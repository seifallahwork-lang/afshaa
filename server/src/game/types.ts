/** Server-only room state. Stored in the Durable Object; never sent raw to clients. */
import type { Avatar } from "../../../shared/avatar";
import type { GameSettings } from "../../../shared/config";
import type { MemeDesign } from "../../../shared/design";
import type { ChatMessage, Highlight, Phase, Rating, RoundResult } from "../../../shared/protocol";
import type { MemeTemplate } from "../../../shared/templates";

export interface PlayerState {
  id: string;
  name: string;
  avatar: Avatar;
  /** Secret that lets this browser reclaim its seat after a refresh or a dropped connection. */
  token: string;
  joinedAt: number;
  connected: boolean;
  everConnected: boolean;
  disconnectedAt: number | null;
  /** Left on purpose: kept for the scoreboard, can't come back with the same seat. */
  left: boolean;
  /** Pressed "مستعد" in the lobby. */
  ready: boolean;
  score: number;
  lastChatAt: number;
}

export interface SubmissionState {
  id: string;
  playerId: string;
  template: MemeTemplate;
  design: MemeDesign;
  submittedAt: number;
}

/** The meme template a player is working on this round. */
export interface Assignment {
  template: MemeTemplate;
  rerolls: number;
  /** Template ids this player already saw this round (not shown again on reroll). */
  seen: string[];
}

export interface RoomState {
  version: 4;
  code: string;
  createdAt: number;
  phase: Phase;
  settings: GameSettings;
  hostId: string | null;
  players: PlayerState[]; // join order (used for host migration)
  gameNumber: number;
  round: number;
  /** All memes available this game, shuffled. */
  pool: MemeTemplate[];
  poolIndex: number;
  /** playerId -> this round's meme */
  assignments: Record<string, Assignment>;
  /** playerId -> autosaved work in progress (auto-submitted at the deadline) */
  drafts: Record<string, MemeDesign>;
  phaseEndsAt: number | null;
  submissions: SubmissionState[];
  /** Shuffled submission ids — the order everybody sees. */
  revealOrder: string[];
  /** voterId -> (submissionId -> rating) */
  ratings: Record<string, Record<string, Rating>>;
  /** This round's AI hints: playerId -> hint (null text while the AI is thinking). */
  hints: Record<string, { text: string | null; templateId: string }>;
  /** AI hint per template id, so the AI runs once per meme. */
  hintCache: Record<string, string>;
  chat: ChatMessage[];
  lastRound: RoundResult | null;
  highlights: Highlight[];
  emptySince: number | null;
}
