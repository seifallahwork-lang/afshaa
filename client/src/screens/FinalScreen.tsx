import { useEffect } from "react";
import { Avatar } from "../components/Avatar";
import { DownloadButton } from "../components/MemeActions";
import { MemeView } from "../components/MemeView";
import { Leaderboard, rankPlayers } from "../components/game";
import { Button, Panel } from "../components/ui";
import { t } from "../i18n";
import { sound } from "../lib/sound";
import type { ScreenProps } from "./types";

export function FinalScreen({ state, send, onLeave }: ScreenProps) {
  const ranked = rankPlayers(state.players);
  const winners = ranked.filter((p) => p.rank === 1 && p.score > 0);

  useEffect(() => {
    sound.sfx("fanfare");
  }, []);

  return (
    <div className="stack">
      <div className="trophy">
        <div className="trophy-icon" aria-hidden="true">
          🏆
        </div>
        <p className="trophy-label">{winners.length > 1 ? t.winners : t.winner}</p>
        {winners.length > 0 ? (
          <>
            <div className="winner-avatars">
              {winners.map((w) => (
                <Avatar key={w.id} avatar={w.avatar} size={170} />
              ))}
            </div>
            <h1 className="trophy-name">{winners.map((w) => w.name).join(" و ")}</h1>
            <p className="trophy-score">{t.points(winners[0].score)}</p>
          </>
        ) : (
          <h1 className="trophy-name">—</h1>
        )}
      </div>

      <Panel>
        <div className="panel-head">
          <h2>{t.leaderboard}</h2>
        </div>
        <Leaderboard players={state.players} youId={state.you.id} />
      </Panel>

      {state.highlights.length > 0 && (
        <section className="stack">
          <h2 className="section-title">{t.bestMemes}</h2>
          <div className="meme-grid count-2">
            {state.highlights.map((h) => (
              <figure key={h.round} className="highlight">
                <MemeView template={h.template} design={h.design} />
                <figcaption>
                  {t.roundOf(h.round, state.totalRounds)}: <strong>{h.playerName}</strong> ({t.points(h.points)})
                </figcaption>
                <div className="row-center">
                  <DownloadButton template={h.template} design={h.design} name={`afsha-best-${h.round}`} />
                </div>
              </figure>
            ))}
          </div>
        </section>
      )}

      <div className="sticky-actions">
        {state.you.isHost ? (
          <div className="row">
            <Button onClick={() => send({ type: "playAgain" })}>{t.playAgain}</Button>
            <Button variant="secondary" onClick={() => send({ type: "returnToLobby" })}>
              {t.backToLobby}
            </Button>
          </div>
        ) : (
          <p className="hint hint-strong">{t.waitingHostNext}</p>
        )}
        <button className="link" onClick={onLeave}>
          {t.leave}
        </button>
      </div>
    </div>
  );
}
