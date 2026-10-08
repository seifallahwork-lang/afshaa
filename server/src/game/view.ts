/**
 * Builds what ONE player is allowed to see. This is where anti-cheating lives:
 * captions are never included before the reveal, and authors stay hidden
 * until the round results.
 */
import type { PlayerView, RoomView } from "../../../shared/protocol";
import { staticTemplates, type TemplateSource } from "./engine";
import type { RoomState } from "./types";

const SHOW_TEMPLATE = new Set(["CAPTION", "REVEAL", "VOTING", "ROUND_RESULTS"]);
const SHOW_SUBMISSIONS = new Set(["REVEAL", "VOTING", "ROUND_RESULTS"]);
const SHOW_RESULTS = new Set(["ROUND_RESULTS", "FINAL_RESULTS"]);

export function buildView(s: RoomState, viewerId: string, templates: TemplateSource = staticTemplates): RoomView {
  const mine = s.submissions.find((x) => x.playerId === viewerId) ?? null;

  const players: PlayerView[] = s.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.id === s.hostId,
    connected: p.connected,
    left: p.left,
    score: p.score,
    hasSubmitted: s.submissions.some((x) => x.playerId === p.id),
    hasVoted: Boolean(s.votes[p.id]),
  }));

  const template = SHOW_TEMPLATE.has(s.phase)
    ? (templates.list(null).find((t) => t.id === s.currentTemplateId) ?? null)
    : null;

  const submissions = SHOW_SUBMISSIONS.has(s.phase)
    ? s.revealOrder.map((id) => {
        const sub = s.submissions.find((x) => x.id === id)!;
        return { id: sub.id, caption: sub.caption }; // no author!
      })
    : null;

  return {
    code: s.code,
    phase: s.phase,
    round: s.round,
    totalRounds: s.settings.rounds,
    settings: s.settings,
    phaseEndsAt: s.phaseEndsAt,
    hostId: s.hostId,
    players,
    template,
    submissions,
    lastRound: SHOW_RESULTS.has(s.phase) ? s.lastRound : null,
    highlights: s.phase === "FINAL_RESULTS" ? s.highlights : [],
    you: {
      id: viewerId,
      isHost: viewerId === s.hostId,
      myCaption: mine?.caption ?? null,
      mySubmissionId: mine?.id ?? null,
      votedFor: s.votes[viewerId] ?? null,
    },
  };
}
