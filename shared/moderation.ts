/**
 * Very small word filter. Add words you don't want in names/captions to
 * BLOCKED_WORDS (any spelling — Arabic is normalized before matching).
 * Empty by default: you decide what your group considers off-limits.
 */
import { normalizeArabic } from "./text";

export const BLOCKED_WORDS: string[] = [
  // "كلمة",
];

const blocked = BLOCKED_WORDS.map(normalizeArabic).filter(Boolean);

export function containsBlockedWord(text: string): boolean {
  if (blocked.length === 0) return false;
  const words = normalizeArabic(text).split(/[\s.,!?؟،؛:"'()\-_*]+/u);
  return words.some((w) => blocked.includes(w));
}
