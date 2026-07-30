import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AddInput = z.object({
  sceneDataUrl: z.string().min(20),
  name: z.string().min(1),
  description: z.string().min(1),
  placement: z.string().optional(),
  referenceDataUrl: z.string().optional(),
});

const SwapInput = z.object({
  sceneDataUrl: z.string().min(20),
  target: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  referenceDataUrl: z.string().optional(),
});

type Content =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function generate(content: Content[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      modalities: ["image", "text"],
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add credits in your workspace billing.");
    throw new Error(`AI request failed [${res.status}]: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
  };
  const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("No image returned by the model.");
  return { imageDataUrl: url };
}

export const addCharacter = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => AddInput.parse(raw))
  .handler(async ({ data }) => {
    const text = `First image: the SCENE. ${
      data.referenceDataUrl ? "Second image: an IDENTITY REFERENCE of the character to insert." : ""
    }

Composite a new character into the scene photograph.

Character name: ${data.name}
Character description: ${data.description}
Placement / action: ${data.placement?.trim() || "naturally placed in the scene, believable position and scale"}

Rules:
- Keep the environment, props, framing, lens, perspective and color grade of the scene EXACTLY the same.
- Match the scene's lighting direction, shadow softness, reflections, exposure and film grain on the new character.
- Correct scale and ground contact (feet/shadow anchored to the floor).
${data.referenceDataUrl ? "- Preserve the referenced person's facial identity, hair and build." : ""}
- Photoreal, no text, no watermark. Return only the image.`;

    const content: Content[] = [
      { type: "text", text },
      { type: "image_url", image_url: { url: data.sceneDataUrl } },
    ];
    if (data.referenceDataUrl)
      content.push({ type: "image_url", image_url: { url: data.referenceDataUrl } });

    return generate(content);
  });

export const swapCharacter = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => SwapInput.parse(raw))
  .handler(async ({ data }) => {
    const text = `First image: the SCENE. ${
      data.referenceDataUrl ? "Second image: an IDENTITY REFERENCE of the replacement character." : ""
    }

Replace an existing character in the scene with a different one.

Person to replace: ${data.target}
Replacement name: ${data.name}
Replacement description: ${data.description}

Rules:
- Keep the replaced person's pose, position, scale, framing and occlusions identical.
- Keep the environment, props, lens, perspective, lighting, shadows, reflections, color grade and grain unchanged.
- Only the person's identity, face, body and wardrobe change (unless the description says otherwise).
${data.referenceDataUrl ? "- Preserve the referenced person's facial identity, hair and build." : ""}
- Photoreal, no text, no watermark. Return only the image.`;

    const content: Content[] = [
      { type: "text", text },
      { type: "image_url", image_url: { url: data.sceneDataUrl } },
    ];
    if (data.referenceDataUrl)
      content.push({ type: "image_url", image_url: { url: data.referenceDataUrl } });

    return generate(content);
  });
