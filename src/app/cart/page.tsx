"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Tag,
  ArrowLeft,
  Check,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice, toFa } from "@/lib/format";
import ProductArt from "@/components/ui/ProductArt";

const DEMO_CODE = "LUXE10"; // کد تخفیف نمایشی ۱۰٪

export default function CartPage() {
  const { items, subtotal, setQty, remove, clear, count } = useCart();
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const shipping = subtotal > 5_000_000 || subtotal === 0 ? 0 : 89_000;
  const discount = Math.round((subtotal * applied) / 100);
  const total = Math.max(0, subtotal - discount + shipping);

  function applyCode() {
    if (code.trim().toUpperCase() === DEMO_CODE) {
      setApplied(10);
      setMsg("کد تخفیف ۱۰٪ اعمال شد ✓");
    } else {
      setApplied(0);
      setMsg("کد تخفیف نامعتبر است. (کد نمایشی: LUXE10)");
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto grid max-w-7xl place-items-center px-4 py-24 text-center sm:px-6">
        <ShoppingBag className="mb-4 h-14 w-14 text-silver-600" />
        <h1 className="text-2xl font-black text-silver-50">سبد خرید خالی است</h1>
        <p className="mt-2 text-sm text-silver-400">
          هنوز محصولی اضافه نکرده‌اید.
        </p>
        <Link href="/products" className="btn-luxe mt-6">
          رفتن به فروشگاه
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-black text-silver-50 sm:text-3xl">
        سبد خرید <span className="num text-base text-silver-400">({toFa(count)} کالا)</span>
      </h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* items */}
        <div className="space-y-3">
          {items.map((it) => (
            <div
              key={`${it.id}-${it.color.hex}`}
              className="glass flex gap-4 rounded-2xl p-3"
            >
              <Link
                href={`/products/${it.slug}`}
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl"
              >
                <ProductArt hue={it.hue} categorySlug="accessories" />
              </Link>

              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/products/${it.slug}`}
                    className="text-sm font-semibold text-silver-50 hover:text-white"
                  >
                    {it.name}
                  </Link>
                  <button
                    onClick={() => remove(it.id, it.color.hex)}
                    className="text-silver-500 transition hover:text-rose-400"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-silver-400">
                  <span
                    className="h-3 w-3 rounded-full border border-white/20"
                    style={{ background: it.color.hex }}
                  />
                  {it.color.name}
                </span>

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-lg border border-white/10">
                    <button
                      onClick={() => setQty(it.id, it.color.hex, it.qty - 1)}
                      className="grid h-8 w-8 place-items-center text-silver-300 hover:text-white"
                      aria-label="کاهش"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="num w-8 text-center text-sm text-silver-50">
                      {toFa(it.qty)}
                    </span>
                    <button
                      onClick={() => setQty(it.id, it.color.hex, it.qty + 1)}
                      className="grid h-8 w-8 place-items-center text-silver-300 hover:text-white"
                      aria-label="افزایش"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="num text-sm font-bold text-metal">
                    {formatPrice(it.price * it.qty)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={clear}
            className="text-xs text-silver-500 transition hover:text-rose-400"
          >
            خالی کردن سبد خرید
          </button>
        </div>

        {/* summary */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <div className="glass rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-bold text-silver-100">
              خلاصه‌ی سفارش
            </h2>

            {/* discount code */}
            <div className="mb-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-500" />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="کد تخفیف"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pr-9 pl-3 text-sm text-silver-100 outline-none placeholder:text-silver-500 focus:border-white/25"
                  />
                </div>
                <button onClick={applyCode} className="btn-ghost px-4 py-2.5">
                  اعمال
                </button>
              </div>
              {msg && (
                <p
                  className={`mt-2 text-xs ${
                    applied ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {msg}
                </p>
              )}
            </div>

            <dl className="space-y-3 border-t border-white/[0.06] pt-4 text-sm">
              <div className="flex justify-between text-silver-300">
                <dt>جمع کالاها</dt>
                <dd className="num">{formatPrice(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <dt>تخفیف</dt>
                  <dd className="num">− {formatPrice(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-silver-300">
                <dt>هزینه ارسال</dt>
                <dd className="num">
                  {shipping === 0 ? "رایگان" : formatPrice(shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-white/[0.06] pt-3 text-base font-bold text-silver-50">
                <dt>مبلغ قابل پرداخت</dt>
                <dd className="num text-metal">{formatPrice(total)}</dd>
              </div>
            </dl>

            <Link href="/checkout" className="btn-luxe mt-5 w-full">
              ادامه‌ی خرید و تسویه
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-center text-[11px] text-silver-600">
              این یک فروشگاه نمایشی است؛ پرداخت واقعی انجام نمی‌شود.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
