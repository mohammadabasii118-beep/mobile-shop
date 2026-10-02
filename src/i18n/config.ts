export const LOCALES = ["fa", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fa";
export const LOCALE_COOKIE = "sm_locale";
export const isRtl = (l: Locale) => l === "fa";
export const toLocale = (v?: string): Locale => (v === "en" || v === "fa" ? v : DEFAULT_LOCALE);
