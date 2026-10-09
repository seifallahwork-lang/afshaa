/**
 * The game rules — a pure state machine with no networking.
 *
 *   LOBBY → COUNTDOWN → CAPTION → REVEAL → VOTING → ROUND_RESULTS ─┐
 *                ▲                                                 │
 *                └──────────── next round ─────────────────────────┤
 *                                                                  ▼
 *                                                          FINAL_RESULTS → (play again | lobby)
 *
 * Each player gets their OWN meme template every round (and may swap it a
 * limited number of times). Every function takes the current time explicitly,
 * so the rules can be unit-tested without real clocks or sockets.
 */
import { sanitizeAvatar } from "../../../shared/avatar";
import {
  CAPTION_SECONDS_OPTIONS,
  DEFAULT_SETTINGS,
  GAME_CONFIG,
  REROLL_OPTIONS,
  ROUND_OPTIONS,
  VOTING_SECONDS_OPTIONS,
  type GameSettings,
} from "../../../shared/config";
import { DesignError, sanitizeDesign, tryDesign } from "../../../shared/design";
import { containsBlockedWord } from "../../../shared/moderation";
import type { Rating } from "../../../shared/protocol";
import { getActiveTemplates, type MemeTemplate } from "../../../shared/templates";
import { cleanText, normalizeArabic, textLength, truncate } from "../../../shared/text";
import { GameError } from "./errors";
import { randomHex, shuffle } from "./random";
import { scoreRound } from "./scoring";
import type { PlayerState, RoomState } from "./types";

const S = 1000;
const MAX_POOL = 200;

/** Templates are passed in when a game starts (Google Drive, or shared/templates.json). */
export const staticTemplates = (): MemeTemplate[] => getActiveTemplates();

/* ------------------------------------------------------------------ */
/* Room & players                                                      */
/* ------------------------------------------------------------------ */

export function createRoomState(code: string, now: number): RoomState {
  return {
    version: 4,
    code,
    createdAt: now,
    phase: "LOBBY",
    settings: { ...DEFAULT_SETTINGS },
    hostId: null,
    players: [],
    gameNumber: 0,
    round: 0,
    pool: [],
    poolIndex: 0,
    assignments: {},
    drafts: {},
    phaseEndsAt: null,
    submissions: [],
    revealOrder: [],
    ratings: {},
    hints: {},
    hintCache: {},
    chat: [],
    lastRound: null,
    highlights: [],
    emptySince: now,
  };
}

export const activePlayers = (s: RoomState) => s.players.filter((p) => !p.left);
export const connectedPlayers = (s: RoomState) => s.players.filter((p) => !p.left && p.connected);
export const findPlayer = (s: RoomState, id: string) => s.players.find((p) => p.id === id);
export const findByToken = (s: RoomState, token: string) => s.players.find((p) => p.token === token && !p.left);
const inGame = (s: RoomState) => s.phase !== "LOBBY";

export function validateName(raw: unknown): string {
  if (typeof raw !== "string") throw new GameError("INVALID_NAME");
  const name = cleanText(raw);
  const len = textLength(name);
  if (len < 1 || len > GAME_CONFIG.nameMaxLength) throw new GameError("INVALID_NAME");
  if (containsBlockedWord(name)) throw new GameError("BLOCKED_WORD");
  return name;
}

/** Adds a player (the first one becomes host). Allowed in the lobby AND mid-game. */
export function addPlayer(s: RoomState, rawName: unknown, now: number, rawAvatar?: unknown): PlayerState {
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
    connected: false,
    everConnected: false,
    disconnectedAt: now,
    left: false,
    ready: false,
    score: 0,
    lastChatAt: 0,
  };
  s.players.push(player);
  if (!s.hostId) s.hostId = player.id;
  // Joining mid-round: hand them a meme right away so they can play this round.
  if (s.phase === "COUNTDOWN" || s.phase === "CAPTION") assignTemplate(s, player.id);
  return player;
}

