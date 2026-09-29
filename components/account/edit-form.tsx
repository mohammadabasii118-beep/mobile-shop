"use client";
import { useState } from "react";
import { Eye, Lock } from "lucide-react";
import { api } from "@/lib/client/api";

const field = "h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-primary";

function Pw({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block space-y-2 text-xs font-bold">
      <span>{label}</span>
      <span className="relative block">
        <input type={show ? "text" : "password"} dir="ltr" autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className={`${field} ps-11`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label="نمایش رمز" className="absolute start-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted hover:text-primary"><Eye className="size-4" /></button>
      </span>
    </label>
  );
}

export function EditAccountForm({ init, hasPassword }: { init: { firstName: string; lastName: string; displayName: string; email: string }; hasPassword: boolean }) {
  const [v, setV] = useState(init);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPw && newPw !== newPw2) return setMsg({ ok: false, text: "تکرار رمز عبور جدید یکسان نیست." });
    setBusy(true);
    const p = await api("PATCH", "/api/me", { firstName: v.firstName, lastName: v.lastName, displayName: v.displayName || undefined, email: v.email });
    if (!p.ok) { setBusy(false); return setMsg({ ok: false, text: p.error.message }); }
    if (newPw) {
      const r = await api("POST", "/api/account/password", { oldPassword: oldPw || undefined, newPassword: newPw });
      if (!r.ok) { setBusy(false); return setMsg({ ok: false, text: r.error.message }); }
      setOldPw(""); setNewPw(""); setNewPw2("");
    }
    setBusy(false);
    setMsg({ ok: true, text: "تغییرات با موفقیت ذخیره شد." });
  }

  const F = ({ label, k, type = "text", dir }: { label: string; k: keyof typeof v; type?: string; dir?: "ltr" }) => (
    <label className="block space-y-2 text-xs font-bold"><span>{label}<b className="text-hot"> *</b></span><input type={type} dir={dir} value={v[k]} onChange={set(k)} className={field} /></label>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">{F({ label: "نام", k: "firstName" })}{F({ label: "نام خانوادگی", k: "lastName" })}</div>
      <div>{F({ label: "نام نمایشی", k: "displayName" })}<p className="mt-2 text-[11px] text-muted">به این صورت اسم شما در حساب کاربری و نظرات دیده خواهد شد</p></div>
      {F({ label: "آدرس ایمیل", k: "email", type: "email", dir: "ltr" })}
      <fieldset className="space-y-4 rounded-2xl bg-surface-2 p-4">
        <legend className="flex items-center gap-2 px-1 text-[13px] font-black"><Lock className="size-4 text-primary" />{hasPassword ? "تغییر گذرواژه" : "تعیین گذرواژه"}</legend>
        {hasPassword && <Pw label="رمز عبور پیشین (در صورتی که قصد تغییر ندارید خالی بگذارید)" value={oldPw} onChange={setOldPw} autoComplete="current-password" />}
        <Pw label="رمز عبور جدید (در صورتی که قصد تغییر ندارید خالی بگذارید)" value={newPw} onChange={setNewPw} autoComplete="new-password" />
        <Pw label="تایید رمز عبور جدید" value={newPw2} onChange={setNewPw2} autoComplete="new-password" />
      </fieldset>
      <p role="alert" className={`min-h-4 text-xs ${msg?.ok ? "text-success" : "text-hot"}`}>{msg?.text}</p>
      <div className="flex justify-end"><button type="submit" disabled={busy} className="h-12 cursor-pointer rounded-xl bg-primary px-6 text-sm font-bold text-primary-fg shadow-md hover:bg-primary-hover disabled:opacity-60">ذخیره تغییرات</button></div>
    </form>
  );
}
