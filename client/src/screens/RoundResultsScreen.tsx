import { GAME_CONFIG } from "@shared/config";
import { useEffect } from "react";
import { Avatar } from "../components/Avatar";
import { MemeView } from "../components/MemeView";
import { Leaderboard, MEDALS } from "../components/game";
import { Button, Panel } from "../components/ui";
import { useCountdown } from "../hooks/useCountdown";
import { t } from "../i18n/ar";
import { sound } from "../lib/sound";
import type { ScreenProps } from "./types";

export function RoundResultsScreen({ state, send, clockOffset }: ScreenProps) {
  const left = useCountdown(state.phaseEndsAt, clockOffset);
  const result = state.lastRound;
  const isLast = state.round >= state.totalRounds;
  const top = result?.entries[0];
  const hasWinner = Boolean(result && result.winnerIds.length > 0 && top);

  useEffect(() => {
    sound.sfx(hasWinner ? "fanfare" : "submit");
  }, [hasWinner, state.round]);

  return (
    <div className="stack">
      <div className="section-head">
        <h1>{t.roundResults}</h1>
        <p className="hint">{isLast ? t.finalIn(left) : t.nextRoundIn(left)}</p>
      </div>

      {result && top && hasWinner ? (
        <div className="winner-meme">
          <MemeView template={result.template} design={top.design} className="meme-hero" />
          <p className="winner-line">
            🏆{" "}
            {result.entries
              .filter((e) => result.winnerIds.includes(e.playerId))
              .map((e) => e.playerName)
              .join(" و ")}
            <span> — {t.points(top.points)}</span>
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
                <div className="entry-head">
                  <span className="lb-rank">{e.points > 0 ? (MEDALS[i] ?? i + 1) : "·"}</span>
                  <Avatar avatar={e.avatar} size={36} />
                  <strong className="entry-name">{e.playerName}</strong>
                  <span className="entry-stats">
                    ⭐ {e.stars}
                    {e.angry > 0 && <> · 😡 {e.angry}</>}
                  </span>
                  <span className={`entry-points ${e.points < 0 ? "neg" : ""}`}>
                    {e.points > 0 ? "+" : ""}
                    {e.points}
                  </span>
                </div>
                {e.comments.length > 0 && (
                  <ul className="comments">
                    {e.comments.map((c, j) => (
                      <li key={j}>
                        <q dir="auto">{c.text}</q>
                        <small>
                          {" "}
                          — {c.from} {c.angry ? "😡" : `⭐${c.stars}`}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {result.hintUsers.length > 0 && (
            <p className="hint hint-line">
              💡 {t.hintUsers(result.hintUsers.join("، "), GAME_CONFIG.hintCost)}
            </p>
          )}
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
