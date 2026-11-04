"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, CheckCircle2, Lock, ShoppingBag, Tag, Trash2, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { useCart, useHydrated } from "@/store/cart";
import { PRODUCTS, type Product } from "@/data/products";
import { getModel } from "@/data/vehicles";
import { bestsellers } from "@/lib/catalog";
import { QtyStepper } from "./product-purchase";
import { ProductRail } from "./product-rail";
import { SectionHeading } from "./section-heading";
import { Breadcrumbs } from "./breadcrumbs";
import { StockBadge } from "./stock-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatPrice, toFa } from "@/lib/utils";

const SHIPPING = [
  { id: "courier", label: "پیک موتوری (تهران)", desc: "تحویل همان روز", price: 120_000 },
  { id: "post", label: "پست پیشتاز", desc: "۲ تا ۴ روز کاری", price: 180_000 },
  { id: "cargo", label: "باربری (قطعات حجیم)", desc: "پس‌کرایه", price: 0 },
];
const FREE_SHIPPING = 10_000_000;
const COUPONS: Record<string, number> = { HAMIDI10: 10, NISSAN5: 5 };

export function CartView() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const { increment, decrement, setQty, remove, add, clear } = useCart.getState();
  const [ship, setShip] = useState("courier");
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [order, setOrder] = useState<string | null>(null);

  const lines = useMemo(
    () => items.map((i) => ({ ...i, product: PRODUCTS.find((p) => p.id === i.id) })).filter((l): l is typeof l & { product: Product } => !!l.product),
    [items],
  );
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.product.price * l.qty, 0);
  const listTotal = lines.reduce((n, l) => n + (l.product.oldPrice ?? l.product.price) * l.qty, 0);
  const savings = listTotal - subtotal;
  const couponOff = coupon ? Math.round((subtotal * COUPONS[coupon]) / 100) : 0;
  const shipMethod = SHIPPING.find((s) => s.id === ship)!;
  const shipping = subtotal >= FREE_SHIPPING && ship !== "cargo" ? 0 : shipMethod.price;
  const total = subtotal - couponOff + shipping;

  function removeLine(p: Product, qty: number) {
    remove(p.id);
    toast("از سبد خرید حذف شد", { description: p.name, action: { label: "بازگردانی", onClick: () => add(p.id, qty) } });
  }

  function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (COUPONS[c]) { setCoupon(c); toast.success(`کد تخفیف ${toFa(COUPONS[c])}٪ اعمال شد`); }
    else toast.error("کد تخفیف معتبر نیست", { description: "در نسخه نمایشی از کد HAMIDI10 استفاده کنید." });
  }

  const header = (
    <div className="border-b border-neutral-200 bg-neutral-50">
      <div className="container-x flex flex-wrap items-center justify-between gap-4 py-5">
        <div>
          <Breadcrumbs items={[{ label: "سبد خرید" }]} />
          <h1 className="mt-2 text-2xl font-black">سبد خرید {hydrated && count > 0 && <span className="text-base font-semibold text-neutral-400">({toFa(count)} کالا)</span>}</h1>
        </div>
        <ol className="flex items-center gap-2 text-xs font-semibold">
          {["سبد خرید", "اطلاعات ارسال", "پرداخت"].map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={cn("grid size-7 place-items-center rounded-full", i === 0 ? "bg-primary text-white" : "bg-neutral-200 text-neutral-500")}>{toFa(i + 1)}</span>
              <span className={i === 0 ? "text-neutral-950" : "text-neutral-400"}>{s}</span>
              {i < 2 && <span className="h-px w-6 bg-neutral-300" />}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );

  if (!hydrated) {
    return (<>{header}<div className="container-x mt-8 h-96 animate-pulse rounded-3xl bg-neutral-100" /></>);
  }

  if (lines.length === 0) {
    return (
      <>
        {header}
        <div className="container-x mt-10">
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
            <span className="grid size-20 place-items-center rounded-3xl bg-neutral-100 text-neutral-400"><ShoppingBag className="size-9" /></span>
            <h2 className="mt-6 text-xl font-black">سبد خرید شما خالی است</h2>
            <p className="mt-2 max-w-sm text-sm leading-7 text-neutral-500">می‌توانید از بین هزاران قطعه اصلی نیسان و هوندا، قطعه مورد نیاز خودروی خود را انتخاب کنید.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild size="lg"><Link href="/shop">رفتن به فروشگاه <ArrowLeft /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/#vehicle">انتخاب بر اساس خودرو</Link></Button>
            </div>
          </div>
        </div>
        <section className="container-x mt-16">
          <SectionHeading eyebrow="پیشنهاد ما" title="محصولات پرفروش" href="/shop" />
          <ProductRail products={bestsellers().slice(0, 8)} />
        </section>
      </>
    );
  }

  const progress = Math.min(100, (subtotal / FREE_SHIPPING) * 100);

  return (
    <>
      {header}
      <div className="container-x mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="flex items-center gap-2 text-sm">
              <Truck className="size-4 text-primary" />
              {subtotal >= FREE_SHIPPING ? <b className="text-emerald-700">ارسال شما رایگان شد!</b> : <span>با افزودن <b>{formatPrice(FREE_SHIPPING - subtotal)} تومان</b> دیگر، ارسال رایگان می‌شود.</span>}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-gradient-to-l from-primary to-[#ff6a5f] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
          </div>

          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
            {lines.map(({ product: p, qty }) => {
              const models = p.fitments.map((f) => getModel(f.model)?.nameFa).filter(Boolean);
              return (
                <li key={p.id} className="flex gap-4 p-4 animate-in fade-in sm:p-5">
                  <Link href={`/product/${p.slug}`} className="size-24 shrink-0 overflow-hidden rounded-2xl bg-studio sm:size-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt={p.name} className="size-full object-contain p-2 transition hover:scale-105" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <Link href={`/product/${p.slug}`} className="line-clamp-2 font-bold hover:text-primary">{p.name}</Link>
                      <p className="flex flex-wrap gap-x-3 text-[11px] text-neutral-500">
                        <span>کد: <span className="ltr-nums font-mono text-neutral-700">{p.sku}</span></span>
                        <span>OEM: <span className="ltr-nums font-mono text-neutral-700">{p.oem}</span></span>
                      </p>
                      <p className="line-clamp-1 text-xs text-neutral-500">سازگار با: {models.slice(0, 3).join("، ")}</p>
                      <StockBadge status={p.stock} />
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <div className="text-left">
                        {p.oldPrice && <p className="text-xs text-neutral-400 line-through">{formatPrice(p.oldPrice * qty)}</p>}
                        <p className="font-extrabold">{formatPrice(p.price * qty)} <span className="text-[11px] font-normal text-neutral-500">تومان</span></p>
                        {qty > 1 && <p className="text-[11px] text-neutral-400">هر عدد {formatPrice(p.price)}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <QtyStepper size="sm" value={qty} max={Math.max(1, Math.min(20, p.stockQty))} onChange={(n) => (n > qty ? increment(p.id) : n < qty ? decrement(p.id) : setQty(p.id, n))} />
                        <button onClick={() => removeLine(p, qty)} aria-label="حذف از سبد" className="grid size-9 cursor-pointer place-items-center rounded-xl text-neutral-400 transition hover:bg-red-50 hover:text-primary"><Trash2 className="size-4" /></button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between">
            <Button variant="ghost" asChild><Link href="/shop"><ArrowLeft className="rotate-180" />ادامه خرید</Link></Button>
            <Button variant="ghost" className="text-neutral-500 hover:text-primary" onClick={() => { const snapshot = items; clear(); toast("سبد خرید خالی شد", { action: { label: "بازگردانی", onClick: () => snapshot.forEach((i) => add(i.id, i.qty)) } }); }}>
              <Trash2 />خالی کردن سبد
            </Button>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-44">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-4 font-extrabold">روش ارسال</h2>
            <div className="space-y-2">
              {SHIPPING.map((s) => (
                <label key={s.id} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition", ship === s.id ? "border-neutral-950 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400")}>
                  <input type="radio" name="ship" value={s.id} checked={ship === s.id} onChange={() => setShip(s.id)} className="size-4 accent-[#e10600]" />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{s.label}</span>
                    <span className="text-[11px] text-neutral-500">{s.desc}</span>
                  </span>
                  <span className="text-xs font-bold">{s.price === 0 ? "پس‌کرایه" : subtotal >= FREE_SHIPPING ? <span className="text-emerald-600">رایگان</span> : `${formatPrice(s.price)} ت`}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5">
            <form onSubmit={applyCoupon} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-400" />
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="کد تخفیف (HAMIDI10)" className="pr-9" dir="auto" />
              </div>
              <Button type="submit" variant="dark">اعمال</Button>
            </form>
            {coupon && (
              <p className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                کد {coupon} اعمال شد ({toFa(COUPONS[coupon])}٪)
                <button onClick={() => setCoupon(null)} className="cursor-pointer" aria-label="حذف کد"><X className="size-4" /></button>
              </p>
            )}

            <dl className="mt-5 space-y-3 text-sm">
              <Row label={`قیمت کالاها (${toFa(count)})`} value={listTotal} />
              {savings > 0 && <Row label="سود شما از خرید" value={-savings} className="text-primary" />}
              {couponOff > 0 && <Row label="کد تخفیف" value={-couponOff} className="text-primary" />}
              <div className="flex justify-between"><dt className="text-neutral-500">هزینه ارسال</dt><dd className="font-semibold">{shipMethod.price === 0 ? "پس‌کرایه" : shipping === 0 ? <span className="text-emerald-600">رایگان</span> : `${formatPrice(shipping)} تومان`}</dd></div>
              <div className="flex items-center justify-between border-t border-dashed border-neutral-200 pt-4">
                <dt className="font-bold">مبلغ قابل پرداخت</dt>
                <dd className="text-xl font-black">{formatPrice(total)} <span className="text-xs font-medium text-neutral-500">تومان</span></dd>
              </div>
            </dl>
            <Button size="lg" className="mt-5 h-13 w-full text-base" onClick={() => setCheckout(true)}>
              <Lock />ادامه و ثبت سفارش
            </Button>
            <p className="mt-3 text-center text-[11px] text-neutral-400">نسخه نمایشی — پرداخت واقعی انجام نمی‌شود.</p>
          </div>
        </aside>
      </div>

      <Dialog.Root open={checkout} onOpenChange={(o) => { setCheckout(o); if (!o && order) { clear(); setOrder(null); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content dir="rtl" className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0">
            {order ? (
              <div className="text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-9" /></span>
                <Dialog.Title className="mt-4 text-xl font-black">سفارش نمایشی ثبت شد</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-7 text-neutral-500">
                  کد پیگیری: <b className="ltr-nums font-mono text-neutral-950">{toFa(order)}</b>
                  <br />در نسخه نهایی، کارشناسان ما برای تأیید تطابق قطعه با شما تماس می‌گیرند.
                </Dialog.Description>
                <Dialog.Close asChild><Button className="mt-6 w-full" size="lg" asChild><Link href="/">بازگشت به صفحه اصلی</Link></Button></Dialog.Close>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); setOrder(`HAP-${Math.floor(100000 + Math.random() * 900000)}`); }}
                className="space-y-4"
              >
                <Dialog.Title className="text-xl font-black">اطلاعات ارسال</Dialog.Title>
                <Dialog.Description className="text-sm text-neutral-500">مبلغ قابل پرداخت: <b className="text-neutral-950">{formatPrice(total)} تومان</b></Dialog.Description>
                <Input required placeholder="نام و نام خانوادگی" />
                <Input required placeholder="شماره موبایل" inputMode="tel" pattern="[0-9۰-۹]{11}" title="شماره موبایل ۱۱ رقمی" />
                <Input required placeholder="شهر و آدرس کامل" />
                <Input placeholder="شماره شاسی (VIN) — اختیاری برای تطبیق قطعه" dir="auto" />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" size="lg" className="flex-1">ثبت سفارش نمایشی</Button>
                  <Dialog.Close asChild><Button type="button" size="lg" variant="outline">انصراف</Button></Dialog.Close>
                </div>
              </form>
            )}
            <Dialog.Close className="absolute top-4 left-4 grid size-8 cursor-pointer place-items-center rounded-full bg-neutral-100 hover:bg-neutral-200" aria-label="بستن"><X className="size-4" /></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function Row({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={cn("flex justify-between", className)}>
      <dt className={className ? undefined : "text-neutral-500"}>{label}</dt>
      <dd className="font-semibold">{value < 0 ? "−" : ""}{formatPrice(Math.abs(value))} تومان</dd>
    </div>
  );
}
