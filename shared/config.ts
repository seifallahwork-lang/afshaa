/**
 * Game configuration shared by the server (authoritative) and the client (UI hints).
 * Change values here — never inside the game logic.
 */

export const GAME_CONFIG = {
  minPlayers: 2,
  maxPlayers: 10,

  roomCodeLength: 6,

  nameMaxLength: 16,
  captionMaxLength: 150,

  /** Seconds for the short "get ready" countdown before each round. */
  countdownSeconds: 3,
  /** Seconds the anonymous memes are shown before voting opens. */
  revealSeconds: 5,
  /** Seconds the round results stay on screen before the next round starts. */
  roundResultsSeconds: 10,

  /** A disconnected player is removed from the LOBBY after this many seconds. */
  lobbyDisconnectGraceSeconds: 30,
  /** If the host is disconnected this long, host rights move to another player. */
  hostDisconnectGraceSeconds: 15,
  /** A room with nobody connected is destroyed after this many seconds. */
  emptyRoomTtlSeconds: 10 * 60,
  /** Hard limit on a room's lifetime. */
  maxRoomLifetimeSeconds: 3 * 60 * 60,
} as const;

export const ROUND_OPTIONS = [3, 5, 7, 10] as const;
export const CAPTION_SECONDS_OPTIONS = [30, 60, 90, 120, 180] as const;
export const VOTING_SECONDS_OPTIONS = [15, 20, 30, 45, 60] as const;

export interface GameSettings {
  rounds: number;
  captionSeconds: number;
  votingSeconds: number;
  /** null = all categories. Ready for a future category picker. */
  categories: string[] | null;
}

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 3,
  captionSeconds: 90,
  votingSeconds: 30,
  categories: null,
};
