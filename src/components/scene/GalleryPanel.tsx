import { useMemo, useState } from "react";
import { Download, Film, LayoutGrid, Search } from "lucide-react";
import { GradedImage } from "@/components/scene/GradedImage";
import type { AssetKind, GalleryEntry } from "@/lib/studio-types";

const FILTERS: { key: AssetKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "source", label: "Sources" },
  { key: "plate", label: "Clean plates" },
  { key: "angle", label: "Angles" },
];

export function GalleryPanel({
  entries,
  onDownload,
  onSendToBoard,
  onSendToTimeline,
  onOpenScene,
}: {
  entries: GalleryEntry[];
  onDownload: (e: GalleryEntry) => void;
  onSendToBoard: (e: GalleryEntry) => void;
  onSendToTimeline: (e: GalleryEntry) => void;
  onOpenScene: (itemId: string) => void;
}) {
  const [filter, setFilter] = useState<AssetKind | "all">("all");
  const [scene, setScene] = useState<string>("all");
  const [q, setQ] = useState("");

  const scenes = useMemo(() => {
    const m = new Map<string, string>();
    entries.forEach((e) => m.set(e.itemId, e.itemName));
    return [...m.entries()];
  }, [entries]);

  const shown = entries.filter(
    (e) =>
      (filter === "all" || e.kind === filter) &&
      (scene === "all" || e.itemId === scene) &&
      (q.trim() === "" ||
        `${e.itemName} ${e.label}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const counts = (k: AssetKind | "all") =>
    k === "all" ? entries.length : entries.filter((e) => e.kind === k).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-neutral-800 bg-neutral-950 p-0.5 text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 transition ${
                filter === f.key
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {f.label} <span className="text-neutral-600">{counts(f.key)}</span>
            </button>
          ))}
        </div>

        <select
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-300 outline-none"
          aria-label="Filter by scene"
        >
          <option value="all">All scenes</option>
          {scenes.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search generations"
            className="w-44 bg-transparent text-xs text-neutral-200 outline-none placeholder:text-neutral-600"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex h-[50vh] items-center justify-center rounded-2xl border border-dashed border-neutral-800 text-sm text-neutral-500">
          No generations match these filters yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((e) => (
            <div
              key={e.id}
              className="group overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60"
            >
              <button onClick={() => onOpenScene(e.itemId)} className="block w-full">
                <GradedImage src={e.src} grade={e.grade} className="aspect-video w-full" alt={e.label} />
              </button>
              <div className="p-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
                      e.kind === "plate"
                        ? "bg-emerald-400/10 text-emerald-300"
                        : e.kind === "angle"
                          ? "bg-sky-400/10 text-sky-300"
                          : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {e.kind}
                  </span>
                  <span className="truncate text-[11px] text-neutral-300" title={e.itemName}>
                    {e.itemName}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-neutral-500" title={e.label}>
                  {e.label}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    onClick={() => onDownload(e)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                    aria-label="Download"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onSendToBoard(e)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                    aria-label="Send to storyboard"
                    title="Send to storyboard"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onSendToTimeline(e)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                    aria-label="Send to timeline"
                    title="Send to timeline"
                  >
                    <Film className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
