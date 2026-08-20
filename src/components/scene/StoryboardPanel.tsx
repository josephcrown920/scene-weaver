import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Download,
  Loader2,
  Megaphone,
  Square,
  Trash2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GradedImage } from "@/components/scene/GradedImage";
import { directBoard } from "@/lib/direct-board.functions";
import { SCENE_GROUPS, SHOT_TYPES, type Shot } from "@/lib/studio-types";

export function StoryboardPanel({
  shots,
  onPatch,
  onRemove,
  onMove,
  onToggle,
  onToggleAll,
  onExport,
  onExportZip,
  exporting,
  onApplyDrafts,
}: {
  shots: Shot[];
  onPatch: (id: string, patch: Partial<Shot>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onToggle: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onExport: (title: string) => void;
  onExportZip: (title: string) => void;
  exporting: string | null;
  onApplyDrafts: (drafts: { caption: string; shotType: string; group: string }[]) => void;
}) {
  const [title, setTitle] = useState("Scene Changer — Storyboard");
  const [treatment, setTreatment] = useState("");
  const [beats, setBeats] = useState(10);
  const [directing, setDirecting] = useState(false);
  const direct = useServerFn(directBoard);
  const selected = shots.filter((s) => s.selected);

  const runDirector = async () => {
    if (treatment.trim().length < 10) return;
    setDirecting(true);
    try {
      const res = await direct({
        data: { treatment: treatment.trim(), count: beats, shotTypes: SHOT_TYPES },
      });
      onApplyDrafts(res.shots);
      toast.success(`Director drafted ${res.shots.length} shots`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Director failed");
    } finally {
      setDirecting(false);
    }
  };

  const director = (
    <div className="panel-lux space-y-2 rounded-2xl p-3">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
        <Megaphone className="h-3 w-3" /> Director — paste a treatment or lyrics
      </div>
      <textarea
        value={treatment}
        onChange={(e) => setTreatment(e.target.value)}
        rows={3}
        placeholder="Paste the treatment, lyrics or brief and the director will break it into ordered shots with beats."
        className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[11px] text-neutral-400">
          Shots
          <input
            type="number"
            min={2}
            max={24}
            value={beats}
            onChange={(e) => setBeats(Math.max(2, Math.min(24, Number(e.target.value))))}
            className="w-16 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-neutral-100 outline-none"
          />
        </label>
        <button
          onClick={runDirector}
          disabled={directing || treatment.trim().length < 10}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-neutral-200 hover:border-white/25 disabled:opacity-40"
        >
          {directing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
          Draft board
        </button>
        <span className="text-[10px] text-neutral-600">
          Frames are pulled from your gallery in order — regenerate any shot from Create.
        </span>
      </div>
    </div>
  );

  if (shots.length === 0) {
    return (
      <div className="space-y-4">
        {director}
        <div className="flex h-[40vh] items-center justify-center rounded-2xl border border-dashed border-neutral-800 text-center text-sm text-neutral-500">
          Nothing on the board. Send shots here from the Gallery, or draft one above.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {director}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-lg text-neutral-100 outline-none"
          aria-label="Storyboard title"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            {selected.length} of {shots.length} selected
          </span>
          <button
            onClick={() => onToggleAll(selected.length !== shots.length)}
            className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] text-neutral-200 hover:border-neutral-500"
          >
            {selected.length === shots.length ? "Deselect all" : "Select all"}
          </button>
          <button
            onClick={() => onExportZip(title)}
            disabled={selected.length === 0 || !!exporting}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] text-neutral-200 hover:border-neutral-500 disabled:opacity-40"
          >
            {exporting === "zip" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Export selected (ZIP)
          </button>
          <button
            onClick={() => onExport(title)}
            disabled={selected.length === 0 || !!exporting}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-medium text-neutral-950 hover:bg-emerald-300 disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {exporting === "sheet" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Export contact sheet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shots.map((s, i) => (
          <div
            key={s.id}
            className={`overflow-hidden rounded-xl border transition ${
              s.selected ? "border-emerald-400/60 bg-emerald-400/5" : "border-neutral-800 bg-neutral-950/60"
            }`}
          >
            <div className="relative">
              <GradedImage src={s.src} grade={s.grade} className="aspect-video w-full" alt={s.caption} />
              <button
                onClick={() => onToggle(s.id)}
                className="absolute left-2 top-2 rounded bg-black/70 p-1 text-neutral-200 hover:text-emerald-300"
                aria-label={s.selected ? "Deselect shot" : "Select shot"}
              >
                {s.selected ? (
                  <CheckSquare className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-neutral-200">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="space-y-2 p-2">
              <select
                value={s.shotType}
                onChange={(e) => onPatch(s.id, { shotType: e.target.value })}
                className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-300 outline-none"
                aria-label="Shot type"
              >
                {SHOT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select
                value={s.group ?? "Scene"}
                onChange={(e) => onPatch(s.id, { group: e.target.value })}
                className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-400 outline-none"
                aria-label="Scene group"
              >
                {SCENE_GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <textarea
                value={s.caption}
                onChange={(e) => onPatch(s.id, { caption: e.target.value })}
                rows={2}
                placeholder="Action / description"
                className="w-full resize-none rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-200 outline-none placeholder:text-neutral-600"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onMove(s.id, -1)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                    aria-label="Move left"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onMove(s.id, 1)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                    aria-label="Move right"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => onRemove(s.id)}
                  className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                  aria-label="Remove shot"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
