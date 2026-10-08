import { MemeCard } from "../components/MemeCard";
import { Leaderboard, rankPlayers } from "../components/game";
import { Button, Panel } from "../components/ui";
import { t } from "../i18n/ar";
import type { ScreenProps } from "./types";

export function FinalScreen({ state, send, onLeave }: ScreenProps) {
  const ranked = rankPlayers(state.players);
  const winners = ranked.filter((p) => p.rank === 1 && p.score > 0);

  return (
    <div className="stack">
      <div className="trophy">
        <div className="trophy-icon" aria-hidden="true">
          🏆
        </div>
        <p className="trophy-label">{winners.length > 1 ? t.winners : t.winner}</p>
        {winners.length > 0 ? (
          <>
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
                <MemeCard template={h.template} caption={h.caption} />
                <figcaption>
                  {t.roundOf(h.round, state.totalRounds)}: <strong>{h.playerName}</strong> ({t.votes(h.votes)})
                </figcaption>
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
