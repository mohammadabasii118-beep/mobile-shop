"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { api, type ApiResult } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { fmtDate, fmtId, fmtNum, fmtToman, ORDER_LABEL, PAY_LABEL, type Tone } from "@/lib/admin/format";

export { fmtDate, fmtId, fmtNum, fmtToman, ORDER_LABEL, PAY_LABEL };

/* ───────── styling tokens ───────── */
export const inputCls = "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary disabled:opacity-60";
export const btnCls = "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = cn(btnCls, "bg-primary text-primary-fg hover:bg-primary-hover");
export const btnGhost = cn(btnCls, "border border-border bg-surface hover:bg-surface-2");
export const btnDanger = cn(btnCls, "bg-error/10 text-error hover:bg-error/20");


/* ───────── toast ───────── */
export const toast = (message: string, tone: "ok" | "err" = "ok") => window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message, tone } }));
export function Toaster() {
  const [items, setItems] = useState<{ id: number; message: string; tone: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { message, tone } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setItems((l) => [...l, { id, message, tone }]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 4500);
    };
    window.addEventListener("admin-toast", on);
    return () => window.removeEventListener("admin-toast", on);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {items.map((t) => <div key={t.id} className={cn("pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg", t.tone === "err" ? "bg-error text-white" : "bg-secondary text-secondary-fg")}>{t.message}</div>)}
    </div>
  );
}

/* ───────── data hook: result is keyed by URL so "loading" is derived, never set synchronously ───────── */
export function useApi<T>(url: string | null) {
  const [res, setRes] = useState<{ url: string; r: ApiResult<T> } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let live = true;
    api<T>("GET", url).then((r) => live && setRes({ url, r }));
    return () => { live = false; };
  }, [url, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const cur = res && res.url === url ? res.r : null;
  return { data: cur && cur.ok ? cur.data : null, error: cur && !cur.ok ? cur.error.message : null, loading: !cur, reload };
}

/** Runs a mutation, shows a toast, returns ok. */
export async function act<T = unknown>(method: string, url: string, body?: unknown, okMsg = "ذخیره شد."): Promise<{ ok: boolean; data?: T; fields?: Record<string, string>; message?: string }> {
  const r = await api<T>(method, url, body);
  if (r.ok) { if (okMsg) toast(okMsg); return { ok: true, data: r.data }; }
  toast(r.error.message, "err");
  return { ok: false, fields: r.error.fields, message: r.error.message };
}

/* ───────── layout bits ───────── */
export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-black sm:text-2xl">{title}</h1>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("rounded-xl border border-border bg-surface p-4 shadow-sm", className)} {...p} />;
export const Spinner = () => <div className="grid place-items-center py-16 text-muted"><Loader2 className="size-6 animate-spin" /></div>;
export const ErrorBox = ({ message }: { message: string }) => <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">{message}</div>;
export const Empty = ({ text = "موردی پیدا نشد." }: { text?: string }) => <div className="py-14 text-center text-sm text-muted">{text}</div>;

const TONES: Record<string, string> = {
  ok: "bg-success/15 text-success", warn: "bg-warning/15 text-warning", bad: "bg-error/15 text-error", info: "bg-primary/15 text-primary", mute: "bg-surface-2 text-muted",
};
export const Pill = ({ tone = "mute", children }: { tone?: keyof typeof TONES; children: ReactNode }) => <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold", TONES[tone])}>{children}</span>;

export const StatusPill = ({ map, value }: { map: Record<string, [string, Tone]>; value: string }) => <Pill tone={map[value]?.[1] ?? "mute"}>{map[value]?.[0] ?? value}</Pill>;

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-border bg-surface-2 text-xs text-muted">{head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2.5 text-start font-bold">{h || <span className="sr-only">عملیات</span>}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-3 py-2.5 align-middle", className)} {...p} />;

export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-muted">
      <span>{fmtNum(total)} مورد</span>
      <div className="flex items-center gap-2">
        <button className={cn(btnGhost, "h-8 px-3")} disabled={page <= 1} onClick={() => onPage(page - 1)}>قبلی</button>
        <span>{fmtNum(page)} از {fmtNum(pages)}</span>
        <button className={cn(btnGhost, "h-8 px-3")} disabled={page >= pages} onClick={() => onPage(page + 1)}>بعدی</button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cn("max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-lg sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-xl")}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button onClick={onClose} className="cursor-pointer rounded-md px-2 py-1 text-muted hover:bg-surface-2" aria-label="بستن">✕</button></div>
        {children}
      </div>
    </div>
  );
}

export const Label = ({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) => (
  <label className={cn("block space-y-1", className)}>
    <span className="text-xs font-bold text-muted">{label}</span>{children}
    {hint && !error && <span className="block text-[11px] text-muted">{hint}</span>}
    {error && <span className="block text-[11px] font-bold text-error">{error}</span>}
  </label>
);

/** Confirm dialog helper (native confirm keeps the code small and is accessible). */
export const confirmAsk = (msg: string) => typeof window !== "undefined" && window.confirm(msg);

/** Image uploader → POST /api/admin/upload → returns the public /media URL. */
export function ImageInput({ value, onChange, label }: { value: string | null | undefined; onChange: (url: string | null) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    const fd = new FormData(); fd.append("file", f);
    const r = await api<{ url: string }>("POST", "/api/admin/upload", fd);
    setBusy(false);
    if (r.ok) onChange(r.data.url); else toast(r.error.message, "err");
  };
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2 text-[10px] text-muted">
        {value ? <img src={value} alt={label ?? ""} className="size-full object-cover" /> : "بدون تصویر"}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className={cn(btnGhost, "h-9 cursor-pointer")}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "انتخاب تصویر"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {value && <button type="button" className={cn(btnGhost, "h-9")} onClick={() => onChange(null)}>حذف</button>}
      </div>
    </div>
  );
}
