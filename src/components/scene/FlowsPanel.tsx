import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Workflow,
  Loader2,
  Download,
  Plus,
  X,
  ImagePlus,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { runFlow } from "@/lib/run-flow.functions";

type Tag = "IMAGE" | "BATCH" | "VIDEO" | "CAMPAIGN";

interface Slot {
  key: string;
  label: string;
  multiple?: boolean;
}

interface Flow {
  id: string;
  name: string;
  tags: Tag[];
  desc: string;
  slots: Slot[];
  prompt: string;
  iterator?: string[];
  batchOverImages?: boolean;
}

const FLOWS: Flow[] = [
  {
    id: "style-transfer",
    name: "Style transfer",
    tags: ["IMAGE"],
    desc: "Use one image as the subject and a second as the style reference, then generate from the combined input.",
    slots: [
      { key: "subject", label: "Subject" },
      { key: "style", label: "Style reference" },
    ],
    prompt:
      "Render the subject in the first image reference using the visual style, color palette, grain and aesthetic of the second (style) reference. Preserve the subject's identity, pose and clothing. Return only the image.",
  },
  {
    id: "multi-character",
    name: "Multi-character scene",
    tags: ["IMAGE"],
    desc: "Place two uploaded references together into a single generated scene.",
    slots: [
      { key: "a", label: "Character A" },
      { key: "b", label: "Character B" },
    ],
    prompt:
      "Place both referenced people together into one believable cinematic scene. Preserve each person's identity, wardrobe and proportions. Match lighting, perspective, shadows and color grade between them. Return only the image.",
  },
  {
    id: "camera-ideation",
    name: "Camera angle ideation",
    tags: ["IMAGE"],
    desc: "Explore the same subject from multiple camera angles or compositions.",
    slots: [{ key: "ref", label: "Reference" }],
    prompt:
      "A grid of 2 x 2 with different camera angles of the attached reference subject, no gridlines. Include a cinematic wide angle, a low angle, a side view and a close-up. Keep the same subject, environment, lighting and grade in every cell.",
  },
  {
    id: "change-element",
    name: "Changing object or element",
    tags: ["IMAGE"],
    desc: "Swap or replace a specific element in a scene while keeping the rest intact.",
    slots: [{ key: "ref", label: "Scene" }],
    prompt:
      "Replace {text} in this scene. Keep every other element, the framing, lens, lighting, shadows, reflections and color grade exactly the same. Return only the image.",
    iterator: ["the car with a matte black sports coupe"],
  },
  {
    id: "thumbnail-variations",
    name: "Thumbnail variations",
    tags: ["IMAGE", "BATCH"],
    desc: "Generate multiple visual options from a brief and upscale for selection.",
    slots: [{ key: "ref", label: "Base image" }],
    prompt:
      "Attached image edited into a thumbnail: {text}. High contrast, strong focal subject, clean composition. Return only the image.",
    iterator: [
      "bold red title overlay, high-contrast hero photo style",
      "cinematic wide landscape shot, minimal text style",
      "illustrated anime-style key art, vibrant palette",
    ],
  },
  {
    id: "batch-bg-removal",
    name: "Batch background removal",
    tags: ["IMAGE", "BATCH"],
    desc: "Remove backgrounds from a set of images and regenerate them in a new scene.",
    slots: [{ key: "set", label: "Image set", multiple: true }],
    prompt:
      "Cut the main subject out of its background and regenerate it inside this new scene: a clean studio backdrop with soft directional light. Preserve the subject exactly. Return only the image.",
    batchOverImages: true,
  },
  {
    id: "text-iterator",
    name: "Text iterator",
    tags: ["IMAGE", "BATCH"],
    desc: "Generate a set of outputs from a list of different prompts.",
    slots: [{ key: "ref", label: "Reference (optional)" }],
    prompt: "{text}",
    iterator: ["", "", ""],
  },
  {
    id: "subject-environments",
    name: "Subject in multiple environments",
    tags: ["VIDEO", "BATCH"],
    desc: "Place a reference subject into different environments and generate a keyframe for each.",
    slots: [{ key: "ref", label: "Subject" }],
    prompt:
      "Attached subject placed in {text}. Shot on 35mm film, shallow depth of field, dreamy cinematic mood, soft grain. Return only the image.",
    iterator: [
      "a sandy beach at golden hour",
      "against a snowy mountain backdrop",
      "lush tropical jungle",
      "an urban rooftop parking at dusk",
    ],
  },
  {
    id: "campaign-set",
    name: "Image to campaign set",
    tags: ["CAMPAIGN", "BATCH"],
    desc: "Turn one hero image into a full campaign set of key visuals.",
    slots: [{ key: "ref", label: "Hero image" }],
    prompt:
      "Campaign key visual from the attached hero image: {text}. Keep the product/subject identity identical. Advertising-grade lighting and composition. Return only the image.",
    iterator: [
      "hero wide shot with copy space on the left",
      "tight detail macro shot",
      "lifestyle shot with human interaction",
      "night shot with neon practicals",
    ],
  },
  {
    id: "chained-scene",
    name: "Chained scene generation",
    tags: ["VIDEO"],
    desc: "Use the last frame of one shot as the start of the next, creating a seamless continuous scene.",
    slots: [{ key: "start", label: "Start frame" }],
    prompt:
      "Continue this shot: {text}. This is the next keyframe in a continuous camera move — keep the same location, lighting, grade and lens. Return only the image.",
    iterator: [
      "camera slowly pushes in",
      "camera continues moving up, higher angle",
      "camera reaches a bird's-eye top view",
    ],
  },
  {
    id: "multi-camera",
    name: "Multi-camera scene set",
    tags: ["VIDEO"],
    desc: "Generate the same scene from multiple reference angles simultaneously.",
    slots: [{ key: "ref", label: "Scene" }],
    prompt:
      "Render the attached scene from this camera: {text}. Identical environment, subject, time of day, lighting and grade — only the camera changes. Return only the image.",
    iterator: ["wide master", "over-the-shoulder", "low front three-quarter", "reverse angle"],
  },
  {
    id: "grid-extract",
    name: "Grid shot extraction",
    tags: ["IMAGE", "BATCH"],
    desc: "Extract individual shots from a generated image grid and iterate on each separately.",
    slots: [{ key: "grid", label: "Image grid" }],
    prompt:
      "From the attached 2x2 image grid, extract {text} and re-render it as a full-frame standalone image at the same quality and grade. Return only the image.",
    iterator: ["cell 1,1", "cell 1,2", "cell 2,1", "cell 2,2"],
  },
];

