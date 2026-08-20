import { useRef, useState } from "react";
import { Download, ImagePlus, Loader2, ShieldCheck, Sparkles, Wand2, X } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateVariation, suggestVariationPrompts } from "@/lib/variation-line.functions";

type Aspect = "4:5" | "1:1" | "9:16" | "16:9";
const ASPECTS: Aspect[] = ["4:5", "1:1", "9:16", "16:9"];
const CONCURRENCY = 3;

interface Result {
  id: string;
  prompt: string;
  src: string | null;
  error: string | null;
}

export function VariationLinePanel({
  onPublish,
}: {
  onPublish: (results: { label: string; src: string }[]) => void;
}) {
  const genOne = useServerFn(generateVariation);
  const suggest = useServerFn(suggestVariationPrompts);

  const [reference, setReference] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [direction, setDirection] = useState("");
  const [count, setCount] = useState(8);
  const [aspect, setAspect] = useState<Aspect>("4:5");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [ideating, setIdeating] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setReference(String(r.result));
    r.readAsDataURL(f);
  };

  const ideate = async () => {
    if (direction.trim().length < 3) return;
    setIdeating(true);
    try {
      const res = await suggest({ data: { direction: direction.trim(), count } });
      if (res.prompts.length === 0) toast.error("No briefs came back — rephrase the direction.");
      setPrompts(res.prompts);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not draft briefs");
    } finally {
      setIdeating(false);
    }
  };

  const run = async () => {
    if (!reference || !consent || prompts.length === 0) return;
    setRunning(true);
    setDone(0);
    const seeded: Result[] = prompts.map((p) => ({
      id: crypto.randomUUID(),
      prompt: p,
      src: null,
      error: null,
    }));
    setResults(seeded);

    let cursor = 0;
    const worker = async () => {
      while (cursor < seeded.length) {
        const i = cursor++;
        const item = seeded[i];
        try {
          const res = await genOne({
            data: {
              referenceDataUrl: reference,
              prompt: item.prompt,
              aspect,
              consentConfirmed: true,
            },
          });
          setResults((prev) =>
            prev.map((r) => (r.id === item.id ? { ...r, src: res.imageDataUrl } : r)),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed";
          setResults((prev) => prev.map((r) => (r.id === item.id ? { ...r, error: msg } : r)));
        } finally {
          setDone((d) => d + 1);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, seeded.length) }, worker));
    setRunning(false);
    toast.success("Variation line finished");
  };

  const exportZip = async () => {
    const ok = results.filter((r) => r.src);
    if (ok.length === 0) return;
    const zip = new JSZip();
    ok.forEach((r, i) => {
      const b64 = r.src!.split(",")[1] ?? "";
      zip.file(`${String(i + 1).padStart(2, "0")}-variation.png`, b64, { base64: true });
    });
    zip.file("line.txt", ok.map((r, i) => `${i + 1}. ${r.prompt}`).join("\n"));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "variation line.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const readyCount = results.filter((r) => r.src).length;

  return (
    <div className="space-y-4">
      <div className="panel-lux grid gap-4 rounded-2xl p-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
            Reference
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-neutral-500 hover:border-white/30"
          >
            {reference ? (
              <img src={reference} alt="Reference" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-xs">
                <ImagePlus className="h-5 w-5" /> Upload a reference photo
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-[11px] leading-relaxed text-amber-100/80">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 accent-amber-400"
            />
            <span>
              <ShieldCheck className="mr-1 inline h-3 w-3" />
              This is my own likeness, or one I hold documented commercial consent for. Generating
              variations of someone else's photo is identity misuse.
            </span>
          </label>
        </div>

        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
            Direction
          </div>
          <textarea
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            rows={3}
            placeholder="e.g. streetwear campaign across a rainy city at night — vary outfit, location and lighting"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[11px] text-neutral-400">
              Variations
              <input
                type="number"
                min={1}
                max={30}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value))))}
                className="w-16 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-neutral-100 outline-none"
              />
            </label>
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[11px]">
              {ASPECTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAspect(a)}
                  className={`rounded-full px-2.5 py-1 ${
                    aspect === a ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-200"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <button
              onClick={ideate}
              disabled={ideating || direction.trim().length < 3}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-neutral-200 hover:border-white/25 disabled:opacity-40"
            >
              {ideating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              Draft {count} briefs
            </button>
          </div>

          <textarea
            value={prompts.join("\n")}
            onChange={(e) => setPrompts(e.target.value.split("\n").filter((l) => l.trim()))}
            rows={7}
            placeholder="One variation brief per line — or let the director draft them above."
            className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-600"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={run}
              disabled={!reference || !consent || prompts.length === 0 || running}
              className="btn-lux inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/5 disabled:text-white/30 disabled:shadow-none"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {running ? `Running ${done}/${prompts.length}` : `Run line (${prompts.length})`}
            </button>
            <button
              onClick={exportZip}
              disabled={readyCount === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-neutral-200 hover:border-white/25 disabled:opacity-40"
            >
              <Download className="h-3 w-3" /> variation line.zip ({readyCount})
            </button>
            <button
              onClick={() =>
                onPublish(
                  results
                    .filter((r) => r.src)
                    .map((r, i) => ({ label: `Variation ${i + 1}`, src: r.src! })),
                )
              }
              disabled={readyCount === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-neutral-200 hover:border-white/25 disabled:opacity-40"
            >
              Send to gallery
            </button>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {results.map((r) => (
            <div
              key={r.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
            >
              <div className="flex aspect-[4/5] items-center justify-center bg-black/40">
                {r.src ? (
                  <img src={r.src} alt={r.prompt} className="h-full w-full object-cover" />
                ) : r.error ? (
                  <X className="h-5 w-5 text-red-400" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
                )}
              </div>
              <p className="line-clamp-3 p-2 text-[10px] leading-relaxed text-neutral-500">
                {r.error ?? r.prompt}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
