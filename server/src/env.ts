import type { GameRoom } from "./room";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  /** Comma-separated list of allowed website origins, or "*" (see wrangler.jsonc). */
  ALLOWED_ORIGINS: string;
}
