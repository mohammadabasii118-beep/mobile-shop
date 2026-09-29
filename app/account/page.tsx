import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/header";

export const metadata: Metadata = { title: "ورود به حساب کاربری | CaseLine" };
const field = "h-12 w-full rounded-xl border border-primary/40 bg-surface px-4 text-center text-base tracking-widest text-foreground outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_20%,transparent)]";

export default function AccountPage() {
  return (
    <main className="login-bg grid min-h-screen place-items-center px-4 py-10">
      <div data-login-card className="login-card relative w-full max-w-[330px] rounded-[28px] border border-white/60 bg-surface/70 p-6 shadow-lg backdrop-blur-xl dark:border-border">
        <div className="login-dots" aria-hidden><i /><i /><i /></div>
        <div className="login-blur">
        <Link href="/" aria-label="بازگشت به سایت" className="absolute start-4 top-4 grid size-9 place-items-center rounded-full bg-surface text-primary shadow-sm hover:bg-primary/10"><ArrowRight className="size-4" /></Link>
        <div className="flex justify-center pt-1"><Logo className="text-3xl" /></div>

        <div data-login-done hidden className="py-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h1 className="mt-3 text-base font-black">با موفقیت وارد شدید</h1>
          <p className="mt-2 text-xs leading-6 text-muted">ورود نمونه انجام شد. داشبورد، سفارش‌ها، کیف پول و امتیاز در مرحله بعد ساخته می‌شوند.</p>
          <Link href="/shop" className="mt-5 flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-fg shadow-md">رفتن به فروشگاه</Link>
        </div>

        <form data-login-form className="mt-3 text-center">
          <h1 className="text-base font-black">به پنل کاربری خوش آمدید.</h1>
          <div data-step1>
            <p className="mt-3 text-[11.5px] leading-6 text-muted">اگر هنگام ورود با خطا مواجه شدید، نگران نباشید. بدون ورود هم می‌توانید سفارش دهید. اطلاعات سفارش به شماره‌ای که در فرم پرداخت وارد می‌کنید پیامک می‌شود.</p>
            <label className="mt-5 block text-start text-xs font-bold" htmlFor="login-phone">شماره موبایل</label>
            <input id="login-phone" name="phone" type="tel" dir="ltr" inputMode="numeric" autoComplete="tel" placeholder="09xxxxxxxxx" className={`${field} mt-2`} />
          </div>
          <div data-step2 hidden>
            <p className="mt-3 text-xs font-bold">کد تایید ارسال شده را وارد کنید</p>
            <div className="mt-3 rounded-lg bg-success/15 px-3 py-3 text-start text-xs font-medium text-success">کد تایید پیامک شد.</div>
            <span className="mt-5 block text-start text-xs font-bold">کد تایید</span>
            <div dir="ltr" data-otp className="mt-3 flex justify-center gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <input key={i} aria-label={`رقم ${i + 1}`} maxLength={1} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} className="size-12 rounded-xl border border-border bg-surface text-center text-lg font-bold text-foreground outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_20%,transparent)]" />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted">
              <span>کد به شماره <b dir="ltr" data-login-phone className="text-foreground" /> ارسال شد.</span>
              <button type="button" data-login-edit className="shrink-0 cursor-pointer rounded-full bg-primary/10 px-3 py-1.5 font-bold text-primary hover:bg-primary/15">تغییر شماره ‹</button>
            </div>
            <p data-login-timer className="mt-3 min-h-5 text-[11px] text-muted" />
          </div>
          <p data-login-err className="mt-2 min-h-4 text-xs text-hot" />
          <button type="submit" data-login-btn className="mt-2 flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-fg shadow-md transition-colors hover:bg-primary-hover">ارسال کد</button>
          <p className="mt-6 text-[10.5px] leading-5 text-muted">با ورود یا ثبت‌نام در سایت، شما قوانین و مقررات استفاده از سایت کیس‌لاین را قبول می‌کنید.</p>
        </form>
        </div>
      </div>
    </main>
  );
}
