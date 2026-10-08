/**
 * Live connection to one room. The server is the source of truth: this hook
 * only stores the latest view it was sent and forwards player actions.
 * Reconnects automatically (refresh, flaky mobile data, laptop sleep).
 */
import type { ClientMessage, ErrorCode, RoomView, ServerMessage, SessionResponse } from "@shared/protocol";
import { CLOSE_CODES } from "@shared/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "../lib/config";

export type ConnectionStatus = "connecting" | "open" | "reconnecting";
export type EndReason = "EXPIRED" | "LEFT" | "INVALID_TOKEN";

export interface RoomConnection {
  state: RoomView | null;
  status: ConnectionStatus;
  ended: EndReason | null;
  /** serverTime - localTime, so timers follow the server clock. */
  clockOffset: number;
  error: { code: ErrorCode; at: number } | null;
  send: (msg: ClientMessage) => void;
}

const HEARTBEAT_MS = 25_000;

export function useRoom(session: SessionResponse): RoomConnection {
  const [state, setState] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [ended, setEnded] = useState<EndReason | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [error, setError] = useState<RoomConnection["error"]>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let attempt = 0;
    let stopped = false;
    let retryTimer: number | undefined;
    let heartbeat: number | undefined;

    const connect = () => {
      if (stopped || !WS_URL) return;
      const ws = new WebSocket(`${WS_URL}/api/rooms/${session.code}/ws?token=${encodeURIComponent(session.token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setStatus("open");
        heartbeat = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), HEARTBEAT_MS);
      };

      ws.onmessage = (e) => {
        if (e.data === "pong") return;
        const msg = JSON.parse(e.data as string) as ServerMessage;
        if (msg.type === "state") {
          setState(msg.state);
          setClockOffset(msg.serverNow - Date.now());
        } else if (msg.type === "error") {
          setError({ code: msg.code, at: Date.now() });
        } else if (msg.type === "closed") {
          stopped = true;
          setEnded(msg.reason);
        }
      };

      ws.onclose = (e) => {
        window.clearInterval(heartbeat);
        if (e.code === CLOSE_CODES.ROOM_GONE) setEnded((r) => r ?? "EXPIRED");
        if (e.code === CLOSE_CODES.INVALID_TOKEN) setEnded((r) => r ?? "INVALID_TOKEN");
        if (e.code === CLOSE_CODES.LEFT) setEnded("LEFT");
        if (stopped || e.code >= 4000) return;
        setStatus("reconnecting");
        const delay = Math.min(8000, 500 * 2 ** attempt++);
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    // Phones drop sockets when backgrounded: reconnect as soon as the tab is visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible" && wsRef.current?.readyState === WebSocket.CLOSED && !stopped) {
        window.clearTimeout(retryTimer);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisible);
      wsRef.current?.close();
    };
  }, [session.code, session.token]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else setError({ code: "SERVER_ERROR", at: Date.now() });
  }, []);

  return { state, status, ended, clockOffset, error, send };
}
