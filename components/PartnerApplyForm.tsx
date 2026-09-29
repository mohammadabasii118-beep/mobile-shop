"use client";
import { useState } from "react";
import { submitPartnerApplication } from "@/lib/actions/partners";
import Icon from "@/components/Icon";

export default function PartnerApplyForm() {
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("companyName", companyName);
    fd.append("phone", phone);
    fd.append("city", city);
    fd.append("message", message);
    const res = await submitPartnerApplication(fd);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="surface border line rounded-2xl p-6 text-center">
        <Icon name="check" className="w-10 h-10 mx-auto mb-3 opacity-80" />
        <p className="font-bold text-sm mb-1">درخواست شما ثبت شد</p>
        <p className="muted text-sm">پس از بررسی توسط تیم ما، نتیجه از طریق حساب کاربری‌تان اطلاع‌رسانی می‌شود.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="surface border line rounded-2xl p-6 flex flex-col gap-4">
      <input
        placeholder="نام فروشگاه/شرکت (اختیاری)"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none"
      />
      <input
        required
        placeholder="شماره تماس"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none"
      />
      <input
        placeholder="شهر (اختیاری)"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none"
      />
      <textarea
        required
        placeholder="کمی درباره کسب‌وکار خود و حجم خرید مورد نظرتان بنویسید"
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="rounded-lg border line bg-transparent px-3 py-2 text-sm outline-none"
      />
      {error && <p className="text-sm" style={{ color: "#a24e56" }}>{error}</p>}
      <button disabled={loading} className="h-11 rounded-full text-white font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
        {loading ? "در حال ارسال…" : "ارسال درخواست"}
      </button>
    </form>
  );
}
