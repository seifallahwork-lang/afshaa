/**
 * One Durable Object = one game room. Cloudflare guarantees a single instance
 * per room code worldwide, so this object is the authoritative source of truth.
 *
 * - WebSockets use the Hibernation API: the room sleeps (and costs nothing)
 *   between messages, then wakes with its sockets still attached.
 * - Timers use Durable Object alarms, so phases advance on the SERVER clock
 *   even if every browser is closed.
 * - State is persisted after every change, so a wake-up or restart loses nothing.
 */
import { DurableObject } from "cloudflare:workers";
import { CLOSE_CODES, type ClientMessage, type ErrorCode, type ServerMessage, type SessionResponse } from "../../shared/protocol";
import {
  addPlayer,
  castVote,
  createRoomState,
  findByToken,
  findPlayer,
  leave,
  markConnected,
  markDisconnected,
  nextWakeAt,
  playAgain,
  returnToLobby,
  skip,
  startGame,
  submitCaption,
  tick,
  updateSettings,
} from "./game/engine";
import { GameError } from "./game/errors";
import type { RoomState } from "./game/types";
import { buildView } from "./game/view";
import type { Env } from "./env";

const STATE_KEY = "state";
const MAX_MESSAGE_BYTES = 4096;

type Attachment = { playerId: string };

export type RpcResult<T> = { ok: true; value: T } | { ok: false; error: ErrorCode };

