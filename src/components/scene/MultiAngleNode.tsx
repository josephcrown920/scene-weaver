import { Workflow, Loader2, Check, Play } from "lucide-react";

export interface AngleNode {
  id: string;
  label: string;
  prompt: string;
  enabled: boolean;
  state: "idle" | "running" | "done" | "error";
}

interface Props {
  nodes: AngleNode[];
  running: boolean;
  onToggle: (id: string) => void;
  onRunAll: () => void;
  onRunOne: (id: string) => void;
}

export function MultiAngleNodeBoard({ nodes, running, onToggle, onRunAll, onRunOne }: Props) {
  const active = nodes.filter((n) => n.enabled).length;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          <Workflow className="h-3 w-3 text-emerald-400" /> Multi-angle node
          {running && <Loader2 className="h-3 w-3 animate-spin text-emerald-300" />}
        </div>
        <button
          onClick={onRunAll}
          disabled={running || active === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          <Play className="h-3 w-3" /> Run {active} node{active === 1 ? "" : "s"}
        </button>
      </div>

      <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-3">
        {nodes.map((n) => (
          <div
            key={n.id}
            className={`relative rounded-lg border p-2.5 transition ${
              n.enabled
                ? "border-emerald-400/40 bg-emerald-400/5"
                : "border-neutral-800 bg-neutral-900/40"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => onToggle(n.id)}
                className="min-w-0 flex-1 text-left"
                aria-pressed={n.enabled}
              >
                <div className="truncate text-[11px] text-neutral-200">{n.label}</div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-neutral-500">
                  {n.state === "running"
                    ? "rendering"
                    : n.state === "done"
                      ? "output ready"
                      : n.state === "error"
                        ? "failed"
                        : n.enabled
                          ? "armed"
                          : "off"}
                </div>
              </button>
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                  n.state === "done"
                    ? "border-emerald-400 bg-emerald-400 text-neutral-950"
                    : n.enabled
                      ? "border-emerald-400/60"
                      : "border-neutral-700"
                }`}
              >
                {n.state === "running" ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin text-emerald-300" />
                ) : n.state === "done" ? (
                  <Check className="h-2.5 w-2.5" />
                ) : null}
              </span>
            </div>
            <button
              onClick={() => onRunOne(n.id)}
              disabled={running}
              className="mt-2 w-full rounded border border-neutral-800 bg-neutral-950/60 py-1 font-mono text-[9px] uppercase tracking-widest text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40"
            >
              Run node
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">
        Each node is one synthesized camera move off the current clean plate.
        Armed nodes run in sequence to stay inside rate limits.
      </p>
    </div>
  );
}
