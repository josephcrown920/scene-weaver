import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  referenceDataUrl: z.string().min(20),
  prompt: z.string().min(3),
  aspect: z.enum(["4:5", "1:1", "9:16", "16:9"]).default("4:5"),
  /**
   * Consent gate — the caller must confirm the reference photo is their own
   * likeness, or one they hold documented commercial consent for. Generating
   * variations of an arbitrary person's photo is identity misuse.
   */
  consentConfirmed: z.literal(true),
});

const IdeasInput = z.object({
  direction: z.string().min(3),
  count: z.number().int().min(1).max(30),
});

export const generateVariation = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const text = `Photo variation of the SAME person in the reference image.
Keep the identity, facial structure, skin tone, hair and body proportions exactly consistent — this is the same individual in a new shot, not a new person.
Variation brief: ${data.prompt}
Frame it ${data.aspect}, natural photographic lighting, sharp focus, no text or watermark.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text },
              { type: "image_url", image_url: { url: data.referenceDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Add credits in your workspace billing.");
      throw new Error(`Variation failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
    };
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("No image returned by the model.");
    return { imageDataUrl: url };
  });

/** Expand a one-line direction into N distinct variation briefs. */
export const suggestVariationPrompts = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => IdeasInput.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              'You write short photo-variation briefs. Reply with JSON only: {"prompts":["...","..."]}. Each brief is one line describing outfit, setting, lighting and framing for the same person. No names, no identity changes.',
          },
          { role: "user", content: `Direction: ${data.direction}\nGive exactly ${data.count} distinct briefs.` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Add credits in your workspace billing.");
      throw new Error(`Prompt ideas failed [${res.status}]: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let prompts: string[] = [];
    try {
      const parsed = JSON.parse(raw) as { prompts?: unknown };
      if (Array.isArray(parsed.prompts))
        prompts = parsed.prompts.filter((p): p is string => typeof p === "string");
    } catch {
      prompts = [];
    }
    return { prompts: prompts.slice(0, data.count) };
  });
