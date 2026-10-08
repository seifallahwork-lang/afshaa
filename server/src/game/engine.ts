/**
 * The game rules — a pure state machine with no networking.
 *
 *   LOBBY → COUNTDOWN → CAPTION → REVEAL → VOTING → ROUND_RESULTS ─┐
 *                ▲                                                 │
 *                └──────────── next round ─────────────────────────┤
 *                                                                  ▼
 *                                                          FINAL_RESULTS → (play again | lobby)
 *
 * Every function takes the current time explicitly, so the rules can be
 * unit-tested without real clocks or sockets. The Durable Object (room.ts)
 * is only a thin shell that calls these functions.
 */
import {
  CAPTION_SECONDS_OPTIONS,
  DEFAULT_SETTINGS,
  GAME_CONFIG,
  ROUND_OPTIONS,
  VOTING_SECONDS_OPTIONS,
  type GameSettings,
} from "../../../shared/config";
import { sanitizeAvatar } from "../../../shared/avatar";
import { DesignError, sanitizeDesign } from "../../../shared/design";
import { containsBlockedWord } from "../../../shared/moderation";
import type { Rating } from "../../../shared/protocol";
import { getActiveTemplates, type MemeTemplate } from "../../../shared/templates";
import { cleanText, normalizeArabic, textLength, truncate } from "../../../shared/text";
import { GameError } from "./errors";
import { randomHex, shuffle } from "./random";
import { scoreRound } from "./scoring";
import type { PlayerState, RoomState } from "./types";

const S = 1000;

/**
 * Templates are passed in when a game starts (the Durable Object loads them
 * from Google Drive, or from shared/templates.json as a fallback). The game
 * keeps its own copy of the memes it will use, so nothing changes mid-game.
 */
export const staticTemplates = (): MemeTemplate[] => getActiveTemplates();

/* ------------------------------------------------------------------ */
/* Room & players                                                      */
/* ------------------------------------------------------------------ */

export function createRoomState(code: string, now: number): RoomState {
  return {
    version: 3,
    code,
    createdAt: now,
    phase: "LOBBY",
    settings: { ...DEFAULT_SETTINGS },
    hostId: null,
    players: [],
    gameNumber: 0,
    round: 0,
    deck: [],
    currentTemplate: null,
    phaseEndsAt: null,
    submissions: [],
    revealOrder: [],
    ratings: {},
    hints: {},
    hintCache: {},
    lastRound: null,
    highlights: [],
    emptySince: now,
  };
}

export const activePlayers = (s: RoomState) => s.players.filter((p) => !p.left);
export const connectedPlayers = (s: RoomState) => s.players.filter((p) => !p.left && p.connected);
export const findPlayer = (s: RoomState, id: string) => s.players.find((p) => p.id === id);
export const findByToken = (s: RoomState, token: string) =>
  s.players.find((p) => p.token === token && !p.left);

export function validateName(raw: unknown): string {
  if (typeof raw !== "string") throw new GameError("INVALID_NAME");
  const name = cleanText(raw);
  const len = textLength(name);
  if (len < 1 || len > GAME_CONFIG.nameMaxLength) throw new GameError("INVALID_NAME");
  if (containsBlockedWord(name)) throw new GameError("BLOCKED_WORD");
  return name;
}

/** Adds a player (the first one becomes host). Only allowed in the lobby. */
export function addPlayer(s: RoomState, rawName: unknown, now: number, rawAvatar?: unknown): PlayerState {
  if (s.phase !== "LOBBY") throw new GameError("GAME_STARTED");
  if (activePlayers(s).length >= GAME_CONFIG.maxPlayers) throw new GameError("ROOM_FULL");
  const name = validateName(rawName);
  const key = normalizeArabic(name);
  if (activePlayers(s).some((p) => normalizeArabic(p.name) === key)) throw new GameError("NAME_TAKEN");

  const player: PlayerState = {
    id: randomHex(6),
    name,
    avatar: sanitizeAvatar(rawAvatar),
    token: randomHex(24),
    joinedAt: now,
    // Not connected until the WebSocket arrives; removed after the lobby grace period if it never does.
    connected: false,
    disconnectedAt: now,
    left: false,
    score: 0,
  };
  s.players.push(player);
  if (!s.hostId) s.hostId = player.id;
  return player;
}

