"use client";
import { useState } from "react";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { SiteImage } from "@/components/site-image";
import { Badge, Container } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";
import { formatToman } from "@/lib/utils";
import type { CardProduct, VariantOption } from "@/lib/types";
import { availableColors, availableModels, choose, findVariant, inFilter, type AvailSel, type AvailVariant } from "@/lib/variant-availability";

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

interface Opt { value: string; label: string; stock: number }
const uniq = (arr: VariantOption[], key: (v: VariantOption) => string | null, label: (v: VariantOption) => string | null): Opt[] => {
  const m = new Map<string, Opt>();
  for (const v of arr) { const k = key(v); if (!k) continue; const cur = m.get(k); m.set(k, { value: k, label: label(v) ?? "", stock: (cur?.stock ?? 0) + v.stock }); }
  return [...m.values()];
};

const chip = "min-h-11 cursor-pointer rounded-md border px-4 py-2 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through";
const chipOn = "border-foreground bg-foreground font-semibold text-background";
const chipOff = "border-border-strong bg-card hover:border-foreground";

/**
 * Model ↔ colour chips for variable products — two-way: start from either side and the other side shows only what really exists
 * (active AND in stock). With many models there is a search box plus brand and series filters (they narrow the models considered).
 * A chip is disabled when no buyable variant exists for it. The cart re-checks everything on the server.
 */
