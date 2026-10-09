import type { Avatar } from "@shared/avatar";
import type { ApiError, ErrorCode, SessionResponse } from "@shared/protocol";
import { SERVER_URL } from "./config";

export class ApiFailure extends Error {
  constructor(public readonly code: ErrorCode | "NETWORK") {
    super(code);
  }
}

const RETRY_DELAYS = [600, 1500, 3000];

async function once(path: string, body: unknown): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 10_000);
  try {
    return await fetch(`${SERVER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * POST with automatic retries: a dropped request, a timeout or a temporary
 * server error (5xx) is retried up to 3 times before showing an error.
 */
async function post(path: string, body: unknown): Promise<SessionResponse> {
  if (!SERVER_URL) throw new ApiFailure("NETWORK");
  let lastError: ApiFailure = new ApiFailure("NETWORK");
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
    let res: Response;
    try {
      res = await once(path, body);
    } catch {
      lastError = new ApiFailure("NETWORK");
      continue;
    }
    const data = (await res.json().catch(() => ({ error: "SERVER_ERROR" }))) as SessionResponse | ApiError;
    if (res.ok && !("error" in data)) return data;
    const code = "error" in data ? data.error : "SERVER_ERROR";
    lastError = new ApiFailure(code);
    if (res.status < 500) throw lastError; // a real answer (room full, wrong code…) — don't retry
  }
  throw lastError;
}

/** Wake the server up as soon as the page opens, so "Create game" is instant. */
export function warmUp(): void {
  if (!SERVER_URL) return;
  fetch(`${SERVER_URL}/api/health`, { cache: "no-store" }).catch(() => undefined);
}

export const createRoom = (name: string, avatar: Avatar) => post("/api/rooms", { name, avatar });
export const joinRoom = (code: string, name: string, avatar: Avatar) => post(`/api/rooms/${code}/join`, { name, avatar });
