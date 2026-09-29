"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "خطایی رخ داد"); setLoading(false); return; }
    await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    router.push("/account");
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-extrabold mb-6 text-center">ساخت حساب کاربری</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input required placeholder="نام و نام‌خانوادگی" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" />
        <input required type="email" placeholder="ایمیل" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" />
        <input required type="password" placeholder="رمز عبور (حداقل ۶ کاراکتر)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" />
        {error && <p className="text-sm" style={{ color: "#a24e56" }}>{error}</p>}
        <button disabled={loading} className="h-11 rounded-full text-white font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
          {loading ? "در حال ثبت‌نام…" : "ثبت‌نام"}
        </button>
      </form>
      <p className="text-sm text-center muted mt-6">
        حساب دارید؟ <Link href="/login" className="font-medium" style={{ color: "#404040" }}>ورود</Link>
      </p>
    </div>
  );
}
