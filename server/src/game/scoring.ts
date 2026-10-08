/**
 * Scoring engine. Each rule looks at the finished round and hands out points.
 *   - stars:  every ⭐ received = 1 point
 *   - angry:  every 😡 received = −angryPenalty points
 * To add a bonus later, write another rule and append it to SCORING_RULES.
 * (The AI-hint cost is charged immediately when a hint is bought, not here.)
 */
import { GAME_CONFIG } from "../../../shared/config";
import type { Rating, RoundComment, RoundEntry } from "../../../shared/protocol";
import type { PlayerState, SubmissionState } from "./types";

export interface ScoringContext {
  submissions: SubmissionState[];
  /** submissionId -> list of ratings it received */
  received: Map<string, Rating[]>;
}

export interface ScoringRule {
  id: string;
  /** Returns points per submissionId. */
  apply(ctx: ScoringContext): Map<string, number>;
}

const starsRule: ScoringRule = {
  id: "stars",
  apply: (ctx) =>
    new Map(ctx.submissions.map((s) => [s.id, (ctx.received.get(s.id) ?? []).reduce((a, r) => a + (r.angry ? 0 : r.stars), 0)])),
};

const angryRule: ScoringRule = {
  id: "angry",
  apply: (ctx) =>
    new Map(
      ctx.submissions.map((s) => [s.id, -GAME_CONFIG.angryPenalty * (ctx.received.get(s.id) ?? []).filter((r) => r.angry).length]),
    ),
};

export const SCORING_RULES: ScoringRule[] = [starsRule, angryRule];

export function scoreRound(
  submissions: SubmissionState[],
  ratings: Record<string, Record<string, Rating>>,
  players: PlayerState[],
): { entries: RoundEntry[]; winnerIds: string[] } {
  const received = new Map<string, Rating[]>();
  const comments = new Map<string, RoundComment[]>();
  for (const [voterId, byMeme] of Object.entries(ratings)) {
    const voterName = players.find((p) => p.id === voterId)?.name ?? "؟";
    for (const [subId, r] of Object.entries(byMeme)) {
      received.set(subId, [...(received.get(subId) ?? []), r]);
      if (r.comment) comments.set(subId, [...(comments.get(subId) ?? []), { from: voterName, text: r.comment, stars: r.stars, angry: r.angry }]);
    }
  }

  const ctx: ScoringContext = { submissions, received };
  const results = SCORING_RULES.map((rule) => ({ rule: rule.id, points: rule.apply(ctx) }));

  const entries: RoundEntry[] = submissions.map((s) => {
    const player = players.find((p) => p.id === s.playerId);
    const got = received.get(s.id) ?? [];
    const awards = results.map((r) => ({ rule: r.rule, points: r.points.get(s.id) ?? 0 })).filter((a) => a.points !== 0);
    return {
      submissionId: s.id,
      playerId: s.playerId,
      playerName: player?.name ?? "؟",
      avatar: player?.avatar ?? ({} as RoundEntry["avatar"]),
      design: s.design,
      stars: got.reduce((a, r) => a + (r.angry ? 0 : r.stars), 0),
      raters: got.filter((r) => !r.angry).length,
      angry: got.filter((r) => r.angry).length,
      comments: comments.get(s.id) ?? [],
      points: awards.reduce((sum, a) => sum + a.points, 0),
      awards,
    };
  });

  entries.sort((a, b) => b.points - a.points || b.stars - a.stars || a.angry - b.angry);
  const top = entries[0]?.points ?? 0;
  const winnerIds = top > 0 ? entries.filter((e) => e.points === top).map((e) => e.playerId) : [];
  return { entries, winnerIds };
}
