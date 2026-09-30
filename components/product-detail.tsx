"use client";
import { useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { SiteImage } from "@/components/site-image";
import { Badge, Container } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";
import { formatToman } from "@/lib/utils";
import type { CardProduct, VariantOption } from "@/lib/types";

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

const selectCls = "h-12 w-full cursor-pointer appearance-none rounded-md border border-primary/30 bg-surface ps-10 pe-4 text-start text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50";

interface Opt { value: string; label: string; stock: number }
const uniq = (arr: VariantOption[], key: (v: VariantOption) => string | null, label: (v: VariantOption) => string | null): Opt[] => {
  const m = new Map<string, Opt>();
  for (const v of arr) { const k = key(v); if (!k) continue; const cur = m.get(k); m.set(k, { value: k, label: label(v) ?? "", stock: (cur?.stock ?? 0) + v.stock }); }
  return [...m.values()];
};

function VariantSelect({ label, value, opts, onChange, disabled }: { label: string; value: string; opts: Opt[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="relative block">
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} dir="ltr" className={selectCls}>
        <option value="">{label}</option>
        {opts.map((o) => <option key={o.value} value={o.value} disabled={o.stock <= 0}>{o.label}{o.stock <= 0 ? " — ناموجود" : ""}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
    </label>
  );
}

/** Brand → model → colour pickers for variant products. Options that are out of stock stay visible but disabled. */
function VariantPicker({ variants, onPick }: { variants: VariantOption[]; onPick: (v: VariantOption | null) => void }) {
  const [brand, setBrand] = useState(""); const [model, setModel] = useState(""); const [color, setColor] = useState("");
  const hasBrand = variants.some((v) => v.brandId), hasModel = variants.some((v) => v.modelId), hasColor = variants.some((v) => v.colorId);
  const brands = uniq(variants, (v) => v.brandId, (v) => v.brandName);
  const inBrand = variants.filter((v) => !brand || v.brandId === brand);
  const models = uniq(inBrand, (v) => v.modelId, (v) => v.modelName);
  const inModel = inBrand.filter((v) => !model || v.modelId === model);
  const colors = uniq(inModel, (v) => v.colorId, (v) => v.colorName);
  const pick = (b: string, m: string, c: string) => {
    const complete = (!hasBrand || !!b) && (!hasModel || !!m) && (!hasColor || !!c);
    onPick(complete ? variants.find((v) => (!hasBrand || v.brandId === b) && (!hasModel || v.modelId === m) && (!hasColor || v.colorId === c)) ?? null : null);
  };
  return (
    <div className="space-y-2">
      {hasBrand && <VariantSelect label="برند گوشی را انتخاب کنید" value={brand} opts={brands} onChange={(v) => { setBrand(v); setModel(""); setColor(""); pick(v, "", ""); }} />}
      {hasModel && <VariantSelect label="مدل گوشی را انتخاب کنید" value={model} opts={models} disabled={hasBrand && !brand} onChange={(v) => { setModel(v); setColor(""); pick(brand, v, ""); }} />}
      {hasColor && <VariantSelect label="رنگ را انتخاب کنید" value={color} opts={colors} disabled={(hasBrand && !brand) || (hasModel && !model)} onChange={(v) => { setColor(v); pick(brand, model, v); }} />}
    </div>
  );
}

export function BuyBox({ p, opt, variants, inStock, maxQty, wholesale }: { p: CardProduct; opt: { label: string; options: BuyOption[] } | null; variants?: VariantOption[] | null; inStock: boolean; maxQty: number; wholesale?: { unit: number; min: number } | null }) {
  const [choice, setChoice] = useState("");
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<VariantOption | null>(null);
  const ready = variants ? !!picked : !opt || !!choice;
  const stockNow = variants ? (picked?.stock ?? 0) : maxQty;
  const canBuy = variants ? !!picked && picked.stock > 0 : inStock;
  const ws = variants ? picked?.wholesale ?? null : wholesale;
  const base = variants ? picked?.price ?? p.price : p.price;
  const unit = ws && qty >= ws.min ? ws.unit : base; // display only: the server recomputes the real price
  return (
    <div data-product data-id={p.slug} data-name={p.name} data-hue={p.hue} data-img={p.img ?? ""} className="space-y-4">
      {(variants ? (picked ? picked.stock > 0 : inStock) : inStock) ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">موجود و آماده تحویل سریع <i className="size-2 rounded-full bg-success" /></span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full border border-hot/30 bg-hot/10 px-3 py-1 text-xs font-medium text-hot">ناموجود <i className="size-2 rounded-full bg-hot" /></span>
      )}
      <ul className="space-y-3 text-[13px] leading-7">
        {[["نسخه اختصاصی با", "بهترین قیمت", "ممکن عرضه می‌شود."], ["محصول کاملاً", "اورجینال", "بوده و مرجوعی ۷ روزه دارد."], ["ارسال سفارش در", "سریع‌ترین زمان", "ممکن انجام می‌شود."], ["سازگاری کامل با مدل گوشی شما با", "ضمانت بازگشت", "وجه."]].map(([a, b, c]) => (
          <li key={b} className="flex gap-2"><i className="mt-2.5 size-1.5 shrink-0 rounded-full bg-foreground" /><span>{a} <b>{b}</b> {c}</span></li>
        ))}
      </ul>
      {variants && <VariantPicker variants={variants} onPick={(v) => { setPicked(v); setQty(1); }} />}
      {variants && <input type="hidden" data-model-select value={picked ? `v:${picked.id}` : ""} readOnly />}
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
        {variants && picked && picked.oldPrice != null && <span className="mt-1 block text-[11px] text-muted">قیمت قبل: <s>{formatToman(picked.oldPrice * qty)}</s></span>}
        {variants && picked && <span className="mt-1 block text-[11px] text-muted">{picked.stock > 0 ? `موجودی: ${picked.stock.toLocaleString("fa-IR")} عدد` : "ناموجود"} · SKU: <span dir="ltr">{picked.sku}</span></span>}
        {ws && <span className="mt-1 block text-[11px] font-bold text-success">قیمت همکار: {formatToman(ws.unit)} برای خرید حداقل {ws.min.toLocaleString("fa-IR")} عدد</span>}
      </div>
      <div className="flex items-center gap-2">
        <button data-buy disabled={!ready || !canBuy} className="h-12 flex-1 cursor-pointer rounded-md bg-primary text-sm font-bold text-primary-fg shadow-md transition-colors enabled:hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary/15 disabled:text-primary disabled:shadow-none">
          {!canBuy && ready ? "ناموجود" : ready ? "افزودن به سبد خرید" : variants ? "اول گزینه‌ها را انتخاب کن" : "اول مدل رو انتخاب کن"}
        </button>
        <div className="flex h-12 items-center gap-1 rounded-md bg-surface-2 px-1">
          <button data-qty-inc aria-label="افزایش" onClick={() => setQty((q) => Math.min(variants ? Math.max(1, Math.min(99, stockNow)) : maxQty, q + 1))} className="grid size-9 cursor-pointer place-items-center rounded"><Plus className="size-4" /></button>
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
