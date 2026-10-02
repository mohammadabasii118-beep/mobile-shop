"use client";
import { useMemo } from "react";
import { useI18n } from "@/i18n/provider";

/** Locale-aware numbers, money and relative times (Persian digits + Persian wording in fa). */
export function useFmt() {
  const { locale, t } = useI18n();
  return useMemo(() => {
    const tag = locale === "fa" ? "fa-IR" : "en-US";
    const nfo = new Intl.NumberFormat(tag);
    const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
    return {
      locale,
      nf: nfo,
      toman: (n: number) => `${nfo.format(n)} ${t("Toman")}`,
      timeAgo(iso: string) {
        const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
        const a = Math.abs(s);
        if (a < 45) return t("just now");
        if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
        if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
        return rtf.format(Math.round(s / 86400), "day");
      },
      time: (iso: string) => new Date(iso).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" }),
      dateTime: (iso: string) => new Date(iso).toLocaleString(tag, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    };
  }, [locale, t]);
}
