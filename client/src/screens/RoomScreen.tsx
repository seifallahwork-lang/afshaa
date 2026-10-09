/** Connects to the room and shows the screen for the current phase. */
import type { PlayerView, SessionResponse } from "@shared/protocol";
import { useEffect, useState } from "react";
import { Chat } from "../components/Chat";
import { ExitSheet, KickSheet, PlayerTapProvider } from "../components/RoomControls";
import { ConnectionBanner, TopBar } from "../components/game";
import { Toast } from "../components/Toast";
import { Fringe } from "../components/ui";
import { useRoom } from "../hooks/useRoom";
import { errorText, t } from "../i18n";
import { CaptionScreen } from "./CaptionScreen";
import { CountdownScreen } from "./CountdownScreen";
import { FinalScreen } from "./FinalScreen";
import { LobbyScreen } from "./LobbyScreen";
import { RoundResultsScreen } from "./RoundResultsScreen";
import type { ScreenProps } from "./types";
import { VotingScreen } from "./VotingScreen";

export function RoomScreen({
  session,
  onExit,
  onHome,
  onSwitch,
  onToggleLang,
}: {
  session: SessionResponse;
  onExit: (message?: string) => void;
  /** Back to the home page, keeping my seat (the "ارجع للأوضة" button brings me back). */
  onHome: () => void;
  /** I joined another room: leave this one and go there. */
  onSwitch: (next: SessionResponse) => void;
  onToggleLang: () => void;
}) {
  const { state, status, ended, clockOffset, error, send } = useRoom(session);
  const [kickTarget, setKickTarget] = useState<PlayerView | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [chatDocked, setChatDocked] = useState(false);

  // Warm the browser cache with the next meme during the 3-second countdown.
  const preload = state?.preloadImage;
  useEffect(() => {
    if (!preload) return;
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = preload;
  }, [preload]);

  useEffect(() => {
    if (ended === "LEFT") onExit();
    else if (ended === "EXPIRED") onExit(t.endedExpired);
    else if (ended === "INVALID_TOKEN") onExit(t.endedToken);
    else if (ended === "KICKED") onExit(t.endedKicked);
  }, [ended, onExit]);

  if (!state) {
    return (
      <main className="room">
        <Fringe />
        <div className="loading-screen">
          <p>{status === "reconnecting" ? t.reconnecting : t.connecting}</p>
          <button className="link" onClick={() => onExit()}>
            {t.backHome}
          </button>
        </div>
      </main>
    );
  }

  const props: ScreenProps = {
    state,
    send,
    clockOffset,
    onLeave: () => {
      send({ type: "leave" });
      onExit();
    },
  };

  let screen;
  switch (state.phase) {
    case "LOBBY":
      screen = <LobbyScreen {...props} />;
      break;
    case "COUNTDOWN":
      screen = <CountdownScreen {...props} />;
      break;
    case "CAPTION":
      screen = <CaptionScreen key={`caption-${state.round}`} {...props} />;
      break;
    case "REVEAL":
    case "VOTING":
      screen = <VotingScreen {...props} />;
      break;
    case "ROUND_RESULTS":
      screen = <RoundResultsScreen {...props} />;
      break;
    case "FINAL_RESULTS":
      screen = <FinalScreen {...props} />;
      break;
  }

  // The player in the sheet may have changed (or left) since it was opened.
  const kickLive = kickTarget ? state.players.find((p) => p.id === kickTarget.id && !p.left) ?? null : null;

  return (
    <PlayerTapProvider value={{ youId: state.you.id, onTap: setKickTarget }}>
      <main className={`room phase-${state.phase.toLowerCase()} ${chatDocked ? "has-chat-panel" : ""}`}>
        <Fringe />
        <TopBar state={state} status={status} onHome={onHome} onExit={() => setExitOpen(true)} onToggleLang={onToggleLang} />
        <ConnectionBanner status={status} />
        <div className="room-body">{screen}</div>
        <Chat messages={state.chat} youId={state.you.id} send={send} onDocked={setChatDocked} />
        <Toast message={error ? errorText[error.code] : null} at={error?.at ?? 0} />
      </main>
      {kickLive && (
        <KickSheet
          player={kickLive}
          voted={state.you.kickVotes.includes(kickLive.id)}
          onVote={(vote) => send({ type: "kickVote", playerId: kickLive.id, vote })}
          onClose={() => setKickTarget(null)}
        />
      )}
      {exitOpen && (
        <ExitSheet
          onLeave={props.onLeave}
          onJump={(next) => {
            send({ type: "leave" });
            onSwitch(next);
          }}
          onClose={() => setExitOpen(false)}
        />
      )}
    </PlayerTapProvider>
  );
}
