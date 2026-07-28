import { useEffect, useRef, useState } from "react";
import { Box, Minus, Plus, X, RotateCcw } from "lucide-react";

interface Props {
  src: string;
  label?: string;
}

/**
 * Floating 3D minimap — renders the active plate on a tilted, depth-layered
 * CSS-3D card you can spin with the mouse while you work.
 */
export function Minimap3D({ src, label }: Props) {
  const [open, setOpen] = useState(true);
  const [rot, setRot] = useState({ x: -14, y: 26 });
  const [depth, setDepth] = useState(24);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const spin = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (drag.current) {
        setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
      } else if (spin.current) {
        const dx = e.clientX - spin.current.x;
        const dy = e.clientY - spin.current.y;
        setRot({
          x: Math.max(-60, Math.min(60, spin.current.rx - dy * 0.4)),
          y: Math.max(-70, Math.min(70, spin.current.ry + dx * 0.4)),
        });
      }
    };
    const up = () => {
      drag.current = null;
      spin.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: 24, bottom: 24 };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={style}
        className="fixed z-50 inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-950/90 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-neutral-300 backdrop-blur hover:border-emerald-400/60 hover:text-emerald-300"
      >
        <Box className="h-3.5 w-3.5" /> 3D map
      </button>
    );
  }

  const layers = [0, 1, 2, 3];

  return (
    <div
      style={style}
      className="fixed z-50 w-[260px] overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950/85 shadow-2xl backdrop-blur"
    >
      <div
        onMouseDown={(e) => {
          const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          drag.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          setPos({ x: rect.left, y: rect.top });
        }}
        className="flex cursor-move items-center justify-between border-b border-neutral-800 px-3 py-2"
      >
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
          <Box className="h-3 w-3 text-emerald-400" /> 3D outlay
        </span>
        <button
          onClick={() => setOpen(false)}
          className="rounded p-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          aria-label="Close 3D minimap"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        onMouseDown={(e) => {
          spin.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y };
          e.preventDefault();
        }}
        className="relative flex h-[170px] cursor-grab items-center justify-center bg-[radial-gradient(circle_at_50%_40%,oklch(0.25_0.03_260),oklch(0.11_0.02_260))] active:cursor-grabbing"
        style={{ perspective: "700px" }}
      >
        <div
          className="relative h-[110px] w-[190px]"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
            transition: spin.current ? "none" : "transform 0.2s ease-out",
          }}
        >
          {layers.map((l) => (
            <img
              key={l}
              src={src}
              alt={l === 0 ? (label ?? "Scene 3D preview") : ""}
              aria-hidden={l !== 0}
              draggable={false}
              className="absolute inset-0 h-full w-full rounded-md object-cover"
              style={{
                transform: `translateZ(${-l * (depth / 3)}px)`,
                opacity: l === 0 ? 1 : 0.28 - l * 0.06,
                filter: l === 0 ? "none" : `blur(${l}px) saturate(0.6)`,
                boxShadow: l === 0 ? "0 10px 30px rgba(0,0,0,0.6)" : "none",
              }}
            />
          ))}
          <div
            className="absolute inset-0 rounded-md border border-emerald-400/40"
            style={{ transform: `translateZ(${depth / 2}px)` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-neutral-800 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDepth((d) => Math.max(6, d - 6))}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800"
            aria-label="Less depth"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="font-mono text-[10px] text-neutral-500">depth {depth}</span>
          <button
            onClick={() => setDepth((d) => Math.min(72, d + 6))}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800"
            aria-label="More depth"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <button
          onClick={() => {
            setRot({ x: -14, y: 26 });
            setDepth(24);
          }}
          className="flex items-center gap-1 rounded px-1.5 py-1 font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
    </div>
  );
}
