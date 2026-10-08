/** Server-only room state. Stored in the Durable Object; never sent raw to clients. */
import type { GameSettings } from "../../../shared/config";
import type { Avatar } from "../../../shared/avatar";
import type { MemeDesign } from "../../../shared/design";
import type { Highlight, Phase, Rating, RoundResult } from "../../../shared/protocol";
import type { MemeTemplate } from "../../../shared/templates";

export interface PlayerState {
  id: string;
  name: string;
  avatar: Avatar;
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
  design: MemeDesign;
  submittedAt: number;
}

export interface RoomState {
  version: 3;
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
  /** voterId -> (submissionId -> rating) */
  ratings: Record<string, Record<string, Rating>>;
  /** This round's AI hints: playerId -> hint (null text while the AI is thinking). */
  hints: Record<string, { text: string | null }>;
  /** AI hint per template id, so the AI runs once per meme. */
  hintCache: Record<string, string>;
  lastRound: RoundResult | null;
  highlights: Highlight[];
  emptySince: number | null;
}
