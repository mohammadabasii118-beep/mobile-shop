"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/header";
import { api } from "@/lib/client/api";

const field = "h-12 w-full rounded-[10px] border border-primary/40 bg-surface px-4 text-base text-foreground outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_20%,transparent)]";
const TYPES: [string, string][] = [["instagram_shop", "پیج اینستاگرام"], ["online_shop", "فروشگاه آنلاین"], ["physical_store", "فروشگاه فیزیکی"], ["other", "سایر"]];
const init = { fullName: "", email: "", password: "", storeName: "", phone: "", businessType: "online_shop", instagram: "", website: "", province: "", city: "", address: "", description: "" };

export function PartnerRegisterForm() {
  const [v, setV] = useState(init);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dup, setDup] = useState(false);
  const set = (k: keyof typeof init, val: string) => setV((o) => ({ ...o, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(""); setDup(false);
    const body = { ...v, instagram: v.instagram || undefined, website: v.website || undefined, address: v.address || undefined, description: v.description || undefined };
    const r = await api("POST", "/api/wholesale/register", body);
    const go = (u: string) => { window.location.href = u; };
    if (r.ok) { go("/account/wholesale"); return; }
    setBusy(false); setErr(r.error.message); setDup(r.error.code === "email_taken");
  }
  const F = (k: keyof typeof init, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label htmlFor={`pr-${k}`} className="mt-4 block text-start text-xs font-bold">{label}</label><input id={`pr-${k}`} name={k} value={v[k]} onChange={(e) => set(k, e.target.value)} className={`${field} mt-2`} {...extra} /></div>
  );
  return (
    <div data-login-card data-loading={busy} className="login-card relative w-full max-w-[420px] rounded-[16px] border border-white/60 bg-surface/70 p-6 shadow-lg backdrop-blur-xl dark:border-border">
      <div className="login-dots" aria-hidden><i /><i /><i /></div>
      <div className="login-blur">
        <Link href="/account" aria-label="بازگشت" className="absolute start-4 top-4 grid size-9 place-items-center rounded-full bg-surface text-primary shadow-sm hover:bg-primary/10"><ArrowRight className="size-4" /></Link>
        <div className="flex justify-center pt-1"><Logo className="text-3xl" /></div>
        <form onSubmit={submit} className="mt-3 text-center" noValidate>
          <h1 className="text-base font-extrabold">ثبت‌نام و درخواست همکاری</h1>
          <p className="mt-3 text-[11.5px] leading-6 text-muted">با ثبت این فرم حساب کاربری شما ساخته می‌شود و درخواست همکاری برای بررسی مدیریت ارسال می‌شود. قیمت‌های همکاری پس از تأیید فعال می‌شود.</p>
          {F("fullName", "نام و نام خانوادگی", { autoComplete: "name" })}
          {F("email", "ایمیل", { type: "email", dir: "ltr", autoComplete: "email" })}
          {F("password", "رمز عبور", { type: "password", dir: "ltr", autoComplete: "new-password" })}
          {F("storeName", "نام فروشگاه / کسب‌وکار")}
          {F("phone", "شماره موبایل (برای تماس)", { type: "tel", dir: "ltr", inputMode: "numeric", autoComplete: "tel", placeholder: "09xxxxxxxxx" })}
          <div><label htmlFor="pr-businessType" className="mt-4 block text-start text-xs font-bold">نوع کسب‌وکار</label>
            <select id="pr-businessType" name="businessType" value={v.businessType} onChange={(e) => set("businessType", e.target.value)} className={`${field} mt-2 cursor-pointer`}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          {F("instagram", "آیدی اینستاگرام (اختیاری)", { dir: "ltr" })}
          {F("website", "آدرس سایت (اختیاری)", { dir: "ltr" })}
          {F("province", "استان")}
          {F("city", "شهر")}
          {v.businessType === "physical_store" && F("address", "آدرس فروشگاه")}
          <div><label htmlFor="pr-description" className="mt-4 block text-start text-xs font-bold">توضیحات / معرفی کسب‌وکار (اختیاری)</label>
            <textarea id="pr-description" name="description" rows={3} maxLength={600} value={v.description} onChange={(e) => set("description", e.target.value)} className={`${field} mt-2 h-auto py-3 leading-7`} /></div>
          <p role="alert" className="mt-2 min-h-4 text-xs text-hot">{err}{dup && <> <Link href="/account" className="font-bold text-primary hover:underline">ورود به حساب</Link></>}</p>
          <button type="submit" disabled={busy} className="mt-2 flex h-12 w-full cursor-pointer items-center justify-center rounded-[10px] bg-primary text-sm font-bold text-primary-fg shadow-md transition-colors hover:bg-primary-hover disabled:opacity-60">ثبت درخواست همکاری</button>
          <p className="mt-6 text-[10.5px] leading-5 text-muted">با ثبت‌نام در سایت، شما قوانین و مقررات استفاده از سایت کیس‌لاین را قبول می‌کنید.</p>
        </form>
      </div>
    </div>
  );
}
