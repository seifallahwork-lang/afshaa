/**
 * Everything that travels between the browser and the game server.
 * Both sides import these types, so a change here is checked everywhere.
 */
import type { GameSettings } from "./config";
import type { MemeTemplate } from "./templates";

export type Phase =
  | "LOBBY"
  | "COUNTDOWN"
  | "CAPTION"
  | "REVEAL"
  | "VOTING"
  | "ROUND_RESULTS"
  | "FINAL_RESULTS";

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "GAME_STARTED"
  | "INVALID_NAME"
  | "NAME_TAKEN"
  | "INVALID_CODE"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "WRONG_PHASE"
  | "ALREADY_SUBMITTED"
  | "EMPTY_CAPTION"
  | "CAPTION_TOO_LONG"
  | "BLOCKED_WORD"
  | "ALREADY_VOTED"
  | "CANNOT_VOTE_SELF"
  | "INVALID_VOTE"
  | "INVALID_SETTINGS"
  | "INVALID_TOKEN"
  | "BAD_REQUEST"
  | "CODE_IN_USE"
  | "SERVER_ERROR";

/* ---------- HTTP API ---------- */

export interface CreateRoomRequest {
  name: string;
}
export interface SessionResponse {
  code: string;
  playerId: string;
  token: string;
}
export interface ApiError {
  error: ErrorCode;
}

/* ---------- WebSocket: client -> server ---------- */

export type ClientMessage =
  | { type: "start" }
  | { type: "updateSettings"; settings: Partial<GameSettings> }
  | { type: "submitCaption"; caption: string }
  | { type: "vote"; submissionId: string }
  | { type: "skip" } // host: skip the round-results wait
  | { type: "playAgain" } // host: same players, new game
  | { type: "returnToLobby" } // host
  | { type: "leave" };

/* ---------- WebSocket: server -> client ---------- */

export type ServerMessage =
  | { type: "state"; state: RoomView; serverNow: number }
  | { type: "error"; code: ErrorCode }
  | { type: "closed"; reason: "EXPIRED" | "LEFT" | "INVALID_TOKEN" };

/** WebSocket close codes the client reacts to. */
export const CLOSE_CODES = {
  ROOM_GONE: 4000,
  INVALID_TOKEN: 4001,
  LEFT: 4002,
} as const;

/* ---------- The per-player view of the room ---------- */

export interface PlayerView {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  left: boolean;
  score: number;
  /** Only "has / hasn't" — never the caption itself before the reveal. */
  hasSubmitted: boolean;
  hasVoted: boolean;
}

export interface SubmissionView {
  id: string;
  caption: string;
}

export interface RoundEntry {
  submissionId: string;
  playerId: string;
  playerName: string;
  caption: string;
  votes: number;
  points: number;
  /** Human-readable breakdown, ready for future bonus rules. */
  awards: { rule: string; points: number }[];
}

export interface RoundResult {
  round: number;
  template: MemeTemplate;
  entries: RoundEntry[]; // sorted, best first
  winnerIds: string[];
}

export interface Highlight {
  round: number;
  template: MemeTemplate;
  caption: string;
  playerName: string;
  votes: number;
}

export interface RoomView {
  code: string;
  phase: Phase;
  round: number;
  totalRounds: number;
  settings: GameSettings;
  phaseEndsAt: number | null;
  hostId: string | null;
  players: PlayerView[];
  template: MemeTemplate | null;
  /** Anonymous, shuffled. Present from REVEAL onwards. */
  submissions: SubmissionView[] | null;
  /** Next meme's image URL during the countdown, so it is already loaded when the round starts. */
  preloadImage: string | null;
  lastRound: RoundResult | null;
  highlights: Highlight[];
  you: {
    id: string;
    isHost: boolean;
    myCaption: string | null;
    mySubmissionId: string | null;
    votedFor: string | null;
  };
}
