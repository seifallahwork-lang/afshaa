import { GAME_CONFIG } from "@shared/config";
import type { SessionResponse } from "@shared/protocol";
import { normalizeDigits, textLength } from "@shared/text";
import { useState, type FormEvent } from "react";
import { Avatar } from "../components/Avatar";
import { AvatarBuilder } from "../components/AvatarBuilder";
import { DeveloperButton } from "../components/DeveloperCard";
import { HowToPlayButton } from "../components/Modals";
import { SoundControl } from "../components/SoundControl";
import { Toast } from "../components/Toast";
import { Button, Fringe, Logo } from "../components/ui";
import { errorText, t } from "../i18n";
import { ApiFailure, createRoom, joinRoom } from "../lib/api";
import { SERVER_URL } from "../lib/config";
import { loadAvatar, loadLastSession, loadName, roomFromUrl, saveAvatar, saveName } from "../lib/session";

export function HomeScreen({
  onEnter,
  notice,
  onToggleLang,
}: {
  onEnter: (s: SessionResponse) => void;
  notice?: string | null;
  onToggleLang: () => void;
}) {
  const last = loadLastSession();
  const [name, setName] = useState(loadName);
  const [avatar, setAvatar] = useState(loadAvatar);
  const [building, setBuilding] = useState(false);
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
      const session = kind === "host" ? await createRoom(name.trim(), avatar) : await joinRoom(code, name.trim(), avatar);
      saveName(name.trim());
      saveAvatar(avatar);
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
          <div className="home-tools">
            <SoundControl variant="pill" />
            <HowToPlayButton />
            <button type="button" className="pill-btn" onClick={onToggleLang} lang={t.langToggle === "عربي" ? "ar" : "ar-Latn"}>
              🔤 {t.langToggle}
            </button>
          </div>
        </div>

        {last && (
          <button type="button" className="rejoin-btn" onClick={() => onEnter(last)}>
            ↩️ {t.rejoin(last.code)}
          </button>
        )}

        {!SERVER_URL && <div className="banner banner-static">{t.noServer}</div>}

        <form className="panel home-form" onSubmit={(e) => run(invited ? "join" : "host", e)}>
          <div className="me-row">
            <button type="button" className="avatar-edit" onClick={() => setBuilding(true)} aria-label={t.avatarTitle}>
              <Avatar avatar={avatar} size={104} />
              <span className="avatar-edit-label">✏️ {t.avatarEdit}</span>
            </button>
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
          </div>

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
      <DeveloperButton />
      {building && (
        <AvatarBuilder
          value={avatar}
          onDone={(a) => {
            setAvatar(a);
            saveAvatar(a);
            setBuilding(false);
          }}
        />
      )}
    </main>
  );
}
