import { GAME_CONFIG } from "@shared/config";
import { isDesignEmpty, type MemeDesign } from "@shared/design";
import { useState } from "react";
import { MemeEditor, newBox } from "../components/MemeEditor";
import { MemeView } from "../components/MemeView";
import { ProgressChips, Timer } from "../components/game";
import { Button } from "../components/ui";
import { useCountdown } from "../hooks/useCountdown";
import { t } from "../i18n/ar";
import { sound } from "../lib/sound";
import type { ScreenProps } from "./types";

function HintBox({ state, send }: Pick<ScreenProps, "state" | "send">) {
  const [confirming, setConfirming] = useState(false);
  const hint = state.you.hint;
  if (hint) {
    return (
      <div className={`hint-card ${hint.status}`} role="status">
        <span className="hint-icon" aria-hidden="true">
          💡
        </span>
        <p>{hint.status === "pending" ? t.hintThinking : hint.text}</p>
      </div>
    );
  }
  if (!state.hintsEnabled || state.you.myDesign) return null;
  return confirming ? (
    <div className="hint-confirm">
      <span>{t.hintConfirm(GAME_CONFIG.hintCost)}</span>
      <div className="row">
        <Button
          onClick={() => {
            setConfirming(false);
            send({ type: "requestHint" });
          }}
        >
          {t.hintYes}
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)}>
          {t.cancel}
        </Button>
      </div>
    </div>
  ) : (
    <button type="button" className="hint-btn" onClick={() => setConfirming(true)}>
      💡 {t.hintButton} <small>(−{GAME_CONFIG.hintCost})</small>
    </button>
  );
}

export function CaptionScreen({ state, send, clockOffset }: ScreenProps) {
  const [design, setDesign] = useState<MemeDesign>(() => ({
    boxes: [newBox(state.template?.captionPosition ?? "bottom")],
    strokes: [],
  }));
  const left = useCountdown(state.phaseEndsAt, clockOffset);
  const submitted = state.you.myDesign !== null;
  const active = state.players.filter((p) => !p.left);
  const doneCount = active.filter((p) => p.hasSubmitted).length;
  const empty = isDesignEmpty(design);

  if (!state.template) return null;

  const submit = () => {
    if (empty || left === 0) return;
    sound.sfx("submit");
    send({ type: "submitMeme", design });
  };

  return (
    <div className="stack">
      <Timer endsAt={state.phaseEndsAt} total={state.settings.captionSeconds} clockOffset={clockOffset} />

      {submitted ? (
        <>
          <MemeView template={state.template} design={state.you.myDesign} className="meme-hero" />
          <div className="panel center">
            <p className="big-ok">{t.submitted}</p>
            <p className="hint">{t.waitingOthers}</p>
          </div>
        </>
      ) : (
        <>
          <HintBox state={state} send={send} />
          <MemeEditor template={state.template} design={design} onChange={setDesign} disabled={left === 0} />
          <div className="submit-bar">
            <Button className="btn-big" onClick={submit} disabled={empty || left === 0}>
              {left === 0 ? t.timeUp : t.submitMeme}
            </Button>
            {empty && left > 0 && <p className="hint">{t.emptyMeme}</p>}
          </div>
        </>
      )}

      <div className="panel">
        <p className="panel-sub">{t.submittedCount(doneCount, active.length)}</p>
        <ProgressChips players={state.players} done={(p) => p.hasSubmitted} />
      </div>
    </div>
  );
}
