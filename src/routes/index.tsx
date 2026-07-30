import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import {
  Upload,
  Download,
  Loader2,
  Sparkles,
  Trash2,
  Check,
  X,
  Package,
  Video,
  Rotate3d,
  Camera,
  Pencil,
  Layers,
  Gauge,
} from "lucide-react";
import JSZip from "jszip";
import { extractScene } from "@/lib/extract-scene.functions";
import { generateAngle } from "@/lib/generate-angle.functions";
import { upscaleScene } from "@/lib/upscale-scene.functions";
import { sceneChat } from "@/lib/scene-chat.functions";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { BeforeAfter } from "@/components/scene/BeforeAfter";
import { AssistantPanel, type ChatMsg } from "@/components/scene/AssistantPanel";
import { Minimap3D } from "@/components/scene/Minimap3D";
import { MultiAngleNodeBoard, type AngleNode } from "@/components/scene/MultiAngleNode";
import { RebuildPanel } from "@/components/scene/RebuildPanel";
import { FlowsPanel } from "@/components/scene/FlowsPanel";
import { GalleryPanel } from "@/components/scene/GalleryPanel";
import { ColorPanel } from "@/components/scene/ColorPanel";
import { StoryboardPanel } from "@/components/scene/StoryboardPanel";
import { TimelinePanel } from "@/components/scene/TimelinePanel";
import { CastPanel } from "@/components/scene/CastPanel";
import { addCharacter, swapCharacter } from "@/lib/cast.functions";
import { suggestGrade } from "@/lib/suggest-grade.functions";
import { NEUTRAL_GRADE, PRESETS, presetByKey, drawGraded, type Grade } from "@/lib/grade";
import type { AssetKind, CastMember, Clip, GalleryEntry, Shot } from "@/lib/studio-types";
import { Images, Palette, LayoutGrid, Film, Wand2, Users } from "lucide-react";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scene Changer — remove subjects, generate new angles" },
      {
        name: "description",
        content:
          "Batch AI tool: strip people from photos, rebuild and upscale the clean plate, generate alternate camera angles, and export the whole set as a ZIP.",
      },
      { property: "og:title", content: "Scene Changer" },
      {
        property: "og:description",
        content:
          "Batch upload, before/after slider, multi-angle nodes, upscaling, a scene chatbot, and ZIP export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Status = "queued" | "processing" | "done" | "error";
type Variant = { id: string; label: string; dataUrl: string; kind?: AssetKind };

interface Item {
  id: string;
  name: string;
  original: string;
  result: string | null;
  prevResult: string | null;
  status: Status;
  error?: string;
  chat: ChatMsg[];
  chatBusy: boolean;
  refining: boolean;
  upscaling: boolean;
  rebuilding: boolean;
  variants: Variant[];
  angleBusy: boolean;
  nodes: AngleNode[];
  grade: Grade;
  gradePreset?: string;
  gradeNote?: string;
  grading?: boolean;
}

type StudioView = "scenes" | "gallery" | "color" | "board" | "timeline" | "cast" | "flows";

const RAIL: { key: StudioView; label: string; icon: typeof Images }[] = [
  { key: "scenes", label: "Create", icon: Sparkles },
  { key: "gallery", label: "Gallery", icon: Images },
  { key: "color", label: "Color", icon: Palette },
  { key: "board", label: "Board", icon: LayoutGrid },
  { key: "timeline", label: "Timeline", icon: Film },
  { key: "cast", label: "Cast", icon: Users },
  { key: "flows", label: "Flows", icon: Wand2 },
];

type Resolution = "original" | "2160" | "1440" | "1080" | "720";
type Format = "png" | "jpg";

const ANGLE_PRESETS: { label: string; prompt: string }[] = [
  { label: "Left 30°", prompt: "Rotate camera 30° to the left, same subject distance" },
  { label: "Right 30°", prompt: "Rotate camera 30° to the right, same subject distance" },
  { label: "Reverse 180°", prompt: "Reverse angle — 180° behind the original camera position" },
  { label: "Overhead", prompt: "High-angle overhead view of the same scene" },
  { label: "Wide 3x", prompt: "Wide establishing shot pulled back 3x" },
  { label: "Close-up", prompt: "Tight close-up on the central prop" },
];

function makeNodes(): AngleNode[] {
  return ANGLE_PRESETS.map((p) => ({
    id: crypto.randomUUID(),
    label: p.label,
    prompt: p.prompt,
    enabled: false,
    state: "idle" as const,
  }));
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

async function loadImg(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
}

async function toExportBlob(
  dataUrl: string,
  resolution: Resolution,
  format: Format,
  quality: number,
  grade?: Grade,
): Promise<Blob> {
  const img = await loadImg(dataUrl);
  const maxH = resolution === "original" ? img.height : Number(resolution);
  const scale = img.height > maxH ? maxH / img.height : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (format === "jpg") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
  }
  if (grade) drawGraded(ctx, img, w, h, grade);
  else ctx.drawImage(img, 0, 0, w, h);
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  return await new Promise<Blob>((res) =>
    canvas.toBlob((b) => res(b!), mime, format === "jpg" ? quality : undefined),
  );
}

function safeName(s: string): string {
  return (s || "scene").replace(/[^\w.-]+/g, "_").slice(0, 80) || "scene";
}

function Index() {
  const run = useServerFn(extractScene);
  const runAngle = useServerFn(generateAngle);
  const runUpscale = useServerFn(upscaleScene);
  const runChat = useServerFn(sceneChat);
  const runAddCharacter = useServerFn(addCharacter);
  const runSwapCharacter = useServerFn(swapCharacter);

  const [items, setItems] = useState<Item[]>([]);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [castBusy, setCastBusy] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Resolution>("original");
  const [format, setFormat] = useState<Format>("png");
  const [quality, setQuality] = useState(0.92);
  const [zipping, setZipping] = useState(false);
  const [batchBusy, setBatchBusy] = useState<string | null>(null);
  const [customAngle, setCustomAngle] = useState("");
  const [showMap, setShowMap] = useState(true);
  const [view, setView] = useState<StudioView>("scenes");
  const [shots, setShots] = useState<Shot[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [boardExporting, setBoardExporting] = useState<string | null>(null);
  const [autoAllBusy, setAutoAllBusy] = useState(false);
  const runSuggest = useServerFn(suggestGrade);

  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }, []);

  const processItem = useCallback(
    async (item: Item, guidance?: string) => {
      patch(item.id, { status: "processing" });
      try {
        const out = await run({
          data: {
            imageDataUrl: item.original,
            ...(guidance ? { instruction: guidance } : {}),
          },
        });
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "done",
                  prevResult: it.result,
                  result: out.imageDataUrl,
                  rebuilding: false,
                }
              : it,
          ),
        );
      } catch (e) {
        patch(item.id, {
          status: "error",
          rebuilding: false,
          error: e instanceof Error ? e.message : "Failed",
        });
      }
    },
    [run, patch],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter((f) => f.type.startsWith("image/") && f.size <= 8 * 1024 * 1024);
      if (valid.length === 0) {
        toast.error("No valid images (max 8MB each).");
        return;
      }
      const skipped = files.length - valid.length;
      if (skipped > 0) toast.warning(`${skipped} file(s) skipped — not an image or over 8MB.`);

      const newItems: Item[] = await Promise.all(
        valid.map(async (f) => ({
          id: crypto.randomUUID(),
          name: f.name.replace(/\.[^.]+$/, ""),
          original: await fileToDataUrl(f),
          result: null,
          prevResult: null,
          status: "queued" as const,
          chat: [],
          chatBusy: false,
          refining: false,
          upscaling: false,
          rebuilding: false,
          variants: [],
          angleBusy: false,
          nodes: makeNodes(),
          grade: { ...NEUTRAL_GRADE },
          gradePreset: "neutral",
        })),
      );

      setItems((prev) => [...prev, ...newItems]);
      if (!activeId && newItems[0]) setActiveId(newItems[0].id);

      for (const it of newItems) {
        await processItem(it);
      }
    },
    [activeId, processItem],
  );

  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const rename = (id: string, name: string) => patch(id, { name });

  const refine = useCallback(
    async (id: string, instruction: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item?.result) return false;
      patch(id, { refining: true });
      try {
        const out = await run({ data: { imageDataUrl: item.result, instruction } });
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, refining: false, prevResult: it.result, result: out.imageDataUrl }
              : it,
          ),
        );
        return true;
      } catch (e) {
        patch(id, { refining: false });
        toast.error(e instanceof Error ? e.message : "Refine failed");
        return false;
      }
    },
    [patch, run],
  );

  /* ---------- cast ---------- */

  const castInsert = useCallback(
    async (id: string, m: CastMember, placement: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      const scene = item?.result ?? item?.original;
      if (!scene) return;
      setCastBusy("insert");
      try {
        const out = await runAddCharacter({
          data: {
            sceneDataUrl: scene,
            name: m.name,
            description: m.description,
            placement,
            referenceDataUrl: m.reference ?? undefined,
          },
        });
        const v: Variant = {
          id: crypto.randomUUID(),
          label: `Cast · ${m.name}`,
          dataUrl: out.imageDataUrl,
          kind: "cast",
        };
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, variants: [...it.variants, v] } : it)),
        );
        toast.success(`${m.name} added to the scene`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Adding the character failed");
      } finally {
        setCastBusy(null);
      }
    },
    [runAddCharacter],
  );

  const castSwap = useCallback(
    async (id: string, m: CastMember, target: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      const scene = item?.original ?? item?.result;
      if (!scene || !target.trim()) return;
      setCastBusy("swap");
      try {
        const out = await runSwapCharacter({
          data: {
            sceneDataUrl: scene,
            target: target.trim(),
            name: m.name,
            description: m.description,
            referenceDataUrl: m.reference ?? undefined,
          },
        });
        const v: Variant = {
          id: crypto.randomUUID(),
          label: `Swap · ${m.name}`,
          dataUrl: out.imageDataUrl,
          kind: "swap",
        };
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, variants: [...it.variants, v] } : it)),
        );
        toast.success(`Swapped in ${m.name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Character swap failed");
      } finally {
        setCastBusy(null);
      }
    },
    [runSwapCharacter],
  );

  const genAngle = useCallback(
    async (id: string, angle: string, label?: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item?.result) return false;
      patch(id, { angleBusy: true });
      try {
        const out = await runAngle({ data: { imageDataUrl: item.result, angle } });
        const v: Variant = {
          id: crypto.randomUUID(),
          label: label ?? (angle.length > 40 ? angle.slice(0, 40) + "…" : angle),
          dataUrl: out.imageDataUrl,
        };
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, angleBusy: false, variants: [...it.variants, v] } : it,
          ),
        );
        return true;
      } catch (e) {
        patch(id, { angleBusy: false });
        toast.error(e instanceof Error ? e.message : "Angle generation failed");
        return false;
      }
    },
    [patch, runAngle],
  );

  const upscale = useCallback(
    async (id: string, factor: "2x" | "4x") => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item?.result) return false;
      patch(id, { upscaling: true });
      try {
        const out = await runUpscale({ data: { imageDataUrl: item.result, factor } });
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, upscaling: false, prevResult: it.result, result: out.imageDataUrl }
              : it,
          ),
        );
        toast.success(`Upscaled ${factor}`);
        return true;
      } catch (e) {
        patch(id, { upscaling: false });
        toast.error(e instanceof Error ? e.message : "Upscale failed");
        return false;
      }
    },
    [patch, runUpscale],
  );

  const undo = (id: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id && it.prevResult
          ? { ...it, result: it.prevResult, prevResult: null }
          : it,
      ),
    );
  };

  /* ---------- node board ---------- */

  const toggleNode = (itemId: string, nodeId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              nodes: it.nodes.map((n) =>
                n.id === nodeId ? { ...n, enabled: !n.enabled } : n,
              ),
            }
          : it,
      ),
    );
  };

  const setNodeState = (itemId: string, nodeId: string, state: AngleNode["state"]) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, nodes: it.nodes.map((n) => (n.id === nodeId ? { ...n, state } : n)) }
          : it,
      ),
    );
  };

  const runNodes = useCallback(
    async (itemId: string, only?: string) => {
      const item = itemsRef.current.find((i) => i.id === itemId);
      if (!item?.result) return;
      const targets = only
        ? item.nodes.filter((n) => n.id === only)
        : item.nodes.filter((n) => n.enabled);
      if (targets.length === 0) return;
      for (const n of targets) {
        setNodeState(itemId, n.id, "running");
        const ok = await genAngle(itemId, n.prompt, n.label);
        setNodeState(itemId, n.id, ok ? "done" : "error");
      }
    },
    [genAngle],
  );

  /* ---------- batch flows ---------- */

  const batchProcessAll = async () => {
    setBatchBusy("extract");
    try {
      for (const it of itemsRef.current.filter(
        (i) => i.status === "queued" || i.status === "error",
      )) {
        await processItem(it);
      }
    } finally {
      setBatchBusy(null);
    }
  };

  const batchAngles = async () => {
    setBatchBusy("angles");
    try {
      for (const it of itemsRef.current.filter((i) => i.status === "done")) {
        await runNodes(it.id);
      }
      toast.success("Batch angles complete");
    } finally {
      setBatchBusy(null);
    }
  };

  const batchUpscale = async () => {
    setBatchBusy("upscale");
    try {
      for (const it of itemsRef.current.filter((i) => i.status === "done")) {
        await upscale(it.id, "2x");
      }
      toast.success("Batch upscale complete");
    } finally {
      setBatchBusy(null);
    }
  };

  /* ---------- chatbot ---------- */

  const sendChat = useCallback(
    async (id: string, text: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      const history: ChatMsg[] = [...item.chat, { role: "user", content: text }];
      patch(id, { chat: history, chatBusy: true });
      try {
        const out = await runChat({
          data: {
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            sceneName: item.name,
            hasResult: !!item.result,
            variantCount: item.variants.length,
          },
        });
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  chatBusy: false,
                  chat: [
                    ...history,
                    { role: "assistant", content: out.reply, action: out.action },
                  ],
                }
              : it,
          ),
        );

        if (out.action === "refine" && out.instruction) await refine(id, out.instruction);
        else if (out.action === "angle" && out.instruction)
          await genAngle(id, out.instruction);
        else if (out.action === "upscale") await upscale(id, "2x");
        else if (out.action === "rebuild") {
          const target = itemsRef.current.find((i) => i.id === id);
          if (target) {
            patch(id, { rebuilding: true });
            await processItem(target, out.instruction || undefined);
          }
        }
      } catch (e) {
        patch(id, { chatBusy: false });
        toast.error(e instanceof Error ? e.message : "Assistant failed");
      }
    },
    [patch, runChat, refine, genAngle, upscale, processItem],
  );

  const removeVariant = (itemId: string, variantId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, variants: it.variants.filter((v) => v.id !== variantId) }
          : it,
      ),
    );
  };

  /* ---------- export ---------- */

  const downloadOne = async (dataUrl: string, filename: string, grade?: Grade) => {
    const blob = await toExportBlob(dataUrl, resolution, format, quality, grade);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName(filename)}.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadZip = async () => {
    const done = items.filter((i) => i.status === "done" && i.result);
    if (done.length === 0) {
      toast.error("Nothing done yet.");
      return;
    }
    setZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("scene changer")!;
      for (const item of done) {
        const base = safeName(item.name);
        const sub = folder.folder(base)!;
        sub.file(
          `${base}-scene.${format}`,
          await toExportBlob(item.result!, resolution, format, quality, item.grade),
        );
        sub.file(`${base}-original.png`, await dataUrlToBlob(item.original));
        for (let i = 0; i < item.variants.length; i++) {
          const v = item.variants[i];
          sub.file(
            `${base}-angle-${i + 1}-${safeName(v.label)}.${format}`,
            await toExportBlob(v.dataUrl, resolution, format, quality, item.grade),
          );
        }
      }
      folder.file(
        "README.txt",
        "Scene Changer\n\n" +
          `${done.length} scene(s) at ${
            resolution === "original" ? "original resolution" : `${resolution}p max height`
          }, format: ${format.toUpperCase()}${
            format === "jpg" ? ` @ quality ${Math.round(quality * 100)}%` : ""
          }.\n` +
          `Generated ${new Date().toISOString()}\n`,
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "scene changer.zip";
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Exported ${done.length} scene(s)`);
    } finally {
      setZipping(false);
    }
  };


  /* ---------- grading ---------- */

  const setGrade = useCallback(
    (id: string, grade: Grade, presetKey?: string, note?: string) =>
      patch(id, { grade, gradePreset: presetKey, gradeNote: note }),
    [patch],
  );

  const autoGrade = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      const src = item?.result ?? item?.original;
      if (!item || !src) return;
      patch(id, { grading: true });
      try {
        const out = await runSuggest({
          data: { imageDataUrl: src, presetKeys: PRESETS.map((p) => p.key) },
        });
        const base = presetByKey(out.preset)?.grade ?? NEUTRAL_GRADE;
        const grade: Grade = { ...base, ...(out.tweaks ?? {}) } as Grade;
        patch(id, { grading: false, grade, gradePreset: out.preset, gradeNote: out.note });
      } catch (e) {
        patch(id, { grading: false });
        toast.error(e instanceof Error ? e.message : "Colorist failed");
      }
    },
    [patch, runSuggest],
  );

  const autoGradeAll = async () => {
    setAutoAllBusy(true);
    try {
      for (const it of itemsRef.current.filter((i) => i.result)) await autoGrade(it.id);
      toast.success("Graded every scene");
    } finally {
      setAutoAllBusy(false);
    }
  };

  /* ---------- gallery / board / timeline ---------- */

  const gallery: GalleryEntry[] = items.flatMap((it) => {
    const out: GalleryEntry[] = [
      {
        id: `${it.id}-src`,
        itemId: it.id,
        itemName: it.name,
        kind: "source",
        label: "Original frame",
        src: it.original,
        grade: it.grade,
      },
    ];
    if (it.result)
      out.push({
        id: `${it.id}-plate`,
        itemId: it.id,
        itemName: it.name,
        kind: "plate",
        label: "Clean plate",
        src: it.result,
        grade: it.grade,
      });
    it.variants.forEach((v) =>
      out.push({
        id: v.id,
        itemId: it.id,
        itemName: it.name,
        kind: v.kind ?? "angle",
        label: v.label,
        src: v.dataUrl,
        grade: it.grade,
      }),
    );
    return out;
  });

  const addShot = (e: GalleryEntry) => {
    setShots((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        src: e.src,
        name: `${e.itemName} — ${e.label}`,
        caption: "",
        shotType: e.kind === "angle" ? "Wide" : "Establishing",
        selected: true,
        grade: e.grade,
      },
    ]);
    toast.success("Added to storyboard");
  };

  const addClip = (e: GalleryEntry) => {
    setClips((prev) => [
      ...prev,
      { id: crypto.randomUUID(), src: e.src, name: `${e.itemName} — ${e.label}`, duration: 2.5, grade: e.grade },
    ]);
    toast.success("Added to timeline");
  };

  const addAllPlates = () => {
    const plates = items.filter((i) => i.result);
    if (plates.length === 0) return;
    setClips((prev) => [
      ...prev,
      ...plates.map((i) => ({
        id: crypto.randomUUID(),
        src: i.result!,
        name: i.name,
        duration: 2.5,
        grade: i.grade,
      })),
    ]);
  };

  const move = <T extends { id: string }>(list: T[], id: string, dir: -1 | 1): T[] => {
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const copy = [...list];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  };

  const exportContactSheet = async (title: string) => {
    const sel = shots.filter((s) => s.selected);
    if (sel.length === 0) return;
    setBoardExporting("sheet");
    try {
      const cols = Math.min(3, sel.length);
      const rows = Math.ceil(sel.length / cols);
      const cw = 640;
      const ch = 360;
      const pad = 28;
      const cap = 74;
      const canvas = document.createElement("canvas");
      canvas.width = cols * cw + pad * (cols + 1);
      canvas.height = rows * (ch + cap) + pad * (rows + 1) + 96;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#0b0b0e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f5f5f5";
      ctx.font = "600 34px ui-serif, Georgia, serif";
      ctx.fillText(title, pad, 58);
      ctx.fillStyle = "#8a8a94";
      ctx.font = "16px ui-monospace, monospace";
      ctx.fillText(`${sel.length} shot(s) · ${new Date().toLocaleDateString()}`, pad, 82);

      for (let i = 0; i < sel.length; i++) {
        const s = sel[i];
        const img = await loadImg(s.src);
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = pad + c * (cw + pad);
        const y = 96 + pad + r * (ch + cap + pad);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cw, ch);
        ctx.clip();
        const scale = Math.max(cw / img.width, ch / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.translate(x + (cw - dw) / 2, y + (ch - dh) / 2);
        drawGraded(ctx, img, dw, dh, s.grade);
        ctx.restore();
        ctx.strokeStyle = "#26262c";
        ctx.strokeRect(x, y, cw, ch);
        ctx.fillStyle = "#e6e6ea";
        ctx.font = "600 18px ui-sans-serif, system-ui";
        ctx.fillText(`${String(i + 1).padStart(2, "0")} · ${s.shotType}`, x, y + ch + 26);
        ctx.fillStyle = "#9a9aa4";
        ctx.font = "15px ui-sans-serif, system-ui";
        ctx.fillText((s.caption || s.name).slice(0, 68), x, y + ch + 50);
      }
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${safeName(title)}-contact-sheet.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Exported ${sel.length} selected shot(s)`);
    } finally {
      setBoardExporting(null);
    }
  };

  const exportBoardZip = async (title: string) => {
    const sel = shots.filter((s) => s.selected);
    if (sel.length === 0) return;
    setBoardExporting("zip");
    try {
      const zip = new JSZip();
      const folder = zip.folder(safeName(title))!;
      for (let i = 0; i < sel.length; i++) {
        const s = sel[i];
        folder.file(
          `${String(i + 1).padStart(2, "0")}-${safeName(s.shotType)}-${safeName(s.name)}.${format}`,
          await toExportBlob(s.src, resolution, format, quality, s.grade),
        );
      }
      folder.file(
        "shotlist.txt",
        sel
          .map((s, i) => `${String(i + 1).padStart(2, "0")} [${s.shotType}] ${s.name}\n    ${s.caption}`)
          .join("\n"),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${safeName(title)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Exported ${sel.length} selected shot(s)`);
    } finally {
      setBoardExporting(null);
    }
  };

  const active = items.find((i) => i.id === activeId) ?? null;
  const doneCount = items.filter((i) => i.status === "done").length;
  const anyProcessing = items.some((i) => i.status === "processing" || i.status === "queued");

  return (
    <div className="min-h-screen bg-[oklch(0.14_0.02_260)] text-neutral-100">
      <Toaster theme="dark" />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Scene Changer
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FormatPicker value={format} onChange={setFormat} />
          <ResolutionPicker value={resolution} onChange={setResolution} />
          <QualitySlider value={quality} onChange={setQuality} disabled={format === "png"} />
          <button
            onClick={downloadZip}
            disabled={doneCount === 0 || zipping}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            scene changer.zip ({doneCount})
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-24">
        <div className="mb-6 flex flex-wrap items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-950 p-1 text-xs w-fit">
          {RAIL.map((r) => (
            <button
              key={r.key}
              onClick={() => setView(r.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 transition ${
                view === r.key
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              <r.icon className="h-3.5 w-3.5" />
              {r.label}
            </button>
          ))}
        </div>

        {view === "gallery" && (
          <GalleryPanel
            entries={gallery}
            onDownload={(e) => downloadOne(e.src, `${e.itemName}-${e.label}`, e.grade)}
            onSendToBoard={addShot}
            onSendToTimeline={addClip}
            onOpenScene={(id) => {
              setActiveId(id);
              setView("scenes");
            }}
          />
        )}

        {view === "color" && (
          <ColorPanel
            scenes={items
              .filter((i) => i.result || i.original)
              .map((i) => ({
                id: i.id,
                name: i.name,
                src: i.result ?? i.original,
                grade: i.grade,
                gradeNote: i.gradeNote,
                gradePreset: i.gradePreset,
                grading: i.grading,
              }))}
            activeId={activeId}
            onSelect={setActiveId}
            onGrade={setGrade}
            onAutoGrade={autoGrade}
            onAutoGradeAll={autoGradeAll}
            autoAllBusy={autoAllBusy}
          />
        )}

        {view === "board" && (
          <StoryboardPanel
            shots={shots}
            onPatch={(id, p) => setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)))}
            onRemove={(id) => setShots((prev) => prev.filter((s) => s.id !== id))}
            onMove={(id, dir) => setShots((prev) => move(prev, id, dir))}
            onToggle={(id) =>
              setShots((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)))
            }
            onToggleAll={(sel) => setShots((prev) => prev.map((s) => ({ ...s, selected: sel })))}
            onExport={exportContactSheet}
            onExportZip={exportBoardZip}
            exporting={boardExporting}
          />
        )}

        {view === "timeline" && (
          <TimelinePanel
            clips={clips}
            onPatch={(id, p) => setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)))}
            onRemove={(id) => setClips((prev) => prev.filter((c) => c.id !== id))}
            onMove={(id, dir) => setClips((prev) => move(prev, id, dir))}
            onAddAll={addAllPlates}
            canAddAll={items.some((i) => i.result)}
          />
        )}

        {view === "cast" && (
          <div className="space-y-4">
            {active ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-neutral-800">
                  <img
                    src={active.result ?? active.original}
                    alt={active.name}
                    className="max-h-[320px] w-full object-cover"
                  />
                </div>
                <CastPanel
                  cast={cast}
                  busy={castBusy}
                  onAdd={(m) => setCast((p) => [...p, { ...m, id: crypto.randomUUID() }])}
                  onRemove={(cid) => setCast((p) => p.filter((c) => c.id !== cid))}
                  onInsert={(m, placement) => castInsert(active.id, m, placement)}
                  onSwap={(m, target) => castSwap(active.id, m, target)}
                />
              </>
            ) : (
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                Upload or select a scene first
              </p>
            )}
          </div>
        )}

        {view === "flows" && <FlowsPanel seedImage={active?.result ?? active?.original ?? null} />}

        {view === "scenes" && items.length === 0 && (
          <>

            <section className="mb-10 max-w-3xl">
              <h1 className="font-serif text-5xl leading-[1.02] tracking-tight text-neutral-50 md:text-7xl">
                Keep the scene.
                <br />
                <span className="italic text-neutral-400">Change the angle.</span>
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-neutral-400 md:text-base">
                Drop in a batch of frames. Walk the subject out, rebuild and
                upscale the plate, then fire off multi-angle nodes. Chat with the
                assistant, watch it in 3D, export as one ZIP.
              </p>
            </section>
            <UploadZone onFiles={addFiles} inputRef={inputRef} />
            <ComingSoonRow />
          </>
        )}

        {view === "scenes" && items.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-2">
              <UploadTile onFiles={addFiles} inputRef={inputRef} />
              <BatchBar
                busy={batchBusy}
                doneCount={doneCount}
                pending={items.filter((i) => i.status === "queued" || i.status === "error").length}
                onProcess={batchProcessAll}
                onAngles={batchAngles}
                onUpscale={batchUpscale}
              />
              {items.map((it) => (
                <div
                  key={it.id}
                  onClick={() => setActiveId(it.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setActiveId(it.id)}
                  className={`group flex w-full cursor-pointer items-center gap-3 rounded-lg border p-2 text-left transition ${
                    activeId === it.id
                      ? "border-emerald-400/60 bg-emerald-400/5"
                      : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700"
                  }`}
                >
                  <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded bg-neutral-900">
                    <img src={it.result ?? it.original} alt="" className="h-full w-full object-cover" />
                    {(it.status === "processing" || it.upscaling || it.angleBusy) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-neutral-200">{it.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest">
                      {it.status === "done" && (
                        <span className="text-emerald-400">
                          <Check className="inline h-3 w-3" /> Ready
                          {it.variants.length > 0 && (
                            <span className="ml-1 text-neutral-500">
                              · {it.variants.length} angle{it.variants.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </span>
                      )}
                      {it.status === "processing" && <span className="text-neutral-400">Processing</span>}
                      {it.status === "queued" && <span className="text-neutral-500">Queued</span>}
                      {it.status === "error" && (
                        <span className="text-red-400">
                          <X className="inline h-3 w-3" /> Error
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(it.id);
                    }}
                    className="rounded p-1 text-neutral-600 opacity-0 hover:bg-neutral-800 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </aside>

            <section>
              {!active && (
                <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-dashed border-neutral-800 text-sm text-neutral-500">
                  Select a scene on the left.
                </div>
              )}
              {active && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <FilenameEditor value={active.name} onChange={(v) => rename(active.id, v)} />
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                        {active.status === "done"
                          ? `Clean plate · ${active.variants.length} angle(s)`
                          : active.status === "processing"
                            ? "Rebuilding scene…"
                            : active.status === "error"
                              ? active.error
                              : "Queued"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowMap((v) => !v)}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        {showMap ? "Hide" : "Show"} 3D map
                      </button>
                      {active.status === "done" && active.result && (
                        <button
                          onClick={() => downloadOne(active.result!, `${active.name}-scene`, active.grade)}
                          className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-600"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download .{format}
                        </button>
                      )}
                    </div>
                  </div>

                  {active.status === "processing" && (
                    <div className="flex h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 text-neutral-400">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <p className="font-mono text-xs uppercase tracking-[0.2em]">Rebuilding scene…</p>
                    </div>
                  )}

                  {active.status === "error" && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-300">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-red-400">Failed</div>
                      <div className="mt-1">{active.error}</div>
                      <button
                        onClick={() => processItem(active)}
                        className="mt-3 rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {active.status === "done" && active.result && (
                    <>
                      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                        <BeforeAfter beforeSrc={active.original} afterSrc={active.result} />
                        <AssistantPanel
                          messages={active.chat}
                          busy={active.chatBusy || active.refining || active.upscaling}
                          onSend={(t) => sendChat(active.id, t)}
                        />
                      </div>

                      <RebuildPanel
                        busy={active.rebuilding || active.refining}
                        upscaling={active.upscaling}
                        canUndo={!!active.prevResult}
                        onRebuild={(g) => {
                          patch(active.id, { rebuilding: true });
                          processItem(active, g || undefined);
                        }}
                        onUndo={() => undo(active.id)}
                        onUpscale={(f) => upscale(active.id, f)}
                      />

                      <MultiAngleNodeBoard
                        nodes={active.nodes}
                        running={active.angleBusy}
                        onToggle={(nid) => toggleNode(active.id, nid)}
                        onRunAll={() => runNodes(active.id)}
                        onRunOne={(nid) => runNodes(active.id, nid)}
                      />

                      <CastPanel
                        cast={cast}
                        busy={castBusy}
                        onAdd={(m) => setCast((p) => [...p, { ...m, id: crypto.randomUUID() }])}
                        onRemove={(cid) => setCast((p) => p.filter((c) => c.id !== cid))}
                        onInsert={(m, placement) => castInsert(active.id, m, placement)}
                        onSwap={(m, target) => castSwap(active.id, m, target)}
                      />

                      <AnglePanel
                        busy={active.angleBusy}
                        customAngle={customAngle}
                        setCustomAngle={setCustomAngle}
                        onGenerate={(a) => genAngle(active.id, a)}
                      />

                      {active.variants.length > 0 && (
                        <div>
                          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                            Generated angles
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {active.variants.map((v, i) => (
                              <div
                                key={v.id}
                                className="group relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/60"
                              >
                                <img src={v.dataUrl} alt={v.label} className="aspect-video w-full object-cover" />
                                <div className="flex items-center justify-between gap-2 p-2 text-[10px] text-neutral-400">
                                  <span className="truncate" title={v.label}>
                                    #{i + 1} · {v.label}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      onClick={() => downloadOne(v.dataUrl, `${active.name}-angle-${i + 1}`, active.grade)}
                                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                                      aria-label="Download angle"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => removeVariant(active.id, v.id)}
                                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                                      aria-label="Remove angle"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {anyProcessing && (
                <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  Batch processing… {doneCount} of {items.length} done
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {showMap && active && (
        <Minimap3D src={active.result ?? active.original} label={`${active.name} 3D preview`} />
      )}
    </div>
  );
}

function BatchBar({
  busy,
  doneCount,
  pending,
  onProcess,
  onAngles,
  onUpscale,
}: {
  busy: string | null;
  doneCount: number;
  pending: number;
  onProcess: () => void;
  onAngles: () => void;
  onUpscale: () => void;
}) {
  const btn =
    "flex w-full items-center justify-between rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-[11px] text-neutral-300 hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";
  return (
    <div className="space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-950/40 p-2">
      <div className="px-1 font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500">
        Batch flow
      </div>
      <button onClick={onProcess} disabled={!!busy || pending === 0} className={btn}>
        <span>Extract pending</span>
        {busy === "extract" ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{pending}</span>}
      </button>
      <button onClick={onAngles} disabled={!!busy || doneCount === 0} className={btn}>
        <span>Run angle nodes on all</span>
        {busy === "angles" ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{doneCount}</span>}
      </button>
      <button onClick={onUpscale} disabled={!!busy || doneCount === 0} className={btn}>
        <span>Upscale all 2x</span>
        {busy === "upscale" ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{doneCount}</span>}
      </button>
    </div>
  );
}

function FilenameEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Pencil className="h-3.5 w-3.5 text-neutral-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 truncate bg-transparent text-lg text-neutral-100 outline-none focus:ring-0"
        aria-label="Filename"
      />
    </div>
  );
}

function FormatPicker({ value, onChange }: { value: Format; onChange: (f: Format) => void }) {
  const opts: { v: Format; label: string }[] = [
    { v: "png", label: "PNG (alpha)" },
    { v: "jpg", label: "JPG" },
  ];
  return (
    <div className="flex items-center rounded-full border border-neutral-800 bg-neutral-950 p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1 transition ${
            value === o.v ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ResolutionPicker({
  value,
  onChange,
}: {
  value: Resolution;
  onChange: (r: Resolution) => void;
}) {
  const opts: { v: Resolution; label: string }[] = [
    { v: "original", label: "Original" },
    { v: "2160", label: "4K" },
    { v: "1440", label: "1440p" },
    { v: "1080", label: "1080p" },
    { v: "720", label: "720p" },
  ];
  return (
    <div className="flex items-center rounded-full border border-neutral-800 bg-neutral-950 p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1 transition ${
            value === o.v ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function QualitySlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-xs ${
        disabled ? "opacity-40" : ""
      }`}
      title={disabled ? "PNG is lossless — quality applies to JPG" : "JPG export quality"}
    >
      <Gauge className="h-3.5 w-3.5 text-neutral-500" />
      <input
        type="range"
        min={40}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-24 accent-emerald-400"
        aria-label="Export quality"
      />
      <span className="w-8 font-mono text-[10px] text-neutral-400">{Math.round(value * 100)}%</span>
    </div>
  );
}

function AnglePanel({
  busy,
  customAngle,
  setCustomAngle,
  onGenerate,
}: {
  busy: boolean;
  customAngle: string;
  setCustomAngle: (v: string) => void;
  onGenerate: (angle: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
        <Camera className="h-3 w-3" /> Custom angle
        {busy && <Loader2 className="ml-1 h-3 w-3 animate-spin text-emerald-300" />}
      </div>
      <div className="flex gap-2">
        <input
          value={customAngle}
          onChange={(e) => setCustomAngle(e.target.value)}
          placeholder="e.g. worm's-eye view from the front bumper"
          className="flex-1 rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
        />
        <button
          disabled={busy || !customAngle.trim()}
          onClick={() => {
            const a = customAngle.trim();
            if (!a) return;
            onGenerate(a);
            setCustomAngle("");
          }}
          className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-medium text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          Generate
        </button>
      </div>
    </div>
  );
}

function UploadZone({
  onFiles,
  inputRef,
}: {
  onFiles: (files: File[]) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [hover, setHover] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-20 text-center transition ${
        hover ? "border-emerald-400 bg-emerald-400/5" : "border-neutral-700 bg-neutral-900/40 hover:border-neutral-500"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 transition group-hover:bg-emerald-400 group-hover:text-neutral-950">
        <Upload className="h-6 w-6" />
      </div>
      <p className="mt-6 text-lg text-neutral-200">Drop images here — one or many</p>
      <p className="mt-1 text-xs text-neutral-500">
        PNG, JPG · up to 8MB each · batch processed sequentially
      </p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/60 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
        <Sparkles className="h-3 w-3" /> Powered by Lovable AI
      </div>
    </label>
  );
}

function UploadTile({
  onFiles,
  inputRef,
}: {
  onFiles: (files: File[]) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-neutral-700 bg-neutral-950/40 p-3 text-neutral-400 transition hover:border-neutral-500 hover:text-neutral-200"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />
      <Upload className="h-4 w-4" />
      <span className="text-xs">Add more images</span>
    </label>
  );
}

function ComingSoonRow() {
  const cards = [
    {
      icon: Video,
      title: "Video scenes",
      body: "Batch clip person-removal with temporal consistency. Needs a Replicate connection (paid credits) — ProPainter or similar.",
    },
    {
      icon: Rotate3d,
      title: "True 3D rotation",
      body: "The current angles are AI-synthesized from a single 2D frame. Full 3D novel-view synthesis needs a NeRF/gaussian-splatting model — planned next.",
    },
  ];
  return (
    <section className="mt-12 grid gap-4 md:grid-cols-2">
      {cards.map(({ icon: Icon, title, body }) => (
        <div key={title} className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            <Icon className="h-3 w-3" /> Coming next
          </div>
          <div className="text-sm text-neutral-200">{title}</div>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{body}</p>
        </div>
      ))}
    </section>
  );
}
