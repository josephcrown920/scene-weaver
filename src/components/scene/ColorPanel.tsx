import { useState } from "react";
import { Loader2, Palette, Sparkles, Wand2, RotateCcw } from "lucide-react";
import { PRESETS, NEUTRAL_GRADE, presetByKey, type Grade } from "@/lib/grade";
import { GradedImage } from "@/components/scene/GradedImage";

export interface ColorScene {
  id: string;
  name: string;
  src: string;
  grade: Grade;
  gradeNote?: string;
  gradePreset?: string;
  grading?: boolean;
}

const SLIDERS: {
  key: keyof Grade;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}[] = [
  { key: "exposure", label: "Exposure", min: 0.5, max: 1.6, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: "contrast", label: "Contrast", min: 0.5, max: 1.8, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: "temp", label: "Temperature", min: -100, max: 100, step: 1, fmt: (v) => `${v}` },
  { key: "hue", label: "Hue shift", min: -60, max: 60, step: 1, fmt: (v) => `${v}°` },
  { key: "diffusion", label: "Diffusion", min: 0, max: 100, step: 1, fmt: (v) => `${v}` },
  { key: "vignette", label: "Vignette", min: 0, max: 100, step: 1, fmt: (v) => `${v}` },
];

export function ColorPanel({
  scenes,
  activeId,
  onSelect,
  onGrade,
  onAutoGrade,
  onAutoGradeAll,
  autoAllBusy,
}: {
  scenes: ColorScene[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onGrade: (id: string, grade: Grade, presetKey?: string, note?: string) => void;
  onAutoGrade: (id: string) => void;
  onAutoGradeAll: () => void;
  autoAllBusy: boolean;
}) {
  const active = scenes.find((s) => s.id === activeId) ?? scenes[0] ?? null;
  const [copyBusy, setCopyBusy] = useState(false);

  if (!active) {
    return (
      <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-dashed border-neutral-800 text-sm text-neutral-500">
        Extract a scene first — then grade it here.
      </div>
    );
  }

  const set = (k: keyof Grade, v: number) =>
    onGrade(active.id, { ...active.grade, [k]: v }, "custom", active.gradeNote);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <GradedImage
          src={active.src}
          grade={active.grade}
          alt={`${active.name} graded preview`}
          className="rounded-2xl border border-neutral-800 bg-black"
          imgClassName="w-full object-contain max-h-[58vh]"
        />

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              <Palette className="h-3 w-3" /> Film presets
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAutoGrade(active.id)}
                disabled={active.grading}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-medium text-neutral-950 hover:bg-emerald-300 disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                {active.grading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="h-3 w-3" />
                )}
                AI pick for this scene
              </button>
              <button
                onClick={onAutoGradeAll}
                disabled={autoAllBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] text-neutral-200 hover:border-neutral-500 disabled:opacity-40"
              >
                {autoAllBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                AI grade all scenes
              </button>
            </div>
          </div>

          {active.gradeNote && (
            <p className="mb-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-[11px] text-emerald-200">
              Colorist: {active.gradeNote}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => onGrade(active.id, { ...p.grade }, p.key, p.blurb)}
                className={`overflow-hidden rounded-lg border text-left transition ${
                  active.gradePreset === p.key
                    ? "border-emerald-400/60 bg-emerald-400/5"
                    : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-600"
                }`}
              >
                <GradedImage
                  src={active.src}
                  grade={p.grade}
                  className="aspect-video w-full"
                  alt={`${p.label} preview`}
                />
                <div className="p-2">
                  <div className="text-[11px] text-neutral-200">{p.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-neutral-500">
                    {p.blurb}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
            Scenes
          </div>
          <div className="grid grid-cols-3 gap-2">
            {scenes.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`relative overflow-hidden rounded-md border ${
                  s.id === active.id ? "border-emerald-400/60" : "border-neutral-800"
                }`}
                title={s.name}
              >
                <GradedImage src={s.src} grade={s.grade} className="aspect-video w-full" />
                {s.grading && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 className="h-3 w-3 animate-spin text-emerald-300" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              Manual grade
            </span>
            <button
              onClick={() => onGrade(active.id, { ...NEUTRAL_GRADE }, "neutral", "")}
              className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-200"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>
          <div className="space-y-3">
            {SLIDERS.map((s) => (
              <label key={s.key} className="block">
                <div className="flex items-center justify-between text-[10px] text-neutral-400">
                  <span>{s.label}</span>
                  <span className="font-mono text-neutral-500">{s.fmt(active.grade[s.key])}</span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={active.grade[s.key]}
                  onChange={(e) => set(s.key, Number(e.target.value))}
                  className="mt-1 w-full accent-emerald-400"
                />
              </label>
            ))}
          </div>
          <button
            onClick={() => {
              setCopyBusy(true);
              scenes.forEach((s) =>
                onGrade(s.id, { ...active.grade }, active.gradePreset, active.gradeNote),
              );
              setTimeout(() => setCopyBusy(false), 400);
            }}
            className="mt-4 w-full rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-[11px] text-neutral-200 hover:border-neutral-500"
          >
            {copyBusy ? "Applied" : "Apply this grade to all scenes"}
          </button>
          <p className="mt-2 text-[10px] leading-snug text-neutral-600">
            The grade is baked into downloads, the ZIP, the storyboard sheet and the rendered video.
            Preset in use: {presetByKey(active.gradePreset ?? "")?.label ?? "Custom"}.
          </p>
        </div>
      </aside>
    </div>
  );
}
