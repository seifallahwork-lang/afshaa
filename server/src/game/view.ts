/**
 * Builds what ONE player is allowed to see. This is where anti-cheating lives:
 * memes are never included before the reveal, and (in blind mode) authors stay
 * hidden until the round results.
 */
import type { PlayerView, RoomView } from "../../../shared/protocol";
import { isDoneVoting, rerollsLeft } from "./engine";
import type { RoomState } from "./types";

const SHOW_TEMPLATE = new Set(["CAPTION", "REVEAL", "VOTING", "ROUND_RESULTS"]);
const SHOW_SUBMISSIONS = new Set(["REVEAL", "VOTING", "ROUND_RESULTS"]);
const SHOW_RESULTS = new Set(["ROUND_RESULTS", "FINAL_RESULTS"]);

export function buildView(s: RoomState, viewerId: string): RoomView {
  const mine = s.submissions.find((x) => x.playerId === viewerId) ?? null;
  const assignment = s.assignments[viewerId];

  const players: PlayerView[] = s.players.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    isHost: p.id === s.hostId,
    connected: p.connected,
    left: p.left,
    ready: p.ready || p.id === s.hostId,
    score: p.score,
    hasSubmitted: s.submissions.some((x) => x.playerId === p.id),
    doneVoting: s.phase === "VOTING" && isDoneVoting(s, p.id),
  }));

  const submissions = SHOW_SUBMISSIONS.has(s.phase)
    ? s.revealOrder.map((id) => {
        const sub = s.submissions.find((x) => x.id === id)!;
        const author = s.players.find((p) => p.id === sub.playerId);
        return {
          id: sub.id,
          template: sub.template,
          design: sub.design,
          author: !s.settings.anonymous && author ? { name: author.name, avatar: author.avatar } : null,
        };
      })
    : null;

  const myTemplate = assignment?.template ?? null;

  return {
    code: s.code,
    phase: s.phase,
    round: s.round,
    totalRounds: s.settings.rounds,
    settings: s.settings,
    phaseEndsAt: s.phaseEndsAt,
    hostId: s.hostId,
    players,
    submissions,
    // During the countdown, send only my image URL so the browser can preload it.
    preloadImage: s.phase === "COUNTDOWN" ? (myTemplate?.image ?? null) : null,
    lastRound: SHOW_RESULTS.has(s.phase) ? s.lastRound : null,
    highlights: s.phase === "FINAL_RESULTS" ? s.highlights : [],
    chat: s.chat,
    you: {
      id: viewerId,
      isHost: viewerId === s.hostId,
      template: SHOW_TEMPLATE.has(s.phase) ? myTemplate : null,
      rerollsLeft: rerollsLeft(s, viewerId),
      draft: s.drafts[viewerId] ?? null,
      myDesign: mine?.design ?? null,
      mySubmissionId: mine?.id ?? null,
      kickVotes: Object.keys(s.kickVotes).filter((id) => s.kickVotes[id].includes(viewerId)),
      myRatings: s.ratings[viewerId] ?? {},
    },
  };
}
