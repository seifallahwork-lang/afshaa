import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../../shared/config";
import {
  addPlayer,
  rate,
  refundHint,
  requestHint,
  resolveHint,
  createRoomState,
  leave,
  markConnected,
  markDisconnected,
  playAgain,
  returnToLobby,
  startGame,
  submitMeme,
  tick,
  updateSettings,
} from "../src/game/engine";
import { GameError } from "../src/game/errors";
import type { RoomState } from "../src/game/types";
import { buildView } from "../src/game/view";

/** A simple one-text-box meme. */
const cap = (text: string) => ({ boxes: [{ id: "a", text, x: 5, y: 70, w: 90, h: 25, color: "#FFFFFF", bg: "transparent", rounded: false, size: 7 }], strokes: [] });
/** Vote helper: stars by default, "angry" for 😡. */
const vote = (s: RoomState, voter: string, submissionId: string, t: number, how: number | "angry" = 3) =>
  rate(s, voter, how === "angry" ? { submissionId, angry: true } : { submissionId, stars: how }, t);

const S = 1000;
const T0 = 1_700_000_000_000;

function room(n: number) {
  const s = createRoomState("123456", T0);
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = addPlayer(s, `لاعب ${i + 1}`, T0);
    markConnected(s, p.id, T0);
    ids.push(p.id);
  }
  return { s, ids };
}

function expectError(fn: () => void, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

/** Run the clock forward to the end of the current phase. */
function expire(s: RoomState) {
  const t = s.phaseEndsAt!;
  tick(s, t);
  return t;
}

function toCaption(s: RoomState) {
  return expire(s); // COUNTDOWN -> CAPTION
}

describe("rooms & lobby", () => {
  it("first player is host; supports 2, 3 and 10 players", () => {
    for (const n of [2, 3, 10]) {
      const { s, ids } = room(n);
      expect(s.players.length).toBe(n);
      expect(s.hostId).toBe(ids[0]);
    }
  });

  it("rejects the 11th player", () => {
    const { s } = room(10);
    expectError(() => addPlayer(s, "الحادي عشر", T0), "ROOM_FULL");
  });

  it("rejects joining after the game started", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    expectError(() => addPlayer(s, "متأخر", T0), "GAME_STARTED");
  });

  it("validates names and duplicates (Arabic-normalized)", () => {
    const { s } = room(1);
    expectError(() => addPlayer(s, "   ", T0), "INVALID_NAME");
    expectError(() => addPlayer(s, "x".repeat(GAME_CONFIG.nameMaxLength + 1), T0), "INVALID_NAME");
    addPlayer(s, "أحمد", T0);
    expectError(() => addPlayer(s, "احمد", T0), "NAME_TAKEN");
  });

  it("only the host can start, and needs 2 connected players", () => {
    const { s, ids } = room(2);
    expectError(() => startGame(s, ids[1], T0), "NOT_HOST");
    markDisconnected(s, ids[1], T0);
    expectError(() => startGame(s, ids[0], T0), "NOT_ENOUGH_PLAYERS");
  });

  it("host settings are validated", () => {
    const { s, ids } = room(2);
    updateSettings(s, ids[0], { rounds: 5, captionSeconds: 60 });
    expect(s.settings.rounds).toBe(5);
    expectError(() => updateSettings(s, ids[0], { rounds: 4 }), "INVALID_SETTINGS");
    expectError(() => updateSettings(s, ids[1], { rounds: 3 }), "NOT_HOST");
  });

  it("removes players who disconnect in the lobby after the grace period", () => {
    const { s, ids } = room(3);
    markDisconnected(s, ids[2], T0);
    tick(s, T0 + (GAME_CONFIG.lobbyDisconnectGraceSeconds - 1) * S);
    expect(s.players.length).toBe(3);
    tick(s, T0 + GAME_CONFIG.lobbyDisconnectGraceSeconds * S);
    expect(s.players.length).toBe(2);
  });
});

