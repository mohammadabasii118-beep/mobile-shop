"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Lock, UserRound } from "lucide-react";
import { api } from "@/lib/client/api";

const field = "h-12 w-full rounded-[10px] border border-border bg-surface px-4 text-sm outline-none focus:border-primary";

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

export function EditAccountForm({ init, hasPassword, phone, mustChange }: { init: { firstName: string; lastName: string; displayName: string; email: string }; hasPassword: boolean; phone?: string | null; mustChange?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(init);
  const [oldPw, setOldPw] = useState(""); const [newPw, setNewPw] = useState(""); const [newPw2, setNewPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false); const [pwBusy, setPwBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  /** Personal information: saved on its own (the password has its own form below, so a typo in one never blocks the other). */
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setBusy(true);
    const p = await api("PATCH", "/api/me", { firstName: v.firstName, lastName: v.lastName, displayName: v.displayName || undefined, email: v.email });
    setBusy(false);
    if (!p.ok) return setMsg({ ok: false, text: p.error.message });
    setMsg({ ok: true, text: "اطلاعات شما ذخیره شد." }); router.refresh();
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault(); setPwMsg(null);
    if (!newPw) return setPwMsg({ ok: false, text: "رمز عبور جدید را وارد کنید." });
    if (newPw !== newPw2) return setPwMsg({ ok: false, text: "تکرار رمز عبور جدید یکسان نیست." });
    setPwBusy(true);
    const r = await api("POST", "/api/account/password", { oldPassword: oldPw || undefined, newPassword: newPw });
    setPwBusy(false);
    if (!r.ok) return setPwMsg({ ok: false, text: r.error.message });
    setOldPw(""); setNewPw(""); setNewPw2(""); setPwMsg({ ok: true, text: "رمز عبور شما تغییر کرد." }); router.refresh();
  }

  const F = ({ label, k, type = "text", dir, required = true }: { label: string; k: keyof typeof v; type?: string; dir?: "ltr"; required?: boolean }) => (
    <label className="block space-y-2 text-xs font-bold"><span>{label}{required && <b className="text-hot"> *</b>}</span><input type={type} dir={dir} value={v[k]} onChange={set(k)} className={field} /></label>
  );

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4 rounded-[16px] border border-border p-4" data-testid="info-form">
        <h2 className="flex items-center gap-2 text-[14px] font-extrabold"><UserRound className="size-4 text-primary" />اطلاعات شخصی</h2>
        <div className="grid gap-4 sm:grid-cols-2">{F({ label: "نام", k: "firstName" })}{F({ label: "نام خانوادگی", k: "lastName" })}</div>
        <div>{F({ label: "نام نمایشی", k: "displayName", required: false })}<p className="mt-2 text-[11px] text-muted">به این صورت اسم شما در حساب کاربری و نظرات دیده خواهد شد</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {F({ label: "آدرس ایمیل", k: "email", type: "email", dir: "ltr" })}
          <label className="block space-y-2 text-xs font-bold"><span>شماره موبایل</span><input dir="ltr" readOnly value={phone ?? ""} placeholder="ثبت نشده" className={`${field} bg-surface-2 text-muted`} aria-label="شماره موبایل" />
            <span className="block text-[11px] font-normal text-muted">{phone ? "شمارهٔ ورود شما؛ برای تغییر با پشتیبانی تماس بگیرید." : "شمارهٔ تماس گیرنده را هنگام افزودن آدرس وارد می‌کنید."}</span></label>
        </div>
        <p role="status" className={`min-h-4 text-xs ${msg?.ok ? "text-success" : "text-hot"}`} data-testid="info-msg">{msg?.text}</p>
        <div className="flex justify-end"><button type="submit" disabled={busy} className="h-11 cursor-pointer rounded-[10px] bg-primary px-6 text-sm font-bold text-primary-fg shadow-md hover:bg-primary-hover disabled:opacity-60">{busy ? "…" : "ذخیره اطلاعات"}</button></div>
      </form>

      <form onSubmit={changePw} className={`space-y-4 rounded-[16px] p-4 ${mustChange ? "border-2 border-warning bg-warning/8" : "bg-surface-2"}`} id="password" data-testid="password-form">
        <h2 className="flex items-center gap-2 text-[14px] font-extrabold"><Lock className="size-4 text-primary" />{hasPassword ? "تغییر رمز عبور" : "تعیین رمز عبور"}</h2>
        {mustChange && <p className="text-xs leading-6">رمز فعلی شما موقت است؛ لطفاً رمز جدید انتخاب کنید.</p>}
        {hasPassword && <Pw label={mustChange ? "رمز موقت (فعلی)" : "رمز عبور فعلی"} value={oldPw} onChange={setOldPw} autoComplete="current-password" />}
        <Pw label="رمز عبور جدید (حداقل ۸ کاراکتر، شامل حرف و عدد)" value={newPw} onChange={setNewPw} autoComplete="new-password" />
        <Pw label="تکرار رمز عبور جدید" value={newPw2} onChange={setNewPw2} autoComplete="new-password" />
        <p role="status" className={`min-h-4 text-xs ${pwMsg?.ok ? "text-success" : "text-hot"}`} data-testid="pw-msg">{pwMsg?.text}</p>
        <div className="flex justify-end"><button type="submit" disabled={pwBusy} className="h-11 cursor-pointer rounded-[10px] bg-primary px-6 text-sm font-bold text-primary-fg shadow-md hover:bg-primary-hover disabled:opacity-60">{pwBusy ? "…" : "تغییر رمز عبور"}</button></div>
      </form>
    </div>
  );
}
