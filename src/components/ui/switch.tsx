"use client";
import { cn } from "@/lib/cn";

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50", checked ? "bg-primary" : "bg-border")}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition", checked && "translate-x-5")} />
    </button>
  );
}
