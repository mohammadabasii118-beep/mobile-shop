"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Card, ImageInput, Label, Pill, act, btnDanger, btnGhost, btnPrimary, confirmAsk, fmtDate, fmtNum, fmtToman, inputCls } from "@/components/admin/kit";
import { toFormData } from "@/lib/admin/product-map";
import type { Opt } from "@/components/admin/resource-manager";
import { cn } from "@/lib/utils";

interface Variant { id?: string; sku: string; name: string; color: string; colorHex: string; retailPrice: string; wholesalePrice: string; isActive: boolean; stock: string; current?: number }
export interface ProductData {
  id?: string; name: string; slug: string; sku: string; brandId: string; categoryId: string; shortDescription: string; description: string; badge: string; isActive: boolean;
  retailPrice: string; retailDiscount: string; wholesalePrice: string; wholesaleDiscount: string; minWholesaleQty: string; seoTitle: string; seoDescription: string; canonical: string;
  phoneModelIds: string[]; images: { url: string; alt: string }[]; variants: Variant[];
  history?: { id: string; type: string; oldPrice: number; newPrice: number; createdAt: string }[];
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function ProductForm({ initial, categories, brands, phoneModels, canWrite, canDelete, canStock }: { initial: ProductData; categories: Opt[]; brands: Opt[]; phoneModels: (Opt & { group: string })[]; canWrite: boolean; canDelete: boolean; canStock: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const isNew = !p.id;
  const set = <K extends keyof ProductData>(k: K, v: ProductData[K]) => setP((o) => ({ ...o, [k]: v }));
  const setV = (i: number, patch: Partial<Variant>) => set("variants", p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const moveImg = (i: number, d: -1 | 1) => { const a = [...p.images]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j]!, a[i]!]; set("images", a); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErrs({});
    const body = {
      name: p.name, slug: p.slug, sku: p.sku, brandId: p.brandId || null, categoryId: p.categoryId, shortDescription: p.shortDescription, description: p.description, badge: p.badge, isActive: p.isActive,
      retailPrice: Number(p.retailPrice), retailDiscount: Number(p.retailDiscount || 0), wholesalePrice: num(p.wholesalePrice), wholesaleDiscount: Number(p.wholesaleDiscount || 0), minWholesaleQty: Number(p.minWholesaleQty || 1),
      seoTitle: p.seoTitle, seoDescription: p.seoDescription, canonical: p.canonical, phoneModelIds: p.phoneModelIds, images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
      variants: p.variants.map((v) => ({ ...(v.id ? { id: v.id } : {}), sku: v.sku, name: v.name, color: v.color, colorHex: v.colorHex, retailPrice: num(v.retailPrice), wholesalePrice: num(v.wholesalePrice), isActive: v.isActive, ...(v.id ? {} : { stock: Number(v.stock || 0) }) })),
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
          <Label label="توضیح کوتاه" className="sm:col-span-2"><input className={inputCls} value={p.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} /></Label>
          <Label label="توضیحات" className="sm:col-span-2"><textarea className={cn(inputCls, "h-28 py-2")} value={p.description} onChange={(e) => set("description", e.target.value)} /></Label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={p.isActive} onChange={(e) => set("isActive", e.target.checked)} />محصول فعال (نمایش در سایت)</label>
        </Card>

        <Card className="grid gap-3 sm:grid-cols-3">
          <h2 className="text-sm font-black sm:col-span-3">قیمت‌گذاری <span className="text-[11px] font-normal text-muted">(قیمت خرده و عمده کاملاً جدا هستند — تومان)</span></h2>
          <Label label="قیمت خرده *" error={errs.retailPrice}><input dir="ltr" type="number" min={0} className={inputCls} value={p.retailPrice} onChange={(e) => set("retailPrice", e.target.value)} required /></Label>
          <Label label="تخفیف خرده (مبلغ)" hint={p.retailPrice ? `قیمت نهایی: ${fmtToman(Number(p.retailPrice) - Number(p.retailDiscount || 0))}` : undefined}><input dir="ltr" type="number" min={0} className={inputCls} value={p.retailDiscount} onChange={(e) => set("retailDiscount", e.target.value)} /></Label>
          <span />
          <Label label="قیمت عمده" hint="خالی = این محصول عمده ندارد" error={errs.wholesalePrice}><input dir="ltr" type="number" min={0} className={inputCls} value={p.wholesalePrice} onChange={(e) => set("wholesalePrice", e.target.value)} /></Label>
          <Label label="تخفیف عمده (مبلغ)"><input dir="ltr" type="number" min={0} className={inputCls} value={p.wholesaleDiscount} onChange={(e) => set("wholesaleDiscount", e.target.value)} /></Label>
          <Label label="حداقل تعداد برای قیمت عمده"><input dir="ltr" type="number" min={1} className={inputCls} value={p.minWholesaleQty} onChange={(e) => set("minWholesaleQty", e.target.value)} /></Label>
          <p className="text-[11px] leading-6 text-muted sm:col-span-3">قیمت عمده فقط برای همکار تأییدشده با سطح فعال و تعداد ≥ حداقل اعمال می‌شود؛ حداقل سفارش هر سطح در بخش «همکاران عمده» تنظیم می‌شود. هر تغییر قیمت در تاریخچه قیمت ثبت می‌شود.</p>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-black">تصاویر <span className="text-[11px] font-normal text-muted">(اولی تصویر اصلی است)</span></h2>
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
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">تنوع‌ها و موجودی</h2>
            <button type="button" className={cn(btnGhost, "h-8 px-3 text-xs")} onClick={() => set("variants", [...p.variants, { sku: "", name: "", color: "", colorHex: "", retailPrice: "", wholesalePrice: "", isActive: true, stock: "0" }])}><Plus className="size-4" />تنوع جدید</button></div>
          <div className="space-y-3">
            {p.variants.map((v, i) => (
              <div key={v.id ?? i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                <Label label="نام تنوع *" className="sm:col-span-2"><input className={inputCls} value={v.name} onChange={(e) => setV(i, { name: e.target.value })} required /></Label>
                <Label label="SKU *" className="sm:col-span-2" error={errs[`variants.${i}.sku`]}><input dir="ltr" className={inputCls} value={v.sku} onChange={(e) => setV(i, { sku: e.target.value })} required /></Label>
                <Label label="رنگ"><input className={inputCls} value={v.color} onChange={(e) => setV(i, { color: e.target.value })} /></Label>
                <Label label="کد رنگ"><input dir="ltr" className={inputCls} placeholder="#000000" value={v.colorHex} onChange={(e) => setV(i, { colorHex: e.target.value })} /></Label>
                <Label label="قیمت خرده (اختیاری)" className="sm:col-span-2"><input dir="ltr" type="number" min={0} className={inputCls} value={v.retailPrice} onChange={(e) => setV(i, { retailPrice: e.target.value })} /></Label>
                <Label label="قیمت عمده (اختیاری)" className="sm:col-span-2"><input dir="ltr" type="number" min={0} className={inputCls} value={v.wholesalePrice} onChange={(e) => setV(i, { wholesalePrice: e.target.value })} /></Label>
                {v.id ? (
                  <div className="flex items-end gap-2 sm:col-span-2 text-xs"><Pill tone={(v.current ?? 0) === 0 ? "bad" : "ok"}>موجودی: {fmtNum(v.current ?? 0)}</Pill>{canStock && <Link href={`/admin/inventory?q=${encodeURIComponent(v.sku)}`} className="font-bold text-primary">تنظیم موجودی</Link>}</div>
                ) : <Label label="موجودی اولیه" className="sm:col-span-2"><input dir="ltr" type="number" min={0} className={inputCls} value={v.stock} onChange={(e) => setV(i, { stock: e.target.value })} /></Label>}
                <div className="flex items-end justify-between gap-2 sm:col-span-6">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={v.isActive} onChange={(e) => setV(i, { isActive: e.target.checked })} />فعال</label>
                  {p.variants.length > 1 && <button type="button" className={cn(btnDanger, "h-8 px-3 text-xs")} onClick={() => set("variants", p.variants.filter((_, j) => j !== i))}><Trash2 className="size-4" />حذف تنوع</button>}
                </div>
              </div>
            ))}
          </div>
          {errs.variants && <p className="mt-2 text-xs font-bold text-error">{errs.variants}</p>}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-black">مدل‌های گوشی سازگار</h2>
          <div className="max-h-56 space-y-3 overflow-y-auto">
            {[...new Set(phoneModels.map((m) => m.group))].map((g) => (
              <div key={g}><div className="mb-1 text-xs font-bold text-muted">{g}</div>
                <div className="flex flex-wrap gap-1.5">{phoneModels.filter((m) => m.group === g).map((m) => { const on = p.phoneModelIds.includes(m.value); return <button type="button" key={m.value} aria-pressed={on} onClick={() => set("phoneModelIds", on ? p.phoneModelIds.filter((x) => x !== m.value) : [...p.phoneModelIds, m.value])} className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors", on ? "border-primary bg-primary text-primary-fg" : "border-border hover:border-primary")}>{m.label}</button>; })}</div></div>
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
