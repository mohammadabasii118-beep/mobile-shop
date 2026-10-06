"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";

export interface AddressRow { id: string; title: string | null; receiver: string; phone: string; province: string; city: string; postalCode: string | null; address: string; isDefault: boolean }
const field = "h-11 w-full rounded-[10px] border border-border bg-surface px-4 text-sm outline-none focus:border-primary";
const blank = { title: "", receiver: "", phone: "", province: "", city: "", postalCode: "", address: "", isDefault: false };

/** Saved delivery addresses (the same addresses checkout uses): add, edit, make default, delete. All rules are enforced by the API. */
export function AddressesManager({ initial, defaults }: { initial: AddressRow[]; defaults: { receiver: string; phone: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [v, setV] = useState({ ...blank }); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const open = (a?: AddressRow) => { setErr(""); setEditing(a ? a.id : "new"); setV(a ? { title: a.title ?? "", receiver: a.receiver, phone: a.phone, province: a.province, city: a.city, postalCode: a.postalCode ?? "", address: a.address, isDefault: a.isDefault } : { ...blank, ...defaults }); };
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const body = { ...v, title: v.title || undefined, postalCode: v.postalCode || undefined };
    const r = editing === "new" ? await api("POST", "/api/addresses", body) : await api("PATCH", `/api/addresses/${editing}`, body);
    setBusy(false);
    if (!r.ok) return setErr(r.error.fields ? Object.values(r.error.fields)[0]! : r.error.message);
    setEditing(null); router.refresh();
  }
  async function del(id: string) { const r = await api("DELETE", `/api/addresses/${id}`); if (!r.ok) return setErr(r.error.message); router.refresh(); }
  async function makeDefault(a: AddressRow) { const r = await api("PATCH", `/api/addresses/${a.id}`, { title: a.title ?? undefined, receiver: a.receiver, phone: a.phone, province: a.province, city: a.city, postalCode: a.postalCode ?? undefined, address: a.address, isDefault: true }); if (!r.ok) return setErr(r.error.message); router.refresh(); }
  const L = (label: string, k: keyof typeof v, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => <label className="block space-y-1.5 text-xs font-bold"><span>{label}</span><input value={v[k] as string} onChange={set(k)} className={field} {...extra} /></label>;
  return (
    <section className="space-y-3 rounded-[16px] border border-border p-4" data-testid="addresses">
      <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-[14px] font-extrabold"><MapPin className="size-4 text-primary" />آدرس‌ها</h2>
        {editing === null && <button type="button" onClick={() => open()} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] bg-surface-2 px-3 text-xs font-bold text-primary" data-testid="add-address"><Plus className="size-4" />افزودن آدرس</button>}</div>
      {initial.length === 0 && editing === null && <p className="rounded-[10px] border border-dashed border-primary/30 px-4 py-6 text-center text-xs text-muted">هنوز آدرسی ثبت نکرده‌اید. آدرس، در خرید بعدی هم خودکار پر می‌شود.</p>}
      <ul className="space-y-2">{initial.map((a) => (
        <li key={a.id} className="rounded-[10px] bg-surface-2 p-3 text-[13px] leading-7" data-testid="address-row">
          <div className="flex flex-wrap items-center justify-between gap-2"><b>{a.title || a.receiver}{a.isDefault && <span className="ms-2 rounded-md bg-primary/12 px-2 py-0.5 text-[10px] font-bold text-primary">پیش‌فرض</span>}</b>
            <span className="flex gap-1">{!a.isDefault && <button type="button" onClick={() => makeDefault(a)} aria-label="پیش‌فرض" title="انتخاب به‌عنوان پیش‌فرض" className="grid size-8 cursor-pointer place-items-center rounded-lg hover:bg-surface"><Star className="size-4" /></button>}
              <button type="button" onClick={() => open(a)} aria-label="ویرایش آدرس" className="grid size-8 cursor-pointer place-items-center rounded-lg hover:bg-surface"><Pencil className="size-4" /></button>
              <button type="button" onClick={() => del(a.id)} aria-label="حذف آدرس" className="grid size-8 cursor-pointer place-items-center rounded-lg text-hot hover:bg-hot/10"><Trash2 className="size-4" /></button></span></div>
          <p className="text-muted">{a.province}، {a.city} — {a.address}{a.postalCode ? ` — کد پستی ${a.postalCode}` : ""}</p><p className="text-[11px] text-muted">{a.receiver} · <span dir="ltr">{a.phone}</span></p>
        </li>))}</ul>
      {editing !== null && (
        <form onSubmit={save} className="space-y-3 rounded-[10px] bg-surface-2 p-3" data-testid="address-form">
          <div className="grid gap-3 sm:grid-cols-2">{L("عنوان (مثلاً خانه)", "title")}{L("نام گیرنده", "receiver", { required: true })}{L("موبایل گیرنده", "phone", { dir: "ltr", inputMode: "numeric", required: true, placeholder: "09…" })}{L("کد پستی (۱۰ رقم)", "postalCode", { dir: "ltr", inputMode: "numeric" })}{L("استان", "province", { required: true })}{L("شهر", "city", { required: true })}</div>
          <label className="block space-y-1.5 text-xs font-bold"><span>آدرس کامل</span><textarea rows={2} value={v.address} onChange={set("address")} required className={`${field} h-auto py-3`} /></label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[var(--primary)]" checked={v.isDefault} onChange={(e) => setV({ ...v, isDefault: e.target.checked })} />آدرس پیش‌فرض باشد</label>
          {err && <p role="alert" className="text-xs font-bold text-hot">{err}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="h-10 cursor-pointer rounded-[10px] px-4 text-sm text-muted">انصراف</button><button disabled={busy} className="h-10 cursor-pointer rounded-[10px] bg-primary px-5 text-sm font-bold text-primary-fg disabled:opacity-60" data-testid="address-save">{busy ? "…" : "ذخیره آدرس"}</button></div>
        </form>
      )}
      {editing === null && err && <p role="alert" className="text-xs font-bold text-hot">{err}</p>}
    </section>
  );
}
