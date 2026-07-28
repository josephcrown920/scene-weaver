import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import {
  Upload,
  Download,
  Loader2,
  Sparkles,
  Trash2,
  Check,
  X,
  Package,
  Video,
  Rotate3d,
  Camera,
  Pencil,
} from "lucide-react";
import JSZip from "jszip";
import { extractScene } from "@/lib/extract-scene.functions";
import { generateAngle } from "@/lib/generate-angle.functions";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { BeforeAfter } from "@/components/scene/BeforeAfter";
import { AssistantPanel } from "@/components/scene/AssistantPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scene Changer — remove subjects, generate new angles" },
      {
        name: "description",
        content:
          "Batch AI tool: strip people from photos, generate alternate camera angles of the clean scene, and export the whole set as a ZIP.",
      },
      { property: "og:title", content: "Scene Changer" },
      {
        property: "og:description",
        content: "Batch upload, before/after slider, alternate angles, prompt refinement, ZIP export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Status = "queued" | "processing" | "done" | "error";
type Turn = { instruction: string; ok: boolean };
type Variant = { id: string; label: string; dataUrl: string };

interface Item {
  id: string;
  name: string;      // display / filename base (editable)
  original: string;
  result: string | null;
  status: Status;
  error?: string;
  history: Turn[];
  refining: boolean;
  variants: Variant[];
  angleBusy: boolean;
}

type Resolution = "original" | "1080" | "720";
type Format = "png" | "jpg";

const ANGLE_PRESETS = [
  "Rotate camera 30° to the left, same subject distance",
  "Rotate camera 30° to the right, same subject distance",
  "Reverse angle — 180° behind the original camera position",
  "High-angle overhead view of the same scene",
  "Wide establishing shot pulled back 3x",
  "Tight close-up on the central prop",
];

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

async function loadImg(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
}

async function toExportBlob(
  dataUrl: string,
  resolution: Resolution,
  format: Format,
): Promise<Blob> {
  const img = await loadImg(dataUrl);
  const maxH =
    resolution === "1080" ? 1080 : resolution === "720" ? 720 : img.height;
  const scale = img.height > maxH ? maxH / img.height : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  if (format === "jpg") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  const q = format === "jpg" ? 0.92 : undefined;
  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), mime, q));
}

function safeName(s: string): string {
  return (s || "scene").replace(/[^\w.-]+/g, "_").slice(0, 80) || "scene";
}

