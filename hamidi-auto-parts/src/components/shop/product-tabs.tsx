"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductTabs({ tabs }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white">
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-neutral-200 px-3 pt-3 sm:px-5">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActive(t.id)} className={cn("relative shrink-0 cursor-pointer px-4 pt-2 pb-3.5 text-sm font-semibold transition", active === t.id ? "text-neutral-950" : "text-neutral-500 hover:text-neutral-800")}>
            {t.label}
            <span className={cn("absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-primary transition-transform", active === t.id ? "scale-x-100" : "scale-x-0")} />
          </button>
        ))}
      </div>
      <div className="p-5 sm:p-7">
        {tabs.map((t) => (
          <div key={t.id} hidden={active !== t.id} className="animate-in fade-in">{t.content}</div>
        ))}
      </div>
    </div>
  );
}
