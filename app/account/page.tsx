import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Smartphone } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "ورود یا ثبت‌نام | CaseLine" };
const field = "h-12 w-full rounded-xl border border-border bg-surface-2 px-4 text-center text-base tracking-widest outline-none transition-colors focus:border-primary";

export default function AccountPage() {
  return (
    <>
      <Header />
      <main className="py-8">
        <Container>
          <div className="mx-auto max-w-md rounded-[28px] border border-border bg-surface p-6 shadow-md sm:p-8">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary"><Smartphone className="size-7" /></div>
            <div data-login-done hidden className="py-6 text-center">
              <CheckCircle2 className="mx-auto size-12 text-success" />
              <h1 className="mt-3 text-lg font-black">خوش آمدید</h1>
              <p className="mt-2 text-sm text-muted">ورود نمونه انجام شد. پنل کاربری (سفارش‌ها، کیف پول و امتیاز) در مرحله بعد ساخته می‌شود.</p>
              <Link href="/shop" className="mt-5 flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-fg">رفتن به فروشگاه</Link>
            </div>
            <form data-login-form className="mt-4 space-y-4 text-center">
              <h1 className="text-lg font-black">ورود یا ثبت‌نام</h1>
              <div data-step1 className="space-y-2">
                <p className="text-xs leading-6 text-muted">شماره موبایل خود را وارد کنید تا کد تایید برایتان ارسال شود.</p>
                <input name="phone" type="tel" dir="ltr" inputMode="numeric" placeholder="09xxxxxxxxx" className={field} />
              </div>
              <div data-step2 hidden className="space-y-2">
                <p className="text-xs leading-6 text-muted">کد تایید نمونه را وارد کنید (هر عددی پذیرفته می‌شود).</p>
                <input name="code" type="text" dir="ltr" inputMode="numeric" placeholder="- - - - -" className={field} />
              </div>
              <p data-login-err className="min-h-4 text-xs text-hot" />
              <button type="submit" data-login-btn className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-fg hover:bg-primary-hover">ارسال کد تایید</button>
            </form>
          </div>
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