export function markConnected(s: RoomState, playerId: string, now: number): void {
  const p = findPlayer(s, playerId);
  if (!p || p.left) return;
  p.connected = true;
  p.disconnectedAt = null;
  s.emptySince = null;
  if (!s.hostId || !findPlayer(s, s.hostId) || findPlayer(s, s.hostId)?.left) s.hostId = p.id;
  tick(s, now);
}

export function markDisconnected(s: RoomState, playerId: string, now: number): void {
  const p = findPlayer(s, playerId);
  if (!p || !p.connected) return;
  p.connected = false;
  p.disconnectedAt = now;
  advanceIfEveryoneDone(s, now);
  tick(s, now);
}

/** Player pressed "leave". In the lobby they vanish; mid-game they stay on the scoreboard. */
export function leave(s: RoomState, playerId: string, now: number): void {
  const p = findPlayer(s, playerId);
  if (!p) return;
  if (s.phase === "LOBBY") {
    s.players = s.players.filter((x) => x.id !== playerId);
  } else {
    p.left = true;
    p.connected = false;
    p.disconnectedAt = now;
  }
  if (s.hostId === playerId) migrateHost(s);
  advanceIfEveryoneDone(s, now);
  tick(s, now);
}

function migrateHost(s: RoomState): void {
  const next = s.players.find((p) => !p.left && p.connected && p.id !== s.hostId) ?? null;
  if (next) s.hostId = next.id;
  else if (!s.players.some((p) => p.id === s.hostId && !p.left)) s.hostId = activePlayers(s)[0]?.id ?? null;
}

function requireHost(s: RoomState, playerId: string): void {
  if (s.hostId !== playerId) throw new GameError("NOT_HOST");
}

/* ------------------------------------------------------------------ */
/* Host actions                                                        */
/* ------------------------------------------------------------------ */

export function updateSettings(s: RoomState, playerId: string, patch: Partial<GameSettings>): void {
  requireHost(s, playerId);
  if (s.phase !== "LOBBY") throw new GameError("WRONG_PHASE");
  if (typeof patch !== "object" || patch === null) throw new GameError("INVALID_SETTINGS");
  const next = { ...s.settings };
  if (patch.rounds !== undefined) {
    if (!(ROUND_OPTIONS as readonly number[]).includes(patch.rounds)) throw new GameError("INVALID_SETTINGS");
    next.rounds = patch.rounds;
  }
  if (patch.captionSeconds !== undefined) {
    if (!(CAPTION_SECONDS_OPTIONS as readonly number[]).includes(patch.captionSeconds))
      throw new GameError("INVALID_SETTINGS");
    next.captionSeconds = patch.captionSeconds;
  }
  if (patch.votingSeconds !== undefined) {
    if (!(VOTING_SECONDS_OPTIONS as readonly number[]).includes(patch.votingSeconds))
      throw new GameError("INVALID_SETTINGS");
    next.votingSeconds = patch.votingSeconds;
  }
  if (patch.categories !== undefined) {
    if (patch.categories !== null && !Array.isArray(patch.categories)) throw new GameError("INVALID_SETTINGS");
    next.categories = patch.categories?.filter((c) => typeof c === "string").slice(0, 20) ?? null;
  }
  s.settings = next;
}

export function startGame(
  s: RoomState,
  playerId: string,
  now: number,
  templates: MemeTemplate[] = staticTemplates(),
): void {
  requireHost(s, playerId);
  if (s.phase !== "LOBBY") throw new GameError("WRONG_PHASE");
  if (connectedPlayers(s).length < GAME_CONFIG.minPlayers) throw new GameError("NOT_ENOUGH_PLAYERS");
  // Anyone who joined but never connected doesn't get a seat in the game.
  s.players = s.players.filter((p) => p.connected);
  for (const p of s.players) p.score = 0;
  s.gameNumber += 1;
  s.round = 0;
  s.lastRound = null;
  s.highlights = [];
  s.deck = buildDeck(templates, s.settings.rounds);
  beginRound(s, now);
}