describe("captions", () => {
  it("hides captions from other players until the reveal", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    submitMeme(s, ids[0], cap("لما الامتحان يطلع سهل 😂"), t);
    const v = buildView(s, ids[1]);
    expect(v.submissions).toBeNull();
    expect(JSON.stringify(v)).not.toContain("الامتحان");
    expect(v.players.find((p) => p.id === ids[0])!.hasSubmitted).toBe(true);
    expect(JSON.stringify(buildView(s, ids[0]).you.myDesign)).toContain("الامتحان");
  });

  it("prevents duplicate, empty and too-long submissions", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    expectError(() => submitMeme(s, ids[0], cap("   "), t), "EMPTY_CAPTION");
    expectError(() => submitMeme(s, ids[0], cap("ا".repeat(GAME_CONFIG.captionMaxLength + 1)), t), "CAPTION_TOO_LONG");
    submitMeme(s, ids[0], cap("أول كابشن"), t);
    expectError(() => submitMeme(s, ids[0], cap("تاني"), t), "ALREADY_SUBMITTED");
  });

  it("counts emoji and Arabic as single characters", () => {
    const { s, ids } = room(2);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    submitMeme(s, ids[0], cap("😂".repeat(GAME_CONFIG.captionMaxLength)), t);
  });

  it("rejects captions in the wrong phase or after the timer", () => {
    const { s, ids } = room(2);
    expectError(() => submitMeme(s, ids[0], cap("مبكر"), T0), "WRONG_PHASE");
    startGame(s, ids[0], T0);
    toCaption(s);
    expectError(() => submitMeme(s, ids[0], cap("متأخر"), s.phaseEndsAt!), "WRONG_PHASE");
  });

  it("moves to the reveal when everyone submitted", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    ids.forEach((id, i) => submitMeme(s, id, cap(`كابشن ${i}`), t));
    expect(s.phase).toBe("REVEAL");
    const v = buildView(s, ids[1]);
    expect(v.submissions!.length).toBe(3);
    expect(JSON.stringify(v.submissions)).not.toContain(ids[0]); // anonymous
  });

  it("timer expiry closes submissions", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    submitMeme(s, ids[0], cap("لوحدي"), t);
    expire(s);
    expect(s.phase).toBe("REVEAL");
  });

  it("skips voting when nobody submitted", () => {
    const { s, ids } = room(2);
    startGame(s, ids[0], T0);
    toCaption(s);
    expire(s);
    expect(s.phase).toBe("ROUND_RESULTS");
  });
});

function toVoting(n: number) {
  const { s, ids } = room(n);
  startGame(s, ids[0], T0);
  const t = toCaption(s);
  ids.forEach((id, i) => submitMeme(s, id, cap(`كابشن ${i}`), t));
  const tv = expire(s); // REVEAL -> VOTING
  const subOf = (id: string) => s.submissions.find((x) => x.playerId === id)!.id;
  return { s, ids, tv, subOf };
}

