import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckSquare, Download, Loader2, Square, Trash2 } from "lucide-react";
import { GradedImage } from "@/components/scene/GradedImage";
import { SHOT_TYPES, type Shot } from "@/lib/studio-types";

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
}) {
  const [title, setTitle] = useState("Scene Changer — Storyboard");
  const selected = shots.filter((s) => s.selected);

  if (shots.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-dashed border-neutral-800 text-center text-sm text-neutral-500">
        Nothing on the board. Send shots here from the Gallery.
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
