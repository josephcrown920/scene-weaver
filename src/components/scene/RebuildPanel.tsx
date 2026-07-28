import { useState } from "react";
import { Hammer, Loader2, Undo2, ArrowUpRightSquare } from "lucide-react";

interface Props {
  busy: boolean;
  upscaling: boolean;
  canUndo: boolean;
  onRebuild: (guidance: string) => void;
  onUndo: () => void;
  onUpscale: (factor: "2x" | "4x") => void;
}

const GUIDES = [
  "Be more aggressive — erase any leftover trace of the person",
  "Rebuild the floor and shadows more carefully",
  "Preserve reflections on glass and paint exactly",
  "Reconstruct the background further into the depth of field",
];

export function RebuildPanel({ busy, upscaling, canUndo, onRebuild, onUndo, onUpscale }: Props) {
  const [guidance, setGuidance] = useState("");

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          <Hammer className="h-3 w-3 text-emerald-400" /> Rebuild
          {busy && <Loader2 className="h-3 w-3 animate-spin text-emerald-300" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo || busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-40"
          >
            <Undo2 className="h-3 w-3" /> Undo
          </button>
          <button
            onClick={() => onUpscale("2x")}
            disabled={upscaling || busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40"
          >
            {upscaling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowUpRightSquare className="h-3 w-3" />
            )}
            Upscale 2x
          </button>
          <button
            onClick={() => onUpscale("4x")}
            disabled={upscaling || busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40"
          >
            4x
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {GUIDES.map((g) => (
          <button
            key={g}
            disabled={busy}
            onClick={() => onRebuild(g)}
            className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 transition hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40"
          >
            {g.split("—")[0].trim()}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          placeholder="Rebuild guidance — re-run extraction from the original with these notes"
          className="flex-1 rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
        />
        <button
          disabled={busy}
          onClick={() => {
            onRebuild(guidance.trim());
            setGuidance("");
          }}
          className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-medium text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          Rebuild
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
        Rebuild starts over from the original frame. Undo restores the previous
        clean plate.
      </p>
    </div>
  );
}
