/**
 * Where the game server lives.
 * - Production: VITE_GAME_SERVER_URL (set in Vercel → Settings → Environment Variables).
 * - Local dev: falls back to the local Cloudflare runtime on port 8787 —
 *   using the same hostname as the page so phones on your Wi-Fi work too.
 */
const fromEnv = (import.meta.env.VITE_GAME_SERVER_URL as string | undefined)?.trim().replace(/\/$/, "");

export const SERVER_URL: string | null =
  fromEnv || (import.meta.env.DEV ? `${location.protocol}//${location.hostname}:8787` : null);

export const WS_URL = SERVER_URL?.replace(/^http/, "ws") ?? null;
