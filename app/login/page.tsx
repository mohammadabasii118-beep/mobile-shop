"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { ...form, redirect: false });
    setLoading(false);
    if (res?.error === "RATE_LIMITED") { setError("تلاش‌های ورود ناموفق زیاد بوده است. لطفاً ۱۵ دقیقه دیگر دوباره امتحان کنید."); return; }
    if (res?.error) { setError("ایمیل یا رمز عبور اشتباه است"); return; }
    router.push("/account");
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-extrabold mb-6 text-center">ورود به حساب کاربری</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input required type="email" placeholder="ایمیل" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" />
        <input required type="password" placeholder="رمز عبور" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" />
        {error && <p className="text-sm" style={{ color: "#a24e56" }}>{error}</p>}
        <button disabled={loading} className="h-11 rounded-full text-white font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
          {loading ? "در حال ورود…" : "ورود"}
        </button>
      </form>
      <p className="text-sm text-center muted mt-6">
        حساب کاربری ندارید؟ <Link href="/register" className="font-medium" style={{ color: "#404040" }}>ثبت‌نام</Link>
      </p>
    </div>
  );
}
