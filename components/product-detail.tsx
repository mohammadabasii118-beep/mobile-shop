"use client";
import { useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { SiteImage } from "@/components/site-image";
import { Badge, Container } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";
import { formatToman } from "@/lib/utils";
import type { CardProduct } from "@/lib/types";

export function Thumb({ p, className, priority }: { p: Pick<CardProduct, "hue" | "kind" | "img" | "name">; className?: string; priority?: boolean }) {
  return (
    <span className={`relative block overflow-hidden ${className ?? ""}`} style={{ background: `linear-gradient(160deg, hsl(${p.hue} 80% 56%), hsl(${(p.hue + 40) % 360} 70% 30%))` }}>
      {p.img ? (
        <SiteImage src={p.img} alt={p.name} priority={priority} sizes={priority ? "(min-width: 768px) 384px, 90vw" : "96px"} />
      ) : (
        <ProductVisual kind={p.kind} hue={(p.hue + 180) % 360} className="absolute inset-0 size-full p-1" />
      )}
    </span>
  );
}

export interface BuyOption { value: string; label: string }

export function BuyBox({ p, opt, inStock, maxQty, wholesale }: { p: CardProduct; opt: { label: string; options: BuyOption[] } | null; inStock: boolean; maxQty: number; wholesale?: { unit: number; min: number } | null }) {
  const [choice, setChoice] = useState("");
  const [qty, setQty] = useState(1);
  const ready = !opt || !!choice;
  const unit = wholesale && qty >= wholesale.min ? wholesale.unit : p.price; // display only: the server recomputes the real price
  return (
    <div data-product data-id={p.slug} data-name={p.name} data-hue={p.hue} data-img={p.img ?? ""} className="space-y-4">
      {inStock ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">موجود و آماده تحویل سریع <i className="size-2 rounded-full bg-success" /></span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full border border-hot/30 bg-hot/10 px-3 py-1 text-xs font-medium text-hot">ناموجود <i className="size-2 rounded-full bg-hot" /></span>
      )}
      <ul className="space-y-3 text-[13px] leading-7">
        {[["نسخه اختصاصی با", "بهترین قیمت", "ممکن عرضه می‌شود."], ["محصول کاملاً", "اورجینال", "بوده و مرجوعی ۷ روزه دارد."], ["ارسال سفارش در", "سریع‌ترین زمان", "ممکن انجام می‌شود."], ["سازگاری کامل با مدل گوشی شما با", "ضمانت بازگشت", "وجه."]].map(([a, b, c]) => (
          <li key={b} className="flex gap-2"><i className="mt-2.5 size-1.5 shrink-0 rounded-full bg-foreground" /><span>{a} <b>{b}</b> {c}</span></li>
        ))}
      </ul>
      {opt && (
        <label className="relative block">
          <select id="model-select" aria-label="انتخاب مدل گوشی" data-model-select value={choice} onChange={(e) => setChoice(e.target.value)} dir="ltr"
            className="h-12 w-full cursor-pointer appearance-none rounded-md border border-primary/30 bg-surface ps-10 pe-4 text-start text-sm text-foreground outline-none focus:border-primary">
            <option value="">{opt.label}</option>
            {opt.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
        </label>
      )}
      <div className="relative rounded-md border border-primary/25 bg-primary/8 py-4 text-center">
        <span className="absolute -top-2.5 end-4 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-fg">قیمت محصول</span>
        <span data-price className="text-xl font-black">{formatToman(unit * qty)}</span>
        {wholesale && <span className="mt-1 block text-[11px] font-bold text-success">قیمت همکار: {formatToman(wholesale.unit)} برای خرید حداقل {qty >= wholesale.min ? "" : ""}{wholesale.min.toLocaleString("fa-IR")} عدد</span>}
      </div>
      <div className="flex items-center gap-2">
        <button data-buy disabled={!ready || !inStock} className="h-12 flex-1 cursor-pointer rounded-md bg-primary text-sm font-bold text-primary-fg shadow-md transition-colors enabled:hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary/15 disabled:text-primary disabled:shadow-none">
          {!inStock ? "ناموجود" : ready ? "افزودن به سبد خرید" : "اول مدل رو انتخاب کن"}
        </button>
        <div className="flex h-12 items-center gap-1 rounded-md bg-surface-2 px-1">
          <button data-qty-inc aria-label="افزایش" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="grid size-9 cursor-pointer place-items-center rounded"><Plus className="size-4" /></button>
          <span data-qty className="w-5 text-center text-sm font-bold">{qty}</span>
          <button data-qty-dec aria-label="کاهش" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-9 cursor-pointer place-items-center rounded"><Minus className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}

export function StickyBar({ p }: { p: CardProduct }) {
  return (
    <div className="fixed inset-x-0 bottom-3 z-40 hidden md:block">
      <Container>
        <div className="glass flex items-center gap-4 rounded-lg p-3 shadow-lg">
          <Thumb p={p} className="size-11 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs"><span className="text-muted">شما در حال مشاهده هستید: </span><b>{p.name}</b></div>
            <div className="text-[11px] font-bold text-primary">{formatToman(p.price)}</div>
          </div>
          <a href="#model-select" className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-fg">انتخاب مدل</a>
        </div>
      </Container>
    </div>
  );
}

export function HotBadge() { return <Badge tone="hot" className="!rounded-md px-2 py-1 text-[10px]">حراج!</Badge>; }
