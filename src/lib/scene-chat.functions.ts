import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Msg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const Input = z.object({
  messages: z.array(Msg).min(1),
  sceneName: z.string().optional(),
  hasResult: z.boolean().optional(),
  variantCount: z.number().optional(),
});

const SYSTEM = `You are the Scene Changer assistant — a terse, technical VFX/plate-cleanup copilot inside an app that removes people from photos, generates alternate camera angles, upscales, and exports batches.

You reply in JSON with:
- "reply": a short (1-3 sentence) helpful answer in plain language.
- "action": one of "none", "refine", "angle", "upscale", "rebuild".
- "instruction": when action is "refine", "angle" or "rebuild", the exact prompt text the image model should receive. Empty string otherwise.

Guidance:
- If the user asks to change the cleaned plate (remove a shadow, fix a reflection, clean an artifact), use action "refine".
- If they ask for a new camera view/angle/rotation, use action "angle" and write a precise camera-move instruction.
- If they ask for sharper/bigger/higher-res, use action "upscale".
- If they want to start the extraction over with different guidance, use action "rebuild".
- If they just ask a question, use action "none".
Never mention model or provider names.`;

export const sceneChat = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const context = `Active scene: ${data.sceneName ?? "untitled"}. Clean plate ready: ${
      data.hasResult ? "yes" : "no"
    }. Generated angles so far: ${data.variantCount ?? 0}.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: `${SYSTEM}\n\n${context}` },
          ...data.messages,
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "scene_reply",
            strict: true,
            schema: {
              type: "object",
              properties: {
                reply: { type: "string" },
                action: {
                  type: "string",
                  enum: ["none", "refine", "angle", "upscale", "rebuild"],
                },
                instruction: { type: "string" },
              },
              required: ["reply", "action", "instruction"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Add credits in your workspace billing.");
      throw new Error(`Chat failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(raw) as {
        reply: string;
        action: "none" | "refine" | "angle" | "upscale" | "rebuild";
        instruction: string;
      };
      return parsed;
    } catch {
      return { reply: raw || "…", action: "none" as const, instruction: "" };
    }
  });