export function markConnected(s: RoomState, playerId: string, now: number): void {
  const p = findPlayer(s, playerId);
  if (!p || p.left) return;
  p.connected = true;
  p.everConnected = true;
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
  if (!inGame(s)) {
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
/* Lobby: ready, settings, host                                        */
/* ------------------------------------------------------------------ */

export function setReady(s: RoomState, playerId: string, ready: unknown): void {
  if (s.phase !== "LOBBY") throw new GameError("WRONG_PHASE");
  const p = findPlayer(s, playerId);
  if (!p || p.left) throw new GameError("INVALID_TOKEN");
  p.ready = ready === true;
}

/** The host hands the room to someone else (only the new host can hand it on again). */
export function transferHost(s: RoomState, playerId: string, targetId: unknown): void {
  requireHost(s, playerId);
  const target = typeof targetId === "string" ? findPlayer(s, targetId) : undefined;
  if (!target || target.left || !target.connected || target.id === playerId) throw new GameError("INVALID_TARGET");
  s.hostId = target.id;
}

export function updateSettings(s: RoomState, playerId: string, patch: Partial<GameSettings>): void {
  requireHost(s, playerId);
  if (s.phase !== "LOBBY") throw new GameError("WRONG_PHASE");
  if (typeof patch !== "object" || patch === null) throw new GameError("INVALID_SETTINGS");
  const next = { ...s.settings };
  const pickFrom = (v: unknown, list: readonly number[]) => {
    if (!list.includes(v as number)) throw new GameError("INVALID_SETTINGS");
    return v as number;
  };
  if (patch.rounds !== undefined) next.rounds = pickFrom(patch.rounds, ROUND_OPTIONS);
  if (patch.captionSeconds !== undefined) next.captionSeconds = pickFrom(patch.captionSeconds, CAPTION_SECONDS_OPTIONS);
  if (patch.votingSeconds !== undefined) next.votingSeconds = pickFrom(patch.votingSeconds, VOTING_SECONDS_OPTIONS);
  if (patch.rerolls !== undefined) next.rerolls = pickFrom(patch.rerolls, REROLL_OPTIONS);
  if (patch.anonymous !== undefined) {
    if (typeof patch.anonymous !== "boolean") throw new GameError("INVALID_SETTINGS");
    next.anonymous = patch.anonymous;
  }
  if (patch.categories !== undefined) {
    if (patch.categories !== null && !Array.isArray(patch.categories)) throw new GameError("INVALID_SETTINGS");
    next.categories = patch.categories?.filter((c) => typeof c === "string").slice(0, 20) ?? null;
  }
  s.settings = next;
}

export function startGame(s: RoomState, playerId: string, now: number, templates: MemeTemplate[] = staticTemplates()): void {
  requireHost(s, playerId);
  if (s.phase !== "LOBBY") throw new GameError("WRONG_PHASE");
  const connected = connectedPlayers(s);
  if (connected.length < GAME_CONFIG.minPlayers) throw new GameError("NOT_ENOUGH_PLAYERS");
  if (connected.some((p) => p.id !== s.hostId && !p.ready)) throw new GameError("NOT_READY");
  // Anyone who joined but never connected doesn't get a seat in the game.
  s.players = s.players.filter((p) => p.connected);
  for (const p of s.players) p.score = 0;
  s.gameNumber += 1;
  s.round = 0;
  s.lastRound = null;
  s.highlights = [];
  s.pool = shuffle(templates).slice(0, MAX_POOL);
  s.poolIndex = 0;
  beginRound(s, now);
}

/** Host skips the wait on the round-results screen. */
export function skip(s: RoomState, playerId: string, now: number): void {
  requireHost(s, playerId);
  if (s.phase !== "ROUND_RESULTS") throw new GameError("WRONG_PHASE");
  endRoundResults(s, now);
}

export function playAgain(s: RoomState, playerId: string, now: number, templates: MemeTemplate[] = staticTemplates()): void {
  requireHost(s, playerId);
  if (s.phase !== "FINAL_RESULTS") throw new GameError("WRONG_PHASE");
  resetToLobby(s);
  for (const p of s.players) p.ready = true; // same group, straight into a new game
  startGame(s, playerId, now, templates);
}

export function returnToLobby(s: RoomState, playerId: string): void {
  requireHost(s, playerId);
  if (s.phase !== "FINAL_RESULTS") throw new GameError("WRONG_PHASE");
  resetToLobby(s);
}

function resetToLobby(s: RoomState): void {
  s.players = s.players.filter((p) => !p.left);
  for (const p of s.players) {
    p.score = 0;
    p.ready = false;
  }
  s.phase = "LOBBY";
  s.phaseEndsAt = null;
  s.round = 0;
  s.assignments = {};
  s.drafts = {};
  s.submissions = [];
  s.revealOrder = [];
  s.ratings = {};
  s.hints = {};
  s.lastRound = null;
  s.highlights = [];
}

/* ------------------------------------------------------------------ */
/* Meme templates per player                                           */
/* ------------------------------------------------------------------ */

/** Give a player the next template nobody else has this round (and they haven't seen). */
function assignTemplate(s: RoomState, playerId: string): void {
  if (s.pool.length === 0) s.pool = shuffle(staticTemplates()).slice(0, MAX_POOL);
  const prev = s.assignments[playerId];
  const seen = new Set(prev?.seen ?? []);
  const taken = new Set(Object.entries(s.assignments).filter(([id]) => id !== playerId).map(([, a]) => a.template.id));
  let pick: MemeTemplate | null = null;
  for (let i = 0; i < s.pool.length; i++) {
    const t = s.pool[(s.poolIndex + i) % s.pool.length];
    if (!taken.has(t.id) && !seen.has(t.id)) {
      pick = t;
      s.poolIndex = (s.poolIndex + i + 1) % s.pool.length;
      break;
    }
  }
  // Small pools: allow duplicates rather than leaving someone without a meme.
  if (!pick) {
    pick = s.pool[s.poolIndex % s.pool.length];
    s.poolIndex = (s.poolIndex + 1) % s.pool.length;
  }
  s.assignments[playerId] = { template: pick, rerolls: prev?.rerolls ?? 0, seen: [...seen, pick.id] };
}

/** Swap my meme for another one (limited per round by the host's setting). */
export function reroll(s: RoomState, playerId: string, now: number): void {
  if (s.phase !== "CAPTION" || (s.phaseEndsAt !== null && now >= s.phaseEndsAt)) throw new GameError("WRONG_PHASE");
  const p = findPlayer(s, playerId);
  if (!p || p.left) throw new GameError("INVALID_TOKEN");
  if (s.submissions.some((x) => x.playerId === playerId)) throw new GameError("ALREADY_SUBMITTED");
  const a = s.assignments[playerId];
  if (a && a.rerolls >= s.settings.rerolls) throw new GameError("NO_REROLLS");
  assignTemplate(s, playerId);
  s.assignments[playerId].rerolls = (a?.rerolls ?? 0) + 1;
  delete s.drafts[playerId]; // the old draft belongs to the old picture
}

export const rerollsLeft = (s: RoomState, playerId: string) =>
  Math.max(0, s.settings.rerolls - (s.assignments[playerId]?.rerolls ?? 0));

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
  if (!s.assignments[playerId]) assignTemplate(s, playerId);
  s.submissions.push({ id: randomHex(5), playerId, template: s.assignments[playerId].template, design, submittedAt: now });
  delete s.drafts[playerId];
  advanceIfEveryoneDone(s, now);
}

/** Autosave. Anything non-empty here is submitted for the player when time runs out. */
export function saveDraft(s: RoomState, playerId: string, raw: unknown, now: number): void {
  if (s.phase !== "CAPTION" || (s.phaseEndsAt !== null && now >= s.phaseEndsAt)) return;
  if (s.submissions.some((x) => x.playerId === playerId)) return;
  const d = tryDesign(raw);
  if (d) s.drafts[playerId] = d;
  else delete s.drafts[playerId];
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

/** Group chat (any phase). */
export function chat(s: RoomState, playerId: string, raw: unknown, now: number): void {
  const p = findPlayer(s, playerId);
  if (!p || p.left) throw new GameError("INVALID_TOKEN");
  if (typeof raw !== "string") throw new GameError("BAD_REQUEST");
  const text = truncate(cleanText(raw), GAME_CONFIG.chatMaxLength);
  if (!text) return;
  if (now - p.lastChatAt < GAME_CONFIG.chatMinIntervalMs) throw new GameError("CHAT_TOO_FAST");
  if (containsBlockedWord(text)) throw new GameError("BLOCKED_WORD");
  p.lastChatAt = now;
  s.chat.push({ id: randomHex(5), playerId, name: p.name, avatar: p.avatar, text, at: now });
  if (s.chat.length > GAME_CONFIG.chatHistory) s.chat = s.chat.slice(-GAME_CONFIG.chatHistory);
}

/* ---------- AI hint (the Durable Object calls the AI between these two) ---------- */

/** Charge the hint cost and mark it pending. Returns the cached hint text if there is one. */
export function requestHint(s: RoomState, playerId: string, now: number): string | null {
  if (s.phase !== "CAPTION" || (s.phaseEndsAt !== null && now >= s.phaseEndsAt)) throw new GameError("WRONG_PHASE");
  const p = findPlayer(s, playerId);
  if (!p || p.left) throw new GameError("INVALID_TOKEN");
  const a = s.assignments[playerId];
  if (!a) throw new GameError("HINT_UNAVAILABLE");
  if (s.hints[playerId]?.templateId === a.template.id) throw new GameError("HINT_USED");
  if (s.submissions.some((x) => x.playerId === playerId)) throw new GameError("ALREADY_SUBMITTED");
  p.score -= GAME_CONFIG.hintCost;
  const cached = s.hintCache[a.template.id];
  s.hints[playerId] = { text: cached ?? null, templateId: a.template.id };
  return cached ?? null;
}

/** Store the AI's answer (only if the player still has that meme this round). */
export function resolveHint(s: RoomState, playerId: string, round: number, templateId: string, text: string): void {
  s.hintCache[templateId] = text;
  if (s.round !== round) return;
  const h = s.hints[playerId];
  if (h && h.text === null && h.templateId === templateId) h.text = text;
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

function beginRound(s: RoomState, now: number): void {
  s.round += 1;
  s.assignments = {};
  s.drafts = {};
  s.submissions = [];
  s.revealOrder = [];
  s.ratings = {};
  s.hints = {};
  for (const p of activePlayers(s)) assignTemplate(s, p.id);
  setPhase(s, "COUNTDOWN", now + GAME_CONFIG.countdownSeconds * S);
}

function closeCaptions(s: RoomState, now: number): void {
  // Time's up: whatever a player was working on counts as their meme.
  for (const [playerId, design] of Object.entries(s.drafts)) {
    const p = findPlayer(s, playerId);
    const a = s.assignments[playerId];
    if (!p || p.left || !a || s.submissions.some((x) => x.playerId === playerId)) continue;
    s.submissions.push({ id: randomHex(5), playerId, template: a.template, design, submittedAt: now });
  }
  s.drafts = {};
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
  const hintUsers = Object.keys(s.hints).map((id) => findPlayer(s, id)?.name ?? "؟");
  s.lastRound = { round: s.round, entries, winnerIds, hintUsers };
  const best = entries[0];
  if (best && best.points > 0) {
    s.highlights.push({ round: s.round, template: best.template, design: best.design, playerName: best.playerName, points: best.points });
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
 * Apply everything that is due at `now`: phase timers, cleanup,
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

  // 2. Cleanup: never-connected joiners (any phase); lobby players gone too long.
  const neverTtl = GAME_CONFIG.neverConnectedTtlSeconds * S;
  const lobbyGrace = GAME_CONFIG.lobbyDisconnectGraceSeconds * S;
  s.players = s.players.filter((p) => {
    if (p.connected) return true;
    if (!p.everConnected) return p.joinedAt + neverTtl > now;
    if (s.phase === "LOBBY") return (p.disconnectedAt ?? now) + lobbyGrace > now;
    return true; // mid-game: keep the seat and score for when they come back
  });

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

/** When the Durable Object must wake up next. */
export function nextWakeAt(s: RoomState): number {
  const times: number[] = [s.createdAt + GAME_CONFIG.maxRoomLifetimeSeconds * S];
  if (s.phaseEndsAt !== null) times.push(s.phaseEndsAt);
  if (s.emptySince !== null) times.push(s.emptySince + GAME_CONFIG.emptyRoomTtlSeconds * S);
  for (const p of s.players) {
    if (p.connected) continue;
    if (!p.everConnected) times.push(p.joinedAt + GAME_CONFIG.neverConnectedTtlSeconds * S);
    if (p.disconnectedAt === null) continue;
    if (s.phase === "LOBBY") times.push(p.disconnectedAt + GAME_CONFIG.lobbyDisconnectGraceSeconds * S);
    if (p.id === s.hostId) times.push(p.disconnectedAt + GAME_CONFIG.hostDisconnectGraceSeconds * S);
  }
  return Math.min(...times);
}
