import type { SessionResponse } from "@shared/protocol";
import { useState } from "react";
import { applyLang, getLang, t, type Lang } from "./i18n";
import { HomeScreen } from "./screens/HomeScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { clearSession, forgetLastSession, loadSession, saveSession } from "./lib/session";

export function App() {
  const [session, setSession] = useState<SessionResponse | null>(loadSession);
  const [notice, setNotice] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(getLang);

  const toggleLang = () => {
    const next: Lang = lang === "ar" ? "franco" : "ar";
    applyLang(next);
    setLang(next);
  };

  if (!session) {
    return (
      <HomeScreen
        key={lang}
        notice={notice}
        onToggleLang={toggleLang}
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
        // The seat is gone (room closed / left / invalid) → no "rejoin" button for it.
        if (message === t.endedExpired || message === t.endedToken || message === undefined) forgetLastSession();
        setNotice(message ?? null);
        setSession(null);
      }}
    />
  );
}
