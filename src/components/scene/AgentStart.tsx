import { useState, type RefObject } from "react";
import {
  ArrowUp,
  Clapperboard,
  ImagePlus,
  Loader2,
  Move3d,
  Orbit,
  Sparkles,
  Video,
  Wand2,
} from "lucide-react";
import { MOTIONS, type MotionKey } from "@/lib/studio-types";
import showcasePlate from "@/assets/showcase-plate.jpg";
import showcaseAngle from "@/assets/showcase-angle.jpg";
import showcaseGrid from "@/assets/showcase-grid.jpg";
import showcaseFlow from "@/assets/showcase-flow.jpg";

const SHOWCASE = [
  {
    src: showcasePlate,
    title: "Clean the plate",
    body: "Lift the person out and keep the street, the car and the light exactly as shot.",
  },
  {
    src: showcaseAngle,
    title: "New camera angles",
    body: "Re-shoot the same scene from a reverse, low or orbiting view — same world, new lens.",
  },
  {
    src: showcaseGrid,
    title: "Batch a whole set",
    body: "Run one brief across every frame and get a full contact sheet of usable stills.",
  },
  {
    src: showcaseFlow,
    title: "Chain it in Flows",
    body: "Style transfer, multi-character scenes and campaign sets as connected recipes.",
  },
];

const IDEAS = [
  "Walk the person out and keep the street empty",
  "Reverse angle of this shot, same light",
  "Orbit the car and give me 6 frames",
  "Neo-noir grade, then cut a 12s sequence",
];

const AGENT_STEPS = [
  { icon: ImagePlus, label: "Drop frames" },
  { icon: Wand2, label: "Clean the plate" },
  { icon: Orbit, label: "New angles" },
  { icon: Video, label: "Render motion" },
];

export function AgentStart({
  onFiles,
  inputRef,
  prompt,
  onPromptChange,
  onSubmit,
  motion,
  onMotionChange,
  strength,
  onStrengthChange,
  busy,
}: {
  onFiles: (files: FileList | File[]) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  prompt: string;
  onPromptChange: (v: string) => void;
  onSubmit: () => void;
  motion: MotionKey;
  onMotionChange: (m: MotionKey) => void;
  strength: number;
  onStrengthChange: (v: number) => void;
  busy?: boolean;
}) {
  const [over, setOver] = useState(false);

  return (
    <div className="relative mx-auto max-w-4xl pb-16 pt-6 md:pt-14">
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[420px] w-[820px] max-w-[130vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.7_0.2_300/0.35),transparent)] blur-2xl aurora-drift" />

      <div className="flex flex-col items-center text-center">
        <span className="ring-gradient inline-flex items-center gap-2 rounded-full bg-white/5 px-3.5 py-1.5 text-[11px] tracking-wide text-white/70 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> Video agent · online
        </span>
        <h1 className="mt-6 text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">
          <span className="text-gradient">What are we shooting today?</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/50 md:text-base">
          Describe the scene, drop your frames, and pick a camera move. The agent
          cleans the plate, generates the angles, and renders the motion.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
        }}
        className={`ring-gradient mt-10 rounded-3xl bg-[oklch(0.19_0.03_278/0.55)] p-2.5 backdrop-blur-2xl transition ${
          over ? "scale-[1.01] shadow-[0_0_0_4px_oklch(0.7_0.2_300/0.18)]" : ""
        }`}
      >
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          rows={3}
          placeholder="Describe the shot — “empty this street, then orbit right and push in”"
          className="w-full resize-none bg-transparent px-4 pt-3 text-[15px] text-white outline-none placeholder:text-white/30"
        />

        <div className="flex flex-wrap items-center gap-2 px-2 pb-1 pt-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white/75 transition hover:bg-white/10"
          >
            <ImagePlus className="h-3.5 w-3.5" /> Add frames
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/70">
            <Move3d className="h-3.5 w-3.5 text-white/45" />
            <select
              value={motion}
              onChange={(e) => onMotionChange(e.target.value as MotionKey)}
              className="bg-transparent text-xs text-white/80 outline-none [&>option]:bg-[oklch(0.18_0.03_278)]"
              aria-label="Camera motion"
            >
              {MOTIONS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/60">
            Intensity
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={strength}
              onChange={(e) => onStrengthChange(Number(e.target.value))}
              className="h-1 w-24 accent-fuchsia-400"
            />
            <span className="w-8 text-right font-mono text-white/50">
              {Math.round(strength * 100)}
            </span>
          </label>

          <button
            onClick={onSubmit}
            disabled={busy}
            className="btn-lux ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:brightness-110 disabled:opacity-50"
            aria-label="Start"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {IDEAS.map((i) => (
          <button
            key={i}
            onClick={() => onPromptChange(i)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white/90"
          >
            {i}
          </button>
        ))}
      </div>

      <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
        {AGENT_STEPS.map((s, i) => (
          <div key={s.label} className="panel-lux p-4">
            <s.icon className="h-4 w-4 text-white/70" />
            <div className="mt-3 font-mono text-[10px] tracking-[0.2em] text-white/35">
              STEP {i + 1}
            </div>
            <div className="mt-1 text-sm text-white/85">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-white/35">
        <Clapperboard className="h-3.5 w-3.5" />
        Motion renders straight to the timeline as a video export.
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
    </div>
  );
}
