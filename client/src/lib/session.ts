/**
 * The seat in a room survives a page refresh via sessionStorage.
 * sessionStorage is per-tab, so several tabs in one browser act as
 * different players — handy for testing multiplayer alone.
 */
import { randomAvatar, sanitizeAvatar, type Avatar } from "@shared/avatar";
import type { SessionResponse } from "@shared/protocol";

const KEY = "afsha.session";
const NAME_KEY = "afsha.name";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function loadSession(): SessionResponse | null {
  return safe(() => {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionResponse) : null;
  }, null);
}

const LAST_KEY = "afsha.last";

/** Last room on this device (survives closing the browser) → "ارجع للأوضة" button. */
export function loadLastSession(): SessionResponse | null {
  return safe(() => {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as SessionResponse) : null;
  }, null);
}
export const forgetLastSession = () => safe(() => localStorage.removeItem(LAST_KEY), undefined);

export function saveSession(s: SessionResponse): void {
  safe(() => sessionStorage.setItem(KEY, JSON.stringify(s)), undefined);
  safe(() => localStorage.setItem(LAST_KEY, JSON.stringify(s)), undefined);
  const url = new URL(location.href);
  url.searchParams.set("room", s.code);
  history.replaceState(null, "", url);
}

export function clearSession(): void {
  safe(() => sessionStorage.removeItem(KEY), undefined);
  const url = new URL(location.href);
  url.searchParams.delete("room");
  history.replaceState(null, "", url);
}

/** Remember the display name between visits (per device). */
export const loadName = () => safe(() => localStorage.getItem(NAME_KEY) ?? "", "");
export const saveName = (n: string) => safe(() => localStorage.setItem(NAME_KEY, n), undefined);

const AVATAR_KEY = "afsha.avatar";
/** Saved avatar for this device, or a fresh random one the first time. */
export function loadAvatar(): Avatar {
  return safe(() => {
    const raw = localStorage.getItem(AVATAR_KEY);
    return raw ? sanitizeAvatar(JSON.parse(raw)) : randomAvatar();
  }, randomAvatar());
}
export const saveAvatar = (a: Avatar) => safe(() => localStorage.setItem(AVATAR_KEY, JSON.stringify(a)), undefined);

export const inviteLink = (code: string) => `${location.origin}/?room=${code}`;
export const roomFromUrl = () => new URLSearchParams(location.search).get("room") ?? "";
