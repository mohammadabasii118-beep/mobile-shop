import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CreditCard, Send, Ticket } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "تسویه حساب | CaseLine" };

const field = "h-12 w-full rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none transition-colors focus:border-primary";
function Field({ label, name, type = "text", required, dir, placeholder }: { label: string; name: string; type?: string; required?: boolean; dir?: "ltr"; placeholder?: string }) {
  return (
    <label className="block space-y-1.5 text-xs font-medium">
      <span>{label}{required && <b className="text-hot"> *</b>}</span>
      <input name={name} type={type} required={required} dir={dir} placeholder={placeholder} className={field} />
    </label>
  );
}

export default function CheckoutPage() {
  return (
    <>
      <Header />
      <main className="py-6">
        <Container>
          <div data-checkout>
            <div data-order-done hidden className="mx-auto max-w-md rounded-[28px] border border-border bg-surface p-8 text-center shadow-md">
              <CheckCircle2 className="mx-auto size-14 text-success" />
              <h1 className="mt-4 text-xl font-black">سفارش شما ثبت شد</h1>
              <p className="mt-2 text-sm leading-7 text-muted">این یک نسخه دمو است و پرداختی انجام نشد. کد پیگیری نمونه: <b dir="ltr" data-order-code className="text-foreground" /></p>
              <Link href="/shop" className="mt-6 flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-fg">بازگشت به فروشگاه</Link>
            </div>

            <div data-checkout-main className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
              <form data-checkout-form className="rounded-[28px] border border-border bg-surface p-5 shadow-md sm:p-8">
                <h1 className="mb-5 text-lg font-black">جزئیات پرداخت</h1>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="نام" name="first" required />
                  <Field label="نام خانوادگی" name="last" required />
                  <Field label="شماره موبایل" name="phone" type="tel" dir="ltr" required placeholder="09xxxxxxxxx" />
                  <Field label="ایمیل (اختیاری)" name="email" type="email" dir="ltr" />
                  <Field label="شهر" name="city" required />
                  <Field label="کد پستی" name="zip" dir="ltr" />
                </div>
                <label className="mt-4 block space-y-1.5 text-xs font-medium">
                  <span>آدرس کامل<b className="text-hot"> *</b></span>
                  <textarea name="address" required rows={3} className={`${field} h-auto py-3 leading-7`} />
                </label>
                <div className="mt-4 space-y-1.5 text-xs font-medium">
                  <span className="flex items-center gap-1.5"><Ticket className="size-4 text-primary" />کد تخفیف دارید؟</span>
                  <div className="flex gap-2">
                    <input data-coupon-input placeholder="مثلاً CASE10" dir="ltr" className={field} />
                    <button type="button" data-coupon-btn className="h-12 shrink-0 cursor-pointer rounded-xl bg-primary px-5 text-sm font-bold text-primary-fg hover:bg-primary-hover">اعمال کد</button>
                  </div>
                  <p data-coupon-msg className="min-h-4 text-[11px] text-hot data-[ok=1]:text-success" />
                </div>
                <label className="mt-2 block space-y-1.5 text-xs font-medium">
                  <span>یادداشت سفارش (اختیاری)</span>
                  <textarea name="note" rows={2} placeholder="نکات خاص برای تحویل سفارش" className={`${field} h-auto py-3`} />
                </label>
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 p-3 text-xs leading-6"><Send className="mt-0.5 size-4 shrink-0 text-primary" />پس از ثبت سفارش، شماره پیگیری برای شما نمایش داده می‌شود و پشتیبانی از طریق تلگرام پیگیر ارسال خواهد بود.</div>
              </form>

              <aside className="space-y-4 lg:sticky lg:top-20">
                <div className="rounded-[28px] border border-border bg-surface p-5 shadow-md">
                  <h2 className="mb-2 text-base font-black">سفارش شما</h2>
                  <div data-order-list />
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">جمع جزء</dt><dd data-order-sub className="font-bold" /></div>
                    <div className="flex justify-between"><dt className="text-muted">تخفیف</dt><dd data-order-discount className="font-bold text-success" /></div>
                    <div className="flex justify-between"><dt className="text-muted">هزینه ارسال</dt><dd data-order-ship className="font-bold" /></div>
                    <div className="flex justify-between border-t border-border pt-3 text-base"><dt className="font-black">مجموع</dt><dd data-order-total className="font-black text-primary" /></div>
                  </dl>
                  <p className="mt-2 text-[11px] text-muted">ارسال برای سفارش‌های بالای ۲ میلیون تومان رایگان است.</p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary"><CreditCard className="size-5" /></span>
                  <div className="text-xs leading-6"><b className="text-sm">پرداخت آنلاین</b><br /><span className="text-muted">پرداخت امن با کلیه کارت‌های عضو شتاب</span></div>
                </div>
                <button type="button" data-place-order className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-primary text-base font-black text-primary-fg shadow-md hover:bg-primary-hover">ثبت سفارش</button>
              </aside>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
