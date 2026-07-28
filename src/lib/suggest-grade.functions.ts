import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  imageDataUrl: z.string().min(20),
  presetKeys: z.array(z.string()).min(1),
});

export const suggestGrade = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => Input.parse(raw))
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
              "You are a film colorist. Look at the frame and choose the single best film grade preset for it, then optionally nudge the parameters. Reply ONLY with compact JSON: {\"preset\":\"<key>\",\"note\":\"<max 14 words why>\",\"tweaks\":{\"exposure\":1,\"contrast\":1,\"saturation\":1,\"temp\":0,\"hue\":0,\"diffusion\":0,\"vignette\":0}}. exposure 0.8-1.3, contrast 0.8-1.5, saturation 0-1.6, temp -100..100, hue -30..30, diffusion 0..60, vignette 0..60. Omit tweaks to accept the preset as-is.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Available preset keys: ${data.presetKeys.join(", ")}. Pick the best one for this scene.`,
              },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
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
      throw new Error(`Grade suggestion failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Colorist returned no suggestion.");

    let parsed: { preset?: string; note?: string; tweaks?: Record<string, number> };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw new Error("Colorist returned malformed JSON.");
    }

    const preset =
      parsed.preset && data.presetKeys.includes(parsed.preset) ? parsed.preset : data.presetKeys[0];

    return {
      preset,
      note: (parsed.note ?? "").slice(0, 120),
      tweaks: parsed.tweaks ?? null,
    };
  });
