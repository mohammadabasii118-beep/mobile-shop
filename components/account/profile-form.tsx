"use client";
import { useState } from "react";
import { api, safeNext } from "@/lib/client/api";

const field = "h-12 w-full rounded-[10px] border border-border bg-surface px-4 text-sm text-foreground outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_20%,transparent)]";

export function ProfileForm({ next, firstName, lastName }: { next: string; firstName: string; lastName: string }) {
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const dest = safeNext(next);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const r = await api("PATCH", "/api/me", { firstName: first, lastName: last });
    if (r.ok) window.location.href = dest; else { setBusy(false); setErr(r.error.message); }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[340px] space-y-4">
      <div className="text-center">
        <h1 className="text-lg font-extrabold text-secondary">تکمیل اطلاعات پروفایل</h1>
        <p className="mt-2 text-[11.5px] leading-6 text-muted">برای تجربه بهتر از سایت، لطفاً نام و نام خانوادگی خود را وارد کنید.</p>
      </div>
      <label className="block space-y-2 text-xs font-bold"><span>نام<b className="text-hot"> *</b></span><input value={first} onChange={(e) => setFirst(e.target.value)} required autoComplete="given-name" className={field} /></label>
      <label className="block space-y-2 text-xs font-bold"><span>نام خانوادگی<b className="text-hot"> *</b></span><input value={last} onChange={(e) => setLast(e.target.value)} required autoComplete="family-name" className={field} /></label>
      <p role="alert" className="min-h-4 text-xs text-hot">{err}</p>
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={busy} className="h-12 flex-1 cursor-pointer rounded-[10px] bg-primary text-sm font-bold text-primary-fg shadow-md hover:bg-primary-hover disabled:opacity-60">ذخیره</button>
        <button type="button" onClick={() => window.location.href = dest} className="h-12 flex-1 cursor-pointer rounded-[10px] border border-border bg-surface-2 text-sm text-muted hover:text-foreground">بعداً</button>
      </div>
    </form>
  );
}