/** Host skips the wait on the round-results screen. */
export function skip(s: RoomState, playerId: string, now: number): void {
  requireHost(s, playerId);
  if (s.phase !== "ROUND_RESULTS") throw new GameError("WRONG_PHASE");
  endRoundResults(s, now);
}

export function playAgain(
  s: RoomState,
  playerId: string,
  now: number,
  templates: MemeTemplate[] = staticTemplates(),
): void {
  requireHost(s, playerId);
  if (s.phase !== "FINAL_RESULTS") throw new GameError("WRONG_PHASE");
  resetToLobby(s);
  startGame(s, playerId, now, templates);
}

export function returnToLobby(s: RoomState, playerId: string): void {
  requireHost(s, playerId);
  if (s.phase !== "FINAL_RESULTS") throw new GameError("WRONG_PHASE");
  resetToLobby(s);
}

function resetToLobby(s: RoomState): void {
  s.players = s.players.filter((p) => !p.left);
  for (const p of s.players) p.score = 0;
  s.phase = "LOBBY";
  s.phaseEndsAt = null;
  s.round = 0;
  s.currentTemplate = null;
  s.deck = [];
  s.submissions = [];
  s.revealOrder = [];
  s.ratings = {};
  s.hints = {};
  s.lastRound = null;
  s.highlights = [];
}

/* ------------------------------------------------------------------ */
/* Player actions                                                      */
/* ------------------------------------------------------------------ */

export function submitMeme(s: RoomState, playerId: string, raw: unknown, now: number): void {
  if (s.phase !== "CAPTION") throw new GameError("WRONG_PHASE");
  if (s.phaseEndsAt !== null && now >= s.phaseEndsAt) throw new GameError("WRONG_PHASE");
  const p = findPlayer(s, playerId);
  if (!p || p.left) throw new GameError("INVALID_TOKEN");
  if (s.submissions.some((x) => x.playerId === playerId)) throw new GameError("ALREADY_SUBMITTED");
  let design;
  try {
    design = sanitizeDesign(raw);
  } catch (e) {
    throw new GameError(e instanceof DesignError ? e.code : "BAD_REQUEST");
  }
  s.submissions.push({ id: randomHex(5), playerId, design, submittedAt: now });
  advanceIfEveryoneDone(s, now);
}

/** Rate one meme: 1–5 stars or 😡, optional comment. Final once sent. */
export function rate(
  s: RoomState,
  playerId: string,
  msg: { submissionId?: unknown; stars?: unknown; angry?: unknown; comment?: unknown },
  now: number,
): void {
  if (s.phase !== "VOTING") throw new GameError("WRONG_PHASE");
  if (s.phaseEndsAt !== null && now >= s.phaseEndsAt) throw new GameError("WRONG_PHASE");
  const p = findPlayer(s, playerId);
  if (!p || p.left) throw new GameError("INVALID_TOKEN");
  const sub = s.submissions.find((x) => x.id === msg.submissionId);
  if (!sub) throw new GameError("INVALID_VOTE");
  if (sub.playerId === playerId) throw new GameError("CANNOT_VOTE_SELF");
  if (s.ratings[playerId]?.[sub.id]) throw new GameError("ALREADY_VOTED");

  const angry = msg.angry === true;
  const stars = angry ? 0 : msg.stars;
  if (!angry && !(Number.isInteger(stars) && (stars as number) >= 1 && (stars as number) <= 5))
    throw new GameError("INVALID_VOTE");
  const comment = typeof msg.comment === "string" ? truncate(cleanText(msg.comment), GAME_CONFIG.commentMaxLength) : "";
  if (comment && containsBlockedWord(comment)) throw new GameError("BLOCKED_WORD");

  const rating: Rating = { stars: stars as number, angry, comment };
  s.ratings[playerId] = { ...(s.ratings[playerId] ?? {}), [sub.id]: rating };
  advanceIfEveryoneDone(s, now);
}

/** Has this player rated every meme that isn't theirs? */
export function isDoneVoting(s: RoomState, playerId: string): boolean {
  const mine = s.ratings[playerId] ?? {};
  return s.submissions.every((x) => x.playerId === playerId || mine[x.id]);
}

