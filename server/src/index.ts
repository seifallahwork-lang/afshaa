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
import { describeTemplates } from "./templates/source";

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    const parts = url.pathname.split("/").filter(Boolean); // ["api", "rooms", ":code", ...]

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.headers.get("Origin") && !origin) return new Response("Origin not allowed", { status: 403 });

    if (url.pathname === "/" || url.pathname === "/api/health") {
      return new Response("Afsha game server is running ✔", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    // GET /api/templates — check which memes the server sees (handy after uploading to Drive).
    if (url.pathname === "/api/templates") return json(await describeTemplates(env), 200, origin);

    if (parts[0] !== "api" || parts[1] !== "rooms") return fail("BAD_REQUEST", origin);

    // POST /api/rooms — create a room with a fresh, unused 6-digit code.
    if (parts.length === 2 && request.method === "POST") {
      const { name, avatar } = await readBody(request);
      for (let attempt = 0; attempt < 15; attempt++) {
        const code = randomRoomCode();
        const result = await roomStub(env, code).create(code, name, avatar);
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
      const result = await roomStub(env, code).join(name, avatar);
      return result.ok ? json(result.value, 200, origin) : fail(result.error, origin);
    }

    // GET /api/rooms/:code/ws — hand the WebSocket to the room.
    if (parts[3] === "ws" && request.headers.get("Upgrade") === "websocket") {
      return roomStub(env, code).fetch(request);
    }

    return fail("BAD_REQUEST", origin);
  },
} satisfies ExportedHandler<Env>;
