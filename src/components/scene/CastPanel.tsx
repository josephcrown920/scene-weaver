import { useRef, useState } from "react";
import { Users, Plus, X, ImagePlus, UserPlus, Repeat, Loader2 } from "lucide-react";
import type { CastMember } from "@/lib/studio-types";

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export function CastPanel({
  cast,
  busy,
  disabled,
  onAdd,
  onRemove,
  onInsert,
  onSwap,
}: {
  cast: CastMember[];
  busy: string | null;
  disabled?: boolean;
  onAdd: (m: Omit<CastMember, "id">) => void;
  onRemove: (id: string) => void;
  onInsert: (m: CastMember, placement: string) => void;
  onSwap: (m: CastMember, target: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [placement, setPlacement] = useState("");
  const [target, setTarget] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const active = cast.find((c) => c.id === selected) ?? null;

  const submit = () => {
    if (!name.trim() || !description.trim()) return;
    onAdd({ name: name.trim(), description: description.trim(), reference });
    setName("");
    setDescription("");
    setReference(null);
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
        <Users className="h-3 w-3 text-violet-400" /> Cast — characters &amp; artists
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f?.type.startsWith("image/")) setReference(await fileToDataUrl(f));
          e.target.value = "";
        }}
      />

      {/* add form */}
      <div className="mt-3 grid gap-2 sm:grid-cols-[88px_1fr]">
        <div className="relative h-[88px] w-[88px] overflow-hidden rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40">
          {reference ? (
            <>
              <img src={reference} alt="Identity reference" className="h-full w-full object-cover" />
              <button
                onClick={() => setReference(null)}
                className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-neutral-300 hover:text-red-400"
                aria-label="Remove reference"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-600 hover:text-neutral-300"
            >
              <ImagePlus className="h-4 w-4" />
              <span className="font-mono text-[8px] uppercase tracking-widest">Ref photo</span>
            </button>
          )}
        </div>
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Character / artist name"
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-violet-500/60"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Look, wardrobe, age, vibe — e.g. 'late-20s artist, cropped leather jacket, silver chains, buzz cut'"
            className="w-full resize-none rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-violet-500/60"
          />
          <button
            onClick={submit}
            disabled={!name.trim() || !description.trim()}
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-[11px] text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> Add to cast
          </button>
        </div>
      </div>

      {/* roster */}
      {cast.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {cast.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id === selected ? null : c.id)}
              className={`group flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition ${
                c.id === selected
                  ? "border-violet-400/60 bg-violet-400/10"
                  : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700"
              }`}
            >
              {c.reference ? (
                <img src={c.reference} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-[10px] text-neutral-300">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="text-xs text-neutral-200">{c.name}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(c.id);
                  if (selected === c.id) setSelected(null);
                }}
                className="text-neutral-600 hover:text-red-400"
                role="button"
                aria-label={`Remove ${c.name}`}
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* actions for selected */}
      {active && (
        <div className="mt-4 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/30 p-3">
          <p className="text-[11px] leading-relaxed text-neutral-400">
            <span className="text-neutral-200">{active.name}</span> — {active.description}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <input
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                placeholder="Placement — e.g. 'leaning on the car hood, left third'"
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-violet-500/60"
              />
              <button
                onClick={() => onInsert(active, placement)}
                disabled={disabled || !!busy}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-violet-500 px-3 py-1.5 text-xs font-medium text-neutral-50 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                {busy === "insert" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                Add into scene
              </button>
            </div>

            <div className="space-y-1.5">
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Who to replace — e.g. 'the man in the white tee'"
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-violet-500/60"
              />
              <button
                onClick={() => onSwap(active, target)}
                disabled={disabled || !!busy || !target.trim()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "swap" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Repeat className="h-3.5 w-3.5" />
                )}
                Character swap
              </button>
            </div>
          </div>
        </div>
      )}

      {cast.length === 0 && (
        <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-neutral-600">
          Add a character above, then insert or swap them into this scene
        </p>
      )}
    </div>
  );
}
