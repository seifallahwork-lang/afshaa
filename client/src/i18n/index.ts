/**
 * Language switch: Arabic (default) ⇄ Franco-Arab.
 * `t` and `errorText` always point at the current language; the App re-renders
 * everything when the language changes.
 */
import { ar, arErrors, type Dict } from "./ar";
import { franco, francoErrors } from "./franco";

export type Lang = "ar" | "franco";
const KEY = "afsha.lang";

let current: Lang = (() => {
  try {
    return localStorage.getItem(KEY) === "franco" ? "franco" : "ar";
  } catch {
    return "ar";
  }
})();

const dicts = { ar, franco } as const;
const errs = { ar: arErrors, franco: francoErrors } as const;

export const t: Dict = new Proxy({} as Dict, { get: (_, k) => dicts[current][k as keyof Dict] });
export const errorText = new Proxy({} as typeof arErrors, { get: (_, k) => errs[current][k as keyof typeof arErrors] });

export const getLang = () => current;

export function applyLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  document.documentElement.dir = dicts[lang].dir;
  document.documentElement.lang = dicts[lang].langCode;
}
