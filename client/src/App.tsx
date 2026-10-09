import type { SessionResponse } from "@shared/protocol";
import { useState } from "react";
import { applyLang, getLang, t, type Lang } from "./i18n";
import { HomeScreen } from "./screens/HomeScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { clearSession, forgetLastSession, loadSession, saveSession } from "./lib/session";

/** Drop "?room=123456" from the address bar (it would pre-fill the join box). */
const cleanUrl = () => {
  if (location.search) history.replaceState(null, "", "/");
};

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
        // The seat is gone (room closed / left / invalid / removed) → no "rejoin" button for it.
        if (message === t.endedExpired || message === t.endedToken || message === t.endedKicked || message === undefined) forgetLastSession();
        cleanUrl();
        setNotice(message ?? null);
        setSession(null);
      }}
      onHome={() => {
        clearSession(); // the seat is kept: "ارجع للأوضة" on the home page brings you back
        cleanUrl();
        setNotice(null);
        setSession(null);
      }}
      onSwitch={(next) => {
        forgetLastSession();
        saveSession(next);
        setSession(next);
      }}
      onToggleLang={toggleLang}
    />
  );
}
