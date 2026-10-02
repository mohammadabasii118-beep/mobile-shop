"use client";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/provider";

export function Dialog({ open, onClose, title, description, children, className }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; className?: string;
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t(title)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("animate-step-in relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border bg-card p-6 shadow-xl sm:max-w-lg sm:rounded-2xl", className)}>
        <button onClick={onClose} aria-label={t("Close")} className="absolute top-4 end-4 rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        <h2 className="pe-8 text-lg font-semibold">{t(title)}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{t(description)}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
