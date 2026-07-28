import { useEffect, useRef, useState } from "react";
import { Film, Loader2, Pause, Play, Plus, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { GradedImage } from "@/components/scene/GradedImage";
import { drawGraded } from "@/lib/grade";
import type { Clip } from "@/lib/studio-types";

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

export function TimelinePanel({
  clips,
  onPatch,
  onRemove,
  onMove,
  onAddAll,
  canAddAll,
}: {
  clips: Clip[];
  onPatch: (id: string, patch: Partial<Clip>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onAddAll: () => void;
  canAddAll: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const total = clips.reduce((a, c) => a + c.duration, 0);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => {
        const next = prev + dt;
        if (next >= total) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, total]);

  let acc = 0;
  let currentIndex = 0;
  for (let i = 0; i < clips.length; i++) {
    if (t < acc + clips[i].duration) {
      currentIndex = i;
      break;
    }
    acc += clips[i].duration;
    currentIndex = i;
  }
  const current = clips[currentIndex];

  const render = async () => {
    if (clips.length === 0) return;
    setRendering(true);
    setProgress(0);
    setVideoUrl(null);
    try {
      const W = 1280;
      const H = 720;
      const FPS = 30;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      const imgs = await Promise.all(clips.map((c) => loadImage(c.src)));

      const stream = canvas.captureStream(FPS);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      const done = new Promise<Blob>((res) => {
        rec.onstop = () => res(new Blob(chunks, { type: "video/webm" }));
      });
      rec.start();

      const totalFrames = Math.max(1, Math.round(total * FPS));
      let frame = 0;
      for (let ci = 0; ci < clips.length; ci++) {
        const clip = clips[ci];
        const img = imgs[ci];
        const frames = Math.max(1, Math.round(clip.duration * FPS));
        for (let f = 0; f < frames; f++) {
          const p = f / frames;
          const zoom = 1.04 + p * 0.08; // slow push-in
          const scale = Math.max(W / img.width, H / img.height) * zoom;
          const dw = img.width * scale;
          const dh = img.height * scale;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);
          ctx.save();
          ctx.translate((W - dw) / 2, (H - dh) / 2);
          drawGraded(ctx, img, dw, dh, clip.grade);
          ctx.restore();

          // cross-fade the first 12 frames from black
          const fade = Math.min(1, f / 10);
          if (fade < 1) {
            ctx.fillStyle = `rgba(0,0,0,${1 - fade})`;
            ctx.fillRect(0, 0, W, H);
          }
          frame++;
          setProgress(frame / totalFrames);
          await new Promise((r) => setTimeout(r, 1000 / FPS));
        }
      }
      rec.stop();
      const blob = await done;
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scene changer sequence.webm";
      a.click();
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          <Film className="h-3 w-3" /> Sequence · {clips.length} clip(s) · {total.toFixed(1)}s
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onAddAll}
            disabled={!canAddAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] text-neutral-200 hover:border-neutral-500 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> Add all clean plates
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={clips.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] text-neutral-200 hover:border-neutral-500 disabled:opacity-40"
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playing ? "Pause" : "Preview"}
          </button>
          <button
            onClick={render}
            disabled={clips.length === 0 || rendering}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-medium text-neutral-950 hover:bg-emerald-300 disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {rendering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Film className="h-3 w-3" />}
            {rendering ? `Rendering ${Math.round(progress * 100)}%` : "Render video"}
          </button>
        </div>
      </div>

      {clips.length === 0 ? (
        <div className="flex h-[50vh] items-center justify-center rounded-2xl border border-dashed border-neutral-800 text-sm text-neutral-500">
          Timeline is empty — send scenes here from the Gallery, or add all clean plates.
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-black">
            {current && (
              <GradedImage
                src={current.src}
                grade={current.grade}
                className="w-full"
                imgClassName="w-full max-h-[52vh] object-contain"
                alt={current.name}
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-900">
              <div
                className="h-full bg-emerald-400 transition-[width] duration-100"
                style={{ width: `${total ? (t / total) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {clips.map((c, i) => (
              <div
                key={c.id}
                className={`w-44 shrink-0 overflow-hidden rounded-xl border ${
                  i === currentIndex ? "border-emerald-400/60" : "border-neutral-800"
                } bg-neutral-950/60`}
              >
                <GradedImage src={c.src} grade={c.grade} className="aspect-video w-full" alt={c.name} />
                <div className="space-y-1.5 p-2">
                  <div className="truncate text-[11px] text-neutral-300" title={c.name}>
                    {i + 1}. {c.name}
                  </div>
                  <label className="block">
                    <div className="flex items-center justify-between text-[10px] text-neutral-500">
                      <span>Duration</span>
                      <span className="font-mono">{c.duration.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={8}
                      step={0.1}
                      value={c.duration}
                      onChange={(e) => onPatch(c.id, { duration: Number(e.target.value) })}
                      className="w-full accent-emerald-400"
                    />
                  </label>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onMove(c.id, -1)}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                        aria-label="Move earlier"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onMove(c.id, 1)}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                        aria-label="Move later"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => onRemove(c.id)}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                      aria-label="Remove clip"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {videoUrl && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                Rendered sequence
              </div>
              <video src={videoUrl} controls className="w-full rounded-lg" />
              <a
                href={videoUrl}
                download="scene changer sequence.webm"
                className="mt-2 inline-block text-[11px] text-emerald-300 hover:underline"
              >
                Download again
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
