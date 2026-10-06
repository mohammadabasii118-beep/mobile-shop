"use client";
import { useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { Label, Modal, act, btnGhost, btnPrimary, inputCls } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

export interface RoleOpt { key: string; name: string; isStaff: boolean; permissions: string[] }
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
const genPw = () => { const a = new Uint32Array(14); crypto.getRandomValues(a); return [...a].map((n) => ALPHA[n % ALPHA.length]).join("") + "a1"; };
const score = (p: string) => (p.length >= 10 ? 1 : 0) + (/[A-Z]/.test(p) && /[a-z]/.test(p) ? 1 : 0) + (/\d/.test(p) ? 1 : 0) + (/[^A-Za-z0-9]/.test(p) ? 1 : 0);
const ROLE_HINT: Record<string, string> = { super_admin: "همهٔ دسترسی‌ها", admin: "همه‌چیز جز مدیریت نقش‌ها", product_manager: "محصولات، دسته‌ها، برندها و موجودی", order_manager: "سفارش‌ها، پرداخت‌ها و ارسال", content_manager: "بلاگ، بنر، صفحه اصلی و سئو", support: "چت آنلاین و تیکت‌ها", wholesale_manager: "درخواست‌های همکاری عمده" };

/** One form for both cases: a plain customer, or an admin (role picker + the creator's password as confirmation). The server re-checks everything. */
export function AddUserModal({ kind, roles, onClose, onDone }: { kind: "customer" | "admin"; roles: RoleOpt[]; onClose: () => void; onDone: () => void }) {
  const admin = kind === "admin";
  const staffRoles = roles.filter((r) => r.isStaff);
  const [v, setV] = useState({ fullName: "", email: "", phone: "", password: genPw(), mustChange: true, isActive: true, roleKey: staffRoles.find((r) => r.key === "support")?.key ?? staffRoles[0]?.key ?? "", currentPassword: "" });
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((o) => ({ ...o, [k]: val }));
  const role = staffRoles.find((r) => r.key === v.roleKey);
  const s = score(v.password);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErrs({});
    const r = await act("POST", "/api/admin/customers", { kind, ...v, roleKey: admin ? v.roleKey : undefined, currentPassword: admin ? v.currentPassword : undefined }, admin ? "مدیر جدید ساخته شد." : "کاربر ساخته شد.");
    setBusy(false);
    if (!r.ok) return setErrs(r.fields ?? {});
    onDone(); onClose();
  };
  const copy = () => { try { void navigator.clipboard.writeText(v.password).then(() => {}, () => {}); } catch { /* copy by hand */ } };
  return (
    <Modal title={admin ? "افزودن مدیر جدید" : "افزودن کاربر دستی"} onClose={onClose}>
      <p className="mb-3 text-xs leading-6 text-muted">{admin ? "فقط «مدیر ارشد» می‌تواند مدیر بسازد. هر مدیر فقط به بخش‌های نقش خودش دسترسی دارد و رمز موقت را باید در اولین ورود عوض کند." : "برای مشتری‌ای که خودش ثبت‌نام نکرده (مثلاً سفارش تلفنی یا حضوری). ایمیل یا موبایل، دست‌کم یکی لازم است."}</p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" data-testid={admin ? "add-admin-form" : "add-user-form"}>
        <Label label="نام و نام خانوادگی *" error={errs.fullName}><input className={inputCls} value={v.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="off" /></Label>
        <Label label={admin ? "ایمیل *" : "ایمیل"} error={errs.email}><input dir="ltr" className={inputCls} value={v.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" /></Label>
        <Label label={admin ? "موبایل (اختیاری)" : "موبایل"} error={errs.phone}><input dir="ltr" inputMode="numeric" placeholder="09…" className={inputCls} value={v.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="off" /></Label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} />حساب فعال باشد</label>
        {admin && (
          <fieldset className="sm:col-span-2"><legend className="mb-1 text-xs font-bold">نقش (سطح دسترسی) *</legend>
            <div className="grid gap-1.5" role="radiogroup" aria-label="نقش">
              {staffRoles.map((r) => (
                <label key={r.key} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors", v.roleKey === r.key ? "border-primary bg-primary/8" : "border-border hover:bg-surface-2")}>
                  <input type="radio" name="role" className="accent-[var(--primary)]" checked={v.roleKey === r.key} onChange={() => set("roleKey", r.key)} data-testid={`role-${r.key}`} />
                  <span><b>{r.name}</b><span className="block text-[11px] text-muted">{ROLE_HINT[r.key] ?? ""}</span></span>
                </label>
              ))}
            </div>
            {errs.roleKey && <p className="mt-1 text-xs font-bold text-error">{errs.roleKey}</p>}
            {role && <div className="mt-2 flex flex-wrap gap-1" data-testid="role-perms">{role.permissions.slice(0, 14).map((p) => <span key={p} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px]">{p}</span>)}{role.permissions.length > 14 && <span className="text-[11px] text-muted">و {role.permissions.length - 14} مورد دیگر</span>}</div>}
          </fieldset>
        )}
        <div className="sm:col-span-2"><Label label="رمز عبور موقت *" error={errs.password}>
          <div className="flex gap-2"><input dir="ltr" className={cn(inputCls, "font-mono")} value={v.password} onChange={(e) => set("password", e.target.value)} autoComplete="off" data-testid="pw" />
            <button type="button" className={cn(btnGhost, "px-3")} onClick={() => set("password", genPw())}><KeyRound className="size-4" />تولید</button>
            <button type="button" className={cn(btnGhost, "px-3")} onClick={copy} aria-label="کپی رمز"><Copy className="size-4" /></button></div></Label>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border"><i className="block h-full rounded-full transition-all duration-300" style={{ width: `${s * 25}%`, background: s < 2 ? "var(--error, #d4453b)" : s < 4 ? "var(--warning, #c98a12)" : "var(--success, #1f9d63)" }} /></div>
          <p className="mt-1 text-[11px] text-muted">رمز را فقط یک‌بار می‌بینید؛ آن را امن برای کاربر بفرستید. در دیتابیس فقط به‌صورت هش ذخیره می‌شود.</p></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={v.mustChange} onChange={(e) => set("mustChange", e.target.checked)} />در اولین ورود رمز را عوض کند (پیشنهادی{admin ? "؛ برای مدیر تا عوض‌کردن رمز پنل بسته است" : ""})</label>
        {admin && <div className="sm:col-span-2"><div className="mb-2 rounded-lg bg-warning/12 p-2.5 text-xs leading-6">برای امنیت، رمز خودتان را برای تأیید وارد کنید. ساخت مدیر در لاگ عملیات ثبت می‌شود.</div>
          <Label label="رمز شما (تأیید) *" error={errs.currentPassword}><input dir="ltr" type="password" autoComplete="current-password" className={inputCls} value={v.currentPassword} onChange={(e) => set("currentPassword", e.target.value)} data-testid="confirm-pw" /></Label></div>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={btnGhost} onClick={onClose}>انصراف</button><button className={btnPrimary} disabled={busy} data-testid="create-submit">{busy ? "در حال ساخت…" : admin ? "ساخت مدیر" : "ساخت کاربر"}</button></div>
      </form>
    </Modal>
  );
}