/* ---------- AI hint (the Durable Object calls the AI between these two) ---------- */

/** Charge the hint cost and mark it pending. Returns the cached hint text if there is one. */
export function requestHint(s: RoomState, playerId: string, now: number): string | null {
  if (s.phase !== "CAPTION" || (s.phaseEndsAt !== null && now >= s.phaseEndsAt)) throw new GameError("WRONG_PHASE");
  const p = findPlayer(s, playerId);
  if (!p || p.left) throw new GameError("INVALID_TOKEN");
  if (s.hints[playerId]) throw new GameError("HINT_USED");
  if (s.submissions.some((x) => x.playerId === playerId)) throw new GameError("ALREADY_SUBMITTED");
  p.score -= GAME_CONFIG.hintCost;
  const cached = s.currentTemplate ? s.hintCache[s.currentTemplate.id] : undefined;
  s.hints[playerId] = { text: cached ?? null };
  return cached ?? null;
}

/** Store the AI's answer (only if the same round is still running). */
export function resolveHint(s: RoomState, playerId: string, round: number, templateId: string, text: string): void {
  s.hintCache[templateId] = text;
  if (s.round !== round || s.currentTemplate?.id !== templateId) return;
  const h = s.hints[playerId];
  if (h && h.text === null) h.text = text;
}

/** The AI failed: give the points back so the player can try again. */
export function refundHint(s: RoomState, playerId: string, round: number): void {
  if (s.round !== round || !s.hints[playerId] || s.hints[playerId].text !== null) return;
  delete s.hints[playerId];
  const p = findPlayer(s, playerId);
  if (p) p.score += GAME_CONFIG.hintCost;
}

/* ------------------------------------------------------------------ */
/* Phase transitions                                                   */
/* ------------------------------------------------------------------ */

function setPhase(s: RoomState, phase: RoomState["phase"], endsAt: number | null): void {
  s.phase = phase;
  s.phaseEndsAt = endsAt;
}

/** Pick this game's memes up front: random, no repeats until the pool runs out. */
function buildDeck(templates: MemeTemplate[], rounds: number): MemeTemplate[] {
  if (templates.length === 0) return [];
  const deck: MemeTemplate[] = [];
  while (deck.length < rounds) {
    let batch = shuffle(templates);
    if (batch.length > 1 && batch[0].id === deck[deck.length - 1]?.id) batch = [...batch.slice(1), batch[0]];
    deck.push(...batch);
  }
  return deck.slice(0, rounds);
}

function beginRound(s: RoomState, now: number): void {
  s.round += 1;
  s.currentTemplate = s.deck[s.round - 1] ?? s.deck[0] ?? null;
  s.submissions = [];
  s.revealOrder = [];
  s.ratings = {};
  s.hints = {};
  setPhase(s, "COUNTDOWN", now + GAME_CONFIG.countdownSeconds * S);
}

function closeCaptions(s: RoomState, now: number): void {
  if (s.submissions.length === 0) {
    finishRound(s, now);
    return;
  }
  s.revealOrder = shuffle(s.submissions.map((x) => x.id));
  setPhase(s, "REVEAL", now + GAME_CONFIG.revealSeconds * S);
}

function finishRound(s: RoomState, now: number): void {
  const { entries, winnerIds } = scoreRound(s.submissions, s.ratings, s.players);
  for (const e of entries) {
    const p = findPlayer(s, e.playerId);
    if (p) p.score += e.points;
  }
  const template = s.currentTemplate;
  if (template) {
    const hintUsers = Object.keys(s.hints).map((id) => findPlayer(s, id)?.name ?? "؟");
    s.lastRound = { round: s.round, template, entries, winnerIds, hintUsers };
    const best = entries[0];
    if (best && best.points > 0) {
      s.highlights.push({ round: s.round, template, design: best.design, playerName: best.playerName, points: best.points });
    }
  }
  setPhase(s, "ROUND_RESULTS", now + GAME_CONFIG.roundResultsSeconds * S);
}

