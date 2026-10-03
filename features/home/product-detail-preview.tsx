"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Box, Check, Heart, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { products } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import { ProductArt } from "@/components/product/product-art";
import { Swatches } from "@/features/catalog/swatches";
import { useCart } from "@/features/cart/cart-context";
import { buildLine } from "@/features/cart/build-line";
import { discountPercent } from "@/lib/pricing";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const product = products[0];
const TABS = [
  { id: "desc", label: "توضیحات" },
  { id: "spec", label: "مشخصات" },
  { id: "compat", label: "سازگاری" },
] as const;
const SPECS: [string, string][] = [
  ["متریال", "سیلیکون مایع ضدلک"],
  ["آهنربا", "حلقهٔ N52 هم‌محور (سازگار با مگ‌سیف)"],
  ["محافظ لنز", "لبهٔ برجستهٔ ۱٫۲ میلی‌متر"],
  ["وزن", "۳۸ گرم"],
  ["گارانتی", "۱۲ ماه تعویض"],
];

export function ProductDetailPreview() {
  const [colorId, setColorId] = useState(product.colors[0].id);
  const [model, setModel] = useState(product.compatibility[0]);
  const [shot, setShot] = useState<"main" | "alt">("main");
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("desc");
  const [wish, setWish] = useState(false);
  const { add } = useCart();
  const color = product.colors.find((c) => c.id === colorId)!;
  const pct = discountPercent(product.price, product.oldPrice);

  return (
    <section id="product-preview" className="bg-bg pb-section">
      <div className="container-x">
        <nav aria-label="مسیر صفحه" className="t-caption mb-6 flex items-center gap-2 text-muted">
          <a href="#top" className="hover:text-fg">خانه</a><span aria-hidden>/</span>
          <a href="#categories" className="hover:text-fg">قاب و کاور</a><span aria-hidden>/</span>
          <span className="text-fg">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          {/* گالری */}
          <div className="lg:col-span-7">
            <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl bg-stage">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={shot + colorId} className="size-[78%]" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                  <ProductArt kind={product.kind} color={color.hex} view={shot} className="size-full" label={`${product.name}، رنگ ${color.name}`} />
                </motion.div>
              </AnimatePresence>
              <Button asChild variant="secondary" size="sm" className="absolute end-4 top-4 bg-surface/90">
                <a href="#showcase"><Box /> مشاهدهٔ ۳D</a>
              </Button>
            </div>
            <div className="mt-3 flex gap-3">
              {(["main", "alt"] as const).map((v) => (
                <button key={v} onClick={() => setShot(v)} aria-label={v === "main" ? "تصویر اصلی" : "تصویر دوم"} aria-pressed={shot === v} className={cn("grid size-20 place-items-center rounded-md bg-stage transition-shadow", shot === v ? "shadow-[inset_0_0_0_2px_var(--fg)]" : "shadow-hairline")}>
                  <ProductArt kind={product.kind} color={color.hex} view={v} className="size-16" label="" />
                </button>
              ))}
              <a href="#showcase" className="grid size-20 place-items-center rounded-md bg-stage text-sm font-bold shadow-hairline" aria-label="نمای سه‌بعدی">۳D</a>
            </div>
          </div>

          {/* اطلاعات */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <p className="t-caption text-muted"><bdi>{product.brand}</bdi></p>
              <h2 className="t-h1 mt-1 !text-3xl md:!text-4xl">{product.name}</h2>
              <p className="mt-1 text-lg text-muted"><bdi>iPhone 17 Pro</bdi></p>
              <div className="mt-4 flex items-center gap-4">
                <Rating value={product.rating} count={product.reviewCount} />
                {product.badge === "bestseller" && <Badge variant="neutral">پرفروش</Badge>}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Price value={product.price} oldValue={product.oldPrice} size="lg" showDiscount={false} />
                {pct > 0 && <Badge variant="discount" className="num !text-sm">{formatNumber(pct)}٪ تخفیف</Badge>}
              </div>

              <p className="t-body mt-5 text-muted">{product.blurb}</p>

              <div className="mt-7 space-y-6">
                <div>
                  <p className="t-caption mb-3">رنگ: <b>{color.name}</b></p>
                  <Swatches colors={product.colors} value={colorId} onChange={setColorId} size="md" label="رنگ" />
                </div>
                <div>
                  <p className="t-caption mb-3">سازگار با</p>
                  <div role="radiogroup" aria-label="مدل گوشی" className="flex flex-wrap gap-2">
                    {product.compatibility.map((m) => (
                      <button key={m} role="radio" aria-checked={model === m} onClick={() => setModel(m)} className={cn("min-h-11 rounded-full px-4 text-sm font-semibold transition-colors", model === m ? "bg-primary text-primary-fg" : "bg-secondary hover:bg-line")}>
                        <bdi>{m}</bdi>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <ul className="mt-7 space-y-2 text-sm">
                <li className="flex items-center gap-2 text-success"><Check className="size-4" aria-hidden /> موجود در انبار تهران ({formatNumber(product.stock)} عدد)</li>
                <li className="flex items-center gap-2"><Truck className="size-4 text-muted" aria-hidden /> ارسال امروز برای سفارش تا ساعت ۱۸</li>
                <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-muted" aria-hidden /> ۱۲ ماه گارانتی تعویض</li>
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="min-w-0 flex-1" onClick={() => add({ ...buildLine(product, color), key: `${product.id}:${color.id}:${model}`, note: model })}>
                  <ShoppingBag /> افزودن به سبد
                </Button>
                <Button variant="accent" size="lg" className="flex-1" onClick={() => add({ ...buildLine(product, color), key: `${product.id}:${color.id}:${model}`, note: model })}>
                  خرید فوری
                </Button>
                <Button variant="outline" size="icon" className="size-14" onClick={() => setWish((w) => !w)} aria-pressed={wish} aria-label="علاقه‌مندی">
                  <Heart className={cn(wish && "fill-discount text-discount")} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* تب‌ها */}
        <div className="mt-14 border-t border-line pt-8 lg:max-w-3xl">
          <div role="tablist" aria-label="جزئیات محصول" className="mb-6 flex gap-2">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("min-h-11 rounded-full px-5 text-sm font-semibold", tab === t.id ? "bg-primary text-primary-fg" : "bg-secondary")}>
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="min-h-40">
            {tab === "desc" && <p className="t-body text-muted">{product.blurb} سطح داخلی با میکروفایبر نرم از خط‌افتادن پشت گوشی جلوگیری می‌کند و دکمه‌ها با فیدبک واضح و بدون سفتی کار می‌کنند. حلقهٔ مگنتی در قاب تعبیه شده؛ بنابراین چسبندگی شارژرهای مگنتی و کیف‌پول‌ها بدون افت سرعت شارژ حفظ می‌شود.</p>}
            {tab === "spec" && (
              <dl className="divide-y divide-line rounded-lg shadow-hairline">
                {SPECS.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[8rem_1fr] gap-4 px-4 py-3 text-sm"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            )}
            {tab === "compat" && (
              <ul className="flex flex-wrap gap-2">
                {product.compatibility.map((m) => <li key={m} className="rounded-full bg-secondary px-4 py-2 text-sm"><bdi>{m}</bdi></li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
