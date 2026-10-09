import type { GameRoom } from "./room";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  /** Comma-separated list of allowed website origins, or "*" (see wrangler.jsonc). */
  ALLOWED_ORIGINS: string;
  /** Google Drive folder with the meme images (set in wrangler.jsonc). */
  DRIVE_FOLDER_ID?: string;
  /** Google API key with Drive API enabled (Cloudflare secret, never in code). */
  GOOGLE_API_KEY?: string;
}
