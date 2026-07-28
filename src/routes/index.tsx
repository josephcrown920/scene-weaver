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
} from "lucide-react";
import JSZip from "jszip";
import { extractScene } from "@/lib/extract-scene.functions";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { BeforeAfter } from "@/components/scene/BeforeAfter";
import { AssistantPanel } from "@/components/scene/AssistantPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Extract the Scene — remove subjects, keep backdrops" },
      {
        name: "description",
        content:
          "Batch AI tool that strips people from photos and hands back clean plates you can rebuild any shot with.",
      },
      { property: "og:title", content: "Extract the Scene" },
      {
        property: "og:description",
        content: "Batch upload, before/after slider, prompt-driven refinement, ZIP export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Status = "queued" | "processing" | "done" | "error";
type Turn = { instruction: string; ok: boolean };

interface Item {
  id: string;
  name: string;
  original: string;
  result: string | null;
  status: Status;
  error?: string;
  history: Turn[];
  refining: boolean;
}

type Resolution = "original" | "1080" | "720";

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

async function resizeToMaxHeight(dataUrl: string, maxH: number): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  if (img.height <= maxH) return dataUrlToBlob(dataUrl);
  const scale = maxH / img.height;
  const w = Math.round(img.width * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = maxH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, maxH);
  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png", 0.95));
}

async function toExportBlob(dataUrl: string, resolution: Resolution): Promise<Blob> {
  if (resolution === "original") return dataUrlToBlob(dataUrl);
  if (resolution === "1080") return resizeToMaxHeight(dataUrl, 1080);
  return resizeToMaxHeight(dataUrl, 720);
}

function Index() {
  const run = useServerFn(extractScene);
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Resolution>("original");
  const [zipping, setZipping] = useState(false);
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
        })),
      );

      setItems((prev) => [...prev, ...newItems]);
      if (!activeId && newItems[0]) setActiveId(newItems[0].id);

      // Sequential to be gentle on the API (rate limits)
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

  const downloadOne = async (item: Item) => {
    if (!item.result) return;
    const blob = await toExportBlob(item.result, resolution);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${item.name}-scene.png`;
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
      const folder = zip.folder("Extract the Scene")!;
      for (const item of done) {
        const blob = await toExportBlob(item.result!, resolution);
        folder.file(`${item.name}-scene.png`, blob);
        // also include original for reference
        const orig = await dataUrlToBlob(item.original);
        folder.file(`originals/${item.name}.png`, orig);
      }
      const readme =
        "Extract the Scene\n\n" +
        `${done.length} clean plate(s) exported at ${resolution === "original" ? "original resolution" : `${resolution}p max height`}.\n` +
        `Generated ${new Date().toISOString()}\n`;
      folder.file("README.txt", readme);
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Extract the Scene.zip";
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

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Extract the Scene
        </div>
        <div className="flex items-center gap-3">
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
            Export ZIP ({doneCount})
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
                <span className="italic text-neutral-400">Lose the subject.</span>
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-neutral-400 md:text-base">
                Drop in a batch of frames. The AI walks the person out — the car,
                the wall, the light, the grain all stay. Compare with the slider,
                refine with prompts, export the whole set as one ZIP.
              </p>
            </section>
            <UploadZone onFiles={addFiles} inputRef={inputRef} />
            <ComingSoonRow />
          </>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
            {/* Sidebar */}
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

            {/* Detail */}
            <section>
              {!active && (
                <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-dashed border-neutral-800 text-sm text-neutral-500">
                  Select a scene on the left.
                </div>
              )}
              {active && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-lg text-neutral-100">{active.name}</div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                        {active.status === "done"
                          ? `Clean plate ready · ${active.history.length} refinement(s)`
                          : active.status === "processing"
                            ? "Rebuilding scene…"
                            : active.status === "error"
                              ? active.error
                              : "Queued"}
                      </div>
                    </div>
                    {active.status === "done" && active.result && (
                      <button
                        onClick={() => downloadOne(active)}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-600"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download this one
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
                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                      <BeforeAfter beforeSrc={active.original} afterSrc={active.result} />
                      <AssistantPanel
                        history={active.history}
                        busy={active.refining}
                        onSend={(instr) => refine(active.id, instr)}
                      />
                    </div>
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
      title: "Angle & rotation",
      body: "Novel-view synthesis of the clean plate (turn the camera). Needs a 3D-aware model — experimental from a single 2D frame.",
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
