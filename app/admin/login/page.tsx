"use client";
import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", code: "" });
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", { ...form, redirect: false });

    if (res?.error === "2FA_REQUIRED") {
      // Password was correct — this account just has two-factor turned
      // on. Reveal the code field instead of showing a generic error.
      setNeedsCode(true);
      setLoading(false);
      return;
    }
    if (res?.error === "RATE_LIMITED") {
      setError("تلاش‌های ورود ناموفق زیاد بوده است. لطفاً ۱۵ دقیقه دیگر دوباره امتحان کنید.");
      setLoading(false);
      return;
    }
    if (res?.error) {
      setError(needsCode ? "کد دو مرحله‌ای اشتباه است" : "ایمیل یا رمز عبور اشتباه است");
      setLoading(false);
      return;
    }

    // Don't trust res.ok alone — confirm a real session (with ADMIN/STAFF
    // role) was actually stored before navigating, so a silent
    // cookie/session failure shows an error instead of leaving the user
    // stuck on this page.
    const session = await getSession();
    if (!session?.user) {
      setError("ورود انجام نشد: نشست (Session) ایجاد نشد. اگر سایت روی HTTP (نه HTTPS) اجرا می‌شود، مطمئن شوید NEXTAUTH_URL دقیقاً با http:// شروع شده و با آدرسی که در مرورگر باز کرده‌اید یکی است، سپس سرور را ری‌استارت کنید.");
      setLoading(false);
      return;
    }
    const role = (session.user as any).role;
    if (role !== "ADMIN" && role !== "STAFF") {
      setError("این حساب دسترسی مدیریت ندارد.");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center surface2 px-4">
      <div className="w-full max-w-sm surface border line rounded-2xl p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: "var(--ink)" }}>CL</span>
          <span className="font-extrabold text-lg">پنل مدیریت کیس لاین</span>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input required disabled={needsCode} type="email" placeholder="ایمیل مدیر" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none disabled:opacity-60" />
          <input required disabled={needsCode} type="password" placeholder="رمز عبور" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none disabled:opacity-60" />
          {needsCode && (
            <>
              <input required autoFocus type="text" placeholder="کد ۶ رقمی یا یک کد پشتیبان (مثل AB12-CD34)" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none tracking-widest text-center" />
              <p className="text-xs muted -mt-2">اگر به اپلیکیشن احراز هویت دسترسی ندارید، می‌توانید یکی از کدهای پشتیبان یک‌بارمصرف خود را وارد کنید.</p>
            </>
          )}
          {error && <p className="text-sm leading-6" style={{ color: "#a24e56" }}>{error}</p>}
          <button disabled={loading} className="h-11 rounded-full text-white font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
            {loading ? "در حال ورود…" : needsCode ? "تأیید کد" : "ورود به پنل"}
          </button>
        </form>
      </div>
    </div>
  );
}
