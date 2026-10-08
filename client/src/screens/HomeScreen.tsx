import { GAME_CONFIG } from "@shared/config";
import type { SessionResponse } from "@shared/protocol";
import { normalizeDigits, textLength } from "@shared/text";
import { useState, type FormEvent } from "react";
import { Toast } from "../components/Toast";
import { Button, Fringe, Logo } from "../components/ui";
import { errorText, t } from "../i18n/ar";
import { ApiFailure, createRoom, joinRoom } from "../lib/api";
import { SERVER_URL } from "../lib/config";
import { loadName, roomFromUrl, saveName } from "../lib/session";

export function HomeScreen({ onEnter, notice }: { onEnter: (s: SessionResponse) => void; notice?: string | null }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(() => normalizeDigits(roomFromUrl()).replace(/\D/g, "").slice(0, 6));
  const [busy, setBusy] = useState<"host" | "join" | null>(null);
  const [error, setError] = useState<{ msg: string; at: number } | null>(
    notice ? { msg: notice, at: Date.now() } : null,
  );
  const invited = code.length === 6;

  const nameOk = name.trim().length > 0 && textLength(name.trim()) <= GAME_CONFIG.nameMaxLength;

  async function run(kind: "host" | "join", e?: FormEvent) {
    e?.preventDefault();
    if (!nameOk) return setError({ msg: errorText.INVALID_NAME, at: Date.now() });
    if (kind === "join" && code.length !== 6) return setError({ msg: errorText.INVALID_CODE, at: Date.now() });
    setBusy(kind);
    try {
      const session = kind === "host" ? await createRoom(name.trim()) : await joinRoom(code, name.trim());
      saveName(name.trim());
      onEnter(session);
    } catch (err) {
      const c = err instanceof ApiFailure ? err.code : "NETWORK";
      setError({ msg: errorText[c], at: Date.now() });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="home">
      <Fringe />
      <div className="home-inner">
        <div className="hero">
          <Logo />
          <p className="tagline">{t.tagline}</p>
          <p className="pitch">{t.pitch}</p>
        </div>

        {!SERVER_URL && <div className="banner banner-static">{t.noServer}</div>}

        <form className="panel home-form" onSubmit={(e) => run(invited ? "join" : "host", e)}>
          <label className="field">
            <span className="field-label">{t.yourName}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              maxLength={GAME_CONFIG.nameMaxLength * 2}
              autoComplete="nickname"
              enterKeyHint="go"
              dir="auto"
            />
          </label>

          {!invited && (
            <Button type="button" onClick={() => run("host")} busy={busy === "host"} disabled={busy !== null}>
              {t.host}
            </Button>
          )}

          <div className="join-box">
            <span className="field-label">{invited ? t.roomCodeLabel : t.or}</span>
            <div className="join-row">
              <input
                className="input input-code"
                value={code}
                onChange={(e) => setCode(normalizeDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                placeholder={t.codePlaceholder}
                aria-label={t.roomCodeLabel}
                dir="ltr"
              />
              <Button
                type="button"
                variant={invited ? "primary" : "secondary"}
                onClick={() => run("join")}
                busy={busy === "join"}
                disabled={busy !== null}
              >
                {t.join}
              </Button>
            </div>
          </div>
          {invited && (
            <button type="button" className="link" onClick={() => setCode("")}>
              {t.host}
            </button>
          )}
        </form>

        <p className="facts">{t.facts}</p>
      </div>
      <Toast message={error?.msg ?? null} at={error?.at ?? 0} />
    </main>
  );
}
