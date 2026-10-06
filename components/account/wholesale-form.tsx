"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Paperclip } from "lucide-react";
import { api } from "@/lib/client/api";

const field = "w-full rounded-[10px] border border-border bg-surface px-4 text-sm outline-none focus:border-primary";
const TYPES: [string, string][] = [["instagram_shop", "پیج اینستاگرام"], ["online_shop", "فروشگاه آنلاین"], ["physical_store", "فروشگاه فیزیکی"], ["other", "سایر"]];
interface Doc { id: string; originalName: string }
interface Initial { name: string; phone: string; province: string; storeName: string; businessType: string; instagram: string; website: string; city: string; address: string; description: string }

export function WholesaleForm({ initial, applicationId, docs, editing }: { initial: Initial; applicationId: string | null; docs: Doc[]; editing: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const set = (k: keyof Initial, val: string) => setV((o) => ({ ...o, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const { name, ...rest } = v;
    const r = await api<{ id: string }>("POST", "/api/wholesale/apply", { ...rest, fullName: name, phone: v.phone || undefined, province: v.province || undefined, address: v.address || undefined, instagram: v.instagram || undefined, website: v.website || undefined, description: v.description || undefined });
    if (!r.ok) { setBusy(false); return setErr(r.error.message); }
    for (const f of pending) {
      const fd = new FormData(); fd.set("applicationId", r.data.id); fd.set("file", f);
      const up = await api("POST", "/api/wholesale/documents", fd);
      if (!up.ok) { setBusy(false); setErr(`ارسال «${f.name}» انجام نشد: ${up.error.message}`); router.refresh(); return; }
    }
    setBusy(false); setPending([]); router.refresh();
  }
  async function removeDoc(id: string) { await api("DELETE", `/api/wholesale/documents/${id}`); router.refresh(); }
  const F = (k: keyof Initial, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block space-y-1.5 text-xs font-medium"><span>{label}</span><input value={v[k]} onChange={(e) => set(k, e.target.value)} className={`${field} h-11`} {...extra} /></label>
  );
  return (
    <form onSubmit={submit} className="space-y-4 rounded-[16px] border border-border bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {F("name", "نام و نام خانوادگی", { required: true })}{F("storeName", "نام فروشگاه / برند", { required: true })}
        <label className="block space-y-1.5 text-xs font-medium"><span>نوع کسب‌وکار</span><select value={v.businessType} onChange={(e) => set("businessType", e.target.value)} className={`${field} h-11`}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        {F("phone", "شماره موبایل (برای تماس)", { dir: "ltr", inputMode: "numeric", required: !initial.phone })}{F("province", "استان", { required: true })}{F("city", "شهر", { required: true })}{F("instagram", "اینستاگرام (اختیاری)", { dir: "ltr" })}{F("website", "وب‌سایت (اختیاری)", { dir: "ltr" })}
      </div>
      <label className="block space-y-1.5 text-xs font-medium"><span>آدرس فروشگاه (برای فروشگاه فیزیکی)</span><input required={v.businessType === "physical_store"} value={v.address} onChange={(e) => set("address", e.target.value)} className={`${field} h-11`} /></label>
      <label className="block space-y-1.5 text-xs font-medium"><span>توضیحات (حجم فروش، نوع محصولات…)</span><textarea rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} className={`${field} py-3 leading-7`} /></label>
      <div className="space-y-2 text-xs">
        <div className="font-bold">مدارک (جواز کسب، کارت ملی، تصویر مغازه یا پیج) — خصوصی و فقط برای بررسی‌کنندگان</div>
        {docs.length > 0 && <ul className="space-y-1">{docs.map((d) => <li key={d.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-1.5"><a href={`/api/wholesale/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="truncate text-primary">{d.originalName}</a><button type="button" onClick={() => removeDoc(d.id)} className="cursor-pointer text-hot">حذف</button></li>)}</ul>}
        {pending.length > 0 && <ul className="space-y-1">{pending.map((f, i) => <li key={i} className="flex items-center justify-between rounded-lg bg-surface px-3 py-1.5"><span className="truncate">{f.name} (ارسال با فرم)</span><button type="button" onClick={() => setPending(pending.filter((_, j) => j !== i))} className="cursor-pointer text-hot">حذف</button></li>)}</ul>}
        {docs.length + pending.length < 5 && <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-surface px-3 py-2 font-bold text-primary"><Paperclip className="size-4" />افزودن مدرک (تصویر یا PDF، تا ۵ فایل)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPending([...pending, f]); e.target.value = ""; }} /></label>}
      </div>
      <p role="alert" className="min-h-4 text-xs text-hot">{err}</p>
      <button disabled={busy} className="h-12 w-full cursor-pointer rounded-[10px] bg-primary text-sm font-bold text-primary-fg hover:bg-primary-hover disabled:opacity-60">{busy ? "در حال ارسال…" : editing ? "ارسال مجدد اطلاعات اصلاح‌شده" : "ثبت درخواست همکاری"}</button>
      {applicationId === null && null}
    </form>
  );
}
