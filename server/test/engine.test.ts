import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../../shared/config";
import {
  addPlayer,
  castVote,
  createRoomState,
  leave,
  markConnected,
  markDisconnected,
  playAgain,
  returnToLobby,
  startGame,
  submitCaption,
  tick,
  updateSettings,
} from "../src/game/engine";
import { GameError } from "../src/game/errors";
import type { RoomState } from "../src/game/types";
import { buildView } from "../src/game/view";

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
    submitCaption(s, ids[0], "لما الامتحان يطلع سهل 😂", t);
    const v = buildView(s, ids[1]);
    expect(v.submissions).toBeNull();
    expect(JSON.stringify(v)).not.toContain("الامتحان");
    expect(v.players.find((p) => p.id === ids[0])!.hasSubmitted).toBe(true);
    expect(buildView(s, ids[0]).you.myCaption).toContain("الامتحان");
  });

  it("prevents duplicate, empty and too-long submissions", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    expectError(() => submitCaption(s, ids[0], "   ", t), "EMPTY_CAPTION");
    expectError(() => submitCaption(s, ids[0], "ا".repeat(GAME_CONFIG.captionMaxLength + 1), t), "CAPTION_TOO_LONG");
    submitCaption(s, ids[0], "أول كابشن", t);
    expectError(() => submitCaption(s, ids[0], "تاني", t), "ALREADY_SUBMITTED");
  });

  it("counts emoji and Arabic as single characters", () => {
    const { s, ids } = room(2);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    submitCaption(s, ids[0], "😂".repeat(GAME_CONFIG.captionMaxLength), t);
  });

  it("rejects captions in the wrong phase or after the timer", () => {
    const { s, ids } = room(2);
    expectError(() => submitCaption(s, ids[0], "مبكر", T0), "WRONG_PHASE");
    startGame(s, ids[0], T0);
    toCaption(s);
    expectError(() => submitCaption(s, ids[0], "متأخر", s.phaseEndsAt!), "WRONG_PHASE");
  });

  it("moves to the reveal when everyone submitted", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    ids.forEach((id, i) => submitCaption(s, id, `كابشن ${i}`, t));
    expect(s.phase).toBe("REVEAL");
    const v = buildView(s, ids[1]);
    expect(v.submissions!.length).toBe(3);
    expect(JSON.stringify(v.submissions)).not.toContain(ids[0]); // anonymous
  });

  it("timer expiry closes submissions", () => {
    const { s, ids } = room(3);
    startGame(s, ids[0], T0);
    const t = toCaption(s);
    submitCaption(s, ids[0], "لوحدي", t);
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
  ids.forEach((id, i) => submitCaption(s, id, `كابشن ${i}`, t));
  const tv = expire(s); // REVEAL -> VOTING
  const subOf = (id: string) => s.submissions.find((x) => x.playerId === id)!.id;
  return { s, ids, tv, subOf };
}

describe("voting & scoring", () => {
  it("cannot vote for own meme, cannot vote twice", () => {
    const { s, ids, tv, subOf } = toVoting(3);
    expect(s.phase).toBe("VOTING");
    expectError(() => castVote(s, ids[0], subOf(ids[0]), tv), "CANNOT_VOTE_SELF");
    castVote(s, ids[0], subOf(ids[1]), tv);
    expectError(() => castVote(s, ids[0], subOf(ids[2]), tv), "ALREADY_VOTED");
    expectError(() => castVote(s, ids[1], "nope", tv), "INVALID_VOTE");
  });

  it("scores 1 point per vote and ends early when all voted", () => {
    const { s, ids, tv, subOf } = toVoting(3);
    castVote(s, ids[0], subOf(ids[1]), tv);
    castVote(s, ids[2], subOf(ids[1]), tv);
    castVote(s, ids[1], subOf(ids[0]), tv);
    expect(s.phase).toBe("ROUND_RESULTS");
    expect(s.players.find((p) => p.id === ids[1])!.score).toBe(2);
    expect(s.players.find((p) => p.id === ids[0])!.score).toBe(1);
    expect(s.lastRound!.winnerIds).toEqual([ids[1]]);
    expect(buildView(s, ids[2]).lastRound!.entries[0].playerName).toBe("لاعب 2");
  });

  it("voting timer expiry calculates results", () => {
    const { s, ids, tv, subOf } = toVoting(3);
    castVote(s, ids[0], subOf(ids[1]), tv);
    expire(s);
    expect(s.phase).toBe("ROUND_RESULTS");
    expect(s.players.find((p) => p.id === ids[1])!.score).toBe(1);
  });

  it("a disconnect during voting doesn't block the round", () => {
    const { s, ids, tv, subOf } = toVoting(3);
    castVote(s, ids[0], subOf(ids[1]), tv);
    castVote(s, ids[1], subOf(ids[0]), tv);
    markDisconnected(s, ids[2], tv);
    expect(s.phase).toBe("ROUND_RESULTS");
  });
});

describe("game flow", () => {
  function playRound(s: RoomState, ids: string[]) {
    const t = toCaption(s);
    ids.forEach((id, i) => submitCaption(s, id, `ر${s.round} ل${i}`, t));
    const tv = expire(s);
    const subs = s.submissions;
    ids.forEach((id, i) => {
      const target = subs.find((x) => x.playerId === ids[(i + 1) % ids.length])!;
      castVote(s, id, target.id, tv);
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
    expect(s.players.reduce((a, p) => a + p.score, 0)).toBe(9);
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
