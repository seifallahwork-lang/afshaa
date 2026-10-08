/**
 * Builds what ONE player is allowed to see. This is where anti-cheating lives:
 * captions are never included before the reveal, and authors stay hidden
 * until the round results.
 */
import type { PlayerView, RoomView } from "../../../shared/protocol";
import { isDoneVoting } from "./engine";
import type { RoomState } from "./types";

const SHOW_TEMPLATE = new Set(["CAPTION", "REVEAL", "VOTING", "ROUND_RESULTS"]);
const SHOW_SUBMISSIONS = new Set(["REVEAL", "VOTING", "ROUND_RESULTS"]);
const SHOW_RESULTS = new Set(["ROUND_RESULTS", "FINAL_RESULTS"]);

export function buildView(s: RoomState, viewerId: string, hintsEnabled = false): RoomView {
  const mine = s.submissions.find((x) => x.playerId === viewerId) ?? null;

  const players: PlayerView[] = s.players.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    isHost: p.id === s.hostId,
    connected: p.connected,
    left: p.left,
    score: p.score,
    hasSubmitted: s.submissions.some((x) => x.playerId === p.id),
    doneVoting: s.phase === "VOTING" && isDoneVoting(s, p.id),
  }));

  const template = SHOW_TEMPLATE.has(s.phase) ? s.currentTemplate : null;

  const submissions = SHOW_SUBMISSIONS.has(s.phase)
    ? s.revealOrder.map((id) => {
        const sub = s.submissions.find((x) => x.id === id)!;
        return { id: sub.id, design: sub.design }; // no author!
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
    // During the countdown, send only the image URL so browsers can preload it.
    preloadImage: s.phase === "COUNTDOWN" ? (s.currentTemplate?.image ?? null) : null,
    lastRound: SHOW_RESULTS.has(s.phase) ? s.lastRound : null,
    highlights: s.phase === "FINAL_RESULTS" ? s.highlights : [],
    hintsEnabled,
    you: {
      id: viewerId,
      isHost: viewerId === s.hostId,
      myDesign: mine?.design ?? null,
      mySubmissionId: mine?.id ?? null,
      myRatings: s.ratings[viewerId] ?? {},
      hint: s.hints[viewerId] ? { status: s.hints[viewerId].text === null ? "pending" : "ready", text: s.hints[viewerId].text } : null,
    },
  };
}
