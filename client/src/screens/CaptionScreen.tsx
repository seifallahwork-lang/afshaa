import { GAME_CONFIG } from "@shared/config";
import { textLength, truncate } from "@shared/text";
import { useState } from "react";
import { MemeCard } from "../components/MemeCard";
import { ProgressChips, Timer } from "../components/game";
import { Button } from "../components/ui";
import { useCountdown } from "../hooks/useCountdown";
import { t } from "../i18n/ar";
import type { ScreenProps } from "./types";

export function CaptionScreen({ state, send, clockOffset }: ScreenProps) {
  const [draft, setDraft] = useState("");
  const left = useCountdown(state.phaseEndsAt, clockOffset);
  const submitted = state.you.myCaption !== null;
  const active = state.players.filter((p) => !p.left);
  const doneCount = active.filter((p) => p.hasSubmitted).length;
  const max = GAME_CONFIG.captionMaxLength;
  const len = textLength(draft);

  if (!state.template) return null;

  const submit = () => {
    if (draft.trim()) send({ type: "submitCaption", caption: draft });
  };

  return (
    <div className="stack">
      <Timer endsAt={state.phaseEndsAt} total={state.settings.captionSeconds} clockOffset={clockOffset} />
      <MemeCard
        template={state.template}
        caption={submitted ? state.you.myCaption : draft}
        placeholder={submitted ? undefined : t.captionPlaceholder}
        className="meme-hero"
      />

      {submitted ? (
        <div className="panel center">
          <p className="big-ok">{t.submitted}</p>
          <p className="hint">{t.waitingOthers}</p>
        </div>
      ) : (
        <form
          className="panel caption-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="field">
            <span className="field-label">{t.writeCaption}</span>
            <textarea
              className="input textarea"
              value={draft}
              onChange={(e) => setDraft(truncate(e.target.value.replace(/\n/g, " "), max))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={t.captionPlaceholder}
              rows={2}
              dir="rtl"
              autoFocus
              disabled={left === 0}
            />
          </label>
          <div className="caption-foot">
            <span className={`counter ${len > max - 15 ? "warn" : ""}`} dir="ltr">
              {t.chars(len, max)}
            </span>
            <Button type="submit" disabled={!draft.trim() || left === 0}>
              {left === 0 ? t.timeUp : t.submit}
            </Button>
          </div>
        </form>
      )}

      <div className="panel">
        <p className="panel-sub">{t.submittedCount(doneCount, active.length)}</p>
        <ProgressChips players={state.players} done={(p) => p.hasSubmitted} />
      </div>
    </div>
  );
}
