"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Tag, Trash2, Truck, X } from "lucide-react";
import { useCart } from "@/features/cart/cart-context";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProductArt } from "@/components/product/product-art";
import { useDialog } from "@/hooks/use-dialog";
import { COUPONS, FREE_SHIPPING_THRESHOLD } from "@/lib/pricing";
import { formatNumber } from "@/lib/format";

/** در RTL پنل در سمت چپ (end) است و از چپ وارد می‌شود: x منفی */
const OFFSET = "-105%";

export function CartDrawer() {
  const { open, setOpen, lines, totals, setQty, remove, coupon, couponError, applyCoupon, clearCoupon } = useCart();
  const [code, setCode] = useState("");
  const ref = useDialog(open, () => setOpen(false));
  const progress = Math.min(1, totals.subtotal / FREE_SHIPPING_THRESHOLD);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <div className="absolute inset-0 bg-black/55" onClick={() => setOpen(false)} aria-hidden />
          <motion.aside
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="سبد خرید"
            tabIndex={-1}
            className="surface-dark absolute inset-y-0 end-0 flex w-full max-w-md flex-col rounded-s-xl bg-elevated text-fg shadow-float outline-none ring-1 ring-line"
            initial={{ x: OFFSET }}
            animate={{ x: 0 }}
            exit={{ x: OFFSET }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <header className="flex items-center justify-between border-b border-line p-4">
              <h2 className="t-h3 flex items-center gap-2">
                سبد خرید
                <span className="num rounded-full bg-secondary px-2 text-sm font-semibold">{formatNumber(totals.count)}</span>
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="بستن سبد خرید"><X /></Button>
            </header>

            {lines.length === 0 ? (
              <div className="grid flex-1 place-items-center p-8 text-center">
                <div>
                  <ShoppingBag className="mx-auto mb-4 size-10 text-muted" aria-hidden />
                  <p className="t-h3">سبد خالی است</p>
                  <p className="t-small mt-1 text-muted">چند محصول اضافه کن تا اینجا ببینی.</p>
                  <Button className="mt-6" variant="accent" onClick={() => setOpen(false)}>ادامهٔ خرید</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-line p-4">
                  <p className="t-small mb-2 flex items-center gap-2">
                    <Truck className="size-4 text-muted" aria-hidden />
                    {totals.freeShippingRemaining > 0 ? (
                      <span>{formatNumber(totals.freeShippingRemaining)} تومان تا <b>ارسال رایگان</b></span>
                    ) : (
                      <b className="text-success">ارسال شما رایگان است</b>
                    )}
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت ارسال رایگان">
                    <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </div>

                <ul className="flex-1 divide-y divide-line overflow-auto px-4">
                  <AnimatePresence initial={false}>
                    {lines.map((l) => (
                      <motion.li key={l.key} layout exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="flex gap-3 overflow-hidden py-4">
                        <div className="grid size-20 shrink-0 place-items-center rounded-md bg-stage">
                          <ProductArt kind={l.kind} color={l.colorHex} className="size-[4.5rem]" label={l.name} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold leading-6">{l.name}</p>
                          <p className="t-caption text-muted">
                            <bdi>{l.brand}</bdi> · {l.colorName}{l.note ? ` · ${l.note}` : ""}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex items-center rounded-full bg-secondary" role="group" aria-label={`تعداد ${l.name}`}>
                              <button onClick={() => setQty(l.key, l.qty - 1)} disabled={l.qty <= 1} aria-label="کاهش تعداد" className="grid size-11 place-items-center rounded-full disabled:opacity-40"><Minus className="size-4" /></button>
                              <span className="num w-6 text-center text-sm font-semibold" aria-live="polite">{formatNumber(l.qty)}</span>
                              <button onClick={() => setQty(l.key, l.qty + 1)} aria-label="افزایش تعداد" className="grid size-11 place-items-center rounded-full"><Plus className="size-4" /></button>
                            </div>
                            <Price value={l.unitPrice * l.qty} oldValue={l.oldPrice ? l.oldPrice * l.qty : undefined} size="sm" showDiscount={false} className="flex-col items-end gap-0" />
                          </div>
                        </div>
                        <button onClick={() => remove(l.key)} aria-label={`حذف ${l.name}`} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:text-danger"><Trash2 className="size-4" /></button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                <footer className="space-y-4 border-t border-line p-4">
                  {coupon ? (
                    <div className="flex items-center justify-between rounded-md bg-success/12 px-3 py-2 text-sm text-success">
                      <span className="flex items-center gap-2"><Tag className="size-4" aria-hidden /><bdi>{coupon}</bdi> — {COUPONS[coupon].label}</span>
                      <button onClick={clearCoupon} className="min-h-9 px-2 font-semibold">حذف</button>
                    </div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); applyCoupon(code); }} className="flex gap-2">
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="کد تخفیف (VOLTA10)"
                        dir="ltr"
                        aria-label="کد تخفیف"
                        aria-invalid={couponError}
                        className="min-h-11 min-w-0 flex-1 rounded-md bg-secondary px-3 text-sm placeholder:text-muted placeholder:[direction:rtl] placeholder:text-start"
                      />
                      <Button type="submit" variant="secondary" size="sm">اعمال</Button>
                    </form>
                  )}
                  {couponError && <p className="t-caption -mt-2 text-danger" role="alert">این کد معتبر نیست.</p>}

                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">جمع کالاها</dt><dd className="num"><AnimatedNumber value={totals.subtotal} /> تومان</dd></div>
                    {totals.saved > 0 && <div className="flex justify-between text-discount"><dt>سود شما از تخفیف</dt><dd className="num"><AnimatedNumber value={totals.saved} /> تومان</dd></div>}
                    {totals.couponDiscount > 0 && <div className="flex justify-between text-success"><dt>کد تخفیف</dt><dd className="num">−<AnimatedNumber value={totals.couponDiscount} /> تومان</dd></div>}
                    <div className="flex justify-between"><dt className="text-muted">ارسال</dt><dd>{totals.shipping === 0 ? <span className="text-success">رایگان</span> : <span className="num">{formatNumber(totals.shipping)} تومان</span>}</dd></div>
                    <div className="flex items-baseline justify-between border-t border-line pt-3"><dt className="font-semibold">مبلغ قابل پرداخت</dt><dd className="price text-xl"><AnimatedNumber value={totals.total} /> <span className="text-xs font-medium text-muted">تومان</span></dd></div>
                  </dl>
                  <Button variant="accent" size="lg" className="w-full">ادامه و ثبت سفارش</Button>
                </footer>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
