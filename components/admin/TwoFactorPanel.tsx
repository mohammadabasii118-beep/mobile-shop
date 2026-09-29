"use client";
import { useState } from "react";
import { beginTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor, regenerateTwoFactorBackupCodes } from "@/lib/actions/twoFactor";

export default function TwoFactorPanel({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Shown exactly once, right after being generated (initial setup or a
  // manual regeneration) — never fetched or displayed again afterward,
  // since only bcrypt hashes are kept server-side from that point on.
  const [freshBackupCodes, setFreshBackupCodes] = useState<string[] | null>(null);
  const [showRegenerate, setShowRegenerate] = useState(false);

  async function startSetup() {
    setError("");
    setBusy(true);
    try {
      const res = await beginTwoFactorSetup();
      setSetup(res);
    } catch (e: any) {
      setError(e.message || "خطا در شروع راه‌اندازی");
    }
    setBusy(false);
  }

  async function confirm(formData: FormData) {
    setError("");
    setBusy(true);
    try {
      const res = await confirmTwoFactorSetup(formData);
      setEnabled(true);
      setSetup(null);
      setFreshBackupCodes(res.backupCodes);
    } catch (e: any) {
      setError(e.message || "کد اشتباه است");
    }
    setBusy(false);
  }

  async function disable(formData: FormData) {
    setError("");
    setBusy(true);
    try {
      await disableTwoFactor(formData);
      setEnabled(false);
      setFreshBackupCodes(null);
    } catch (e: any) {
      setError(e.message || "خطا در غیرفعال‌سازی");
    }
    setBusy(false);
  }

  async function regenerate(formData: FormData) {
    setError("");
    setBusy(true);
    try {
      const res = await regenerateTwoFactorBackupCodes(formData);
      setFreshBackupCodes(res.backupCodes);
      setShowRegenerate(false);
    } catch (e: any) {
      setError(e.message || "خطا در ساخت کدهای جدید");
    }
    setBusy(false);
  }

  const backupCodesBlock = freshBackupCodes && (
    <div className="surface2 rounded-xl p-4 mb-4">
      <p className="text-sm font-bold mb-2">کدهای پشتیبان یک‌بارمصرف — همین یک‌بار نمایش داده می‌شوند، در جای امنی ذخیره کنید:</p>
      <div className="grid grid-cols-2 gap-2 font-mono text-sm mb-2" dir="ltr">
        {freshBackupCodes.map((c) => (
          <span key={c} className="px-2 py-1 rounded surface border line text-center">{c}</span>
        ))}
      </div>
      <p className="text-xs muted">هر کد فقط یک‌بار قابل استفاده است — اگر دسترسی به اپلیکیشن احراز هویت خود را از دست دادید، می‌توانید هنگام ورود از یکی از این کدها به‌جای کد ۶ رقمی استفاده کنید.</p>
      <button onClick={() => setFreshBackupCodes(null)} className="mt-3 text-xs font-medium underline">متوجه شدم، مخفی کن</button>
    </div>
  );

  if (enabled) {
    return (
      <div className="surface border line rounded-2xl p-5 max-w-lg">
        <p className="text-sm mb-4">✅ ورود دو مرحله‌ای برای این حساب فعال است.</p>
        {backupCodesBlock}
        {!showRegenerate ? (
          <button onClick={() => setShowRegenerate(true)} className="text-xs font-medium underline mb-6 block">ساخت کدهای پشتیبان جدید (کدهای قبلی باطل می‌شوند)</button>
        ) : (
          <form action={regenerate} className="grid gap-3 mb-6">
            <label className="text-sm font-medium">برای ساخت کدهای جدید، رمز عبور خود را وارد کنید</label>
            <input name="password" type="password" required className="h-11 rounded-lg border line bg-transparent px-3 text-sm" />
            <div className="flex gap-2">
              <button disabled={busy} className="px-6 h-10 rounded-full text-white text-sm font-bold w-fit" style={{ background: "var(--ink)" }}>ساخت کدهای جدید</button>
              <button type="button" onClick={() => setShowRegenerate(false)} className="px-6 h-10 rounded-full border line text-sm font-medium w-fit">انصراف</button>
            </div>
          </form>
        )}
        <form action={disable} className="grid gap-3">
          <label className="text-sm font-medium">برای غیرفعال‌سازی، رمز عبور خود را وارد کنید</label>
          <input name="password" type="password" required className="h-11 rounded-lg border line bg-transparent px-3 text-sm" />
          {error && <p className="text-sm" style={{ color: "#a24e56" }}>{error}</p>}
          <button disabled={busy} className="px-6 h-10 rounded-full text-sm font-bold w-fit" style={{ background: "#a24e56", color: "white" }}>غیرفعال‌سازی ۲FA</button>
        </form>
      </div>
    );
  }

  if (setup) {
    return (
      <div className="surface border line rounded-2xl p-5 max-w-lg">
        <p className="text-sm mb-3">این کلید را در اپلیکیشن احراز هویت خود (مثل Google Authenticator) به‌صورت دستی وارد کنید:</p>
        <div className="font-mono text-sm p-3 rounded-lg surface2 mb-3 break-all" dir="ltr">{setup.secret}</div>
        <p className="text-xs muted mb-4">
          این پروژه تصویر QR نمی‌سازد (برای جلوگیری از افزودن یک کتابخانه‌ی جدید که در این محیط قابل نصب/آزمایش نبود) — وارد کردن دستی کلید بالا در هر اپلیکیشن احراز هویت استاندارد کار می‌کند.
        </p>
        <form action={confirm} className="grid gap-3">
          <label className="text-sm font-medium">کد ۶ رقمی نمایش‌داده‌شده در اپلیکیشن را وارد کنید</label>
          <input name="code" required inputMode="numeric" className="h-11 rounded-lg border line bg-transparent px-3 text-sm tracking-widest text-center" />
          {error && <p className="text-sm" style={{ color: "#a24e56" }}>{error}</p>}
          <button disabled={busy} className="px-6 h-10 rounded-full text-white text-sm font-bold w-fit" style={{ background: "var(--ink)" }}>تأیید و فعال‌سازی</button>
        </form>
      </div>
    );
  }

  return (
    <div className="surface border line rounded-2xl p-5 max-w-lg">
      <p className="text-sm mb-4">ورود دو مرحله‌ای برای این حساب غیرفعال است.</p>
      {error && <p className="text-sm mb-3" style={{ color: "#a24e56" }}>{error}</p>}
      <button onClick={startSetup} disabled={busy} className="px-6 h-10 rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>شروع راه‌اندازی</button>
    </div>
  );
}