type Output = { id: string; label: string; dataUrl: string };

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

const TAG_STYLE: Record<Tag, string> = {
  IMAGE: "border-neutral-700 text-neutral-300",
  BATCH: "border-emerald-400/40 text-emerald-300",
  VIDEO: "border-sky-400/40 text-sky-300",
  CAMPAIGN: "border-amber-400/40 text-amber-300",
};

export function FlowsPanel({ seedImage }: { seedImage?: string | null }) {
  const run = useServerFn(runFlow);
  const [flowId, setFlowId] = useState(FLOWS[0].id);
  const flow = FLOWS.find((f) => f.id === flowId)!;

  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [prompt, setPrompt] = useState(FLOWS[0].prompt);
  const [lines, setLines] = useState<string[]>(FLOWS[0].iterator ?? []);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [outputs, setOutputs] = useState<Output[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<Slot | null>(null);

  const select = (f: Flow) => {
    setFlowId(f.id);
    setPrompt(f.prompt);
    setLines(f.iterator ?? []);
    setSlots({});
    setOutputs([]);
  };

  const pick = (slot: Slot) => {
    pendingSlot.current = slot;
    if (fileRef.current) {
      fileRef.current.multiple = !!slot.multiple;
      fileRef.current.value = "";
      fileRef.current.click();
    }
  };

  const onFiles = async (files: File[]) => {
    const slot = pendingSlot.current;
    if (!slot || files.length === 0) return;
    const urls = await Promise.all(files.filter((f) => f.type.startsWith("image/")).map(fileToDataUrl));
    setSlots((p) => ({ ...p, [slot.key]: slot.multiple ? [...(p[slot.key] ?? []), ...urls] : urls.slice(0, 1) }));
  };

  const useSeed = (slot: Slot) => {
    if (!seedImage) return;
    setSlots((p) => ({ ...p, [slot.key]: slot.multiple ? [...(p[slot.key] ?? []), seedImage] : [seedImage] }));
  };

  const clearSlot = (key: string, idx: number) =>
    setSlots((p) => ({ ...p, [key]: (p[key] ?? []).filter((_, i) => i !== idx) }));

  const allImages = flow.slots.flatMap((s) => slots[s.key] ?? []);

  const jobs = (): { label: string; prompt: string; images: string[] }[] => {
    if (flow.batchOverImages) {
      const set = slots[flow.slots[0].key] ?? [];
      return set.map((img, i) => ({ label: `Image ${i + 1}`, prompt, images: [img] }));
    }
    const active = lines.map((l) => l.trim()).filter(Boolean);
    if (prompt.includes("{text}") && active.length > 0) {
      return active.map((t) => ({ label: t, prompt: prompt.replaceAll("{text}", t), images: allImages }));
    }
    return [{ label: flow.name, prompt: prompt.replaceAll("{text}", ""), images: allImages }];
  };

  const execute = async () => {
    const list = jobs();
    if (list.length === 0) return toast.error("Nothing to run — add an image or a prompt line.");
    setBusy(true);
    setOutputs([]);
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      setProgress(`${i + 1} / ${list.length}`);
      try {
        const out = await run({ data: { prompt: list[i].prompt, images: list[i].images } });
        setOutputs((p) => [...p, { id: crypto.randomUUID(), label: list[i].label, dataUrl: out.imageDataUrl }]);
        ok++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Flow step failed");
      }
    }
    setBusy(false);
    setProgress("");
    if (ok > 0) toast.success(`${flow.name} — ${ok} output${ok > 1 ? "s" : ""}`);
  };

  const download = (o: Output, i: number) => {
    const a = document.createElement("a");
    a.href = o.dataUrl;
    a.download = `${flow.id}-${i + 1}.png`;
    a.click();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />

      <aside className="space-y-2">
        <div className="flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
          <Workflow className="h-3 w-3 text-emerald-400" /> Flows
        </div>
        {FLOWS.map((f) => (
          <button
            key={f.id}
            onClick={() => select(f)}
            className={`w-full rounded-lg border p-3 text-left transition ${
              f.id === flowId
                ? "border-emerald-400/60 bg-emerald-400/5"
                : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700"
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-neutral-100">{f.name}</span>
              {f.tags.map((t) => (
                <span
                  key={t}
                  className={`rounded border px-1.5 py-px font-mono text-[8px] tracking-widest ${TAG_STYLE[t]}`}
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{f.desc}</p>
          </button>
        ))}
      </aside>

      <section className="space-y-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
            {flow.name} · inputs
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {flow.slots.map((s) => (
              <div key={s.key} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-300">{s.label}</span>
                  <div className="flex items-center gap-1">
                    {seedImage && (
                      <button
                        onClick={() => useSeed(s)}
                        className="rounded border border-neutral-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                      >
                        Use plate
                      </button>
                    )}
                    <button
                      onClick={() => pick(s)}
                      className="rounded border border-neutral-800 p-1 text-neutral-400 hover:border-neutral-600 hover:text-neutral-100"
                      aria-label={`Upload ${s.label}`}
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(slots[s.key] ?? []).map((u, i) => (
                    <div key={i} className="relative h-14 w-20 overflow-hidden rounded border border-neutral-800">
                      <img src={u} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => clearSlot(s.key, i)}
                        className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-neutral-300 hover:text-red-400"
                        aria-label="Remove"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  {(slots[s.key] ?? []).length === 0 && (
                    <button
                      onClick={() => pick(s)}
                      className="flex h-14 w-20 items-center justify-center rounded border border-dashed border-neutral-800 text-neutral-600 hover:border-neutral-600"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="mt-3 w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs leading-relaxed text-neutral-200 outline-none focus:border-neutral-600"
            aria-label="Flow prompt"
          />
          <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-neutral-600">
            {"{text}"} is replaced by each iterator line
          </p>

          {!flow.batchOverImages && (
            <div className="mt-3 space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Iterator ({lines.filter((l) => l.trim()).length} runs)
              </div>
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={l}
                    onChange={(e) => setLines((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="prompt variation…"
                    className="flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                  />
                  <button
                    onClick={() => setLines((p) => p.filter((_, j) => j !== i))}
                    className="rounded p-1 text-neutral-600 hover:text-red-400"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setLines((p) => [...p, ""])}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-800 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
              >
                <Plus className="h-3 w-3" /> Add text
              </button>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={execute}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run flow
            </button>
            {busy && <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{progress}</span>}
          </div>
        </div>

        {outputs.length > 0 && (
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              Outputs
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {outputs.map((o, i) => (
                <div key={o.id} className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/60">
                  <img src={o.dataUrl} alt={o.label} className="aspect-video w-full object-cover" />
                  <div className="flex items-center justify-between gap-2 p-2 text-[10px] text-neutral-400">
                    <span className="truncate" title={o.label}>
                      #{i + 1} · {o.label}
                    </span>
                    <button
                      onClick={() => download(o, i)}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                      aria-label="Download output"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
