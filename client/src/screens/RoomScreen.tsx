/** Connects to the room and shows the screen for the current phase. */
import type { SessionResponse } from "@shared/protocol";
import { useEffect } from "react";
import { Chat } from "../components/Chat";
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

export function RoomScreen({ session, onExit }: { session: SessionResponse; onExit: (message?: string) => void }) {
  const { state, status, ended, clockOffset, error, send } = useRoom(session);

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

  return (
    <main className={`room phase-${state.phase.toLowerCase()}`}>
      <Fringe />
      <TopBar state={state} status={status} />
      <ConnectionBanner status={status} />
      <div className="room-body">{screen}</div>
      <Chat messages={state.chat} youId={state.you.id} send={send} />
      <Toast message={error ? errorText[error.code] : null} at={error?.at ?? 0} />
    </main>
  );
}
