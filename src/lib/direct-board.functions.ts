import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  treatment: z.string().min(10),
  count: z.number().int().min(2).max(24),
  shotTypes: z.array(z.string()).min(1),
});

export interface DraftShot {
  caption: string;
  shotType: string;
  group: string;
}

/** Turn a treatment / lyrics / brief into an ordered shot list for the board. */
export const directBoard = createServerFn({ method: "POST" })
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
            content: `You are a director breaking a treatment into a shot list.
Reply with JSON only: {"shots":[{"caption":"...","shotType":"...","group":"..."}]}.
caption = one line of on-screen action. shotType must be one of: ${data.shotTypes.join(", ")}.
group = a beat name such as Intro, Verse, Chorus, Bridge, Outro, or an act name that fits the material.`,
          },
          {
            role: "user",
            content: `Treatment / lyrics:\n${data.treatment}\n\nGive exactly ${data.count} shots in play order.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Add credits in your workspace billing.");
      throw new Error(`Director failed [${res.status}]: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let shots: DraftShot[] = [];
    try {
      const parsed = JSON.parse(raw) as { shots?: unknown };
      if (Array.isArray(parsed.shots)) {
        shots = parsed.shots
          .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
          .map((s) => ({
            caption: String(s["caption"] ?? "").slice(0, 240),
            shotType: data.shotTypes.includes(String(s["shotType"]))
              ? String(s["shotType"])
              : data.shotTypes[0],
            group: String(s["group"] ?? "Scene").slice(0, 40),
          }))
          .filter((s) => s.caption.length > 0);
      }
    } catch {
      shots = [];
    }
    if (shots.length === 0) throw new Error("The director returned no shots — try a longer brief.");
    return { shots: shots.slice(0, data.count) };
  });
