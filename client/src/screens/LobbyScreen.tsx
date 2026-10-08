import { CAPTION_SECONDS_OPTIONS, GAME_CONFIG, ROUND_OPTIONS, VOTING_SECONDS_OPTIONS } from "@shared/config";
import { useState } from "react";
import { PlayerList } from "../components/game";
import { Button, Panel, Segmented } from "../components/ui";
import { t } from "../i18n/ar";
import { inviteLink } from "../lib/session";
import type { ScreenProps } from "./types";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function LobbyScreen({ state, send, onLeave }: ScreenProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const isHost = state.you.isHost;
  const active = state.players.filter((p) => !p.left);
  const connected = active.filter((p) => p.connected).length;
  const canStart = connected >= GAME_CONFIG.minPlayers;
  const link = inviteLink(state.code);

  const flash = async (kind: "code" | "link", text: string) => {
    if (await copy(text)) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t.gameName, text: t.shareText(state.code), url: link });
        return;
      } catch {
        /* cancelled */
      }
    }
    flash("link", `${t.shareText(state.code)}\n${link}`);
  };

  return (
    <div className="stack">
      <Panel className="code-card">
        <span className="field-label">{t.roomCodeLabel}</span>
        <div className="room-code" dir="ltr" aria-label={state.code.split("").join(" ")}>
          {state.code.split("").map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="row">
          <Button variant="secondary" onClick={() => flash("code", state.code)}>
            {copied === "code" ? t.copied : t.copyCode}
          </Button>
          <Button variant="secondary" onClick={share}>
            {copied === "link" ? t.copied : t.share}
          </Button>
        </div>
      </Panel>

      <Panel>
        <div className="panel-head">
          <h2>{t.playersCount(active.length, GAME_CONFIG.maxPlayers)}</h2>
        </div>
        <PlayerList players={active} youId={state.you.id} />
      </Panel>

      <Panel>
        <div className="panel-head">
          <h2>{t.settings}</h2>
        </div>
        <Segmented
          label={t.rounds}
          options={ROUND_OPTIONS}
          value={state.settings.rounds as (typeof ROUND_OPTIONS)[number]}
          onChange={(rounds) => send({ type: "updateSettings", settings: { rounds } })}
          disabled={!isHost}
        />
        <Segmented
          label={t.captionTime}
          options={CAPTION_SECONDS_OPTIONS}
          value={state.settings.captionSeconds as (typeof CAPTION_SECONDS_OPTIONS)[number]}
          onChange={(captionSeconds) => send({ type: "updateSettings", settings: { captionSeconds } })}
          format={t.seconds}
          disabled={!isHost}
        />
        <Segmented
          label={t.votingTime}
          options={VOTING_SECONDS_OPTIONS}
          value={state.settings.votingSeconds as (typeof VOTING_SECONDS_OPTIONS)[number]}
          onChange={(votingSeconds) => send({ type: "updateSettings", settings: { votingSeconds } })}
          format={t.seconds}
          disabled={!isHost}
        />
      </Panel>

      <div className="sticky-actions">
        {isHost ? (
          <>
            <Button onClick={() => send({ type: "start" })} disabled={!canStart} className="btn-big">
              {t.start}
            </Button>
            <p className="hint">{canStart ? t.waitingPlayers : t.needTwo}</p>
          </>
        ) : (
          <p className="hint hint-strong">{t.waitingHost}</p>
        )}
        <button className="link" onClick={onLeave}>
          {t.leave}
        </button>
      </div>
    </div>
  );
}
