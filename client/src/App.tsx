import type { SessionResponse } from "@shared/protocol";
import { useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { clearSession, loadSession, saveSession } from "./lib/session";

export function App() {
  const [session, setSession] = useState<SessionResponse | null>(loadSession);
  const [notice, setNotice] = useState<string | null>(null);

  if (!session) {
    return (
      <HomeScreen
        notice={notice}
        onEnter={(s) => {
          saveSession(s);
          setNotice(null);
          setSession(s);
        }}
      />
    );
  }

  return (
    <RoomScreen
      key={session.token}
      session={session}
      onExit={(message) => {
        clearSession();
        setNotice(message ?? null);
        setSession(null);
      }}
    />
  );
}
