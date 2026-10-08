/**
 * Meme template model + loader.
 *
 * The template LIST lives in `templates.json` (pure data). To add a meme you
 * only touch that file and drop an image in client/public/templates/.
 * Later this file is the single place to swap the source for a database or
 * cloud bucket — the game logic only ever calls `getActiveTemplates()`.
 */
import raw from "./templates.json";

export const TEMPLATE_CATEGORIES = [
  "Egyptian",
  "Arabic",
  "TV",
  "Movies",
  "Football",
  "University",
  "Work",
  "Relationships",
  "Family",
  "Everyday Life",
  "Social Media",
  "Random",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface MemeTemplate {
  id: string;
  /** Path under client/public (e.g. "/templates/egypt_001.jpg") or a full https:// URL. */
  image: string;
  name: string;
  /** Known categories are listed above; Drive sub-folder names are also allowed. */
  categories: (TemplateCategory | string)[];
  /** Where the caption is drawn on the image. Default "bottom". */
  captionPosition?: "top" | "bottom";
  /** Set to false to hide a template without deleting it. Default true. */
  enabled?: boolean;
}

const ALL_TEMPLATES = (raw as { templates: MemeTemplate[] }).templates;

/** Enabled templates, optionally filtered by category (null = all). */
export function getActiveTemplates(categories: string[] | null = null): MemeTemplate[] {
  const enabled = ALL_TEMPLATES.filter((t) => t.enabled !== false);
  if (!categories || categories.length === 0) return enabled;
  const filtered = enabled.filter((t) => t.categories.some((c) => categories.includes(c)));
  return filtered.length > 0 ? filtered : enabled;
}
