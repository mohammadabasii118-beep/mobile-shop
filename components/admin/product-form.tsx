"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Card, ImageInput, Label, Pill, act, btnDanger, btnGhost, btnPrimary, confirmAsk, fmtDate, fmtToman, inputCls } from "@/components/admin/kit";
import { MediaManager } from "@/components/admin/media-manager";
import { toFormData } from "@/lib/admin/product-map";
import type { Opt } from "@/components/admin/resource-manager";
import { VariantMatrix, type ColorOpt, type ModelOpt } from "@/components/admin/variant-matrix";
import { cn } from "@/lib/utils";

export interface Variant { _k?: string; id?: string; sku: string; name: string; phoneModelId: string; colorId: string; costPrice: string; pricingMode: "AUTOMATIC" | "MANUAL"; color: string; colorHex: string; retailPrice: string; wholesalePrice: string; salePrice: string; imageUrl: string; isActive: boolean; stock: string; current?: number }
export interface ProductData {
  id?: string; name: string; slug: string; sku: string; brandId: string; categoryId: string; shortDescription: string; description: string; badge: string; isActive: boolean;
  retailPrice: string; retailDiscount: string; costPrice: string; pricingMode: "AUTOMATIC" | "MANUAL"; wholesalePrice: string; wholesaleDiscount: string; minWholesaleQty: string; seoTitle: string; seoDescription: string; canonical: string;
  phoneModelIds: string[]; extraCategoryIds: string[]; extraBrandIds: string[]; productType: "SIMPLE" | "VARIABLE"; attributeValueIds: string[]; images: { url: string; alt: string }[]; variants: Variant[];
  history?: { id: string; type: string; oldPrice: number; newPrice: number; createdAt: string }[];
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export interface AttributeOpt { id: string; name: string; values: { id: string; value: string }[] }

export function ProductForm({ initial, categories, brands, phoneModels, colors, attributes, canWrite, canDelete, canStock, canPrice, canCost }: { initial: ProductData; categories: Opt[]; brands: Opt[]; phoneModels: ModelOpt[]; colors: ColorOpt[]; attributes: AttributeOpt[]; canWrite: boolean; canDelete: boolean; canStock: boolean; canPrice: boolean; canCost: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const isNew = !p.id;
  const set = <K extends keyof ProductData>(k: K, v: ProductData[K]) => setP((o) => ({ ...o, [k]: v }));
  const setVariants = (f: (v: Variant[]) => Variant[]) => setP((o) => ({ ...o, variants: f(o.variants) }));
  const hasAxes = p.variants.length > 1 || p.variants.some((v) => v.phoneModelId || v.colorId);
  const chooseType = (t: "SIMPLE" | "VARIABLE") => { if (t === "SIMPLE" && hasAxes) return;
    setP((o) => {
      const blank = o.variants.length === 1 && !o.variants[0]!.id && !o.variants[0]!.phoneModelId && !o.variants[0]!.colorId && !o.variants[0]!.sku;
      const variants = t === "VARIABLE" && blank ? [] : t === "SIMPLE" && o.variants.length === 0 ? [{ sku: "", name: "پیش‌فرض", phoneModelId: "", colorId: "", costPrice: "", pricingMode: o.pricingMode, color: "", colorHex: "", retailPrice: "", wholesalePrice: "", salePrice: "", imageUrl: "", isActive: true, stock: "0" }] : o.variants;
      return { ...o, productType: t, variants };
    });
  };
  const moveImg = (i: number, d: -1 | 1) => { const a = [...p.images]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j]!, a[i]!]; set("images", a); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErrs({});
    const body = {
      name: p.name, slug: p.slug, sku: p.sku, brandId: p.brandId || null, categoryId: p.categoryId, shortDescription: p.shortDescription, description: p.description, badge: p.badge, isActive: p.isActive,
      ...(p.pricingMode === "AUTOMATIC" ? {} : { retailPrice: Number(p.retailPrice) }), costPrice: num(p.costPrice), pricingMode: p.pricingMode, retailDiscount: Number(p.retailDiscount || 0), wholesalePrice: num(p.wholesalePrice), wholesaleDiscount: Number(p.wholesaleDiscount || 0), minWholesaleQty: Number(p.minWholesaleQty || 1),
      seoTitle: p.seoTitle, seoDescription: p.seoDescription, canonical: p.canonical, phoneModelIds: p.phoneModelIds, extraCategoryIds: p.extraCategoryIds, extraBrandIds: p.extraBrandIds, productType: p.productType, attributeValueIds: p.attributeValueIds, ...(isNew ? { images: p.images.map((i) => ({ url: i.url, alt: i.alt })) } : {}),
      variants: p.variants.map((v) => ({ ...(v.id ? { id: v.id } : {}), sku: v.sku, name: v.name, phoneModelId: v.phoneModelId || null, colorId: v.colorId || null, costPrice: num(v.costPrice), pricingMode: v.pricingMode, color: v.colorId ? null : v.color, colorHex: v.colorId ? null : v.colorHex, retailPrice: num(v.retailPrice), wholesalePrice: num(v.wholesalePrice), salePrice: num(v.salePrice), imageUrl: v.imageUrl || null, isActive: v.isActive, ...(v.id && !canStock ? {} : { stock: Number(v.stock || 0) }) })),
    };
    const r = await act<Parameters<typeof toFormData>[0]>(isNew ? "POST" : "PATCH", isNew ? "/api/admin/products" : `/api/admin/products/${p.id}`, body, isNew ? "محصول ایجاد شد." : "محصول ذخیره شد.");
    setBusy(false);
    if (!r.ok) { setErrs(r.fields ?? {}); return; }
    if (isNew) router.replace(`/admin/products/${r.data!.id}`); else setP(toFormData(r.data!));
  };
  const del = async () => { if (!confirmAsk("این محصول برای همیشه حذف شود؟")) return; const r = await act("DELETE", `/api/admin/products/${p.id}`, undefined, "محصول حذف شد."); if (r.ok) router.replace("/admin/products"); };
  const ro = !canWrite;

