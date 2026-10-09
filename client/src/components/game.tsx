/** Game-specific pieces: timer, player lists, leaderboard, top bar. */
import type { PlayerView, RoomView } from "@shared/protocol";
import { useEffect, useRef } from "react";
import { Avatar } from "./Avatar";
import { SoundControl } from "./SoundControl";
import { sound } from "../lib/sound";
import { t } from "../i18n";
import type { ConnectionStatus } from "../hooks/useRoom";
import { useCountdown } from "../hooks/useCountdown";
import { Logo } from "./ui";

export function Timer({ endsAt, total, clockOffset }: { endsAt: number | null; total: number; clockOffset: number }) {
  const left = useCountdown(endsAt, clockOffset);
  // "beep – boop" for each of the last 5 seconds, then a buzzer at zero.
  const prev = useRef(left);
  useEffect(() => {
    if (left !== prev.current && endsAt !== null) {
      if (left >= 1 && left <= 5) sound.sfx("tick", left);
      else if (left === 0 && prev.current > 0) sound.sfx("final");
    }
    prev.current = left;
  }, [left, endsAt]);
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
        <SoundControl />
      </div>
      <MyStatus state={state} />
    </header>
  );
}

/** "#2 من 6 — 15 نقطة": every player always sees their own rank and score. */
export function MyStatus({ state }: { state: RoomView }) {
  if (state.phase === "LOBBY") return null;
  const ranked = rankPlayers(state.players.filter((p) => !p.left));
  const me = ranked.find((p) => p.id === state.you.id);
  if (!me) return null;
  return (
    <div className="my-status" aria-live="polite">
      <span className="chip chip-rank">🏅 {t.myRank(me.rank, ranked.length)}</span>
      <span className="chip chip-score">⭐ {t.myScore(me.score)}</span>
    </div>
  );
}

/** "3 من 6 خلّصوا" with a small bar. */
export function DoneProgress({ players, done }: { players: PlayerView[]; done: (p: PlayerView) => boolean }) {
  const active = players.filter((p) => !p.left && p.connected);
  const n = active.filter(done).length;
  return (
    <div className="done-progress" role="status">
      <span>✅ {t.doneProgress(n, active.length)}</span>
      <span className="done-bar">
        <i style={{ width: `${active.length ? (n / active.length) * 100 : 0}%` }} />
      </span>
    </div>
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

export function PlayerList({
  players,
  youId,
  showReady = false,
  onMakeHost,
}: {
  players: PlayerView[];
  youId: string;
  showReady?: boolean;
  onMakeHost?: (p: PlayerView) => void;
}) {
  return (
    <ul className="players">
      {players.map((p) => (
        <li key={p.id} className={`player ${p.connected ? "" : "is-off"} ${showReady && p.ready ? "is-ready" : ""}`}>
          <Avatar avatar={p.avatar} size={58} />
          <span className="player-name">{p.name}</span>
          {p.isHost && <span className="tag tag-host">👑 {t.hostBadge}</span>}
          {p.id === youId && <span className="tag">{t.you}</span>}
          {showReady && !p.isHost && <span className={`tag ${p.ready ? "tag-ready" : "tag-off"}`}>{p.ready ? `✔ ${t.readyBadge}` : "…"}</span>}
          {!p.connected && <span className="tag tag-off">{t.offline}</span>}
          {onMakeHost && !p.isHost && p.connected && (
            <button type="button" className="mini-btn" onClick={() => onMakeHost(p)}>
              👑 {t.makeHost}
            </button>
          )}
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
            <Avatar avatar={p.avatar} size={30} />
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
          <Avatar avatar={p.avatar} size={46} />
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
