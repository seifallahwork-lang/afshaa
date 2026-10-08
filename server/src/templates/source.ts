/**
 * Where the game gets its memes:
 *   1. Google Drive folder (DRIVE_FOLDER_ID + GOOGLE_API_KEY) — preferred.
 *   2. shared/templates.json — fallback if Drive isn't configured, fails, or is empty.
 *
 * The Drive list is cached for a few minutes, so a newly uploaded meme shows up
 * in the next game within ~5 minutes without redeploying anything.
 */
import { getActiveTemplates, type MemeTemplate } from "../../../shared/templates";
import type { Env } from "../env";
import { loadDriveTemplates } from "./drive";

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; templates: MemeTemplate[] } | null = null;

export async function getTemplates(env: Env, categories: string[] | null = null): Promise<MemeTemplate[]> {
  const all = await loadAll(env);
  if (!categories || categories.length === 0) return all;
  const filtered = all.filter((t) => t.categories.some((c) => categories.includes(c)));
  return filtered.length > 0 ? filtered : all;
}

async function loadAll(env: Env): Promise<MemeTemplate[]> {
  if (!env.GOOGLE_API_KEY || !env.DRIVE_FOLDER_ID) return getActiveTemplates();
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.templates;
  try {
    const templates = await loadDriveTemplates(env.DRIVE_FOLDER_ID, env.GOOGLE_API_KEY);
    if (templates.length > 0) {
      cache = { at: Date.now(), templates };
      return templates;
    }
    console.warn("Drive folder has no images yet — using the built-in templates");
  } catch (e) {
    console.error("Could not load templates from Google Drive — using the built-in templates", e);
    if (cache) return cache.templates; // last good list beats the placeholders
  }
  return getActiveTemplates();
}

/** Debug info for GET /api/templates (no secrets). */
export async function describeTemplates(env: Env) {
  const list = await loadAll(env);
  const fromDrive = list.some((t) => t.id.startsWith("gd_"));
  return {
    source: fromDrive ? "google-drive" : "built-in",
    driveConfigured: Boolean(env.GOOGLE_API_KEY && env.DRIVE_FOLDER_ID),
    count: list.length,
    templates: list.map((t) => ({ name: t.name, categories: t.categories, captionPosition: t.captionPosition })),
  };
}