function endRoundResults(s: RoomState, now: number): void {
  if (s.round >= s.settings.rounds) setPhase(s, "FINAL_RESULTS", null);
  else beginRound(s, now);
}

/** Players whose vote we wait for: connected, and there is at least one meme that isn't theirs. */
function eligibleVoters(s: RoomState): PlayerState[] {
  return connectedPlayers(s).filter((p) => s.submissions.some((x) => x.playerId !== p.id));
}

/** Skip the rest of the timer when everyone connected has submitted / voted. */
export function advanceIfEveryoneDone(s: RoomState, now: number): void {
  const connected = connectedPlayers(s);
  if (connected.length === 0) return; // nobody here: let the timer decide
  if (s.phase === "CAPTION") {
    if (connected.every((p) => s.submissions.some((x) => x.playerId === p.id))) closeCaptions(s, now);
  } else if (s.phase === "VOTING") {
    if (eligibleVoters(s).every((p) => isDoneVoting(s, p.id))) finishRound(s, now);
  }
}

/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

/**
 * Apply everything that is due at `now`: phase timers, lobby cleanup,
 * host migration. Returns true when the room should be destroyed.
 */
export function tick(s: RoomState, now: number): boolean {
  // 1. Phase timers (loop in case several deadlines passed while asleep).
  for (let guard = 0; guard < 20 && s.phaseEndsAt !== null && now >= s.phaseEndsAt; guard++) {
    const at = s.phaseEndsAt;
    switch (s.phase) {
      case "COUNTDOWN":
        setPhase(s, "CAPTION", at + s.settings.captionSeconds * S);
        break;
      case "CAPTION":
        closeCaptions(s, at);
        break;
      case "REVEAL":
        setPhase(s, "VOTING", at + s.settings.votingSeconds * S);
        // If nobody can vote (e.g. one meme, only its author online) don't wait.
        advanceIfEveryoneDone(s, at);
        break;
      case "VOTING":
        finishRound(s, at);
        break;
      case "ROUND_RESULTS":
        endRoundResults(s, at);
        break;
      default:
        s.phaseEndsAt = null;
    }
  }

  // 2. Lobby: drop players who disconnected and didn't come back.
  if (s.phase === "LOBBY") {
    const grace = GAME_CONFIG.lobbyDisconnectGraceSeconds * S;
    s.players = s.players.filter((p) => p.connected || (p.disconnectedAt ?? now) + grace > now);
  }

  // 3. Host migration.
  const host = s.hostId ? findPlayer(s, s.hostId) : undefined;
  const hostGone =
    !host || host.left || (!host.connected && (host.disconnectedAt ?? now) + GAME_CONFIG.hostDisconnectGraceSeconds * S <= now);
  if (hostGone) migrateHost(s);

  // 4. Expiry.
  if (connectedPlayers(s).length === 0) s.emptySince ??= now;
  else s.emptySince = null;
  if (s.emptySince !== null && now - s.emptySince >= GAME_CONFIG.emptyRoomTtlSeconds * S) return true;
  if (now - s.createdAt >= GAME_CONFIG.maxRoomLifetimeSeconds * S) return true;
  if (s.players.length === 0 && s.phase === "LOBBY" && s.emptySince !== null && now - s.createdAt > 60 * S) return true;
  return false;
}

/** When the Durable Object must wake up next (null = nothing scheduled). */
export function nextWakeAt(s: RoomState): number {
  const times: number[] = [s.createdAt + GAME_CONFIG.maxRoomLifetimeSeconds * S];
  if (s.phaseEndsAt !== null) times.push(s.phaseEndsAt);
  if (s.emptySince !== null) times.push(s.emptySince + GAME_CONFIG.emptyRoomTtlSeconds * S);
  for (const p of s.players) {
    if (p.connected || p.disconnectedAt === null) continue;
    if (s.phase === "LOBBY") times.push(p.disconnectedAt + GAME_CONFIG.lobbyDisconnectGraceSeconds * S);
    if (p.id === s.hostId) times.push(p.disconnectedAt + GAME_CONFIG.hostDisconnectGraceSeconds * S);
  }
  return Math.min(...times);
}
