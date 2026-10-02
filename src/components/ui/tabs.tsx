"use client";
import { cn } from "@/lib/cn";

export interface TabItem<T extends string> { value: T; label: string; count?: number }

export function Tabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1", className)}>
      {items.map((t) => (
        <button
          key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition", value === t.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-[11px]">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
