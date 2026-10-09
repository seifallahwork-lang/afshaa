/** REVEAL (look only) and VOTING: rate every meme with 1–5 ⭐ or 😡, plus an optional comment. */
import { GAME_CONFIG } from "@shared/config";
import type { Rating, RoomView, SubmissionView } from "@shared/protocol";
import { truncate } from "@shared/text";
import { useState } from "react";
import { Avatar } from "../components/Avatar";
import { DownloadButton, ReportButton } from "../components/MemeActions";
import { MemeView } from "../components/MemeView";
import { DoneProgress, ProgressChips, Timer } from "../components/game";
import { Button } from "../components/ui";
import { t } from "../i18n";
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
  mine,
  rating,
  canRate,
  onRate,
  state,
}: {
  index: number;
  sub: SubmissionView;
  mine: boolean;
  rating: Rating | undefined;
  canRate: boolean;
  onRate: (r: Rating) => void;
  state: RoomView;
}) {
  const me = state.players.find((p) => p.id === state.you.id);
  return (
    <article className={`vote-card ${mine ? "is-mine" : ""} ${rating ? "is-rated" : ""}`}>
      <span className="vote-num">{t.memeNumber(index + 1)}</span>
      {mine && <span className="vote-flag">{t.yours}</span>}
      {sub.author && !mine && (
        <span className="vote-author">
          <Avatar avatar={sub.author.avatar} size={36} /> {t.by(sub.author.name)}
        </span>
      )}
      <MemeView template={sub.template} design={sub.design} />
      <div className="meme-actions">
        <DownloadButton template={sub.template} design={sub.design} name={`afsha-${state.code}-${index + 1}`} />
        {!mine && <ReportButton template={sub.template} design={sub.design} code={state.code} round={state.round} reporter={me?.name ?? ""} />}
      </div>
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

  return (
    <div className="stack">
      <div className="timer-row">
        <Timer endsAt={state.phaseEndsAt} total={voting ? state.settings.votingSeconds : 5} clockOffset={clockOffset} />
        {voting && <DoneProgress players={state.players} done={(p) => p.doneVoting} />}
      </div>
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
            mine={s.id === mineId}
            rating={state.you.myRatings[s.id]}
            canRate={voting}
            state={state}
            onRate={(r) => {
              sound.sfx(r.angry ? "angry" : "vote");
              send({ type: "rate", submissionId: s.id, stars: r.angry ? undefined : r.stars, angry: r.angry, comment: r.comment });
            }}
          />
        ))}
      </div>

      {voting && (
        <div className="panel">
          <ProgressChips players={state.players} done={(p) => p.doneVoting} />
        </div>
      )}
    </div>
  );
}
