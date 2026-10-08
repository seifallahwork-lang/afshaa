/** Used for both REVEAL (look only) and VOTING (tap to vote). */
import { MemeCard } from "../components/MemeCard";
import { ProgressChips, Timer } from "../components/game";
import { t } from "../i18n/ar";
import type { ScreenProps } from "./types";

export function VotingScreen({ state, send, clockOffset }: ScreenProps) {
  const voting = state.phase === "VOTING";
  const subs = state.submissions ?? [];
  const votedFor = state.you.votedFor;
  const active = state.players.filter((p) => !p.left);
  const voters = active.filter((p) => p.hasVoted).length;
  const total = voting ? state.settings.votingSeconds : 5;

  if (!state.template) return null;

  return (
    <div className="stack">
      <Timer endsAt={state.phaseEndsAt} total={total} clockOffset={clockOffset} />
      <div className="section-head">
        <h1>{voting ? t.votingTitle : t.revealTitle}</h1>
        <p className="hint">{voting ? (votedFor ? t.voted : t.votingHint) : t.revealHint}</p>
      </div>

      <div className={`meme-grid count-${Math.min(subs.length, 4)}`}>
        {subs.map((s, i) => {
          const mine = s.id === state.you.mySubmissionId;
          const chosen = s.id === votedFor;
          const clickable = voting && !mine && !votedFor;
          return (
            <button
              key={s.id}
              className={`vote-card ${mine ? "is-mine" : ""} ${chosen ? "is-chosen" : ""} ${clickable ? "is-clickable" : ""}`}
              disabled={!clickable}
              onClick={() => send({ type: "vote", submissionId: s.id })}
              aria-pressed={chosen}
            >
              <span className="vote-num">{t.memeNumber(i + 1)}</span>
              {mine && <span className="vote-flag">{t.yours}</span>}
              {chosen && <span className="vote-flag vote-flag-chosen">✔</span>}
              <MemeCard template={state.template!} caption={s.caption} />
            </button>
          );
        })}
      </div>

      {voting && (
        <div className="panel">
          <p className="panel-sub">{t.votedCount(voters, active.length)}</p>
          <ProgressChips players={state.players} done={(p) => p.hasVoted} />
        </div>
      )}
    </div>
  );
}
