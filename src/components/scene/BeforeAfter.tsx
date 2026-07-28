import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

interface Props {
  beforeSrc: string;
  afterSrc: string;
}

export function BeforeAfter({ beforeSrc, afterSrc }: Props) {
  const [pct, setPct] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingHandle = useRef(false);
  const panning = useRef<{ x: number; y: number } | null>(null);

  const clampPct = (v: number) => Math.max(0, Math.min(100, v));

  const onHandleMove = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPct(clampPct(((clientX - rect.left) / rect.width) * 100));
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (draggingHandle.current) {
        const x = "touches" in e ? e.touches[0].clientX : e.clientX;
        onHandleMove(x);
      } else if (panning.current) {
        const x = "touches" in e ? e.touches[0].clientX : e.clientX;
        const y = "touches" in e ? e.touches[0].clientY : e.clientY;
        setPan({ x: x - panning.current.x, y: y - panning.current.y });
      }
    };
    const up = () => {
      draggingHandle.current = false;
      panning.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [onHandleMove]);

  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPct(50);
  };

  const startPan = (e: React.MouseEvent | React.TouchEvent) => {
    if (zoom <= 1) return;
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    panning.current = { x: x - pan.x, y: y - pan.y };
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-neutral-800 bg-black select-none"
        style={{ aspectRatio: "16 / 9", cursor: zoom > 1 ? "grab" : "default" }}
        onMouseDown={startPan}
        onTouchStart={startPan}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: panning.current || draggingHandle.current ? "none" : "transform 0.15s ease",
          }}
        >
          <img
            src={afterSrc}
            alt="after"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
          <img
            src={beforeSrc}
            alt="before"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            draggable={false}
            style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
          />
        </div>

        {/* labels */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-neutral-300">
          Before
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-300">
          After
        </div>

        {/* divider */}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-white/80"
          style={{ left: `${pct}%` }}
        />
        {/* handle */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.stopPropagation();
            draggingHandle.current = true;
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            draggingHandle.current = true;
          }}
          aria-label="Drag to compare"
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/95 text-neutral-900 shadow-lg backdrop-blur cursor-ew-resize"
          style={{ left: `${pct}%` }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 6L3 12l6 6M15 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-300 hover:bg-neutral-800"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-16 text-center font-mono text-xs text-neutral-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-300 hover:bg-neutral-800"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={reset}
            className="ml-2 flex h-8 items-center gap-1 rounded-md px-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="w-40 accent-emerald-400"
        />
      </div>
    </div>
  );
}
