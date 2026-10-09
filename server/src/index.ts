/**
 * Worker entry point: a tiny HTTP router in front of the room Durable Objects.
 *
 *   GET  /api/health                 -> "ok"
 *   POST /api/rooms                  {name}  -> {code, playerId, token}
 *   POST /api/rooms/:code/join       {name}  -> {code, playerId, token}
 *   GET  /api/rooms/:code/ws?token=  (WebSocket upgrade)
 */
import type { ApiError, ErrorCode } from "../../shared/protocol";
import { normalizeDigits } from "../../shared/text";
import type { Env } from "./env";
import { randomRoomCode } from "./game/random";
import type { RpcResult } from "./room";
import type { SessionResponse } from "../../shared/protocol";
import { describeTemplates } from "./templates/source";
import { driveThumbUrl } from "./templates/drive";

export { GameRoom } from "./room";

const MAX_BODY = 2048;
const STATUS: Partial<Record<ErrorCode, number>> = {
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  GAME_STARTED: 409,
  NAME_TAKEN: 409,
  INVALID_NAME: 400,
  BLOCKED_WORD: 400,
  INVALID_CODE: 400,
  BAD_REQUEST: 400,
};

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "*").split(",").map((o) => o.trim()).filter(Boolean);
  if (allowed.includes("*")) return origin ?? "*";
  if (origin && allowed.includes(origin)) return origin;
  return null;
}

function cors(origin: string | null): Record<string, string> {
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      }
    : {};
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(origin) },
  });
}

const fail = (code: ErrorCode, origin: string | null) =>
  json({ error: code } satisfies ApiError, STATUS[code] ?? 500, origin);

async function readBody(request: Request): Promise<{ name?: unknown; avatar?: unknown }> {
  const text = await request.text();
  if (text.length > MAX_BODY) return {};
  try {
    return JSON.parse(text) ?? {};
  } catch {
    return {};
  }
}

function roomStub(env: Env, code: string) {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

/** Durable Object calls can fail briefly (e.g. right after a deploy). Retry those a few times. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retryable = (e as { retryable?: boolean })?.retryable !== false;
      if (!retryable || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 150 * 2 ** i));
    }
  }
  throw last;
}

/**
 * GET /api/img/:driveFileId — meme images, fetched from Google Drive once and
 * then served from Cloudflare's cache (fast for players, works with canvas).
 */
async function serveImage(fileId: string, request: Request, ctx: ExecutionContext): Promise<Response> {
  if (!/^[\w-]{10,100}$/.test(fileId)) return new Response("Bad image id", { status: 400 });
  const cache = caches.default;
  const key = new Request(new URL(`/api/img/${fileId}`, request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  let upstream: Response | null = null;
  for (const url of [driveThumbUrl(fileId, 1200), `https://lh3.googleusercontent.com/d/${fileId}=w1200`]) {
    try {
      const r = await fetch(url, { redirect: "follow", cf: { cacheTtl: 86400, cacheEverything: true } });
      if (r.ok && (r.headers.get("content-type") ?? "").startsWith("image/")) {
        upstream = r;
        break;
      }
    } catch {
      /* try the next source */
    }
  }
  if (!upstream) return new Response("Image not available", { status: 502, headers: { "Access-Control-Allow-Origin": "*" } });
  const res = new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handle(request, env, ctx);
    } catch (e) {
      // Never let an exception reach the browser without CORS headers —
      // otherwise it shows up as a "network" failure instead of a retryable server error.
      console.error("Unhandled error", e);
      return json({ error: "SERVER_ERROR" } satisfies ApiError, 503, allowedOrigin(request, env));
    }
  },
} satisfies ExportedHandler<Env>;

async function handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    const parts = url.pathname.split("/").filter(Boolean); // ["api", "rooms", ":code", ...]

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.headers.get("Origin") && !origin) return new Response("Origin not allowed", { status: 403 });

    if (parts[0] === "api" && parts[1] === "img" && parts[2] && request.method === "GET") {
      return serveImage(parts[2], request, ctx);
    }

    if (url.pathname === "/" || url.pathname === "/api/health") {
      return new Response("Afsha game server is running ✔", {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...cors(origin) },
      });
    }
    // GET /api/templates — check which memes the server sees (handy after uploading to Drive).
    if (url.pathname === "/api/templates") return json(await describeTemplates(env), 200, origin);

    if (parts[0] !== "api" || parts[1] !== "rooms") return fail("BAD_REQUEST", origin);

    // POST /api/rooms — create a room with a fresh, unused 6-digit code.
    if (parts.length === 2 && request.method === "POST") {
      const { name, avatar } = await readBody(request);
      for (let attempt = 0; attempt < 15; attempt++) {
        const code = randomRoomCode();
        const result: RpcResult<SessionResponse> = await withRetry(async () => (await roomStub(env, code).create(code, name, avatar)) as RpcResult<SessionResponse>);
        if (result.ok) return json(result.value, 201, origin);
        if (result.error !== "CODE_IN_USE") return fail(result.error, origin);
      }
      return fail("SERVER_ERROR", origin);
    }

    const code = normalizeDigits(parts[2] ?? "");
    if (!/^\d{6}$/.test(code)) return fail("INVALID_CODE", origin);

    // POST /api/rooms/:code/join
    if (parts[3] === "join" && request.method === "POST") {
      const { name, avatar } = await readBody(request);
      const result: RpcResult<SessionResponse> = await withRetry(async () => (await roomStub(env, code).join(name, avatar)) as RpcResult<SessionResponse>);
      return result.ok ? json(result.value, 200, origin) : fail(result.error, origin);
    }

    // GET /api/rooms/:code/ws — hand the WebSocket to the room.
    if (parts[3] === "ws" && request.headers.get("Upgrade") === "websocket") {
      return roomStub(env, code).fetch(request);
    }

    return fail("BAD_REQUEST", origin);
  }
}