describe("voting & scoring (stars, 😡, comments)", () => {
  it("cannot rate own meme, cannot rate the same meme twice, can rate several memes", () => {
    const { s, ids, tv, subOf } = toVoting(3);
    expect(s.phase).toBe("VOTING");
    expectError(() => vote(s, ids[0], subOf(ids[0]), tv), "CANNOT_VOTE_SELF");
    vote(s, ids[0], subOf(ids[1]), tv, 5);
    expectError(() => vote(s, ids[0], subOf(ids[1]), tv, 1), "ALREADY_VOTED");
    vote(s, ids[0], subOf(ids[2]), tv, 2); // a different meme is fine
    expectError(() => vote(s, ids[1], "nope", tv), "INVALID_VOTE");
    expectError(() => rate(s, ids[1], { submissionId: subOf(ids[0]), stars: 6 }, tv), "INVALID_VOTE");
    expectError(() => rate(s, ids[1], { submissionId: subOf(ids[0]) }, tv), "INVALID_VOTE");
  });

  it("stars add points, 😡 subtracts, comments are kept; ends early when everyone rated everything", () => {
    const { s, ids, tv, subOf } = toVoting(3);
    // p1's meme: 5★ + 4★ = 9.  p0's meme: 3★ + 😡 = 3 - 2 = 1.  p2's meme: 😡 + 1★ = -2 + 1 = -1
    rate(s, ids[0], { submissionId: subOf(ids[1]), stars: 5, comment: "هههه جامد 😂" }, tv);
    vote(s, ids[0], subOf(ids[2]), tv, "angry");
    vote(s, ids[2], subOf(ids[1]), tv, 4);
    vote(s, ids[2], subOf(ids[0]), tv, "angry");
    vote(s, ids[1], subOf(ids[0]), tv, 3);
    expect(s.phase).toBe("VOTING"); // p1 still has one meme to rate
    vote(s, ids[1], subOf(ids[2]), tv, 1);
    expect(s.phase).toBe("ROUND_RESULTS");
    const score = (i: number) => s.players.find((p) => p.id === ids[i])!.score;
    expect(score(1)).toBe(9);
    expect(score(0)).toBe(3 - GAME_CONFIG.angryPenalty);
    expect(score(2)).toBe(1 - GAME_CONFIG.angryPenalty);
    expect(s.lastRound!.winnerIds).toEqual([ids[1]]);
    const top = buildView(s, ids[2]).lastRound!.entries[0];
    expect(top.playerName).toBe("لاعب 2");
    expect(top.comments[0]).toMatchObject({ from: "لاعب 1", text: "هههه جامد 😂", stars: 5 });
  });

  it("voting timer expiry calculates results", () => {
    const { s, ids, tv, subOf } = toVoting(3);
    vote(s, ids[0], subOf(ids[1]), tv, 4);
    expire(s);
    expect(s.phase).toBe("ROUND_RESULTS");
    expect(s.players.find((p) => p.id === ids[1])!.score).toBe(4);
  });

  it("a disconnect during voting doesn't block the round", () => {
    const { s, ids, tv, subOf } = toVoting(3);
    for (const v of [0, 1]) for (const target of [0, 1, 2]) if (v !== target) vote(s, ids[v], subOf(ids[target]), tv);
    markDisconnected(s, ids[2], tv);
    expect(s.phase).toBe("ROUND_RESULTS");
  });
});

describe("meme designs", () => {
  it("rejects an empty meme but accepts a drawing-only meme", () => {
    const { s, ids } = room(2);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    expectError(() => submitMeme(s, ids[0], { boxes: [], strokes: [] }, t), "EMPTY_CAPTION");
    expectError(() => submitMeme(s, ids[0], { boxes: [{ text: "   " }], strokes: [] }, t), "EMPTY_CAPTION");
    submitMeme(s, ids[0], { boxes: [], strokes: [{ color: "#E63946", width: 2, points: [10, 10, 500, 500] }] }, t);
  });

  it("clamps positions and rejects unknown colors", () => {
    const { s, ids } = room(2);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    submitMeme(s, ids[0], { boxes: [{ text: "x", x: 95, y: -5, w: 50, h: 300, color: "red;}", bg: "url(x)", size: 99 }], strokes: [] }, t);
    const b = s.submissions[0].design.boxes[0];
    expect(b.x + b.w).toBeLessThanOrEqual(100);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.h).toBe(100);
    expect(b.color).toBe("#FFFFFF");
    expect(b.bg).toBe("transparent");
    expect(b.size).toBe(14);
  });
});

describe("AI hint", () => {
  it("costs points once per round, can be refunded, and is cached per meme", () => {
    const { s, ids } = room(2);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    const tpl = s.currentTemplate!.id;
    expect(requestHint(s, ids[0], t)).toBeNull();
    expect(s.players[0].score).toBe(-GAME_CONFIG.hintCost);
    expectError(() => requestHint(s, ids[0], t), "HINT_USED");
    refundHint(s, ids[0], s.round);
    expect(s.players[0].score).toBe(0);
    requestHint(s, ids[0], t);
    resolveHint(s, ids[0], s.round, tpl, "بص على وشه 😂");
    expect(buildView(s, ids[0]).you.hint).toEqual({ status: "ready", text: "بص على وشه 😂" });
    expect(buildView(s, ids[1]).you.hint).toBeNull(); // private
    expect(requestHint(s, ids[1], t)).toBe("بص على وشه 😂"); // cached: no second AI call
    expect(s.players[1].score).toBe(-GAME_CONFIG.hintCost);
  });
});