function VariantPicker({ variants, onPick }: { variants: VariantOption[]; onPick: (v: VariantOption | null) => void }) {
  const [q, setQ] = useState(""); const [brand, setBrand] = useState(""); const [series, setSeries] = useState("");
  const [sel, setSel] = useState<AvailSel>({ model: "", color: "" });
  const hasModel = variants.some((v) => v.modelId), hasColor = variants.some((v) => v.colorId);
  const av: AvailVariant[] = variants.map((v) => ({ id: v.id, modelId: v.modelId, colorId: v.colorId, brandId: v.brandId, seriesId: v.seriesId ?? null, stock: v.stock }));
  const filter = { brand, series };
  const brands = uniq(variants, (v) => v.brandId, (v) => v.brandName);
  const inBrand = variants.filter((v) => !brand || v.brandId === brand);
  const seriesOpts = uniq(inBrand, (v) => v.seriesId ?? null, (v) => v.seriesName ?? null);
  const modelsAll = uniq(inBrand.filter((v) => !series || v.seriesId === series), (v) => v.modelId, (v) => v.modelName);
  const models = modelsAll.filter((m) => !q.trim() || m.label.toLowerCase().includes(q.trim().toLowerCase()));
  const colorsAll = uniq(variants, (v) => v.colorId, (v) => v.colorName);
  const hexOf = (id: string) => variants.find((v) => v.colorId === id)?.colorHex ?? null;
  const okModels = availableModels(av, sel, filter), okColors = availableColors(av, sel, filter);
  const apply = (next: AvailSel) => { setSel(next); onPick(findVariant(variants, next)); };
  const setFilter = (b: string, s: string) => {
    setBrand(b); setSeries(s);
    const pool = inFilter(av, { brand: b, series: s });
    if (sel.model && !pool.some((v) => v.modelId === sel.model)) apply({ ...sel, model: "" });
  };
  const many = uniq(variants, (v) => v.modelId, (v) => v.modelName).length > 8;
  return (
    <div className="space-y-5" data-testid="variant-picker">
      {hasModel && (
        <div className="space-y-2">
          <div className="text-[13px] font-bold">مدل گوشی{sel.model && <span className="ms-1 font-normal text-muted">— {variants.find((v) => v.modelId === sel.model)?.modelName}</span>}</div>
          {many && <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی مدل گوشی…" aria-label="جستجوی مدل گوشی" className="h-12 w-full rounded-md border border-border-strong bg-card px-3 text-sm outline-none focus:border-foreground" />}
          {brands.length > 1 && <div className="flex flex-wrap gap-1.5" role="group" aria-label="برند گوشی">{[{ value: "", label: "همه برندها", stock: 1 }, ...brands].map((b) => <button type="button" key={b.value} aria-pressed={brand === b.value} onClick={() => setFilter(b.value, "")} className={`${chip} ${brand === b.value ? chipOn : chipOff}`}>{b.label}</button>)}</div>}
          {seriesOpts.length > 1 && <div className="flex flex-wrap gap-1.5" role="group" aria-label="سری گوشی">{[{ value: "", label: "همه سری‌ها", stock: 1 }, ...seriesOpts].map((x) => <button type="button" key={x.value} aria-pressed={series === x.value} onClick={() => setFilter(brand, x.value)} className={`${chip} ${series === x.value ? chipOn : chipOff}`}>{x.label}</button>)}</div>}
          <div className={`flex flex-wrap gap-1.5 ${many ? "max-h-44 overflow-y-auto" : ""}`} role="group" aria-label="مدل گوشی">
            {models.length === 0 && <p className="text-xs text-muted">مدلی پیدا نشد.</p>}
            {models.map((m) => <button type="button" key={m.value} data-testid="model-chip" disabled={!okModels.has(m.value)} aria-pressed={sel.model === m.value} title={!okModels.has(m.value) ? "ناموجود" : undefined}
              onClick={() => apply(choose(av, sel, "model", m.value, filter))} className={`${chip} ${sel.model === m.value ? chipOn : chipOff}`}>{m.label}</button>)}
          </div>
        </div>
      )}
      {hasColor && (
        <div className="space-y-2">
          <div className="text-[13px] font-bold">رنگ{sel.color && <span className="ms-1 font-normal text-muted">— {colorsAll.find((c) => c.value === sel.color)?.label}</span>}</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="رنگ">
            {colorsAll.map((c) => <button type="button" key={c.value} data-testid="color-chip" disabled={!okColors.has(c.value)} aria-pressed={sel.color === c.value} title={!okColors.has(c.value) ? "ناموجود" : undefined}
              onClick={() => apply(choose(av, sel, "color", c.value, filter))} className={`${chip} inline-flex items-center gap-1.5 ${sel.color === c.value ? chipOn : chipOff}`}>
              {hexOf(c.value) && <i className="size-3 rounded-full border border-border" style={{ background: hexOf(c.value)! }} />}{c.label}</button>)}
          </div>
        </div>
      )}
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
    <div id="buy" data-product data-id={p.slug} data-name={p.name} data-hue={p.hue} data-img={p.img ?? ""} className="space-y-6">
      {(variants ? (picked ? picked.stock > 0 : inStock) : inStock) ? (
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-success"><i className="size-2 rounded-full bg-success" />موجود و آماده تحویل سریع</span>
      ) : (
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-hot"><i className="size-2 rounded-full bg-hot" />ناموجود</span>
      )}
      <ul className="space-y-2 border-y border-border py-4 text-[13px] leading-7 text-foreground/85">
        {[["نسخه اختصاصی با", "بهترین قیمت", "ممکن عرضه می‌شود."], ["محصول کاملاً", "اورجینال", "بوده و مرجوعی ۷ روزه دارد."], ["ارسال سفارش در", "سریع‌ترین زمان", "ممکن انجام می‌شود."], ["سازگاری کامل با مدل گوشی شما با", "ضمانت بازگشت", "وجه."]].map(([a, b, c]) => (
          <li key={b} className="flex gap-3"><Check className="mt-1.5 size-4 shrink-0 text-primary" strokeWidth={2.2} /><span>{a} <b>{b}</b> {c}</span></li>
        ))}
      </ul>
      {variants && <VariantPicker variants={variants} onPick={(v) => { setPicked(v); setQty(1); window.dispatchEvent(new CustomEvent("caseline:variant-image", { detail: v?.imageUrl ?? null })); }} />}
      {variants && <input type="hidden" data-model-select value={picked ? `v:${picked.id}` : ""} readOnly />}
      {opt && (
        <label className="relative block">
          <select id="model-select" aria-label="انتخاب مدل گوشی" data-model-select value={choice} onChange={(e) => setChoice(e.target.value)} dir="ltr"
            className="h-12 w-full cursor-pointer appearance-none rounded-md border border-border-strong bg-card ps-10 pe-4 text-start text-sm text-foreground outline-none transition-colors focus:border-foreground">
            <option value="">{opt.label}</option>
            {opt.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-foreground" />
        </label>
      )}
      <div className="rounded-[10px] bg-surface-2 px-5 py-4">
        <span className="block text-[12px] font-bold tracking-wide text-muted">قیمت محصول</span>
        <span data-price className="num mt-1 block text-[28px] font-extrabold leading-tight">{formatToman(unit * qty)}</span>
        {variants && picked && picked.oldPrice != null && <span className="mt-1 block text-[12px] text-muted">قیمت قبل: <s>{formatToman(picked.oldPrice * qty)}</s></span>}
        {variants && picked && <span className="mt-1 block text-[11px] text-muted">{picked.stock > 0 ? `موجودی: ${picked.stock.toLocaleString("fa-IR")} عدد` : "ناموجود"} · SKU: <span dir="ltr">{picked.sku}</span></span>}
        {ws && <span className="mt-1 block text-[11px] font-bold text-success">قیمت همکار: {formatToman(ws.unit)} برای خرید حداقل {ws.min.toLocaleString("fa-IR")} عدد</span>}
      </div>
      <div className="flex items-center gap-2">
        <button data-buy disabled={!ready || !canBuy} className="h-[52px] flex-1 cursor-pointer rounded-md bg-primary text-[15px] font-semibold text-primary-fg transition-[background-color,transform] duration-150 enabled:hover:bg-primary-hover enabled:active:translate-y-px disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted">
          {!canBuy && ready ? "ناموجود" : ready ? "افزودن به سبد خرید" : variants ? "اول گزینه‌ها را انتخاب کن" : "اول مدل رو انتخاب کن"}
        </button>
        <div className="flex h-[52px] items-center rounded-md border border-border-strong bg-card px-1">
          <button data-qty-inc aria-label="افزایش" onClick={() => setQty((q) => Math.min(variants ? Math.max(1, Math.min(99, stockNow)) : maxQty, q + 1))} className="grid size-10 cursor-pointer place-items-center rounded-md hover:bg-surface-2"><Plus className="size-4" /></button>
          <span data-qty className="num w-7 text-center text-sm font-bold">{qty}</span>
          <button data-qty-dec aria-label="کاهش" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-10 cursor-pointer place-items-center rounded-md hover:bg-surface-2"><Minus className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}

export function StickyBar({ p }: { p: CardProduct }) {
  return (
    <div data-sticky-buy className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] z-30 border-t border-border bg-background lg:bottom-0">
      <Container>
        <div className="flex items-center gap-3 py-2.5 lg:py-3">
          <Thumb p={p} className="hidden size-11 shrink-0 rounded-[8px] sm:block" />
          <div className="min-w-0 flex-1">
            <div className="hidden truncate text-[12px] sm:block"><span className="text-muted">شما در حال مشاهده هستید: </span><b>{p.name}</b></div>
            <div className="num text-[15px] font-extrabold">{formatToman(p.price)}</div>
          </div>
          <a href="#buy" className="inline-flex h-11 shrink-0 items-center rounded-md bg-primary px-6 text-[14px] font-semibold text-primary-fg transition-colors hover:bg-primary-hover">انتخاب و خرید</a>
        </div>
      </Container>
    </div>
  );
}

export function HotBadge() { return <Badge tone="hot" className="px-2 py-0.5 text-[11px]">حراج</Badge>; }
