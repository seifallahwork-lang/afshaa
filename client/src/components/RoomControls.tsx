/**
 * Room-wide controls:
 *  - tapping any other player → "قرار إزالة" (secret removal vote) confirm sheet
 *  - exit sheet: jump to another room, or leave
 */
import type { SessionResponse } from "@shared/protocol";
import type { PlayerView } from "@shared/protocol";
import { createContext, useContext, useState, type FormEvent } from "react";
import { errorText, t } from "../i18n";
import { ApiFailure, joinRoom } from "../lib/api";
import { loadAvatar, loadName } from "../lib/session";
import { Avatar } from "./Avatar";
import { Sheet } from "./Modals";
import { Button } from "./ui";

/* ---------- tap a player ---------- */

type Tap = { youId: string; onTap: (p: PlayerView) => void } | null;
const PlayerTap = createContext<Tap>(null);
export const PlayerTapProvider = PlayerTap.Provider;

/** Returns a click handler for this player, or null (you / no room context / player gone). */
export function usePlayerTap(p: PlayerView): (() => void) | null {
  const ctx = useContext(PlayerTap);
  if (!ctx || p.id === ctx.youId || p.left) return null;
  return () => ctx.onTap(p);
}

export function KickSheet({
  player,
  voted,
  onVote,
  onClose,
}: {
  player: PlayerView;
  voted: boolean;
  onVote: (vote: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} className="kick-sheet">
      <h2>🚫 {t.kickTitle}</h2>
      <div className="kick-who">
        <Avatar avatar={player.avatar} size={120} />
        <strong>{player.name}</strong>
      </div>
      <p className="kick-q">{voted ? t.kickSent(player.name) : t.kickConfirm(player.name)}</p>
      <p className="hint">{t.kickNote}</p>
      <div className="row">
        {voted ? (
          <Button
            variant="secondary"
            onClick={() => {
              onVote(false);
              onClose();
            }}
          >
            {t.kickWithdraw}
          </Button>
        ) : (
          <Button
            className="btn-danger"
            onClick={() => {
              onVote(true);
              onClose();
            }}
          >
            {t.kickSend}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          {t.cancel}
        </Button>
      </div>
    </Sheet>
  );
}

/* ---------- exit / jump to another room ---------- */

export function ExitSheet({
  onLeave,
  onJump,
  onClose,
}: {
  onLeave: () => void;
  onJump: (session: SessionResponse) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jump = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return setError(errorText.INVALID_CODE);
    setBusy(true);
    setError(null);
    try {
      // Join the new room first, so a wrong code never costs you your current seat.
      const session = await joinRoom(code, loadName() || "?", loadAvatar());
      onJump(session);
    } catch (err) {
      setError(errorText[err instanceof ApiFailure ? err.code : "NETWORK"]);
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} className="exit-sheet">
      <h2>{t.exitTitle}</h2>
      <form className="jump-form" onSubmit={jump}>
        <label className="field-label" htmlFor="jump-code">
          {t.jumpRoom}
        </label>
        <div className="join-row">
          <input
            id="jump-code"
            className="input input-code"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder={t.jumpCodeLabel}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            dir="ltr"
          />
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? "…" : t.jumpGo}
          </Button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
      <hr className="divider" />
      <Button variant="secondary" className="btn-big" onClick={onLeave}>
        {t.imLeaving}
      </Button>
    </Sheet>
  );
}