describe("game flow", () => {
  function playRound(s: RoomState, ids: string[]) {
    const t = toCaption(s);
    ids.forEach((id, i) => submitMeme(s, id, cap(`ر${s.round} ل${i}`), t));
    const tv = expire(s);
    const subs = s.submissions;
    ids.forEach((id, i) => {
      for (const target of subs) if (target.playerId !== id) vote(s, id, target.id, tv, target.playerId === ids[(i + 1) % ids.length] ? 3 : 1);
    });
    expect(s.phase).toBe("ROUND_RESULTS");
    expire(s);
  }

  it("plays 3 rounds to final results, with different memes", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    const seen = new Set<string>();
    for (let r = 1; r <= 3; r++) {
      expect(s.round).toBe(r);
      seen.add(s.currentTemplate!.id);
      playRound(s, ids);
    }
    expect(s.phase).toBe("FINAL_RESULTS");
    expect(seen.size).toBe(3);
    // each round: every player gives one 3★ and one 1★ → 3 players × 4 = 12 points per round
    expect(s.players.reduce((a, p) => a + p.score, 0)).toBe(36);
  });

  it("play again keeps players and resets scores; return to lobby works", () => {
    const { s, ids } = room(2);
    startGame(s, ids[0], T0);
    for (let r = 0; r < 3; r++) playRound(s, ids);
    expectError(() => playAgain(s, ids[1], T0), "NOT_HOST");
    playAgain(s, ids[0], T0);
    expect(s.phase).toBe("COUNTDOWN");
    expect(s.round).toBe(1);
    expect(s.players.every((p) => p.score === 0)).toBe(true);
    for (let r = 0; r < 3; r++) playRound(s, ids);
    returnToLobby(s, ids[0]);
    expect(s.phase).toBe("LOBBY");
    expect(s.players.length).toBe(2);
  });
});

describe("disconnects, host migration, expiry", () => {
  it("migrates host after the grace period", () => {
    const { s, ids } = room(3);
    markDisconnected(s, ids[0], T0);
    tick(s, T0 + (GAME_CONFIG.hostDisconnectGraceSeconds - 1) * S);
    expect(s.hostId).toBe(ids[0]);
    tick(s, T0 + GAME_CONFIG.hostDisconnectGraceSeconds * S);
    expect(s.hostId).toBe(ids[1]);
  });

  it("host leaving hands over immediately", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    leave(s, ids[0], T0);
    expect(s.hostId).toBe(ids[1]);
    expect(s.players.find((p) => p.id === ids[0])!.left).toBe(true);
  });

  it("player who refreshes keeps score and seat mid-game", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    s.players[1].score = 4;
    markDisconnected(s, ids[1], T0);
    tick(s, T0 + 120 * S);
    markConnected(s, ids[1], T0 + 121 * S);
    expect(s.players.find((p) => p.id === ids[1])!.score).toBe(4);
  });

  it("empty rooms expire (mid-game: after the TTL; empty lobby: quickly)", () => {
    const { s, ids } = room(2);
    startGame(s, ids[0], T0);
    s.phaseEndsAt = null; // freeze the game clock for this test
    ids.forEach((id) => markDisconnected(s, id, T0));
    expect(tick(s, T0 + GAME_CONFIG.emptyRoomTtlSeconds * S - 1)).toBe(false);
    expect(tick(s, T0 + GAME_CONFIG.emptyRoomTtlSeconds * S)).toBe(true);

    const lobby = room(1);
    markDisconnected(lobby.s, lobby.ids[0], T0);
    expect(tick(lobby.s, T0 + 61 * S)).toBe(true);
  });
});