export class GameRoom extends DurableObject<Env> {
  private state: RoomState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<RoomState>(STATE_KEY)) ?? null;
    });
    // Heartbeats are answered by Cloudflare without waking the room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /* ---------------- RPC (called by the Worker) ---------------- */

  /** Create this room with its host. Fails if the code is already in use. */
  async create(code: string, hostName: unknown): Promise<RpcResult<SessionResponse>> {
    const now = Date.now();
    if (this.state && !tick(this.state, now)) return { ok: false, error: "CODE_IN_USE" }; // collision → the Worker retries with a new code
    await this.destroy(false);
    const s = createRoomState(code, now);
    try {
      const host = addPlayer(s, hostName, now);
      this.state = s;
      await this.commit(now);
      return { ok: true, value: { code, playerId: host.id, token: host.token } };
    } catch (e) {
      return { ok: false, error: e instanceof GameError ? e.code : "SERVER_ERROR" };
    }
  }

  async join(name: unknown): Promise<RpcResult<SessionResponse>> {
    const now = Date.now();
    const s = this.state;
    if (!s) return { ok: false, error: "ROOM_NOT_FOUND" };
    this.syncConnections(now);
    if (tick(s, now)) {
      await this.destroy(true);
      return { ok: false, error: "ROOM_NOT_FOUND" };
    }
    try {
      const p = addPlayer(s, name, now);
      await this.commit(now);
      return { ok: true, value: { code: s.code, playerId: p.id, token: p.token } };
    } catch (e) {
      return { ok: false, error: e instanceof GameError ? e.code : "SERVER_ERROR" };
    }
  }

  async exists(): Promise<boolean> {
    return this.state !== null;
  }

  /* ---------------- WebSocket ---------------- */

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const now = Date.now();

    const player = this.state ? findByToken(this.state, token) : undefined;
    if (!this.state || !player) {
      // Accept then close with a code the browser can read (an HTTP error would look like a network failure).
      server.accept();
      const reason = this.state ? "INVALID_TOKEN" : "EXPIRED";
      server.send(JSON.stringify({ type: "closed", reason } satisfies ServerMessage));
      server.close(this.state ? CLOSE_CODES.INVALID_TOKEN : CLOSE_CODES.ROOM_GONE, reason);
      return new Response(null, { status: 101, webSocket: client });
    }

    this.ctx.acceptWebSocket(server, [player.id]);
    server.serializeAttachment({ playerId: player.id } satisfies Attachment);
    markConnected(this.state, player.id, now);
    await this.commit(now);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const now = Date.now();
    const s = this.state;
    const { playerId } = (ws.deserializeAttachment() ?? {}) as Partial<Attachment>;
    if (!s || !playerId || !findPlayer(s, playerId)) {
      ws.close(CLOSE_CODES.INVALID_TOKEN, "INVALID_TOKEN");
      return;
    }
    if (typeof data !== "string" || data.length > MAX_MESSAGE_BYTES) return this.sendError(ws, "BAD_REQUEST");

    let msg: ClientMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return this.sendError(ws, "BAD_REQUEST");
    }

    this.syncConnections(now);
    tick(s, now); // apply anything that was due before handling the action
    try {
      switch (msg?.type) {
        case "start":
          startGame(s, playerId, now);
          break;
        case "updateSettings":
          updateSettings(s, playerId, msg.settings);
          break;
        case "submitCaption":
          submitCaption(s, playerId, msg.caption, now);
          break;
        case "vote":
          castVote(s, playerId, msg.submissionId, now);
          break;
        case "skip":
          skip(s, playerId, now);
          break;
        case "playAgain":
          playAgain(s, playerId, now);
          break;
        case "returnToLobby":
          returnToLobby(s, playerId);
          break;
        case "leave":
          leave(s, playerId, now);
          ws.send(JSON.stringify({ type: "closed", reason: "LEFT" } satisfies ServerMessage));
          ws.close(CLOSE_CODES.LEFT, "LEFT");
          break;
        default:
          throw new GameError("BAD_REQUEST");
      }
    } catch (e) {
      if (e instanceof GameError) this.sendError(ws, e.code);
      else {
        console.error("action failed", e);
        this.sendError(ws, "SERVER_ERROR");
      }
    }
    await this.commit(now);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  private async handleSocketGone(ws: WebSocket): Promise<void> {
    const s = this.state;
    if (!s) return;
    const { playerId } = (ws.deserializeAttachment() ?? {}) as Partial<Attachment>;
    if (!playerId) return;
    const now = Date.now();
    const stillOpen = this.ctx.getWebSockets(playerId).some((w) => w !== ws && w.readyState === WebSocket.OPEN);
    if (!stillOpen) markDisconnected(s, playerId, now);
    await this.commit(now);
  }

  /* ---------------- Timers ---------------- */

  async alarm(): Promise<void> {
    if (!this.state) return;
    const now = Date.now();
    this.syncConnections(now);
    await this.commit(now);
  }

  /* ---------------- Helpers ---------------- */

  /** Players marked connected without a live socket (e.g. after a server restart) become disconnected. */
  private syncConnections(now: number): void {
    const s = this.state;
    if (!s) return;
    for (const p of s.players) {
      if (p.connected && !this.ctx.getWebSockets(p.id).some((w) => w.readyState === WebSocket.OPEN)) {
        markDisconnected(s, p.id, now);
      }
    }
  }

  /** Apply due timers, persist, schedule the next wake-up and push views to everyone. */
  private async commit(now: number): Promise<void> {
    const s = this.state;
    if (!s) return;
    if (tick(s, now)) {
      await this.destroy(true);
      return;
    }
    await this.ctx.storage.put(STATE_KEY, s);
    await this.ctx.storage.setAlarm(nextWakeAt(s));
    this.broadcast(now);
  }

  private broadcast(now: number): void {
    const s = this.state;
    if (!s) return;
    for (const ws of this.ctx.getWebSockets()) {
      const { playerId } = (ws.deserializeAttachment() ?? {}) as Partial<Attachment>;
      if (!playerId || !findPlayer(s, playerId) || findPlayer(s, playerId)?.left) {
        this.safeClose(ws, CLOSE_CODES.INVALID_TOKEN, "INVALID_TOKEN");
        continue;
      }
      const msg: ServerMessage = { type: "state", state: buildView(s, playerId), serverNow: now };
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        /* socket already closing */
      }
    }
  }

  private sendError(ws: WebSocket, code: ErrorCode): void {
    try {
      ws.send(JSON.stringify({ type: "error", code } satisfies ServerMessage));
    } catch {
      /* ignore */
    }
  }

  private safeClose(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      /* ignore */
    }
  }

  /** Wipe the room. `notify` tells connected players it's gone. */
  private async destroy(notify: boolean): Promise<void> {
    if (notify) {
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(JSON.stringify({ type: "closed", reason: "EXPIRED" } satisfies ServerMessage));
        } catch {
          /* ignore */
        }
        this.safeClose(ws, CLOSE_CODES.ROOM_GONE, "EXPIRED");
      }
    }
    this.state = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}
