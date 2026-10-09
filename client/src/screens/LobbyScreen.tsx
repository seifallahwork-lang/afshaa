import { CAPTION_SECONDS_OPTIONS, GAME_CONFIG, REROLL_OPTIONS, ROUND_OPTIONS, VOTING_SECONDS_OPTIONS } from "@shared/config";
import type { PlayerView } from "@shared/protocol";
import { useState } from "react";
import { DeveloperButton } from "../components/DeveloperCard";
import { PlayerList } from "../components/game";
import { ConfirmSheet, HowToPlayButton, QrButton } from "../components/Modals";
import { Button, Panel, Segmented } from "../components/ui";
import { t } from "../i18n";
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
  const [handOver, setHandOver] = useState<PlayerView | null>(null);
  const isHost = state.you.isHost;
  const active = state.players.filter((p) => !p.left);
  const connected = active.filter((p) => p.connected);
  const readyCount = connected.filter((p) => p.ready).length;
  const allReady = readyCount === connected.length;
  const me = active.find((p) => p.id === state.you.id);
  const canStart = connected.length >= GAME_CONFIG.minPlayers && allReady;
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
          {isHost && <QrButton link={link} code={state.code} />}
        </div>
      </Panel>

      <Panel>
        <div className="panel-head panel-head-row">
          <h2>{t.playersCount(active.length, GAME_CONFIG.maxPlayers)}</h2>
          <span className="chip">{t.readyCount(readyCount, connected.length)}</span>
        </div>
        <PlayerList players={active} youId={state.you.id} showReady onMakeHost={isHost ? setHandOver : undefined} />
      </Panel>

      <Panel>
        <div className="panel-head panel-head-row">
          <h2>{t.settings}</h2>
          <HowToPlayButton />
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
        <Segmented
          label={t.rerollsSetting}
          options={REROLL_OPTIONS}
          value={state.settings.rerolls as (typeof REROLL_OPTIONS)[number]}
          onChange={(rerolls) => send({ type: "updateSettings", settings: { rerolls } })}
          disabled={!isHost}
        />
        <Segmented
          label={t.blindSetting}
          options={[1, 0] as const}
          value={state.settings.anonymous ? 1 : 0}
          onChange={(v) => send({ type: "updateSettings", settings: { anonymous: v === 1 } })}
          format={(v) => (v === 1 ? `🙈 ${t.blindOn}` : `👀 ${t.blindOff}`)}
          disabled={!isHost}
        />
      </Panel>

      <div className="sticky-actions">
        {isHost ? (
          <>
            <Button onClick={() => send({ type: "start" })} disabled={!canStart} className="btn-big">
              {t.start}
            </Button>
            <p className="hint">{connected.length < GAME_CONFIG.minPlayers ? t.needTwo : allReady ? t.waitingPlayers : t.needReady}</p>
          </>
        ) : (
          <>
            <Button className="btn-big" variant={me?.ready ? "secondary" : "primary"} onClick={() => send({ type: "ready", ready: !me?.ready })}>
              {me?.ready ? `✔ ${t.readyBadge}` : t.ready}
            </Button>
            <p className="hint">{me?.ready ? t.waitingHost : t.tapReady}</p>
          </>
        )}
        <button className="link" onClick={onLeave}>
          {t.leave}
        </button>
      </div>
      <DeveloperButton inline />

      {handOver && (
        <ConfirmSheet
          title={`👑 ${t.makeHost}`}
          text={t.makeHostConfirm(handOver.name)}
          yes={t.yes}
          onYes={() => send({ type: "transferHost", playerId: handOver.id })}
          onClose={() => setHandOver(null)}
        />
      )}
    </div>
  );
}
