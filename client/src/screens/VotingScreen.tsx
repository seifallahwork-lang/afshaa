/** REVEAL (look only) and VOTING: rate every meme with 1–5 ⭐ or 😡, plus an optional comment. */
import { GAME_CONFIG } from "@shared/config";
import type { Rating, SubmissionView } from "@shared/protocol";
import type { MemeTemplate } from "@shared/templates";
import { truncate } from "@shared/text";
import { useState } from "react";
import { MemeView } from "../components/MemeView";
import { ProgressChips, Timer } from "../components/game";
import { Button } from "../components/ui";
import { t } from "../i18n/ar";
import { sound } from "../lib/sound";
import type { ScreenProps } from "./types";

function RatingSummary({ r }: { r: Rating }) {
  return (
    <div className="rating-summary">
      <span>{r.angry ? `😡 ${t.angry}` : "⭐".repeat(r.stars)}</span>
      {r.comment && <q dir="auto">{r.comment}</q>}
    </div>
  );
}

function RatingForm({ onSend }: { onSend: (r: Rating) => void }) {
  const [stars, setStars] = useState(0);
  const [angry, setAngry] = useState(false);
  const [comment, setComment] = useState("");
  const ready = angry || stars > 0;
  return (
    <div className="rating-form">
      <div className="stars" role="radiogroup" aria-label={t.starsLabel}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={t.nStars(n)}
            className={`star ${!angry && n <= stars ? "on" : ""}`}
            onClick={() => {
              setAngry(false);
              setStars(n);
            }}
          >
            ★
          </button>
        ))}
        <button
          type="button"
          className={`angry-btn ${angry ? "on" : ""}`}
          aria-pressed={angry}
          title={t.angryHint(GAME_CONFIG.angryPenalty)}
          onClick={() => {
            setAngry((a) => !a);
            setStars(0);
          }}
        >
          😡
        </button>
      </div>
      <div className="comment-row">
        <input
          className="input input-sm"
          value={comment}
          onChange={(e) => setComment(truncate(e.target.value, GAME_CONFIG.commentMaxLength))}
          placeholder={t.commentPlaceholder}
          dir="auto"
          enterKeyHint="send"
          onKeyDown={(e) => e.key === "Enter" && ready && onSend({ stars, angry, comment })}
        />
        <Button className="btn-sm" disabled={!ready} onClick={() => onSend({ stars, angry, comment })}>
          {t.sendRating}
        </Button>
      </div>
      {angry && <p className="hint hint-warn">{t.angryHint(GAME_CONFIG.angryPenalty)}</p>}
    </div>
  );
}

function VoteCard({
  index,
  sub,
  template,
  mine,
  rating,
  canRate,
  onRate,
}: {
  index: number;
  sub: SubmissionView;
  template: MemeTemplate;
  mine: boolean;
  rating: Rating | undefined;
  canRate: boolean;
  onRate: (r: Rating) => void;
}) {
  return (
    <article className={`vote-card ${mine ? "is-mine" : ""} ${rating ? "is-rated" : ""}`}>
      <span className="vote-num">{t.memeNumber(index + 1)}</span>
      {mine && <span className="vote-flag">{t.yours}</span>}
      <MemeView template={template} design={sub.design} />
      {!mine && rating && <RatingSummary r={rating} />}
      {!mine && !rating && canRate && <RatingForm onSend={onRate} />}
    </article>
  );
}

export function VotingScreen({ state, send, clockOffset }: ScreenProps) {
  const voting = state.phase === "VOTING";
  const subs = state.submissions ?? [];
  const mineId = state.you.mySubmissionId;
  const others = subs.filter((s) => s.id !== mineId);
  const ratedCount = others.filter((s) => state.you.myRatings[s.id]).length;
  const active = state.players.filter((p) => !p.left);
  const doneVoters = active.filter((p) => p.doneVoting).length;

  if (!state.template) return null;

  return (
    <div className="stack">
      <Timer endsAt={state.phaseEndsAt} total={voting ? state.settings.votingSeconds : 5} clockOffset={clockOffset} />
      <div className="section-head">
        <h1>{voting ? t.votingTitle : t.revealTitle}</h1>
        <p className="hint">{voting ? (ratedCount === others.length ? t.allRated : t.ratedProgress(ratedCount, others.length)) : t.revealHint}</p>
      </div>

      <div className={`meme-grid count-${Math.min(subs.length, 4)}`}>
        {subs.map((s, i) => (
          <VoteCard
            key={s.id}
            index={i}
            sub={s}
            template={state.template!}
            mine={s.id === mineId}
            rating={state.you.myRatings[s.id]}
            canRate={voting}
            onRate={(r) => {
              sound.sfx(r.angry ? "angry" : "vote");
              send({ type: "rate", submissionId: s.id, stars: r.angry ? undefined : r.stars, angry: r.angry, comment: r.comment });
            }}
          />
        ))}
      </div>

      {voting && (
        <div className="panel">
          <p className="panel-sub">{t.votedCount(doneVoters, active.length)}</p>
          <ProgressChips players={state.players} done={(p) => p.doneVoting} />
        </div>
      )}
    </div>
  );
}
