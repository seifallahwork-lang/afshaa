/** Game-specific pieces: timer, player lists, leaderboard, top bar. */
import type { PlayerView, RoomView } from "@shared/protocol";
import { t } from "../i18n/ar";
import type { ConnectionStatus } from "../hooks/useRoom";
import { useCountdown } from "../hooks/useCountdown";
import { Logo } from "./ui";

export function Timer({ endsAt, total, clockOffset }: { endsAt: number | null; total: number; clockOffset: number }) {
  const left = useCountdown(endsAt, clockOffset);
  const pct = total > 0 ? Math.min(100, (left / total) * 100) : 0;
  const urgent = left <= 5;
  return (
    <div className={`timer ${urgent ? "urgent" : ""}`} role="timer" aria-live={urgent ? "polite" : "off"}>
      <div className="timer-track">
        <div className="timer-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="timer-num">{left}</span>
    </div>
  );
}

export function TopBar({ state, status }: { state: RoomView; status: ConnectionStatus }) {
  const inGame = state.phase !== "LOBBY";
  return (
    <header className="topbar">
      <Logo size="sm" />
      <div className="topbar-info">
        {inGame && state.phase !== "FINAL_RESULTS" && <span className="chip">{t.roundOf(state.round, state.totalRounds)}</span>}
        <span className="chip chip-code" dir="ltr">
          #{state.code}
        </span>
        <span className={`dot ${status === "open" ? "dot-on" : "dot-off"}`} title={status} />
      </div>
    </header>
  );
}

export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status === "open") return null;
  return (
    <div className="banner" role="status">
      {status === "connecting" ? t.connecting : t.reconnecting}
    </div>
  );
}

export function PlayerList({ players, youId }: { players: PlayerView[]; youId: string }) {
  return (
    <ul className="players">
      {players.map((p) => (
        <li key={p.id} className={`player ${p.connected ? "" : "is-off"}`}>
          <span className="avatar" aria-hidden="true">
            {Array.from(p.name)[0]}
          </span>
          <span className="player-name">{p.name}</span>
          {p.isHost && <span className="tag tag-host">👑 {t.hostBadge}</span>}
          {p.id === youId && <span className="tag">{t.you}</span>}
          {!p.connected && <span className="tag tag-off">{t.offline}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Who's done (submitted / voted) — names only, never content. */
export function ProgressChips({ players, done }: { players: PlayerView[]; done: (p: PlayerView) => boolean }) {
  return (
    <ul className="progress-chips">
      {players
        .filter((p) => !p.left)
        .map((p) => (
          <li key={p.id} className={done(p) ? "done" : p.connected ? "" : "off"}>
            {done(p) ? "✔ " : ""}
            {p.name}
          </li>
        ))}
    </ul>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function rankPlayers(players: PlayerView[]) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ar"));
  let rank = 0;
  let prev = Number.NaN;
  return sorted.map((p, i) => {
    if (p.score !== prev) rank = i + 1;
    prev = p.score;
    return { ...p, rank };
  });
}

export function Leaderboard({ players, youId }: { players: PlayerView[]; youId: string }) {
  return (
    <ol className="leaderboard">
      {rankPlayers(players).map((p) => (
        <li key={p.id} className={p.id === youId ? "is-you" : ""}>
          <span className="lb-rank">{MEDALS[p.rank - 1] ?? p.rank}</span>
          <span className="lb-name">
            {p.name}
            {p.left && <small> ({t.left})</small>}
          </span>
          <span className="lb-score">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

export { MEDALS };
