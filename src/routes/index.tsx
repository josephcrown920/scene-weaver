import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import { Upload, Download, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { extractScene } from "@/lib/extract-scene.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scene Extractor — remove the subject, keep the backdrop" },
      {
        name: "description",
        content:
          "Upload a photo and get back the clean scene with people removed — perfect for rebuilding any environment into your own project.",
      },
      { property: "og:title", content: "Scene Extractor" },
      {
        property: "og:description",
        content: "Remove people from any photo and keep the environment intact.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function Index() {
  const run = useServerFn(extractScene);
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("That's not an image.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error("Image is larger than 8MB. Try a smaller one.");
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      setOriginal(dataUrl);
      setResult(null);
      setBusy(true);
      try {
        const out = await run({ data: { imageDataUrl: dataUrl } });
        setResult(out.imageDataUrl);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [run],
  );

  const reset = () => {
    setOriginal(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-[oklch(0.14_0.02_260)] text-neutral-100">
      <Toaster theme="dark" />

      {/* ambient grain */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Scene Extractor
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
          v0.1 · beta
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="mb-14 max-w-3xl">
          <h1 className="font-serif text-5xl leading-[1.02] tracking-tight text-neutral-50 md:text-7xl">
            Keep the scene.
            <br />
            <span className="italic text-neutral-400">Lose the subject.</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-neutral-400 md:text-base">
            Drop in a frame from any video or photo. The person walks out — the
            car, the wall, the light, the grain all stay. Rebuild the shot with
            your own subject.
          </p>
        </section>

        {!original && (
          <UploadZone onFile={handleFile} inputRef={inputRef} />
        )}

        {original && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Panel label="Source">
                <img src={original} alt="original" className="h-full w-full object-contain" />
              </Panel>
              <Panel label="Clean plate">
                {busy && (
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-neutral-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p className="font-mono text-xs uppercase tracking-[0.2em]">
                      Rebuilding scene…
                    </p>
                    <p className="max-w-xs text-center text-xs text-neutral-500">
                      Usually 10–25 seconds depending on complexity.
                    </p>
                  </div>
                )}
                {!busy && result && (
                  <img src={result} alt="scene" className="h-full w-full object-contain" />
                )}
                {!busy && !result && (
                  <div className="flex h-full min-h-[280px] items-center justify-center text-xs text-neutral-500">
                    Nothing yet.
                  </div>
                )}
              </Panel>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={reset}
                className="rounded-full bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                New image
              </Button>
              {result && !busy && (
                <a
                  href={result}
                  download="scene.png"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-300"
                >
                  <Download className="h-4 w-4" />
                  Download scene
                </a>
              )}
            </div>
          </div>
        )}

        <section className="mt-24 grid gap-6 border-t border-neutral-800 pt-10 text-xs text-neutral-500 md:grid-cols-3">
          <Step n="01" title="Upload a frame">
            Any still — screenshot from a video, photo, whatever.
          </Step>
          <Step n="02" title="AI clears the subject">
            People are removed. Lighting, grain, and geometry stay intact.
          </Step>
          <Step n="03" title="Drop yourself in">
            Take the clean plate into Photoshop, CapCut, After Effects — rebuild
            the shot.
          </Step>
        </section>
      </main>
    </div>
  );
}

function UploadZone({
  onFile,
  inputRef,
}: {
  onFile: (f: File) => void;
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
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
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
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 transition group-hover:bg-emerald-400 group-hover:text-neutral-950">
        <Upload className="h-6 w-6" />
      </div>
      <p className="mt-6 text-lg text-neutral-200">Drop an image here</p>
      <p className="mt-1 text-xs text-neutral-500">
        or click to browse · PNG, JPG · up to 8MB
      </p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/60 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
        <Sparkles className="h-3 w-3" /> Powered by Lovable AI
      </div>
    </label>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/60">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
          {label}
        </span>
      </div>
      <div className="flex min-h-[280px] items-center justify-center bg-[repeating-conic-gradient(#1a1a1a_0_25%,#111_0_50%)] [background-size:20px_20px]">
        {children}
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.3em] text-emerald-400">{n}</div>
      <h3 className="mt-2 text-sm font-medium text-neutral-200">{title}</h3>
      <p className="mt-1 leading-relaxed">{children}</p>
    </div>
  );
}
