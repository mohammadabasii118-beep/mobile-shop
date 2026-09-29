"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "خطایی رخ داد"); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="mb-4"><Icon name="check" className="w-12 h-12 mx-auto opacity-80" /></div>
        <h1 className="text-xl font-bold mb-2">پیام شما ارسال شد</h1>
        <p className="muted text-sm">به‌زودی با شما تماس خواهیم گرفت.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 md:px-8 py-14">
      <h1 className="text-2xl font-extrabold mb-2 text-center">تماس با ما</h1>
      <p className="muted text-sm text-center mb-8">سوالی دارید؟ فرم زیر را پر کنید تا به شما پاسخ دهیم.</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input required placeholder="نام" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" />
        <input required type="email" placeholder="ایمیل" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" />
        <input placeholder="شماره تماس (اختیاری)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" />
        <textarea required placeholder="پیام شما" rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className="rounded-lg border line bg-transparent px-3 py-2 text-sm outline-none" />
        {error && <p className="text-sm" style={{ color: "#a24e56" }}>{error}</p>}
        <button disabled={loading} className="h-11 rounded-full text-white font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
          {loading ? "در حال ارسال…" : "ارسال پیام"}
        </button>
      </form>
      <div className="mt-8 text-sm muted text-center leading-7">
        تهران، خیابان ولیعصر<br />۰۲۱-۱۲۳۴۵۶۷۸ · info@caseline.ir
      </div>
    </div>
  );
}
