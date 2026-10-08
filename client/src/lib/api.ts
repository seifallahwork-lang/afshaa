import type { Avatar } from "@shared/avatar";
import type { ApiError, ErrorCode, SessionResponse } from "@shared/protocol";
import { SERVER_URL } from "./config";

export class ApiFailure extends Error {
  constructor(public readonly code: ErrorCode | "NETWORK") {
    super(code);
  }
}

async function post(path: string, body: unknown): Promise<SessionResponse> {
  if (!SERVER_URL) throw new ApiFailure("NETWORK");
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure("NETWORK");
  }
  const data = (await res.json().catch(() => ({ error: "SERVER_ERROR" }))) as SessionResponse | ApiError;
  if (!res.ok || "error" in data) throw new ApiFailure("error" in data ? data.error : "SERVER_ERROR");
  return data;
}

export const createRoom = (name: string, avatar: Avatar) => post("/api/rooms", { name, avatar });
export const joinRoom = (code: string, name: string, avatar: Avatar) => post(`/api/rooms/${code}/join`, { name, avatar });
