"use client";
import { useSettings } from "@/hooks/api";

export function DemoBanner() {
  const { data } = useSettings();
  if (data && !data.demoMode) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-primary px-4 py-1.5 text-center text-xs font-medium text-primary-foreground">
      <span>🟣 DEMO MODE</span><span className="opacity-80">· Demo data is being used. No real Telegram or Instagram API is connected.</span>
    </div>
  );
}
