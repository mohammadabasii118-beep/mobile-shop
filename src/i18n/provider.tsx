"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isRtl, type Locale } from "./config";
import { en } from "./en";
import { fa } from "./fa";

/**
 * Lightweight i18n: the English text IS the key; `fa` maps English → Persian.
 * A missing translation falls back to English, so the UI never breaks. Add a language = add a dictionary.
 */
const DICTS: Record<Locale, Record<string, string>> = { en, fa };

export type Vars = Record<string, string | number>;

function translate(locale: Locale, key: string, vars?: Vars) {
  const d = DICTS[locale];
  let out = d[key];
  if (out === undefined) {
    // Dynamic suffix, e.g. "New customer: armin.s" → translate the prefix, keep the value.
    const i = key.indexOf(": ");
    out = i > 0 && d[key.slice(0, i)] !== undefined ? `${d[key.slice(0, i)]}${key.slice(i)}` : key;
  }
  return vars ? out.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : out;
}

interface Ctx { locale: Locale; setLocale: (l: Locale) => void; t: (key: string, vars?: Vars) => string }
const I18nCtx = createContext<Ctx>({ locale: DEFAULT_LOCALE, setLocale: () => {}, t: (k) => k });

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLoc] = useState<Locale>(initialLocale);
  const setLocale = useCallback((l: Locale) => {
    setLoc(l);
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    document.documentElement.dir = isRtl(l) ? "rtl" : "ltr";
  }, []);
  const value = useMemo<Ctx>(() => ({ locale, setLocale, t: (k, v) => translate(locale, k, v) }), [locale, setLocale]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
export const useT = () => useContext(I18nCtx).t;
