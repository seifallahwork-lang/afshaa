/** Cryptographically secure randomness (available in Workers and Node 20+). */

export function randomInt(maxExclusive: number): number {
  // Rejection sampling to avoid modulo bias.
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % maxExclusive;
}

export function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** 6-digit numeric code, 100000–999999 (never starts with 0, easy to read aloud). */
export function randomRoomCode(): string {
  return String(100000 + randomInt(900000));
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
