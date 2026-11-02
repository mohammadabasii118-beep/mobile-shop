"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, CreditCard, MapPin, User, ArrowLeft } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const [placed, setPlaced] = useState(false);

  const shipping = subtotal > 5_000_000 || subtotal === 0 ? 0 : 89_000;
  const total = subtotal + shipping;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Demo only — no real order is created and no payment gateway is called.
    setPlaced(true);
    clear();
  }

  if (placed) {
    return (
      <div className="mx-auto grid max-w-2xl place-items-center px-4 py-24 text-center sm:px-6">
        <CheckCircle2 className="mb-4 h-16 w-16 text-emerald-400" />
        <h1 className="text-2xl font-black text-silver-50">
          سفارش شما ثبت شد (نمایشی)
        </h1>
        <p className="mt-3 max-w-md leading-7 text-silver-400">
          این یک فروشگاه دمو است؛ هیچ سفارش واقعی ثبت نشد و پرداختی انجام نگرفت.
          در نسخه‌ی واقعی اینجا به درگاه پرداخت متصل می‌شوید.
        </p>
        <Link href="/products" className="btn-luxe mt-6">
          بازگشت به فروشگاه
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto grid max-w-2xl place-items-center px-4 py-24 text-center sm:px-6">
        <h1 className="text-xl font-bold text-silver-100">سبد خرید خالی است</h1>
        <Link href="/products" className="btn-luxe mt-6">
          رفتن به فروشگاه
        </Link>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-silver-100 outline-none placeholder:text-silver-500 focus:border-white/25";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-black text-silver-50 sm:text-3xl">
        تسویه حساب
      </h1>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* contact */}
          <section className="glass rounded-2xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-silver-100">
              <User className="h-4 w-4 text-accent" /> اطلاعات تماس
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input required placeholder="نام" className={field} />
              <input required placeholder="نام خانوادگی" className={field} />
              <input
                required
                type="tel"
                placeholder="شماره موبایل"
                className={field}
              />
              <input type="email" placeholder="ایمیل (اختیاری)" className={field} />
            </div>
          </section>

          {/* address */}
          <section className="glass rounded-2xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-silver-100">
              <MapPin className="h-4 w-4 text-accent" /> آدرس تحویل
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input required placeholder="استان" className={field} />
              <input required placeholder="شهر" className={field} />
              <input
                required
                placeholder="آدرس کامل"
                className={`${field} sm:col-span-2`}
              />
              <input required placeholder="کد پستی" className={field} />
              <input placeholder="پلاک / واحد" className={field} />
            </div>
          </section>

          {/* payment (demo) */}
          <section className="glass rounded-2xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-silver-100">
              <CreditCard className="h-4 w-4 text-accent" /> روش پرداخت
            </h2>
            <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-silver-400">
              درگاه پرداخت در این دمو غیرفعال است. در نسخه‌ی واقعی، پس از ثبت
              اطلاعات به درگاه بانکی هدایت می‌شوید.
            </div>
          </section>
        </div>

        {/* summary */}
        <aside className="h-fit lg:sticky lg:top-20">
          <div className="glass rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-bold text-silver-100">
              سفارش شما
            </h2>
            <ul className="mb-4 space-y-2 text-sm">
              {items.map((it) => (
                <li
                  key={`${it.id}-${it.color.hex}`}
                  className="flex justify-between text-silver-300"
                >
                  <span className="line-clamp-1">
                    {it.name}{" "}
                    <span className="num text-silver-500">×{it.qty}</span>
                  </span>
                  <span className="num shrink-0">
                    {formatPrice(it.price * it.qty)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-white/[0.06] pt-4 text-sm">
              <div className="flex justify-between text-silver-300">
                <dt>جمع کالاها</dt>
                <dd className="num">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-silver-300">
                <dt>ارسال</dt>
                <dd className="num">
                  {shipping === 0 ? "رایگان" : formatPrice(shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-white/[0.06] pt-3 text-base font-bold text-silver-50">
                <dt>مبلغ نهایی</dt>
                <dd className="num text-metal">{formatPrice(total)}</dd>
              </div>
            </dl>
            <button type="submit" className="btn-luxe mt-5 w-full">
              ثبت سفارش (نمایشی)
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}
