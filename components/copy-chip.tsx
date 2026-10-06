"use client";
import { useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyChip({ label, value, className }: { label: string; value: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
  };
  return (
    <div className={cn("inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-primary/25 bg-primary/8 p-1.5 pe-4 text-sm font-medium text-primary", className)}>
      <Send className="ms-2 size-4" />
      <span className="whitespace-nowrap">{label}</span>
      <b dir="ltr">{value}</b>
      <button data-copy={value} onClick={copy} aria-label="کپی آیدی" className="grid size-8 cursor-pointer place-items-center rounded-full bg-surface shadow-sm">
        {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
