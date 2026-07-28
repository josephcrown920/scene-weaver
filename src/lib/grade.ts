export interface Grade {
  exposure: number; // 0.5 - 1.6
  contrast: number; // 0.5 - 1.8
  saturation: number; // 0 - 2
  temp: number; // -100 (cool) .. 100 (warm)
  hue: number; // -60 .. 60 deg
  diffusion: number; // 0 .. 100 (bloom / soft)
  vignette: number; // 0 .. 100
}

export const NEUTRAL_GRADE: Grade = {
  exposure: 1,
  contrast: 1,
  saturation: 1,
  temp: 0,
  hue: 0,
  diffusion: 0,
  vignette: 0,
};

export interface Preset {
  key: string;
  label: string;
  blurb: string;
  grade: Grade;
}

export const PRESETS: Preset[] = [
  {
    key: "neutral",
    label: "Neutral",
    blurb: "No grade — straight off the plate.",
    grade: { ...NEUTRAL_GRADE },
  },
  {
    key: "night-teal",
    label: "Night Teal",
    blurb: "Cool shadows, crushed blacks — night exteriors, car work.",
    grade: { exposure: 0.96, contrast: 1.18, saturation: 1.05, temp: -32, hue: -6, diffusion: 12, vignette: 34 },
  },
  {
    key: "warm-film",
    label: "Warm Film",
    blurb: "Golden highlights and soft roll-off — daylight, portraits.",
    grade: { exposure: 1.05, contrast: 1.08, saturation: 1.12, temp: 36, hue: 3, diffusion: 18, vignette: 20 },
  },
  {
    key: "noir",
    label: "Noir",
    blurb: "High-contrast monochrome — dramatic, graphic frames.",
    grade: { exposure: 0.98, contrast: 1.42, saturation: 0, temp: -8, hue: 0, diffusion: 8, vignette: 46 },
  },
  {
    key: "bleach",
    label: "Bleach Bypass",
    blurb: "Desaturated and hard — gritty action and street.",
    grade: { exposure: 1.06, contrast: 1.34, saturation: 0.55, temp: -6, hue: 0, diffusion: 4, vignette: 28 },
  },
  {
    key: "dream",
    label: "Dream",
    blurb: "Lifted blacks, heavy bloom — soft, romantic scenes.",
    grade: { exposure: 1.1, contrast: 0.92, saturation: 1.18, temp: 14, hue: -4, diffusion: 40, vignette: 12 },
  },
  {
    key: "neon",
    label: "Neon City",
    blurb: "Saturated magenta/cyan — nightlife, signage, wet asphalt.",
    grade: { exposure: 1, contrast: 1.22, saturation: 1.45, temp: -18, hue: 12, diffusion: 26, vignette: 30 },
  },
  {
    key: "desert",
    label: "Desert Sun",
    blurb: "Hot, dusty, blown highlights — open daylight exteriors.",
    grade: { exposure: 1.12, contrast: 1.12, saturation: 1.02, temp: 48, hue: -3, diffusion: 10, vignette: 16 },
  },
  {
    key: "cold-steel",
    label: "Cold Steel",
    blurb: "Clean blue-grey, low sat — interiors, tech, product.",
    grade: { exposure: 1.02, contrast: 1.14, saturation: 0.82, temp: -44, hue: 4, diffusion: 6, vignette: 18 },
  },
];

export function presetByKey(key: string): Preset | undefined {
  return PRESETS.find((p) => p.key === key);
}

export function isNeutral(g: Grade): boolean {
  return (
    g.exposure === 1 &&
    g.contrast === 1 &&
    g.saturation === 1 &&
    g.temp === 0 &&
    g.hue === 0 &&
    g.diffusion === 0 &&
    g.vignette === 0
  );
}

/** CSS filter string used for live previews. */
export function gradeCss(g: Grade): string {
  return [
    `brightness(${g.exposure})`,
    `contrast(${g.contrast})`,
    `saturate(${g.saturation})`,
    `hue-rotate(${g.hue}deg)`,
  ].join(" ");
}

export function tintRgba(g: Grade): string {
  const a = Math.min(0.35, Math.abs(g.temp) / 100 * 0.35);
  if (a <= 0.001) return "rgba(0,0,0,0)";
  return g.temp > 0 ? `rgba(255,168,74,${a})` : `rgba(74,150,255,${a})`;
}

/** Draws a graded copy of `img` into a 2D context sized w x h. */
export function drawGraded(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  w: number,
  h: number,
  g: Grade,
) {
  ctx.save();
  ctx.filter = gradeCss(g);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";

  if (g.diffusion > 0) {
    ctx.globalAlpha = Math.min(0.5, g.diffusion / 200);
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = `blur(${Math.max(2, (g.diffusion / 100) * (Math.min(w, h) / 40))}px) ${gradeCss(g)}`;
    ctx.drawImage(img, 0, 0, w, h);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  const tint = tintRgba(g);
  if (tint !== "rgba(0,0,0,0)") {
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  if (g.vignette > 0) {
    const grd = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.25,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.72,
    );
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, g.vignette / 100)})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
