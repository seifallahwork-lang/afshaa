/**
 * Avatar = a few small numbers (which option of each part).
 * The server only checks the numbers are in range; the browser draws it
 * (client/src/components/Avatar.tsx owns the colors and shapes).
 */

export const AVATAR_PARTS = {
  bg: 8,
  skin: 7,
  hair: 14, // includes bald (0) and hijab (7)
  hairColor: 10,
  eyebrows: 5,
  eyes: 8,
  eyeColor: 7,
  mouth: 9,
  beard: 5,
  glasses: 5,
  hat: 8,
  shirt: 8,
  extra: 5, // blush, freckles, sweat, mole
} as const;

export type AvatarPart = keyof typeof AVATAR_PARTS;
export type Avatar = Record<AvatarPart, number>;

export const DEFAULT_AVATAR: Avatar = {
  bg: 0,
  skin: 2,
  hair: 1,
  hairColor: 0,
  eyebrows: 1,
  eyes: 0,
  eyeColor: 0,
  mouth: 0,
  beard: 0,
  glasses: 0,
  hat: 0,
  shirt: 0,
  extra: 0,
};

/** Any input → a valid avatar (unknown or out-of-range parts fall back to defaults). */
export function sanitizeAvatar(raw: unknown): Avatar {
  const out: Avatar = { ...DEFAULT_AVATAR };
  if (!raw || typeof raw !== "object") return out;
  for (const part of Object.keys(AVATAR_PARTS) as AvatarPart[]) {
    const v = (raw as Record<string, unknown>)[part];
    if (Number.isInteger(v) && (v as number) >= 0 && (v as number) < AVATAR_PARTS[part]) out[part] = v as number;
  }
  return out;
}

export function randomAvatar(rand: () => number = Math.random): Avatar {
  const out = { ...DEFAULT_AVATAR };
  for (const part of Object.keys(AVATAR_PARTS) as AvatarPart[]) {
    out[part] = Math.floor(rand() * AVATAR_PARTS[part]);
  }
  // Keep accessories occasional so random avatars don't look cluttered.
  if (rand() < 0.6) out.glasses = 0;
  if (rand() < 0.6) out.hat = 0;
  if (rand() < 0.5) out.beard = 0;
  if (rand() < 0.5) out.extra = 0;
  return out;
}
