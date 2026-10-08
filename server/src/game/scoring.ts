/**
 * Scoring engine. Each rule looks at the finished round and hands out points.
 * V1 has one rule (1 point per vote). To add a bonus later, write another
 * rule and append it to SCORING_RULES — nothing else changes.
 */
import type { RoundEntry } from "../../../shared/protocol";
import type { PlayerState, SubmissionState } from "./types";

export interface ScoringContext {
  submissions: SubmissionState[];
  /** voterId -> submissionId */
  votes: Record<string, string>;
  votesBySubmission: Map<string, number>;
}

export interface ScoringRule {
  id: string;
  /** Returns points per submissionId. */
  apply(ctx: ScoringContext): Map<string, number>;
}

const votesReceived: ScoringRule = {
  id: "votes",
  apply: (ctx) => new Map(ctx.submissions.map((s) => [s.id, ctx.votesBySubmission.get(s.id) ?? 0])),
};

// Example of a future rule (disabled):
// const winnerBonus: ScoringRule = { id: "winnerBonus", apply: (ctx) => { ... } };

export const SCORING_RULES: ScoringRule[] = [votesReceived];

export function scoreRound(
  submissions: SubmissionState[],
  votes: Record<string, string>,
  players: PlayerState[],
): { entries: RoundEntry[]; winnerIds: string[] } {
  const votesBySubmission = new Map<string, number>();
  for (const subId of Object.values(votes)) {
    votesBySubmission.set(subId, (votesBySubmission.get(subId) ?? 0) + 1);
  }
  const ctx: ScoringContext = { submissions, votes, votesBySubmission };
  const results = SCORING_RULES.map((rule) => ({ rule: rule.id, points: rule.apply(ctx) }));

  const entries: RoundEntry[] = submissions.map((s) => {
    const awards = results
      .map((r) => ({ rule: r.rule, points: r.points.get(s.id) ?? 0 }))
      .filter((a) => a.points !== 0);
    return {
      submissionId: s.id,
      playerId: s.playerId,
      playerName: players.find((p) => p.id === s.playerId)?.name ?? "؟",
      caption: s.caption,
      votes: votesBySubmission.get(s.id) ?? 0,
      points: awards.reduce((sum, a) => sum + a.points, 0),
      awards,
    };
  });

  entries.sort((a, b) => b.points - a.points || b.votes - a.votes);
  const top = entries[0]?.votes ?? 0;
  const winnerIds = top > 0 ? entries.filter((e) => e.votes === top).map((e) => e.playerId) : [];
  return { entries, winnerIds };
}