  return (
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={ro} className="space-y-4">
        <Card className="grid gap-3 sm:grid-cols-2">
          <h2 className="text-sm font-black sm:col-span-2">اطلاعات اصلی</h2>
          <Label label="نام محصول *" error={errs.name}><input className={inputCls} value={p.name} onChange={(e) => set("name", e.target.value)} required /></Label>
          <Label label="اسلاگ (آدرس) *" error={errs.slug}><input dir="ltr" className={inputCls} value={p.slug} onChange={(e) => set("slug", e.target.value)} required /></Label>
          <Label label="SKU اصلی *" error={errs.sku}><input dir="ltr" className={inputCls} value={p.sku} onChange={(e) => set("sku", e.target.value)} required /></Label>
          <Label label="نشان (مثلاً «جدید»)"><input className={inputCls} value={p.badge} onChange={(e) => set("badge", e.target.value)} /></Label>
          <Label label="دسته‌بندی *" error={errs.categoryId}><select className={inputCls} value={p.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>{categories.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Label>
          <Label label="برند"><select className={inputCls} value={p.brandId} onChange={(e) => set("brandId", e.target.value)}><option value="">— بدون برند —</option>{brands.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Label>
          <Label label="دسته‌بندی‌های دیگر (اختیاری، نامحدود)"><MultiPick value={p.extraCategoryIds} onChange={(v) => set("extraCategoryIds", v)} options={categories.filter((o) => o.value !== p.categoryId)} placeholder="جستجوی دسته‌بندی…" /></Label>
          <Label label="برندهای دیگر (اختیاری، نامحدود)"><MultiPick value={p.extraBrandIds} onChange={(v) => set("extraBrandIds", v)} options={brands.filter((o) => o.value !== p.brandId)} placeholder="جستجوی برند…" /></Label>
          <Label label="توضیح کوتاه" className="sm:col-span-2"><input className={inputCls} value={p.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} /></Label>
          <Label label="توضیحات" className="sm:col-span-2"><textarea className={cn(inputCls, "h-28 py-2")} value={p.description} onChange={(e) => set("description", e.target.value)} /></Label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={p.isActive} onChange={(e) => set("isActive", e.target.checked)} />محصول فعال (نمایش در سایت)</label>
        </Card>

        <Card className="grid gap-3 sm:grid-cols-3">
          <h2 className="text-sm font-black sm:col-span-3">قیمت‌گذاری <span className="text-[11px] font-normal text-muted">(قیمت خرده و عمده کاملاً جدا هستند — تومان)</span></h2>
          <Label label="روش قیمت‌گذاری" hint={p.pricingMode === "AUTOMATIC" ? "قیمت از هزینه خرید + قانون سود محاسبه می‌شود" : "قیمت را خودتان وارد می‌کنید"}><select className={inputCls} disabled={!canPrice} value={p.pricingMode} onChange={(e) => set("pricingMode", e.target.value as "AUTOMATIC" | "MANUAL")}><option value="MANUAL">دستی (Manual)</option><option value="AUTOMATIC">خودکار (Automatic)</option></select></Label>
          {canCost ? <Label label="هزینه خرید" hint="برای محصولی که چند تنوع دارد، هزینه را در هر تنوع هم می‌توان وارد کرد"><input dir="ltr" type="number" min={0} className={inputCls} disabled={!canPrice} value={p.costPrice} onChange={(e) => set("costPrice", e.target.value)} /></Label> : <span />}
          <span />
          <Label label="قیمت خرده *" error={errs.retailPrice}><input dir="ltr" type="number" min={0} className={inputCls} disabled={p.pricingMode === "AUTOMATIC"} value={p.retailPrice} onChange={(e) => set("retailPrice", e.target.value)} required={p.pricingMode !== "AUTOMATIC"} /></Label>
          <Label label="تخفیف خرده (مبلغ)" hint={p.retailPrice ? `قیمت نهایی: ${fmtToman(Number(p.retailPrice) - Number(p.retailDiscount || 0))}` : undefined}><input dir="ltr" type="number" min={0} className={inputCls} value={p.retailDiscount} onChange={(e) => set("retailDiscount", e.target.value)} /></Label>
          <span />
          <Label label="قیمت عمده" hint="خالی = این محصول عمده ندارد" error={errs.wholesalePrice}><input dir="ltr" type="number" min={0} className={inputCls} value={p.wholesalePrice} onChange={(e) => set("wholesalePrice", e.target.value)} /></Label>
          <Label label="تخفیف عمده (مبلغ)"><input dir="ltr" type="number" min={0} className={inputCls} value={p.wholesaleDiscount} onChange={(e) => set("wholesaleDiscount", e.target.value)} /></Label>
          <Label label="حداقل تعداد برای قیمت عمده"><input dir="ltr" type="number" min={1} className={inputCls} value={p.minWholesaleQty} onChange={(e) => set("minWholesaleQty", e.target.value)} /></Label>
          <p className="text-[11px] leading-6 text-muted sm:col-span-3">قیمت عمده فقط برای همکار تأییدشده با سطح فعال و تعداد ≥ حداقل اعمال می‌شود؛ حداقل سفارش هر سطح در بخش «همکاران عمده» تنظیم می‌شود. هر تغییر قیمت در تاریخچه قیمت ثبت می‌شود.</p>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-black">تصاویر و ویدیو <span className="text-[11px] font-normal text-muted">(اولی تصویر اصلی است)</span></h2>
          {!isNew ? <MediaManager productId={p.id!} productName={p.name} /> : <>
          <div className="grid gap-3 sm:grid-cols-2">
            {p.images.map((im, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <ImageInput value={im.url} onChange={(u) => set("images", u ? p.images.map((x, j) => (j === i ? { ...x, url: u } : x)) : p.images.filter((_, j) => j !== i))} />
                <div className="ms-auto flex flex-col">
                  <button type="button" className="grid size-7 cursor-pointer place-items-center rounded hover:bg-surface-2" onClick={() => moveImg(i, -1)} aria-label="بالا"><ArrowUp className="size-4" /></button>
                  <button type="button" className="grid size-7 cursor-pointer place-items-center rounded hover:bg-surface-2" onClick={() => moveImg(i, 1)} aria-label="پایین"><ArrowDown className="size-4" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3"><span className="text-xs text-muted">افزودن تصویر:</span><ImageInput value={null} onChange={(u) => u && set("images", [...p.images, { url: u, alt: p.name }])} /></div>
          <p className="mt-2 text-[11px] text-muted">پس از ذخیره محصول می‌توانید تصاویر بیشتر، تغییر ترتیب، تصویر اصلی و ویدیو را مدیریت کنید.</p></>}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-black">نوع محصول</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="نوع محصول">
            {([["SIMPLE", "محصول ساده", "یک SKU و یک موجودی"], ["VARIABLE", "محصول متغیر", "چند تنوع بر اساس مدل گوشی و رنگ"]] as const).map(([t, l, h]) => (
              <label key={t} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm", p.productType === t ? "border-primary bg-primary/10 font-bold text-primary" : "border-border", t === "SIMPLE" && hasAxes && "cursor-not-allowed opacity-50")}>
                <input type="radio" name="productType" className="accent-[var(--primary)]" checked={p.productType === t} disabled={ro || (t === "SIMPLE" && hasAxes)} onChange={() => chooseType(t)} />{l}<span className="text-[11px] font-normal text-muted">{h}</span>
              </label>
            ))}
          </div>
          {hasAxes && <p className="mt-2 text-[11px] text-muted">این محصول Variant دارد؛ برای تبدیل به «ساده» ابتدا Variantها را حذف کنید.</p>}
        </Card>

        {p.productType === "SIMPLE" ? (
          <Card className="grid gap-3 sm:grid-cols-4">
            <h2 className="text-sm font-black sm:col-span-4">SKU و موجودی</h2>
            {p.variants.slice(0, 1).map((v) => (
              <div key="simple" className="contents">
                <Label label="SKU *" error={errs["variants.0.sku"]}><input dir="ltr" className={inputCls} value={v.sku} onChange={(e) => setVariants((o) => o.map((x, j) => (j === 0 ? { ...x, sku: e.target.value } : x)))} required /></Label>
                <Label label={v.id ? "موجودی" : "موجودی اولیه"}><input dir="ltr" type="number" min={0} className={inputCls} disabled={!!v.id && !canStock} value={v.stock} onChange={(e) => setVariants((o) => o.map((x, j) => (j === 0 ? { ...x, stock: e.target.value } : x)))} /></Label>
                <Label label="قیمت فروش ویژه" hint="باید کمتر از قیمت باشد"><input dir="ltr" type="number" min={0} className={inputCls} disabled={!canPrice} value={v.salePrice} onChange={(e) => setVariants((o) => o.map((x, j) => (j === 0 ? { ...x, salePrice: e.target.value } : x)))} /></Label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={v.isActive} onChange={(e) => setVariants((o) => o.map((x, j) => (j === 0 ? { ...x, isActive: e.target.checked } : x)))} />فعال (قابل خرید)</label>
              </div>
            ))}
            {errs.variants && <p className="text-xs font-bold text-error sm:col-span-4">{errs.variants}</p>}
          </Card>
        ) : (
          <>
            <VariantMatrix p={p} setVariants={setVariants} models={phoneModels} colors={colors} canPrice={canPrice} canCost={canCost} canStock={canStock} ro={ro} />
            {errs.variants && <p className="text-xs font-bold text-error">{errs.variants}</p>}
            {Object.entries(errs).filter(([k]) => k.startsWith("variants.")).map(([k, m]) => <p key={k} className="text-xs font-bold text-error">تنوع {k.split(".")[1] ? Number(k.split(".")[1]) + 1 : ""}: {m}</p>)}
          </>
        )}

        {attributes.length > 0 && (
          <Card>
            <h2 className="mb-3 text-sm font-black">ویژگی‌ها (Attributeها) <span className="text-[11px] font-normal text-muted">(توصیفی؛ در مشخصات صفحهٔ محصول نمایش داده می‌شود)</span></h2>
            <div className="space-y-3">{attributes.map((a) => (
              <div key={a.id}><div className="mb-1 text-xs font-bold text-muted">{a.name}</div>
                <div className="flex flex-wrap gap-1.5">{a.values.map((v) => { const on = p.attributeValueIds.includes(v.id); return <button type="button" key={v.id} aria-pressed={on} onClick={() => set("attributeValueIds", on ? p.attributeValueIds.filter((x) => x !== v.id) : [...p.attributeValueIds, v.id])} className={cn("cursor-pointer rounded-md border px-2.5 py-1 text-xs", on ? "border-primary bg-primary/12 font-bold text-primary" : "border-border hover:bg-surface-2")}>{v.value}</button>; })}</div></div>
            ))}</div>
          </Card>
        )}

        <Card>
          <h2 className="mb-3 text-sm font-black">مدل‌های گوشی سازگار</h2>
          <div className="max-h-56 space-y-3 overflow-y-auto">
            {[...new Set(phoneModels.map((m) => m.brand))].map((g) => (
              <div key={g}><div className="mb-1 text-xs font-bold text-muted">{g}</div>
                <div className="flex flex-wrap gap-1.5">{phoneModels.filter((m) => m.brand === g).map((m) => { const on = p.phoneModelIds.includes(m.value); return <button type="button" key={m.value} aria-pressed={on} onClick={() => set("phoneModelIds", on ? p.phoneModelIds.filter((x) => x !== m.value) : [...p.phoneModelIds, m.value])} className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors", on ? "border-primary bg-primary text-primary-fg" : "border-border hover:border-primary")}>{m.label}</button>; })}</div></div>
            ))}
          </div>
        </Card>

        <Card className="grid gap-3 sm:grid-cols-2">
          <h2 className="text-sm font-black sm:col-span-2">سئو</h2>
          <Label label="عنوان سئو"><input className={inputCls} value={p.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} /></Label>
          <Label label="Canonical"><input dir="ltr" className={inputCls} value={p.canonical} onChange={(e) => set("canonical", e.target.value)} /></Label>
          <Label label="توضیحات سئو" className="sm:col-span-2"><textarea className={cn(inputCls, "h-20 py-2")} value={p.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} /></Label>
        </Card>
      </fieldset>

      {p.history && p.history.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-black">تاریخچه قیمت</h2>
          <ul className="divide-y divide-border text-sm">{p.history.map((h) => <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5"><Pill tone={h.type === "retail" ? "info" : "warn"}>{h.type === "retail" ? "خرده" : "عمده"}</Pill><span>{fmtToman(h.oldPrice)} ← <b>{fmtToman(h.newPrice)}</b></span><span className="text-xs text-muted">{fmtDate(h.createdAt)}</span></li>)}</ul>
        </Card>
      )}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
        <Link href="/admin/products" className={btnGhost}>بازگشت</Link>
        <div className="flex gap-2">
          {!isNew && canDelete && <button type="button" className={btnDanger} onClick={del}><Trash2 className="size-4" />حذف</button>}
          {canWrite && <button className={btnPrimary} disabled={busy}>{busy ? "در حال ذخیره…" : isNew ? "ایجاد محصول" : "ذخیره تغییرات"}</button>}
        </div>
      </div>
    </form>
  );
}

/** Searchable multi-select with chips: any number of options can be ticked (used for extra categories/brands). */
function MultiPick({ value, onChange, options, placeholder }: { value: string[]; onChange: (v: string[]) => void; options: { value: string; label: string }[]; placeholder: string }) {
  const [q, setQ] = useState("");
  const chosen = options.filter((o) => value.includes(o.value));
  const shown = options.filter((o) => !q.trim() || o.label.includes(q.trim()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="space-y-2">
      {chosen.length > 0 && <div className="flex flex-wrap gap-1.5">{chosen.map((o) => <button type="button" key={o.value} onClick={() => toggle(o.value)} aria-label={`حذف ${o.label}`} className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-bold text-primary">{o.label} ✕</button>)}</div>}
      <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border p-1.5">
        {shown.length === 0 && <p className="p-1 text-xs text-muted">موردی پیدا نشد.</p>}
        {shown.map((o) => <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-surface-2"><input type="checkbox" className="accent-[var(--primary)]" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />{o.label}</label>)}
      </div>
    </div>
  );
}
