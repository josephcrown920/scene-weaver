import { useEffect, useRef, useState } from "react";
import { Send, Bot, Loader2, User } from "lucide-react";

export type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  action?: string;
};

interface Props {
  messages: ChatMsg[];
  busy: boolean;
  onSend: (text: string) => void;
}

const SUGGESTIONS = [
  "Remove the shadow they left behind",
  "Give me a reverse angle of this scene",
  "Make this sharper for print",
  "Why does the reflection look off?",
];

export function AssistantPanel({ messages, busy, onSend }: Props) {
  const [value, setValue] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  useEffect(() => {
    if (!busy) areaRef.current?.focus();
  }, [busy]);

  const submit = (text?: string) => {
    const t = (text ?? value).trim();
    if (!t || busy) return;
    onSend(t);
    setValue("");
  };

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl border border-neutral-800 bg-neutral-950/60">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
        <Bot className="h-3.5 w-3.5 text-emerald-400" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
          Scene assistant
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-neutral-500">
              Ask anything about the plate — or just tell it what to do. It can
              refine the clean plate, generate an angle, upscale, or rebuild.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  disabled={busy}
                  className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="flex max-w-[85%] items-start gap-2 rounded-2xl rounded-br-sm bg-emerald-400 px-3 py-2 text-xs text-neutral-950">
                <span>{m.content}</span>
                <User className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-2">
              <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <div className="min-w-0 text-xs leading-relaxed text-neutral-300">
                {m.content}
                {m.action && m.action !== "none" && (
                  <div className="mt-1 inline-block rounded-full border border-emerald-400/30 bg-emerald-400/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-emerald-300">
                    ran · {m.action}
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-neutral-800 p-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={areaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Message the scene assistant…"
            className="flex-1 resize-none rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-700"
          />
          <button
            onClick={() => submit()}
            disabled={busy || !value.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-400 text-neutral-950 transition hover:bg-emerald-300 disabled:bg-neutral-800 disabled:text-neutral-600"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
