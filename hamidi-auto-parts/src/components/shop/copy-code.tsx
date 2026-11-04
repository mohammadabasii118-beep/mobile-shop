"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyCode({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); } catch { /* clipboard not available */ }
        setOk(true);
        toast(`${label} کپی شد`, { description: value });
        setTimeout(() => setOk(false), 1500);
      }}
      className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-right transition hover:border-neutral-950"
    >
      <span>
        <span className="block text-[11px] text-neutral-500">{label}</span>
        <span className="ltr-nums block font-mono text-sm font-bold whitespace-nowrap">{value}</span>
      </span>
      {ok ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4 text-neutral-400 group-hover:text-neutral-950" />}
    </button>
  );
}
