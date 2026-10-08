/**
 * Background music + sound effects.
 * - Music: /audio/theme.mp3, looped. Browsers only allow audio after a tap,
 *   so it starts on the player's first interaction (if music is on).
 * - Effects are synthesized with the Web Audio API (no files to download).
 * Settings are per device (localStorage).
 */

export type Sfx = "tick" | "final" | "submit" | "vote" | "angry" | "fanfare" | "go";

interface SoundSettings {
  musicOn: boolean;
  volume: number; // 0..1 (music)
  sfxOn: boolean;
}

const KEY = "afsha.sound";
const DEFAULTS: SoundSettings = { musicOn: true, volume: 0.35, sfxOn: true };

function load(): SoundSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

class SoundManager {
  settings: SoundSettings = load();
  private music: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private listeners = new Set<() => void>();

  /** Call once at startup: waits for the first tap/click/key to unlock audio. */
  init(): void {
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      this.ensureCtx();
      if (this.settings.musicOn) this.playMusic();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      /* private mode */
    }
    this.listeners.forEach((fn) => fn());
  }

  private ensureMusic(): HTMLAudioElement {
    if (!this.music) {
      this.music = new Audio("/audio/theme.mp3");
      this.music.loop = true;
      this.music.preload = "auto";
    }
    this.music.volume = this.settings.volume;
    return this.music;
  }

  private playMusic(): void {
    this.ensureMusic()
      .play()
      .catch(() => {
        /* blocked until next tap — fine */
      });
  }

  setMusicOn(on: boolean): void {
    this.settings.musicOn = on;
    if (on) this.playMusic();
    else this.music?.pause();
    this.save();
  }

  setVolume(v: number): void {
    this.settings.volume = Math.min(1, Math.max(0, v));
    if (this.music) this.music.volume = this.settings.volume;
    if (this.settings.volume > 0 && !this.settings.musicOn) {
      this.settings.musicOn = true;
      this.playMusic();
    }
    this.save();
  }

  setSfxOn(on: boolean): void {
    this.settings.sfxOn = on;
    this.save();
  }

  private ensureCtx(): AudioContext | null {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** One synthesized note. */
  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.18, slideTo?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  /** `n` = seconds left, for the countdown ticks (higher pitch as time runs out). */
  sfx(kind: Sfx, n = 0): void {
    if (!this.settings.sfxOn || !this.unlocked) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (kind) {
      case "tick": {
        // "beep – boop": two quick notes, climbing every second
        const base = 520 + (5 - Math.min(5, Math.max(1, n))) * 110;
        this.tone(base, t, 0.09, "square", 0.12);
        this.tone(base * 1.5, t + 0.1, 0.11, "square", 0.12);
        break;
      }
      case "final":
        this.tone(220, t, 0.55, "sawtooth", 0.2, 90);
        this.tone(165, t + 0.05, 0.5, "square", 0.12, 70);
        break;
      case "go":
        [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.08, 0.14, "triangle", 0.18));
        break;
      case "submit":
        this.tone(660, t, 0.08, "triangle", 0.16);
        this.tone(990, t + 0.08, 0.14, "triangle", 0.16);
        break;
      case "vote":
        this.tone(880, t, 0.1, "sine", 0.18, 1320);
        break;
      case "angry":
        this.tone(140, t, 0.3, "sawtooth", 0.18, 90);
        break;
      case "fanfare":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.12, i === 3 ? 0.45 : 0.14, "triangle", 0.2));
        break;
    }
  }
}

export const sound = new SoundManager();
