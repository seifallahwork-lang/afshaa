import { MemeCard } from "../components/MemeCard";
import { Leaderboard, MEDALS } from "../components/game";
import { Button, Panel } from "../components/ui";
import { useCountdown } from "../hooks/useCountdown";
import { t } from "../i18n/ar";
import type { ScreenProps } from "./types";

export function RoundResultsScreen({ state, send, clockOffset }: ScreenProps) {
  const left = useCountdown(state.phaseEndsAt, clockOffset);
  const result = state.lastRound;
  const isLast = state.round >= state.totalRounds;
  const top = result?.entries[0];
  const hasWinner = Boolean(top && top.votes > 0);

  return (
    <div className="stack">
      <div className="section-head">
        <h1>{t.roundResults}</h1>
        <p className="hint">{isLast ? t.finalIn(left) : t.nextRoundIn(left)}</p>
      </div>

      {result && top && hasWinner ? (
        <div className="winner-meme">
          <MemeCard template={result.template} caption={top.caption} className="meme-hero" />
          <p className="winner-line">
            🏆 {result.winnerIds.length > 1 ? result.entries.filter((e) => result.winnerIds.includes(e.playerId)).map((e) => e.playerName).join(" و ") : top.playerName}
            <span> — {t.votes(top.votes)}</span>
          </p>
        </div>
      ) : (
        <Panel className="center">
          <p className="big-ok">{result && result.entries.length === 0 ? t.noCaptions : t.noVotes}</p>
        </Panel>
      )}

      {result && result.entries.length > 0 && (
        <Panel>
          <ol className="round-entries">
            {result.entries.map((e, i) => (
              <li key={e.submissionId}>
                <span className="lb-rank">{e.votes > 0 ? (MEDALS[i] ?? i + 1) : "·"}</span>
                <div className="entry-body">
                  <strong>{e.playerName}</strong>
                  <span className="entry-caption" dir="auto">
                    {e.caption}
                  </span>
                </div>
                <span className="entry-points">+{t.points(e.points)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <Panel>
        <div className="panel-head">
          <h2>{t.leaderboard}</h2>
        </div>
        <Leaderboard players={state.players} youId={state.you.id} />
      </Panel>

      {state.you.isHost && (
        <div className="sticky-actions">
          <Button onClick={() => send({ type: "skip" })}>{t.next}</Button>
        </div>
      )}
    </div>
  );
}
