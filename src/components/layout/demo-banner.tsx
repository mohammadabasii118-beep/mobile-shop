"use client";
import { useSettings } from "@/hooks/api";
import { useT } from "@/i18n/provider";

export function DemoBanner() {
  const { data } = useSettings();
  const t = useT();
  if (data && !data.demoMode) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-primary px-4 py-1.5 text-center text-xs font-medium text-primary-foreground">
      <span>🟣 {t("DEMO MODE")}</span><span className="opacity-80">· {t("Demo data is being used. No real Telegram or Instagram API is connected.")}</span>
    </div>
  );
}
