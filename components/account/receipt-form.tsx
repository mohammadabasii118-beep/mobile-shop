"use client";
import { useState } from "react";
import { Copy, Check, Upload } from "lucide-react";
import { api } from "@/lib/client/api";

export function CopyField({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 text-[13px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-2 font-bold" dir="auto">
        <span dir="ltr" className={copy ? "tracking-wider" : ""}>{value}</span>
        {copy && (
          <button type="button" aria-label="کپی" onClick={async () => { try { await navigator.clipboard.writeText(value.replace(/[\s-]/g, "")); setDone(true); setTimeout(() => setDone(false), 1500); } catch {} }} className="grid size-7 cursor-pointer place-items-center rounded-full bg-primary/10 text-primary hover:bg-primary/20">
            {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        )}
      </span>
    </div>
  );
}

export function ReceiptForm({ orderNumber, resubmit }: { orderNumber: number; resubmit: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [ref, setRef] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!file) return setErr("فایل رسید را انتخاب کنید.");
    if (file.size > 5 * 1024 * 1024) return setErr("حجم فایل نباید بیشتر از ۵ مگابایت باشد.");
    const f = new FormData();
    f.set("receipt", file);
    f.set("referenceNumber", ref);
    setBusy(true);
    const r = await api("POST", `/api/orders/${orderNumber}/payment/proof`, f);
    if (r.ok) window.location.reload(); else { setBusy(false); setErr(r.error.message); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-2 text-xs font-bold">
        <span>شماره پیگیری / مرجع تراکنش<b className="text-hot"> *</b></span>
        <input value={ref} onChange={(e) => setRef(e.target.value)} dir="ltr" required placeholder="مثلاً 123456789" className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-primary" />
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-xs">
        <Upload className="size-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">{file ? file.name : "بارگذاری تصویر رسید (JPG، PNG، WebP یا PDF — حداکثر ۵ مگابایت)"}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <p role="alert" className="min-h-4 text-xs text-hot">{err}</p>
      <button type="submit" disabled={busy} className="h-12 w-full cursor-pointer rounded-xl bg-primary text-sm font-bold text-primary-fg shadow-md hover:bg-primary-hover disabled:opacity-60">{busy ? "در حال ارسال…" : resubmit ? "ارسال مجدد رسید" : "ثبت رسید پرداخت"}</button>
    </form>
  );
}
