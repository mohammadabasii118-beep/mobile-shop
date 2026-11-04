"use client";

import Link from "next/link";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToasts } from "@/store/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const Icon = t.tone === "error" ? XCircle : t.tone === "info" ? Info : CheckCircle2;
        return (
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,.45)] animate-in fade-in slide-in-from-top-3">
            <Icon className={cn("mt-0.5 size-5 shrink-0", t.tone === "error" ? "text-primary" : t.tone === "info" ? "text-neutral-700" : "text-emerald-600")} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{t.title}</p>
              {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{t.description}</p>}
            </div>
            {t.action &&
              (t.action.href ? (
                <Link href={t.action.href} onClick={() => dismiss(t.id)} className="shrink-0 rounded-lg bg-neutral-950 px-2.5 py-1.5 text-xs font-semibold text-white">{t.action.label}</Link>
              ) : (
                <button type="button" onClick={() => { t.action?.onClick?.(); dismiss(t.id); }} className="shrink-0 cursor-pointer rounded-lg bg-neutral-950 px-2.5 py-1.5 text-xs font-semibold text-white">{t.action.label}</button>
              ))}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="بستن اعلان" className="cursor-pointer text-neutral-500 hover:text-neutral-900"><X className="size-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
