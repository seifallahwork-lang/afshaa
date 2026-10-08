/** Server-only room state. Stored in the Durable Object; never sent raw to clients. */
import type { GameSettings } from "../../../shared/config";
import type { Highlight, Phase, RoundResult } from "../../../shared/protocol";
import type { MemeTemplate } from "../../../shared/templates";

export interface PlayerState {
  id: string;
  name: string;
  /** Secret that lets this browser tab reclaim its seat after a refresh. */
  token: string;
  joinedAt: number;
  connected: boolean;
  disconnectedAt: number | null;
  /** Left mid-game: kept for the scoreboard, can't come back. */
  left: boolean;
  score: number;
}

export interface SubmissionState {
  id: string;
  playerId: string;
  caption: string;
  submittedAt: number;
}

export interface RoomState {
  version: 2;
  code: string;
  createdAt: number;
  phase: Phase;
  settings: GameSettings;
  hostId: string | null;
  players: PlayerState[]; // join order (used for host migration)
  gameNumber: number;
  round: number;
  /** The memes chosen for this game, one per round. */
  deck: MemeTemplate[];
  currentTemplate: MemeTemplate | null;
  phaseEndsAt: number | null;
  submissions: SubmissionState[];
  /** Shuffled submission ids — the anonymous order everybody sees. */
  revealOrder: string[];
  /** voterId -> submissionId */
  votes: Record<string, string>;
  lastRound: RoundResult | null;
  highlights: Highlight[];
  emptySince: number | null;
}