function Index() {
  const run = useServerFn(extractScene);
  const runAngle = useServerFn(generateAngle);
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Resolution>("original");
  const [format, setFormat] = useState<Format>("png");
  const [zipping, setZipping] = useState(false);
  const [customAngle, setCustomAngle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }, []);

  const processItem = useCallback(
    async (item: Item) => {
      patch(item.id, { status: "processing" });
      try {
        const out = await run({ data: { imageDataUrl: item.original } });
        patch(item.id, { status: "done", result: out.imageDataUrl });
      } catch (e) {
        patch(item.id, {
          status: "error",
          error: e instanceof Error ? e.message : "Failed",
        });
      }
    },
    [run, patch],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter((f) => f.type.startsWith("image/") && f.size <= 8 * 1024 * 1024);
      if (valid.length === 0) {
        toast.error("No valid images (max 8MB each).");
        return;
      }
      const skipped = files.length - valid.length;
      if (skipped > 0) toast.warning(`${skipped} file(s) skipped — not an image or over 8MB.`);

      const newItems: Item[] = await Promise.all(
        valid.map(async (f) => ({
          id: crypto.randomUUID(),
          name: f.name.replace(/\.[^.]+$/, ""),
          original: await fileToDataUrl(f),
          result: null,
          status: "queued" as const,
          history: [],
          refining: false,
          variants: [],
          angleBusy: false,
        })),
      );

      setItems((prev) => [...prev, ...newItems]);
      if (!activeId && newItems[0]) setActiveId(newItems[0].id);

      for (const it of newItems) {
        await processItem(it);
      }
    },
    [activeId, processItem],
  );

  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const rename = (id: string, name: string) => {
    patch(id, { name });
  };

  const refine = useCallback(
    async (id: string, instruction: string) => {
      const item = items.find((i) => i.id === id);
      if (!item || !item.result) return;
      patch(id, { refining: true });
      try {
        const out = await run({
          data: { imageDataUrl: item.result, instruction },
        });
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  result: out.imageDataUrl,
                  refining: false,
                  history: [...it.history, { instruction, ok: true }],
                }
              : it,
          ),
        );
      } catch (e) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  refining: false,
                  history: [...it.history, { instruction, ok: false }],
                }
              : it,
          ),
        );
        toast.error(e instanceof Error ? e.message : "Refine failed");
      }
    },
    [items, patch, run],
  );

  const genAngle = useCallback(
    async (id: string, angle: string) => {
      const item = items.find((i) => i.id === id);
      if (!item || !item.result) return;
      patch(id, { angleBusy: true });
      try {
        const out = await runAngle({ data: { imageDataUrl: item.result, angle } });
        const v: Variant = {
          id: crypto.randomUUID(),
          label: angle.length > 40 ? angle.slice(0, 40) + "…" : angle,
          dataUrl: out.imageDataUrl,
        };
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, angleBusy: false, variants: [...it.variants, v] } : it,
          ),
        );
      } catch (e) {
        patch(id, { angleBusy: false });
        toast.error(e instanceof Error ? e.message : "Angle generation failed");
      }
    },
    [items, patch, runAngle],
  );

  const removeVariant = (itemId: string, variantId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, variants: it.variants.filter((v) => v.id !== variantId) } : it,
      ),
    );
  };

  const downloadOne = async (dataUrl: string, filename: string) => {
    const blob = await toExportBlob(dataUrl, resolution, format);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName(filename)}.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadZip = async () => {
    const done = items.filter((i) => i.status === "done" && i.result);
    if (done.length === 0) {
      toast.error("Nothing done yet.");
      return;
    }
    setZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("scene changer")!;
      for (const item of done) {
        const base = safeName(item.name);
        const sub = folder.folder(base)!;
        const blob = await toExportBlob(item.result!, resolution, format);
        sub.file(`${base}-scene.${format}`, blob);
        const orig = await dataUrlToBlob(item.original);
        sub.file(`${base}-original.png`, orig);
        for (let i = 0; i < item.variants.length; i++) {
          const v = item.variants[i];
          const vb = await toExportBlob(v.dataUrl, resolution, format);
          sub.file(`${base}-angle-${i + 1}.${format}`, vb);
        }
      }
      const readme =
        "Scene Changer\n\n" +
        `${done.length} scene(s) at ${resolution === "original" ? "original resolution" : `${resolution}p max height`}, format: ${format.toUpperCase()}.\n` +
        `Generated ${new Date().toISOString()}\n`;
      folder.file("README.txt", readme);
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "scene changer.zip";
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Exported ${done.length} scene(s)`);
    } finally {
      setZipping(false);
    }
  };

  const active = items.find((i) => i.id === activeId) ?? null;
  const doneCount = items.filter((i) => i.status === "done").length;
  const anyProcessing = items.some((i) => i.status === "processing" || i.status === "queued");

  return (
    <div className="min-h-screen bg-[oklch(0.14_0.02_260)] text-neutral-100">
      <Toaster theme="dark" />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Scene Changer
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FormatPicker value={format} onChange={setFormat} />
          <ResolutionPicker value={resolution} onChange={setResolution} />
          <button
            onClick={downloadZip}
            disabled={doneCount === 0 || zipping}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {zipping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            scene changer.zip ({doneCount})
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-24">
        {items.length === 0 && (
          <>
            <section className="mb-10 max-w-3xl">
              <h1 className="font-serif text-5xl leading-[1.02] tracking-tight text-neutral-50 md:text-7xl">
                Keep the scene.
                <br />
                <span className="italic text-neutral-400">Change the angle.</span>
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-neutral-400 md:text-base">
                Drop in a batch of frames. Walk the subject out, then generate
                alternate camera angles of the same environment. Refine with
                prompts. Export as PNG or JPG in one ZIP.
              </p>
            </section>
            <UploadZone onFiles={addFiles} inputRef={inputRef} />
            <ComingSoonRow />
          </>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-2">
              <UploadTile onFiles={addFiles} inputRef={inputRef} compact />
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setActiveId(it.id)}
                  className={`group flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                    activeId === it.id
                      ? "border-emerald-400/60 bg-emerald-400/5"
                      : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700"
                  }`}
                >
                  <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded bg-neutral-900">
                    <img
                      src={it.result ?? it.original}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {it.status === "processing" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-neutral-200">{it.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest">
                      {it.status === "done" && (
                        <span className="text-emerald-400">
                          <Check className="inline h-3 w-3" /> Ready
                          {it.variants.length > 0 && (
                            <span className="ml-1 text-neutral-500">
                              · {it.variants.length} angle{it.variants.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </span>
                      )}
                      {it.status === "processing" && (
                        <span className="text-neutral-400">Processing</span>
                      )}
                      {it.status === "queued" && (
                        <span className="text-neutral-500">Queued</span>
                      )}
                      {it.status === "error" && (
                        <span className="text-red-400">
                          <X className="inline h-3 w-3" /> Error
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(it.id);
                    }}
                    className="rounded p-1 text-neutral-600 opacity-0 hover:bg-neutral-800 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))}
            </aside>

            <section>
              {!active && (
                <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-dashed border-neutral-800 text-sm text-neutral-500">
                  Select a scene on the left.
                </div>
              )}
              {active && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <FilenameEditor
                        value={active.name}
                        onChange={(v) => rename(active.id, v)}
                      />
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                        {active.status === "done"
                          ? `Clean plate · ${active.history.length} refinement(s) · ${active.variants.length} angle(s)`
                          : active.status === "processing"
                            ? "Rebuilding scene…"
                            : active.status === "error"
                              ? active.error
                              : "Queued"}
                      </div>
                    </div>
                    {active.status === "done" && active.result && (
                      <button
                        onClick={() => downloadOne(active.result!, `${active.name}-scene`)}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-600"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download .{format}
                      </button>
                    )}
                  </div>

                  {active.status === "processing" && (
                    <div className="flex h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 text-neutral-400">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <p className="font-mono text-xs uppercase tracking-[0.2em]">
                        Rebuilding scene…
                      </p>
                    </div>
                  )}

                  {active.status === "error" && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-300">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-red-400">
                        Failed
                      </div>
                      <div className="mt-1">{active.error}</div>
                      <button
                        onClick={() => processItem(active)}
                        className="mt-3 rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {active.status === "done" && active.result && (
                    <>
                      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                        <BeforeAfter beforeSrc={active.original} afterSrc={active.result} />
                        <AssistantPanel
                          history={active.history}
                          busy={active.refining}
                          onSend={(instr) => refine(active.id, instr)}
                        />
                      </div>

                      <AnglePanel
                        busy={active.angleBusy}
                        customAngle={customAngle}
                        setCustomAngle={setCustomAngle}
                        onGenerate={(a) => genAngle(active.id, a)}
                      />

                      {active.variants.length > 0 && (
                        <div>
                          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                            Generated angles
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {active.variants.map((v, i) => (
                              <div
                                key={v.id}
                                className="group relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/60"
                              >
                                <img src={v.dataUrl} alt={v.label} className="aspect-video w-full object-cover" />
                                <div className="flex items-center justify-between gap-2 p-2 text-[10px] text-neutral-400">
                                  <span className="truncate" title={v.label}>
                                    #{i + 1} · {v.label}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      onClick={() =>
                                        downloadOne(v.dataUrl, `${active.name}-angle-${i + 1}`)
                                      }
                                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                                      aria-label="Download angle"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => removeVariant(active.id, v.id)}
                                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                                      aria-label="Remove angle"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {anyProcessing && (
                <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  Batch processing… {doneCount} of {items.length} done
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function FilenameEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Pencil className="h-3.5 w-3.5 text-neutral-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 truncate bg-transparent text-lg text-neutral-100 outline-none focus:ring-0"
        aria-label="Filename"
      />
    </div>
  );
}

function FormatPicker({ value, onChange }: { value: Format; onChange: (f: Format) => void }) {
  const opts: { v: Format; label: string }[] = [
    { v: "png", label: "PNG (alpha)" },
    { v: "jpg", label: "JPG" },
  ];
  return (
    <div className="flex items-center rounded-full border border-neutral-800 bg-neutral-950 p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1 transition ${
            value === o.v ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ResolutionPicker({
  value,
  onChange,
}: {
  value: Resolution;
  onChange: (r: Resolution) => void;
}) {
  const opts: { v: Resolution; label: string }[] = [
    { v: "original", label: "Original" },
    { v: "1080", label: "1080p" },
    { v: "720", label: "720p" },
  ];
  return (
    <div className="flex items-center rounded-full border border-neutral-800 bg-neutral-950 p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1 transition ${
            value === o.v ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AnglePanel({
  busy,
  customAngle,
  setCustomAngle,
  onGenerate,
}: {
  busy: boolean;
  customAngle: string;
  setCustomAngle: (v: string) => void;
  onGenerate: (angle: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
        <Camera className="h-3 w-3" /> Generate a new angle
        {busy && <Loader2 className="ml-1 h-3 w-3 animate-spin text-emerald-300" />}
      </div>
      <div className="flex flex-wrap gap-2">
        {ANGLE_PRESETS.map((a) => (
          <button
            key={a}
            disabled={busy}
            onClick={() => onGenerate(a)}
            className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 transition hover:border-neutral-600 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {a.split(",")[0]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={customAngle}
          onChange={(e) => setCustomAngle(e.target.value)}
          placeholder="Custom angle prompt — e.g. worm's-eye view from the front bumper"
          className="flex-1 rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
        />
        <button
          disabled={busy || !customAngle.trim()}
          onClick={() => {
            const a = customAngle.trim();
            if (!a) return;
            onGenerate(a);
            setCustomAngle("");
          }}
          className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-medium text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          Generate
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
        Experimental — synthesized from the single clean plate. Results vary; try
        several angles and pick the ones that hold up.
      </p>
    </div>
  );
}

function UploadZone({
  onFiles,
  inputRef,
}: {
  onFiles: (files: File[]) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [hover, setHover] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-20 text-center transition ${
        hover
          ? "border-emerald-400 bg-emerald-400/5"
          : "border-neutral-700 bg-neutral-900/40 hover:border-neutral-500"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 transition group-hover:bg-emerald-400 group-hover:text-neutral-950">
        <Upload className="h-6 w-6" />
      </div>
      <p className="mt-6 text-lg text-neutral-200">Drop images here — one or many</p>
      <p className="mt-1 text-xs text-neutral-500">
        PNG, JPG · up to 8MB each · batch processed sequentially
      </p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/60 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
        <Sparkles className="h-3 w-3" /> Powered by Lovable AI
      </div>
    </label>
  );
}

function UploadTile({
  onFiles,
  inputRef,
  compact,
}: {
  onFiles: (files: File[]) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  compact?: boolean;
}) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-neutral-700 bg-neutral-950/40 p-3 text-neutral-400 transition hover:border-neutral-500 hover:text-neutral-200 ${
        compact ? "" : "py-6"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />
      <Upload className="h-4 w-4" />
      <span className="text-xs">Add more images</span>
    </label>
  );
}

function ComingSoonRow() {
  const items = [
    {
      icon: Video,
      title: "Video scenes",
      body: "Batch clip person-removal with temporal consistency. Needs a Replicate connection (paid credits) — ProPainter or similar.",
    },
    {
      icon: Rotate3d,
      title: "True 3D rotation",
      body: "The current angles are AI-synthesized from a single 2D frame. Full 3D novel-view synthesis needs a NeRF/gaussian-splatting model — planned next.",
    },
  ];
  return (
    <section className="mt-12 grid gap-4 md:grid-cols-2">
      {items.map(({ icon: Icon, title, body }) => (
        <div
          key={title}
          className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-5"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            <Icon className="h-3 w-3" /> Coming next
          </div>
          <div className="text-sm text-neutral-200">{title}</div>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{body}</p>
        </div>
      ))}
    </section>
  );
}
