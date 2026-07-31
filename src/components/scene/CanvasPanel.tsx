import { useEffect, useRef, useState } from "react";
import { Download, Film, LayoutGrid, Maximize2, Minus, Plus, Shuffle } from "lucide-react";
import { GradedImage } from "@/components/scene/GradedImage";
import type { GalleryEntry } from "@/lib/studio-types";

type Pos = { x: number; y: number };

const CARD_W = 300;
const CARD_H = 190;
const GAP = 40;
const COLS = 5;

function gridPos(i: number): Pos {
  return {
    x: (i % COLS) * (CARD_W + GAP),
    y: Math.floor(i / COLS) * (CARD_H + GAP),
  };
}

export function CanvasPanel({
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
  const [pos, setPos] = useState<Record<string, Pos>>({});
  const [pan, setPan] = useState<Pos>({ x: 80, y: 60 });
  const [zoom, setZoom] = useState(0.75);
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ id: string | null; sx: number; sy: number; ox: number; oy: number } | null>(
    null,
  );

  useEffect(() => {
    setPos((prev) => {
      const next = { ...prev };
      let changed = false;
      entries.forEach((e, i) => {
        if (!next[e.id]) {
          next[e.id] = gridPos(i);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [entries]);

  const relayout = () => {
    const next: Record<string, Pos> = {};
    entries.forEach((e, i) => (next[e.id] = gridPos(i)));
    setPos(next);
    setPan({ x: 80, y: 60 });
    setZoom(0.75);
  };

  const onPointerDown = (ev: React.PointerEvent, id: string | null) => {
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    const base = id ? (pos[id] ?? { x: 0, y: 0 }) : pan;
    drag.current = { id, sx: ev.clientX, sy: ev.clientY, ox: base.x, oy: base.y };
    if (id) setSelected(id);
  };

  const onPointerMove = (ev: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (ev.clientX - d.sx) / (d.id ? zoom : 1);
    const dy = (ev.clientY - d.sy) / (d.id ? zoom : 1);
    if (d.id) {
      const id = d.id;
      setPos((p) => ({ ...p, [id]: { x: d.ox + dx, y: d.oy + dy } }));
    } else {
      setPan({ x: d.ox + dx, y: d.oy + dy });
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onWheel = (ev: React.WheelEvent) => {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    setZoom((z) => Math.min(2, Math.max(0.25, z - ev.deltaY * 0.002)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-neutral-500">
          Drag cards to arrange · drag empty space to pan · ⌘/Ctrl + scroll to zoom
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-950 p-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.15))}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-12 text-center font-mono text-[11px] text-neutral-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Reset zoom"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={relayout}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Re-tile canvas"
            title="Re-tile"
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        onPointerDown={(e) => onPointerDown(e, null)}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        className="relative h-[72vh] cursor-grab touch-none overflow-hidden rounded-2xl border border-neutral-800 bg-[oklch(0.16_0.02_260)] active:cursor-grabbing"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {entries.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            Generate something and it lands here on the canvas.
          </div>
        )}

        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {entries.map((e) => {
            const p = pos[e.id] ?? { x: 0, y: 0 };
            const isSel = selected === e.id;
            return (
              <div
                key={e.id}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  onPointerDown(ev, e.id);
                }}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                className={`absolute cursor-grab overflow-hidden rounded-xl border bg-neutral-950/80 shadow-lg shadow-black/40 transition-colors active:cursor-grabbing ${
                  isSel ? "border-emerald-400/70" : "border-neutral-800 hover:border-neutral-700"
                }`}
                style={{ left: p.x, top: p.y, width: CARD_W }}
              >
                <GradedImage
                  src={e.src}
                  grade={e.grade}
                  alt={e.label}
                  className="pointer-events-none aspect-video w-full"
                />
                <div className="flex items-center gap-1.5 px-2 py-1.5">
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
                  <div className="ml-auto flex items-center gap-0.5">
                    <button
                      onClick={() => onDownload(e)}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                      title="Download"
                      aria-label="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onSendToBoard(e)}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                      title="Send to storyboard"
                      aria-label="Send to storyboard"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onSendToTimeline(e)}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                      title="Send to timeline"
                      aria-label="Send to timeline"
                    >
                      <Film className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onOpenScene(e.itemId)}
                      className="rounded px-1.5 py-1 text-[10px] text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                      title="Open scene"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
