import { useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";

interface Turn {
  instruction: string;
  ok: boolean;
}

interface Props {
  history: Turn[];
  busy: boolean;
  onSend: (instruction: string) => void;
}

const SUGGESTIONS = [
  "Also remove the shadow they left",
  "Fill the reflection on the car naturally",
  "Keep the exact same color grading",
  "Remove the chain/jewelry left floating",
];

export function AssistantPanel({ history, busy, onSend }: Props) {
  const [value, setValue] = useState("");

  const submit = () => {
    const t = value.trim();
    if (!t || busy) return;
    onSend(t);
    setValue("");
  };

  return (
    <div className="flex h-full min-h-[280px] flex-col rounded-xl border border-neutral-800 bg-neutral-950/60">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
          Refine with AI
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {history.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-neutral-500">
              Tell the AI how to improve the extraction. It'll edit the current
              clean plate.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  disabled={busy}
                  className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((t, i) => (
          <div
            key={i}
            className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300"
          >
            <div className="mb-0.5 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              Turn {i + 1} {t.ok ? "· applied" : "· failed"}
            </div>
            {t.instruction}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Refining scene…
          </div>
        )}
      </div>

      <div className="border-t border-neutral-800 p-2">
        <div className="flex items-end gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="e.g. also remove their shadow on the floor"
            className="flex-1 resize-none rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-700"
          />
          <button
            onClick={submit}
            disabled={busy || !value.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-400 text-neutral-950 transition hover:bg-emerald-300 disabled:bg-neutral-800 disabled:text-neutral-600"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
