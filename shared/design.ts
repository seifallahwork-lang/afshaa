/**
 * A player's meme = text boxes + freehand drawing on top of the template.
 * Positions are percentages of the image (0–100), drawing points are 0–1000,
 * so the meme looks the same on every screen size.
 *
 * sanitizeDesign() is used by the server (authoritative) and the browser
 * (to disable "Submit" on an empty meme).
 */
import { containsBlockedWord } from "./moderation";
import { cleanText, textLength, truncate } from "./text";

export const TEXT_COLORS = ["#FFFFFF", "#000000", "#FFD23F", "#E4007C", "#0FA3B1", "#E63946", "#6CBF43", "#3D8BFF"] as const;
export const BG_COLORS = ["transparent", ...TEXT_COLORS] as const;
export const DRAW_COLORS = ["#E63946", "#FFD23F", "#FFFFFF", "#000000", "#0FA3B1", "#E4007C"] as const;
export const DRAW_WIDTHS = [1, 2, 3] as const;

export const DESIGN_LIMITS = {
  maxBoxes: 6,
  maxBoxChars: 150,
  maxTotalChars: 300,
  maxStrokes: 40,
  maxPoints: 2400, // numbers (x,y pairs) across all strokes
  minBoxSize: 8,
  minFont: 3,
  maxFont: 14,
  defaultFont: 7,
} as const;

export interface TextBox {
  id: string;
  text: string;
  x: number; // left, % of image width
  y: number; // top, % of image height
  w: number; // width %
  h: number; // height %
  color: string;
  bg: string;
  rounded: boolean;
  size: number; // font size in % of image width
  /** Rotation in degrees (−180…180). */
  rotate: number;
  /** Outline around the letters (classic meme look). */
  outline: boolean;
}

/** Crop window on the template, in % of the original image. `ar` = original width / height. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
  ar: number;
}

/** A caption bar outside the image (above or below it), like a tweet over a picture. */
export interface Strip {
  text: string;
  position: "top" | "bottom";
  color: string;
  bg: string;
}

export interface Stroke {
  color: string;
  width: number; // 1..3
  points: number[]; // [x0, y0, x1, y1, ...] each 0..1000
}

export interface MemeDesign {
  boxes: TextBox[];
  strokes: Stroke[];
  crop?: Crop | null;
  strip?: Strip | null;
}

export type DesignErrorCode = "EMPTY_CAPTION" | "CAPTION_TOO_LONG" | "BLOCKED_WORD" | "BAD_REQUEST";

export class DesignError extends Error {
  constructor(public readonly code: DesignErrorCode) {
    super(code);
  }
}

const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v * 10) / 10)) : fallback;

const pick = <T extends readonly string[]>(v: unknown, list: T, fallback: T[number]) =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;

