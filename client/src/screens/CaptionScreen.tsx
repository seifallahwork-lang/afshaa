import { isDesignEmpty, type MemeDesign } from "@shared/design";
import type { MemeTemplate } from "@shared/templates";
import { useEffect, useRef, useState } from "react";
import { MemeEditor, newBox } from "../components/MemeEditor";
import { DownloadButton } from "../components/MemeActions";
import { MemeView } from "../components/MemeView";
import { DoneProgress, MyStatus, ProgressChips, Timer } from "../components/game";
import { Button } from "../components/ui";
import { useCountdown } from "../hooks/useCountdown";
import { t } from "../i18n";
import { sound } from "../lib/sound";
import type { ScreenProps } from "./types";

const DRAFT_EVERY_MS = 2500;

const freshDesign = (template: MemeTemplate | null): MemeDesign => ({
  boxes: [newBox(template?.captionPosition ?? "bottom")],
  strokes: [],
  crop: null,
  strip: null,
});

export function CaptionScreen({ state, send, clockOffset }: ScreenProps) {
  const template = state.you.template;
  const [design, setDesign] = useState<MemeDesign>(() => state.you.draft ?? freshDesign(template));
  const left = useCountdown(state.phaseEndsAt, clockOffset);
  const submitted = state.you.myDesign !== null;
  const empty = isDesignEmpty(design);

  // New meme (reroll) → start fresh on the new picture (reset during render, before the editor mounts).
  const [shownId, setShownId] = useState(template?.id);
  if (template && template.id !== shownId) {
    setShownId(template.id);
    setDesign(freshDesign(template));
  }

  // Autosave to the server so unfinished work is submitted when time runs out.
  const lastSent = useRef("");
  useEffect(() => {
    if (submitted) return;
    const id = window.setTimeout(() => {
      const json = JSON.stringify(design);
      if (json !== lastSent.current && !isDesignEmpty(design)) {
        lastSent.current = json;
        send({ type: "draft", design });
      }
    }, DRAFT_EVERY_MS);
    return () => window.clearTimeout(id);
  }, [design, submitted, send]);

  // Last 2 seconds: push the latest version right away.
  useEffect(() => {
    if (left === 2 && !submitted && !isDesignEmpty(design)) send({ type: "draft", design });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  if (!template) {
    return (
      <div className="stack">
        <Timer endsAt={state.phaseEndsAt} total={state.settings.captionSeconds} clockOffset={clockOffset} />
        <div className="panel center">
          <p className="big-ok">⏳</p>
          <p>{t.lateJoin}</p>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (empty || left === 0) return;
    sound.sfx("submit");
    send({ type: "submitMeme", design });
  };

  return (
    <div className="stack">
      <div className="timer-row">
        <Timer endsAt={state.phaseEndsAt} total={state.settings.captionSeconds} clockOffset={clockOffset} />
        <DoneProgress players={state.players} done={(p) => p.hasSubmitted} />
      </div>

      {submitted ? (
        <>
          <MemeView template={template} design={state.you.myDesign} className="meme-hero" />
          <div className="panel center">
            <p className="big-ok">{t.submitted}</p>
            <p className="hint">{t.waitingOthers}</p>
            <div className="row-center">
              <DownloadButton template={template} design={state.you.myDesign!} />
            </div>
          </div>
        </>
      ) : (
        <div className="caption-layout">
          <div className="caption-actions">
            <button
              type="button"
              className="pill-btn"
              disabled={state.you.rerollsLeft <= 0 || left === 0}
              onClick={() => send({ type: "reroll" })}
            >
              {state.you.rerollsLeft > 0 ? t.rerollBtn(state.you.rerollsLeft) : t.noRerolls}
            </button>
          </div>
          <div className="cap-status">
            <MyStatus state={state} />
          </div>
          <MemeEditor key={template.id} template={template} design={design} onChange={setDesign} disabled={left === 0} />
          <div className="submit-bar">
            <Button className="btn-big" onClick={submit} disabled={empty || left === 0}>
              {left === 0 ? t.timeUp : t.submitMeme}
            </Button>
            <p className="hint">{empty && left > 0 ? t.emptyMeme : t.autoSubmitNote}</p>
          </div>
        </div>
      )}

      <div className="panel">
        <ProgressChips players={state.players} done={(p) => p.hasSubmitted} />
      </div>
    </div>
  );
}
