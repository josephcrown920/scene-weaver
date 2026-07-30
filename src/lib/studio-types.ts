import type { Grade } from "@/lib/grade";

export type AssetKind = "source" | "plate" | "angle" | "cast" | "swap";

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

export interface Clip {
  id: string;
  src: string;
  name: string;
  duration: number; // seconds
  grade: Grade;
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
