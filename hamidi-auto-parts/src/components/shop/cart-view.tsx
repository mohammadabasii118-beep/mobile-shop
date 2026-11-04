"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Lock, Tag, Trash2, Truck, X } from "lucide-react";
import { useCart, useHydrated } from "@/store/cart";
import { toast } from "@/store/toast";
import { QtyStepper } from "./product-purchase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { cn, formatPrice, toFa } from "@/lib/utils";

const SHIPPING = [
  { id: "courier", label: "پیک موتوری (تهران)", desc: "تحویل همان روز", price: 120_000 },
  { id: "post", label: "پست پیشتاز", desc: "۲ تا ۴ روز کاری", price: 180_000 },
  { id: "cargo", label: "باربری (قطعات حجیم)", desc: "پس‌کرایه", price: 0 },
];
const FREE_SHIPPING = 10_000_000;
const COUPONS: Record<string, number> = { HAMIDI10: 10, NISSAN5: 5 };

/** Interactive cart. `emptyState` is server-rendered (product suggestions) and passed in as children. */
export function CartView({ emptyState }: { emptyState: React.ReactNode }) {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const { setQty, remove, add, clear, restore } = useCart.getState();
  const [ship, setShip] = useState("courier");
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [order, setOrder] = useState<string | null>(null);

  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.item.price * l.qty, 0);
  const listTotal = lines.reduce((n, l) => n + (l.item.oldPrice ?? l.item.price) * l.qty, 0);
  const savings = listTotal - subtotal;
  const couponOff = coupon ? Math.round((subtotal * COUPONS[coupon]) / 100) : 0;
  const shipMethod = SHIPPING.find((s) => s.id === ship)!;
  const shipping = subtotal >= FREE_SHIPPING && ship !== "cargo" ? 0 : shipMethod.price;
  const total = subtotal - couponOff + shipping;

  if (!hydrated) return <div className="h-96 animate-pulse rounded-3xl bg-neutral-100" aria-busy="true" aria-label="در حال بارگذاری سبد خرید" />;
  if (lines.length === 0 && !order) return <>{emptyState}</>;

  const progress = Math.min(100, (subtotal / FREE_SHIPPING) * 100);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="cart-items-title" className="space-y-4">
        <h2 id="cart-items-title" className="sr-only">کالاهای سبد خرید ({toFa(count)} کالا)</h2>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="flex items-center gap-2 text-sm">
            <Truck className="size-4 text-primary" aria-hidden />
            {subtotal >= FREE_SHIPPING ? <b className="text-emerald-700">ارسال شما رایگان شد!</b> : <span>با افزودن <b>{formatPrice(FREE_SHIPPING - subtotal)} تومان</b> دیگر، ارسال رایگان می‌شود.</span>}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت تا ارسال رایگان">
            <div className="h-full rounded-full bg-gradient-to-l from-primary to-[#ff6a5f] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          {lines.map(({ item: p, qty }) => (
            <li key={p.id} className="flex gap-4 p-4 sm:p-5">
              <Link href={`/product/${p.slug}`} className="size-24 shrink-0 overflow-hidden rounded-2xl bg-studio sm:size-28" tabIndex={-1} aria-hidden>
                <Image src={p.image} alt="" width={224} height={224} sizes="112px" className="size-full object-contain p-2" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <Link href={`/product/${p.slug}`} className="line-clamp-2 font-bold hover:text-primary">{p.name}</Link>
                  <p className="flex flex-wrap gap-x-3 text-[11px] text-neutral-600">
                    <span>کد: <span className="ltr-nums font-mono text-neutral-800">{p.sku}</span></span>
                    <span>OEM: <span className="ltr-nums font-mono text-neutral-800">{p.oem}</span></span>
                  </p>
                  <p className="line-clamp-1 text-xs text-neutral-600">سازگار با: {p.fits}</p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <div className="text-left">
                    {p.oldPrice && <p className="text-xs text-neutral-500 line-through">{formatPrice(p.oldPrice * qty)}</p>}
                    <p className="font-extrabold">{formatPrice(p.price * qty)} <span className="text-[11px] font-normal text-neutral-600">تومان</span></p>
                    {qty > 1 && <p className="text-[11px] text-neutral-500">هر عدد {formatPrice(p.price)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <QtyStepper size="sm" value={qty} max={p.maxQty} onChange={(n) => setQty(p.id, n)} label={p.name} />
                    <button
                      type="button"
                      onClick={() => { remove(p.id); toast({ title: "از سبد خرید حذف شد", description: p.name, tone: "info", action: { label: "بازگردانی", onClick: () => add(p, qty) } }); }}
                      aria-label={`حذف ${p.name} از سبد`}
                      className="grid size-9 cursor-pointer place-items-center rounded-xl text-neutral-500 transition hover:bg-red-50 hover:text-primary"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-between">
          <Button variant="ghost" asChild><Link href="/shop"><ArrowLeft className="rotate-180" />ادامه خرید</Link></Button>
          <Button variant="ghost" className="text-neutral-600 hover:text-primary" onClick={() => { const snapshot = lines; clear(); toast({ title: "سبد خرید خالی شد", tone: "info", action: { label: "بازگردانی", onClick: () => restore(snapshot) } }); }}>
            <Trash2 />خالی کردن سبد
          </Button>
        </div>
      </section>

      <aside aria-label="خلاصه سفارش" className="space-y-4 lg:sticky lg:top-44">
        <fieldset className="rounded-3xl border border-neutral-200 bg-white p-5">
          <legend className="sr-only">روش ارسال</legend>
          <h2 className="mb-4 font-extrabold" aria-hidden>روش ارسال</h2>
          <div className="space-y-2">
            {SHIPPING.map((s) => (
              <label key={s.id} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition", ship === s.id ? "border-neutral-950 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400")}>
                <input type="radio" name="ship" value={s.id} checked={ship === s.id} onChange={() => setShip(s.id)} className="size-4 accent-[#e10600]" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{s.label}</span>
                  <span className="text-[11px] text-neutral-600">{s.desc}</span>
                </span>
                <span className="text-xs font-bold">{s.price === 0 ? "پس‌کرایه" : subtotal >= FREE_SHIPPING ? <span className="text-emerald-700">رایگان</span> : `${formatPrice(s.price)} ت`}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (COUPONS[c]) { setCoupon(c); toast({ title: `کد تخفیف ${toFa(COUPONS[c])}٪ اعمال شد` }); }
              else toast({ title: "کد تخفیف معتبر نیست", description: "در نسخه نمایشی از کد HAMIDI10 استفاده کنید.", tone: "error" });
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-500" aria-hidden />
              <label htmlFor="coupon" className="sr-only">کد تخفیف</label>
              <Input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} placeholder="کد تخفیف (HAMIDI10)" className="pr-9" dir="auto" autoComplete="off" />
            </div>
            <Button type="submit" variant="dark">اعمال</Button>
          </form>
          {coupon && (
            <p className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              کد {coupon} اعمال شد ({toFa(COUPONS[coupon])}٪)
              <button type="button" onClick={() => setCoupon(null)} className="cursor-pointer" aria-label="حذف کد تخفیف"><X className="size-4" /></button>
            </p>
          )}
          <dl className="mt-5 space-y-3 text-sm">
            <Row label={`قیمت کالاها (${toFa(count)})`} value={listTotal} />
            {savings > 0 && <Row label="سود شما از خرید" value={-savings} accent />}
            {couponOff > 0 && <Row label="کد تخفیف" value={-couponOff} accent />}
            <div className="flex justify-between"><dt className="text-neutral-600">هزینه ارسال</dt><dd className="font-semibold">{shipMethod.price === 0 ? "پس‌کرایه" : shipping === 0 ? <span className="text-emerald-700">رایگان</span> : `${formatPrice(shipping)} تومان`}</dd></div>
            <div className="flex items-center justify-between border-t border-dashed border-neutral-200 pt-4">
              <dt className="font-bold">مبلغ قابل پرداخت</dt>
              <dd className="text-xl font-black">{formatPrice(total)} <span className="text-xs font-medium text-neutral-600">تومان</span></dd>
            </div>
          </dl>
          <Button size="lg" className="mt-5 h-13 w-full text-base" onClick={() => setCheckout(true)}><Lock />ادامه و ثبت سفارش</Button>
          <p className="mt-3 text-center text-[11px] text-neutral-600">نسخه نمایشی — پرداخت واقعی انجام نمی‌شود.</p>
        </div>
      </aside>

      <Drawer open={checkout} side="center" title={order ? "سفارش ثبت شد" : "اطلاعات ارسال"} onClose={() => { setCheckout(false); if (order) { clear(); setOrder(null); } }}>
        <div className="p-6">
          {order ? (
            <div className="text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-9" aria-hidden /></span>
              <h2 className="mt-4 text-xl font-black">سفارش نمایشی ثبت شد</h2>
              <p className="mt-2 text-sm leading-7 text-neutral-600">
                کد پیگیری: <b className="ltr-nums font-mono text-neutral-950">{order}</b>
                <br />در نسخه نهایی، کارشناسان ما برای تأیید تطابق قطعه با شما تماس می‌گیرند.
              </p>
              <Button className="mt-6 w-full" size="lg" onClick={() => { clear(); setOrder(null); setCheckout(false); }} asChild><Link href="/">بازگشت به صفحه اصلی</Link></Button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setOrder(`HAP-${Math.floor(100000 + Math.random() * 900000)}`); }} className="space-y-4">
              <h2 className="text-xl font-black">اطلاعات ارسال</h2>
              <p className="text-sm text-neutral-600">مبلغ قابل پرداخت: <b className="text-neutral-950">{formatPrice(total)} تومان</b></p>
              <Field label="نام و نام خانوادگی"><Input required autoComplete="name" /></Field>
              <Field label="شماره موبایل"><Input required inputMode="tel" autoComplete="tel" pattern="[0-9۰-۹]{11}" title="شماره موبایل ۱۱ رقمی" dir="ltr" /></Field>
              <Field label="شهر و آدرس کامل"><Input required autoComplete="street-address" /></Field>
              <Field label="شماره شاسی (VIN) — اختیاری"><Input dir="ltr" /></Field>
              <div className="flex gap-2 pt-2">
                <Button type="submit" size="lg" className="flex-1">ثبت سفارش نمایشی</Button>
                <Button type="button" size="lg" variant="outline" onClick={() => setCheckout(false)}>انصراف</Button>
              </div>
            </form>
          )}
        </div>
      </Drawer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-semibold">{label}{children}</label>;
}

function Row({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn("flex justify-between", accent && "text-primary")}>
      <dt className={accent ? undefined : "text-neutral-600"}>{label}</dt>
      <dd className="font-semibold">{value < 0 ? "−" : ""}{formatPrice(Math.abs(value))} تومان</dd>
    </div>
  );
}
