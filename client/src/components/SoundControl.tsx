import { useEffect, useState } from "react";
import { t } from "../i18n";
import { sound } from "../lib/sound";

/** 🎵 button → small panel: music on/off, volume, sound effects on/off. */
export function SoundControl({ className = "", variant = "icon" }: { className?: string; variant?: "icon" | "pill" }) {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => sound.subscribe(() => force((n) => n + 1)), []);
  const s = sound.settings;

  return (
    <div className={`sound-control ${className}`}>
      <button
        type="button"
        className={variant === "pill" ? "pill-btn" : "icon-btn"}
        aria-expanded={open}
        aria-label={t.soundSettings}
        onClick={() => setOpen((o) => !o)}
      >
        {s.musicOn && s.volume > 0 ? "🎵" : "🔇"}
        {variant === "pill" && ` ${t.soundSettings}`}
      </button>
      {open && (
        <div className="sound-panel" role="dialog" aria-label={t.soundSettings}>
          <label className="switch-row">
            <span>{t.music}</span>
            <input type="checkbox" checked={s.musicOn} onChange={(e) => sound.setMusicOn(e.target.checked)} />
          </label>
          <label className="slider-row">
            <span>{t.volume}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(s.volume * 100)}
              onChange={(e) => sound.setVolume(Number(e.target.value) / 100)}
              dir="ltr"
            />
          </label>
          <label className="switch-row">
            <span>{t.sfx}</span>
            <input type="checkbox" checked={s.sfxOn} onChange={(e) => sound.setSfxOn(e.target.checked)} />
          </label>
        </div>
      )}
    </div>
  );
}