/** Validate + normalize. Throws DesignError. */
export function sanitizeDesign(raw: unknown): MemeDesign {
  if (!raw || typeof raw !== "object") throw new DesignError("BAD_REQUEST");
  const r = raw as { boxes?: unknown; strokes?: unknown; crop?: any; strip?: any };
  const rawBoxes = Array.isArray(r.boxes) ? r.boxes.slice(0, DESIGN_LIMITS.maxBoxes) : [];
  const rawStrokes = Array.isArray(r.strokes) ? r.strokes.slice(0, DESIGN_LIMITS.maxStrokes) : [];

  let totalChars = 0;
  const boxes: TextBox[] = [];
  rawBoxes.forEach((b: any, i: number) => {
    if (!b || typeof b !== "object") return;
    const text = cleanText(typeof b.text === "string" ? b.text : "");
    if (!text) return; // empty boxes are dropped
    if (textLength(text) > DESIGN_LIMITS.maxBoxChars) throw new DesignError("CAPTION_TOO_LONG");
    totalChars += textLength(text);
    if (containsBlockedWord(text)) throw new DesignError("BLOCKED_WORD");
    const w = num(b.w, DESIGN_LIMITS.minBoxSize, 100, 80);
    const h = num(b.h, DESIGN_LIMITS.minBoxSize, 100, 18);
    boxes.push({
      id: typeof b.id === "string" ? truncate(b.id, 12) : `b${i}`,
      text,
      w,
      h,
      x: num(b.x, 0, 100 - w, 10),
      y: num(b.y, 0, 100 - h, 75),
      color: pick(b.color, TEXT_COLORS, "#FFFFFF"),
      bg: pick(b.bg, BG_COLORS, "transparent"),
      rounded: b.rounded === true,
      size: num(b.size, DESIGN_LIMITS.minFont, DESIGN_LIMITS.maxFont, DESIGN_LIMITS.defaultFont),
      rotate: Math.round(num(b.rotate, -180, 180, 0)),
      outline: typeof b.outline === "boolean" ? b.outline : pick(b.bg, BG_COLORS, "transparent") === "transparent",
    });
  });
  if (totalChars > DESIGN_LIMITS.maxTotalChars) throw new DesignError("CAPTION_TOO_LONG");

  let pointBudget = DESIGN_LIMITS.maxPoints;
  const strokes: Stroke[] = [];
  for (const s of rawStrokes as any[]) {
    if (!s || !Array.isArray(s.points) || pointBudget <= 0) continue;
    const pts = s.points
      .slice(0, Math.min(s.points.length, pointBudget) & ~1)
      .map((v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1000, Math.max(0, Math.round(v))) : 0));
    if (pts.length < 4) continue; // at least 2 points
    pointBudget -= pts.length;
    strokes.push({
      color: pick(s.color, DRAW_COLORS, "#E63946"),
      width: (DRAW_WIDTHS as readonly number[]).includes(s.width) ? s.width : 2,
      points: pts,
    });
  }

  let crop: Crop | null = null;
  if (r.crop && typeof r.crop === "object") {
    const w = num(r.crop.w, 10, 100, 100);
    const h = num(r.crop.h, 10, 100, 100);
    crop = { w, h, x: num(r.crop.x, 0, 100 - w, 0), y: num(r.crop.y, 0, 100 - h, 0), ar: Math.min(5, Math.max(0.2, Number(r.crop.ar) || 1)) };
    if (w === 100 && h === 100) crop = null;
  }

  let strip: Strip | null = null;
  if (r.strip && typeof r.strip === "object") {
    const text = cleanText(typeof r.strip.text === "string" ? r.strip.text : "");
    if (text) {
      if (textLength(text) > DESIGN_LIMITS.maxBoxChars) throw new DesignError("CAPTION_TOO_LONG");
      if (containsBlockedWord(text)) throw new DesignError("BLOCKED_WORD");
      strip = {
        text,
        position: r.strip.position === "top" ? "top" : "bottom",
        color: pick(r.strip.color, TEXT_COLORS, "#000000"),
        bg: pick(r.strip.bg, TEXT_COLORS, "#FFFFFF"),
      };
    }
  }

  if (boxes.length === 0 && strokes.length === 0 && !strip) throw new DesignError("EMPTY_CAPTION");
  return { boxes, strokes, crop, strip };
}

/** True when there's nothing to submit (no text and no drawing). */
export function isDesignEmpty(d: MemeDesign): boolean {
  return !d.boxes.some((b) => b.text.trim()) && d.strokes.every((s) => s.points.length < 4) && !d.strip?.text.trim();
}

/** Lenient version for drafts: returns null instead of throwing. */
export function tryDesign(raw: unknown): MemeDesign | null {
  try {
    return sanitizeDesign(raw);
  } catch {
    return null;
  }
}

/** All text in a meme, for lists and accessibility. */
export function designText(d: MemeDesign): string {
  return [d.strip?.text, ...d.boxes.map((b) => b.text)].filter(Boolean).join(" — ");
}
