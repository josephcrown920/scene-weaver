import type { Grade } from "@/lib/grade";

export type AssetKind = "source" | "plate" | "angle" | "cast" | "swap" | "variation";

export interface CastMember {
  id: string;
  name: string;
  description: string;
  reference?: string | null;
}

export interface GalleryEntry {
  id: string;
  itemId: string;
  itemName: string;
  kind: AssetKind;
  label: string;
  src: string;
  grade: Grade;
}

export interface Shot {
  id: string;
  src: string;
  name: string;
  caption: string;
  shotType: string;
  selected: boolean;
  grade: Grade;
}

export type MotionKey =
  | "static"
  | "push-in"
  | "pull-out"
  | "pan-left"
  | "pan-right"
  | "tilt-up"
  | "tilt-down"
  | "orbit-left"
  | "orbit-right"
  | "handheld";

export const MOTIONS: { key: MotionKey; label: string }[] = [
  { key: "static", label: "Static" },
  { key: "push-in", label: "Push in" },
  { key: "pull-out", label: "Pull out" },
  { key: "pan-left", label: "Pan left" },
  { key: "pan-right", label: "Pan right" },
  { key: "tilt-up", label: "Tilt up" },
  { key: "tilt-down", label: "Tilt down" },
  { key: "orbit-left", label: "Orbit left" },
  { key: "orbit-right", label: "Orbit right" },
  { key: "handheld", label: "Handheld" },
];

/** Camera transform for a clip at progress p (0..1). */
export function motionTransform(motion: MotionKey, strength: number, p: number) {
  const s = strength; // 0..1
  const e = p * p * (3 - 2 * p); // ease in-out
  let zoom = 1.04;
  let dx = 0;
  let dy = 0;
  let rot = 0;
  switch (motion) {
    case "push-in":
      zoom = 1.02 + e * 0.18 * s;
      break;
    case "pull-out":
      zoom = 1.02 + (1 - e) * 0.18 * s;
      break;
    case "pan-left":
      zoom = 1.12;
      dx = (0.5 - e) * 0.16 * s;
      break;
    case "pan-right":
      zoom = 1.12;
      dx = (e - 0.5) * 0.16 * s;
      break;
    case "tilt-up":
      zoom = 1.12;
      dy = (0.5 - e) * 0.16 * s;
      break;
    case "tilt-down":
      zoom = 1.12;
      dy = (e - 0.5) * 0.16 * s;
      break;
    case "orbit-left":
      zoom = 1.14 + e * 0.04 * s;
      dx = (0.5 - e) * 0.14 * s;
      rot = (0.5 - e) * 2.4 * s;
      break;
    case "orbit-right":
      zoom = 1.14 + e * 0.04 * s;
      dx = (e - 0.5) * 0.14 * s;
      rot = (e - 0.5) * 2.4 * s;
      break;
    case "handheld":
      zoom = 1.1 + e * 0.03 * s;
      dx = Math.sin(p * Math.PI * 6) * 0.012 * s;
      dy = Math.cos(p * Math.PI * 5) * 0.01 * s;
      rot = Math.sin(p * Math.PI * 4) * 0.5 * s;
      break;
    default:
      zoom = 1.04;
  }
  return { zoom, dx, dy, rot };
}

export interface Clip {
  id: string;
  src: string;
  name: string;
  duration: number; // seconds
  grade: Grade;
  motion?: MotionKey;
  motionStrength?: number; // 0..1
}

export const SHOT_TYPES = [
  "Establishing",
  "Wide",
  "Medium",
  "Close-up",
  "Insert",
  "Over-the-shoulder",
  "Aerial",
  "POV",
];
