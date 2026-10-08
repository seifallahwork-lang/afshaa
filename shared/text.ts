/**
 * Text helpers used on BOTH sides so the browser's character counter and the
 * server's validation always agree.
 */

/** Length in Unicode code points (an Arabic letter or most emoji = 1). */
export function textLength(s: string): number {
  return Array.from(s).length;
}

/** Cut a string to `max` code points without breaking surrogate pairs. */
export function truncate(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join("") : s;
}

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits -> 0-9. */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Clean user text: strip control characters, collapse whitespace/newlines.
 * Keeps Arabic, English, punctuation, digits and emoji.
 */
export function cleanText(s: string): string {
  return s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize Arabic for word matching (alef/ya/ta-marbuta forms, tashkeel, tatweel). */
export function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}
