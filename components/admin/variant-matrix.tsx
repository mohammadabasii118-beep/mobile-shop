"use client";
import { useMemo, useState } from "react";
import { Check, Layers, Pencil, Search, Trash2, Wand2, X } from "lucide-react";
import { Card, Label, Modal, Pill, btnDanger, btnGhost, btnPrimary, confirmAsk, fmtNum, inputCls } from "@/components/admin/kit";
import type { ProductData, Variant } from "@/components/admin/product-form";
import { cn } from "@/lib/utils";

export interface ModelOpt { value: string; label: string; slug: string; brandId: string; brand: string; seriesId: string | null; series: string | null }
export interface ColorOpt { value: string; label: string; hex: string | null }

const chipOn = "border-primary bg-primary/12 font-bold text-primary";
const chipOff = "border-border hover:bg-surface-2";
const small = "h-8 rounded-md border border-border bg-surface px-2 text-xs";
const PAGE = 25;
const MAX_VARIANTS = 600; // same cap as the API
let counter = 0;
const newKey = () => `n${Date.now().toString(36)}${counter++}`;
const kOf = (v: Variant, i: number) => v.id ?? v._k ?? `i${i}`;

type PriceOp = "set" | "inc" | "dec" | "incPct" | "decPct" | "clear";
type SaleOp = "set" | "pctBelow" | "clear";

/**
 * Variant section of the product form (variable products): pick models and colours, generate the combinations (inactive
 * by default), and manage every variant in one matrix. All edits stay in the form until «ذخیره محصول»; the server validates and saves them atomically.
 */
export function VariantMatrix({ p, setVariants, models, colors, canPrice, canCost, canStock, ro }: {
  p: ProductData; setVariants: (f: (v: Variant[]) => Variant[]) => void; models: ModelOpt[]; colors: ColorOpt[];
  canPrice: boolean; canCost: boolean; canStock: boolean; ro: boolean;
}) {
  const vs = p.variants;
  const modelOf = useMemo(() => new Map(models.map((m) => [m.value, m])), [models]);
  const colorOf = useMemo(() => new Map(colors.map((c) => [c.value, c])), [colors]);
  const baseRetail = Number(p.retailPrice) || 0;

  /* ───── generator ───── */
  const [gm, setGm] = useState<Set<string>>(new Set());
  const [gc, setGc] = useState<Set<string>>(new Set());
  const [mq, setMq] = useState(""); const [mBrand, setMBrand] = useState(""); const [mSeries, setMSeries] = useState("");
  const brands = useMemo(() => [...new Map(models.map((m) => [m.brandId, m.brand])).entries()], [models]);
  const seriesList = useMemo(() => [...new Map(models.filter((m) => m.seriesId && (!mBrand || m.brandId === mBrand)).map((m) => [m.seriesId!, m.series!])).entries()], [models, mBrand]);
  const shownModels = models.filter((m) => (!mBrand || m.brandId === mBrand) && (!mSeries || m.seriesId === mSeries) && (!mq.trim() || `${m.label} ${m.brand} ${m.series ?? ""}`.toLowerCase().includes(mq.trim().toLowerCase())));
  const toggle = (s: Set<string>, id: string) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; };
  const existing = new Set(vs.map((v) => `${v.phoneModelId}|${v.colorId}`));
  const mList = [...gm], cList = gc.size ? [...gc] : [""];
  const wanted = gm.size ? mList.flatMap((m) => cList.map((c) => [m, c] as const)) : gc.size ? [...gc].map((c) => ["", c] as const) : [];
  const fresh = wanted.filter(([m, c]) => !existing.has(`${m}|${c}`));
  const room = MAX_VARIANTS - vs.length;
  const generate = () => {
    const base = (p.sku || "SKU").trim();
    const used = new Set(vs.map((v) => v.sku));
    const add = fresh.slice(0, Math.max(0, room)).map(([m, c]) => {
      const mo = modelOf.get(m); const ci = colors.findIndex((x) => x.value === c);
      let sku = [base, mo?.slug, c ? `c${ci + 1}` : ""].filter(Boolean).join("-"); let n = 2; const root = sku;
      while (used.has(sku)) sku = `${root}-${n++}`;
      used.add(sku);
      const v: Variant = { _k: newKey(), sku, name: "", phoneModelId: m, colorId: c, costPrice: "", pricingMode: p.pricingMode, color: "", colorHex: "", retailPrice: "", wholesalePrice: "", salePrice: "", imageUrl: "", isActive: false, stock: "0" };
      return v;
    });
    setVariants((o) => [...o, ...add]);
    setGm(new Set()); setGc(new Set());
  };

  /* ───── matrix state ───── */
  const [q, setQ] = useState(""); const [fBrand, setFBrand] = useState(""); const [fSeries, setFSeries] = useState(""); const [status, setStatus] = useState("all"); const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ price: string; priceOp: PriceOp; sale: string; saleOp: SaleOp; stock: string; prefix: string }>({ price: "", priceOp: "set", sale: "", saleOp: "set", stock: "", prefix: "" });
  const [note, setNote] = useState("");
  const label = (v: Variant) => `${modelOf.get(v.phoneModelId)?.label ?? ""} ${colorOf.get(v.colorId)?.label ?? v.color} ${v.name} ${v.sku}`.toLowerCase();
  const rows = vs.map((v, i) => ({ v, i, k: kOf(v, i) })).filter(({ v }) => {
    const m = modelOf.get(v.phoneModelId);
    return (!q.trim() || label(v).includes(q.trim().toLowerCase())) && (!fBrand || m?.brandId === fBrand) && (!fSeries || m?.seriesId === fSeries)
      && (status === "all" || (status === "active" ? v.isActive && Number(v.stock) > 0 : status === "inactive" ? !v.isActive : v.isActive && Number(v.stock) === 0));
  });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)); const cur = Math.min(page, pages - 1);
  const visible = rows.slice(cur * PAGE, cur * PAGE + PAGE);
  const targetKeys = new Set((sel.size ? rows.filter((r) => sel.has(r.k)) : rows).map((r) => r.k));
  const patchMany = (fn: (v: Variant, n: number) => Partial<Variant>) => setVariants((o) => { let n = 0; return o.map((v, i) => (targetKeys.has(kOf(v, i)) ? { ...v, ...fn(v, n++) } : v)); });
  const patchOne = (k: string, patch: Partial<Variant>) => setVariants((o) => o.map((v, i) => (kOf(v, i) === k ? { ...v, ...patch } : v)));
  const stockLocked = (v: Variant) => !!v.id && !canStock;
  const counts = { on: vs.filter((v) => v.isActive && Number(v.stock) > 0).length, out: vs.filter((v) => v.isActive && Number(v.stock) === 0).length, off: vs.filter((v) => !v.isActive).length };

  const applyPrice = () => {
    const x = Number(bulk.price); if (bulk.priceOp !== "clear" && (!Number.isFinite(x) || bulk.price === "" || x < 0)) { setNote("عدد معتبر وارد کنید."); return; }
    let skipped = 0;
    patchMany((v) => {
      if (v.pricingMode === "AUTOMATIC") { skipped++; return {}; }
      const cur = v.retailPrice === "" ? baseRetail : Number(v.retailPrice);
      const next = bulk.priceOp === "set" ? x : bulk.priceOp === "inc" ? cur + x : bulk.priceOp === "dec" ? cur - x : bulk.priceOp === "incPct" ? cur * (1 + x / 100) : cur * (1 - x / 100);
      return bulk.priceOp === "clear" ? { retailPrice: "" } : { retailPrice: String(Math.max(0, Math.round(next))) };
    });
    setNote(skipped ? `${fmtNum(skipped)} تنوع با قیمت خودکار دست نخورد.` : "");
  };
  const applySale = () => {
    const x = Number(bulk.sale); if (bulk.saleOp !== "clear" && (bulk.sale === "" || !Number.isFinite(x) || x < 0)) { setNote("عدد معتبر وارد کنید."); return; }
    patchMany((v) => {
      if (bulk.saleOp === "clear") return { salePrice: "" };
      const price = v.retailPrice === "" ? baseRetail : Number(v.retailPrice);
      return { salePrice: String(Math.max(0, Math.round(bulk.saleOp === "set" ? x : price * (1 - x / 100)))) };
    });
    setNote("");
  };
  const applyStock = () => { const x = Math.max(0, Math.floor(Number(bulk.stock))); if (bulk.stock === "" || !Number.isFinite(x)) return; let skipped = 0; patchMany((v) => { if (stockLocked(v)) { skipped++; return {}; } return { stock: String(x) }; }); setNote(skipped ? `${fmtNum(skipped)} تنوع بدون دسترسی موجودی دست نخورد.` : ""); };
  const removeSel = () => {
    if (!sel.size || !confirmAsk(`${sel.size} تنوع انتخاب‌شده حذف شود؟ (تنوع‌هایی که در سفارش‌ها بوده‌اند فقط غیرفعال می‌شوند.)`)) return;
    setVariants((o) => o.filter((v, i) => !sel.has(kOf(v, i)))); setSel(new Set());
  };
  const editing = edit ? vs.map((v, i) => ({ v, k: kOf(v, i) })).find((x) => x.k === edit) : null;
  const dis = ro;

  return (
    <div className="space-y-4" data-testid="variant-section">
      <Card className="space-y-3" data-testid="variant-generator">
        <h2 className="flex items-center gap-2 text-sm font-black"><Wand2 className="size-4" />ساخت Variantها از مدل گوشی و رنگ</h2>
        <p className="text-xs leading-6 text-muted">مدل‌ها و رنگ‌ها را انتخاب کنید؛ همهٔ ترکیب‌ها ساخته می‌شوند اما <b>غیرفعال</b> هستند تا خودتان فقط ترکیب‌های واقعی را فعال کنید. ترکیب‌های تکراری ساخته نمی‌شوند.</p>
        <fieldset disabled={dis} className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            <div className="text-xs font-bold">مدل‌های گوشی {gm.size > 0 && <span className="text-primary">({fmtNum(gm.size)} انتخاب)</span>}</div>
            <div className="flex flex-wrap gap-2">
              <span className="relative min-w-40 flex-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" /><input className={cn(inputCls, "h-9 ps-8 text-xs")} placeholder="جستجوی مدل…" value={mq} onChange={(e) => setMq(e.target.value)} aria-label="جستجوی مدل" /></span>
              <select className={cn(inputCls, "h-9 w-36 text-xs")} value={mBrand} onChange={(e) => { setMBrand(e.target.value); setMSeries(""); }} aria-label="برند"><option value="">همه برندها</option>{brands.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
              <select className={cn(inputCls, "h-9 w-36 text-xs")} value={mSeries} onChange={(e) => setMSeries(e.target.value)} aria-label="سری"><option value="">همه سری‌ها</option>{seriesList.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
              <button type="button" className={cn(btnGhost, "h-9 px-3 text-xs")} onClick={() => setGm((s) => new Set([...s, ...shownModels.map((m) => m.value)]))}>انتخاب همه نتایج</button>
              {gm.size > 0 && <button type="button" className={cn(btnGhost, "h-9 px-3 text-xs")} onClick={() => setGm(new Set())}>پاک کردن</button>}
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2" data-testid="model-chips">
              {shownModels.length === 0 && <p className="p-1 text-xs text-muted">مدلی پیدا نشد.</p>}
              {[...new Set(shownModels.map((m) => `${m.brand}${m.series ? ` › ${m.series}` : ""}`))].map((g) => (
                <div key={g} className="mb-2"><div className="mb-1 text-[11px] font-bold text-muted">{g}</div>
                  <div className="flex flex-wrap gap-1.5">{shownModels.filter((m) => `${m.brand}${m.series ? ` › ${m.series}` : ""}` === g).map((m) => <button type="button" key={m.value} aria-pressed={gm.has(m.value)} onClick={() => setGm((s) => toggle(s, m.value))} className={cn("cursor-pointer rounded-md border px-2.5 py-1 text-xs", gm.has(m.value) ? chipOn : chipOff)}>{m.label}</button>)}</div></div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-bold">رنگ‌ها {gc.size > 0 && <span className="text-primary">({fmtNum(gc.size)} انتخاب)</span>}</div>
            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border p-2" data-testid="color-chips">
              {colors.length === 0 && <p className="p-1 text-xs text-muted">رنگی تعریف نشده است.</p>}
              {colors.map((c) => <button type="button" key={c.value} aria-pressed={gc.has(c.value)} onClick={() => setGc((s) => toggle(s, c.value))} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs", gc.has(c.value) ? chipOn : chipOff)}>{c.hex && <span className="size-3 rounded-full border border-border" style={{ background: c.hex }} />}{c.label}</button>)}
            </div>
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" data-testid="generate" className={btnPrimary} disabled={dis || fresh.length === 0 || room <= 0} onClick={generate}><Wand2 className="size-4" />ساخت {fmtNum(Math.min(fresh.length, Math.max(0, room)))} Variant (غیرفعال)</button>
          <span className="text-xs text-muted">{wanted.length ? `${fmtNum(wanted.length)} ترکیب انتخاب شده، ${fmtNum(wanted.length - fresh.length)} از قبل وجود دارد.` : "مدل یا رنگ انتخاب کنید."}{room < fresh.length && ` (سقف ${fmtNum(MAX_VARIANTS)} Variant برای هر محصول)`}</span>
        </div>
      </Card>

      <Card className="space-y-3" data-testid="matrix">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-black"><Layers className="size-4" />Variant Matrix <span className="text-xs font-normal text-muted">{fmtNum(vs.length)} Variant</span></h2>
          <span className="flex flex-wrap items-center gap-2"><Pill tone="ok">موجود: {fmtNum(counts.on)}</Pill><Pill tone="warn">ناموجود: {fmtNum(counts.out)}</Pill><Pill tone="mute">غیرفعال: {fmtNum(counts.off)}</Pill></span>
        </div>
        {vs.length === 0 && <p className="rounded-lg bg-surface-2 p-4 text-center text-xs text-muted">هنوز Variantای ساخته نشده؛ بالا مدل و رنگ را انتخاب و «ساخت Variant» را بزنید.</p>}
        {vs.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input className={cn(inputCls, "h-9 max-w-52 text-xs")} placeholder="فیلتر در جدول…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="فیلتر جدول" />
              <select className={cn(inputCls, "h-9 w-36 text-xs")} value={fBrand} onChange={(e) => { setFBrand(e.target.value); setFSeries(""); setPage(0); }} aria-label="فیلتر برند"><option value="">همه برندها</option>{[...new Map(vs.map((v) => modelOf.get(v.phoneModelId)).filter((m): m is ModelOpt => !!m).map((m) => [m.brandId, m.brand])).entries()].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
              <select className={cn(inputCls, "h-9 w-36 text-xs")} value={fSeries} onChange={(e) => { setFSeries(e.target.value); setPage(0); }} aria-label="فیلتر سری"><option value="">همه سری‌ها</option>{[...new Map(vs.map((v) => modelOf.get(v.phoneModelId)).filter((m): m is ModelOpt => !!m && !!m.seriesId && (!fBrand || m.brandId === fBrand)).map((m) => [m.seriesId!, m.series!])).entries()].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
              <select className={cn(inputCls, "h-9 w-36 text-xs")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="فیلتر وضعیت"><option value="all">همه وضعیت‌ها</option><option value="active">موجود</option><option value="out">ناموجود</option><option value="inactive">غیرفعال</option></select>
              <span className="text-muted">{fmtNum(rows.length)} نتیجه</span>
            </div>
            {!ro && (
              <div className="space-y-2 rounded-lg bg-surface-2 p-2 text-xs" data-testid="bulk-bar">
                <b>ویرایش گروهی روی {sel.size ? `${fmtNum(sel.size)} ردیف انتخاب‌شده` : `همهٔ ${fmtNum(rows.length)} نتیجه`}:</b>
                <div className="flex flex-wrap items-end gap-2">
                  <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} data-testid="bulk-on" onClick={() => patchMany(() => ({ isActive: true }))}><Check className="size-3.5" />فعال</button>
                  <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} data-testid="bulk-off" onClick={() => patchMany(() => ({ isActive: false }))}><X className="size-3.5" />غیرفعال</button>
                  <label>موجودی<input dir="ltr" type="number" min={0} className={cn(small, "block w-20")} value={bulk.stock} onChange={(e) => setBulk({ ...bulk, stock: e.target.value })} aria-label="موجودی گروهی" /></label>
                  <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} disabled={bulk.stock === ""} onClick={applyStock}>اعمال موجودی</button>
                  <label>پیشوند SKU<input dir="ltr" className={cn(small, "block w-28")} value={bulk.prefix} onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })} /></label>
                  <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} disabled={!bulk.prefix} onClick={() => patchMany((_, n) => ({ sku: `${bulk.prefix}-${n + 1}` }))}>اعمال SKU</button>
                </div>
                {canPrice && (
                  <div className="flex flex-wrap items-end gap-2">
                    <label>قیمت<select className={cn(small, "block")} value={bulk.priceOp} onChange={(e) => setBulk({ ...bulk, priceOp: e.target.value as PriceOp })} aria-label="عملیات قیمت"><option value="set">تعیین قیمت</option><option value="inc">افزایش مبلغ ثابت</option><option value="dec">کاهش مبلغ ثابت</option><option value="incPct">افزایش درصدی</option><option value="decPct">کاهش درصدی</option><option value="clear">حذف قیمت اختصاصی (قیمت پایه)</option></select></label>
                    {bulk.priceOp !== "clear" && <input dir="ltr" type="number" min={0} className={cn(small, "w-28")} value={bulk.price} onChange={(e) => setBulk({ ...bulk, price: e.target.value })} aria-label="مقدار قیمت گروهی" />}
                    <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} data-testid="bulk-price" onClick={applyPrice}>اعمال قیمت</button>
                    <label>قیمت فروش ویژه<select className={cn(small, "block")} value={bulk.saleOp} onChange={(e) => setBulk({ ...bulk, saleOp: e.target.value as SaleOp })} aria-label="عملیات قیمت ویژه"><option value="set">تعیین قیمت</option><option value="pctBelow">درصد کمتر از قیمت</option><option value="clear">حذف قیمت ویژه</option></select></label>
                    {bulk.saleOp !== "clear" && <input dir="ltr" type="number" min={0} className={cn(small, "w-28")} value={bulk.sale} onChange={(e) => setBulk({ ...bulk, sale: e.target.value })} aria-label="مقدار قیمت ویژه گروهی" />}
                    <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} data-testid="bulk-sale" onClick={applySale}>اعمال قیمت ویژه</button>
                  </div>
                )}
                {sel.size > 0 && <button type="button" className={cn(btnDanger, "h-8 px-3 text-xs")} onClick={removeSel}><Trash2 className="size-3.5" />حذف {fmtNum(sel.size)} ردیف انتخاب‌شده</button>}
                {note && <p className="font-bold text-warning" role="status">{note}</p>}
                <p className="text-[11px] text-muted">تغییرات تا زدن «ذخیره تغییرات» اعمال نمی‌شود و در ذخیره، سرور همه را دوباره اعتبارسنجی می‌کند. قیمت خالی = قیمت پایهٔ محصول{p.retailPrice ? ` (${fmtNum(baseRetail)} تومان)` : ""}. ردیف‌هایی که قیمت خودکار دارند با عملیات قیمت گروهی تغییر نمی‌کنند.</p>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[980px] text-xs"><thead className="bg-surface-2 text-muted"><tr>
                <th className="p-2"><input type="checkbox" aria-label="انتخاب صفحه" className="size-4 accent-[var(--primary)]" checked={visible.length > 0 && visible.every((r) => sel.has(r.k))} onChange={(e) => setSel((s) => { const n = new Set(s); for (const r of visible) { if (e.target.checked) n.add(r.k); else n.delete(r.k); } return n; })} /></th>
                <th className="p-2 text-start">مدل</th><th className="p-2 text-start">رنگ</th><th className="p-2 text-start">SKU</th><th className="p-2 text-start">قیمت (خالی = پایه)</th><th className="p-2 text-start">قیمت فروش ویژه</th><th className="p-2 text-start">موجودی</th><th className="p-2 text-start">تصویر</th><th className="p-2 text-start">وضعیت</th><th className="p-2" /></tr></thead>
                <tbody className="divide-y divide-border/60">{visible.map(({ v, k }) => {
                  const m = modelOf.get(v.phoneModelId); const c = colorOf.get(v.colorId);
                  return (
                    <tr key={k} data-testid="vrow" className={cn(!v.isActive && "opacity-60")}>
                      <td className="p-2"><input type="checkbox" aria-label="انتخاب" className="size-4 accent-[var(--primary)]" checked={sel.has(k)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(k); else n.delete(k); return n; })} /></td>
                      <td className="p-2 font-bold">{m ? <>{m.label}<span className="block text-[10px] font-normal text-muted">{m.brand}{m.series ? ` › ${m.series}` : ""}</span></> : <span className="text-muted">{v.name || "—"}</span>}</td>
                      <td className="p-2 font-bold"><span className="inline-flex items-center gap-1.5">{(c?.hex ?? v.colorHex) && <span className="size-3 rounded-full border border-border" style={{ background: c?.hex ?? v.colorHex }} />}{c?.label ?? (v.color || <span className="font-normal text-muted">—</span>)}</span></td>
                      <td className="p-2"><input dir="ltr" className={cn(small, "w-36")} value={v.sku} disabled={ro} onChange={(e) => patchOne(k, { sku: e.target.value })} aria-label="SKU" /></td>
                      <td className="p-2"><input dir="ltr" type="number" min={0} className={cn(small, "w-28")} placeholder={p.retailPrice || "—"} disabled={ro || !canPrice || v.pricingMode === "AUTOMATIC"} value={v.retailPrice} onChange={(e) => patchOne(k, { retailPrice: e.target.value })} aria-label="قیمت" title={v.pricingMode === "AUTOMATIC" ? "قیمت خودکار: از هزینه خرید و قانون سود محاسبه می‌شود" : undefined} /></td>
                      <td className="p-2"><input dir="ltr" type="number" min={0} className={cn(small, "w-28")} disabled={ro || !canPrice} value={v.salePrice} onChange={(e) => patchOne(k, { salePrice: e.target.value })} aria-label="قیمت فروش ویژه" /></td>
                      <td className="p-2"><input dir="ltr" type="number" min={0} className={cn(small, "w-20", Number(v.stock) === 0 && "border-warning")} disabled={ro || stockLocked(v)} value={v.stock} onChange={(e) => patchOne(k, { stock: e.target.value })} aria-label="موجودی" /></td>
                      <td className="p-2"><span className="flex items-center gap-1.5">{v.imageUrl && <img src={v.imageUrl} alt="" className="size-7 rounded object-cover" />}<select className={cn(small, "w-28")} disabled={ro} value={v.imageUrl} onChange={(e) => patchOne(k, { imageUrl: e.target.value })} aria-label="تصویر"><option value="">تصویر محصول</option>{p.images.map((im, n) => <option key={im.url} value={im.url}>تصویر {fmtNum(n + 1)}</option>)}</select></span></td>
                      <td className="p-2"><label className="inline-flex cursor-pointer items-center gap-1.5"><input type="checkbox" aria-label="فعال" className="size-4 accent-[var(--primary)]" disabled={ro} checked={v.isActive} onChange={(e) => patchOne(k, { isActive: e.target.checked })} /><span className={v.isActive ? (Number(v.stock) > 0 ? "font-bold text-success" : "font-bold text-warning") : "text-muted"}>{v.isActive ? (Number(v.stock) > 0 ? "✓ فعال" : "✓ فعال · ناموجود") : "× غیرفعال"}</span></label></td>
                      <td className="p-2"><button type="button" aria-label="ویرایش" className="cursor-pointer rounded p-1 hover:bg-surface-2" onClick={() => setEdit(k)}><Pencil className="size-4" /></button></td>
                    </tr>);
                })}</tbody></table>
            </div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted">صفحه {fmtNum(cur + 1)} از {fmtNum(pages)}</span><span className="flex gap-1"><button type="button" className={cn(btnGhost, "h-8 px-3 text-xs")} disabled={cur === 0} onClick={() => setPage(cur - 1)}>قبلی</button><button type="button" className={cn(btnGhost, "h-8 px-3 text-xs")} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>بعدی</button></span></div>
          </>
        )}
        {p.images.length === 0 && vs.length > 0 && <p className="text-[11px] text-muted">برای انتخاب تصویر اختصاصی، ابتدا تصاویر محصول را اضافه کنید (برای محصول ذخیره‌شده، پس از تغییر تصاویر صفحه را تازه کنید).</p>}
      </Card>

      {editing && (
        <Modal title={`ویرایش Variant — ${editing.v.sku}`} onClose={() => setEdit(null)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label label="نام نمایشی" hint="خالی = خودکار از مدل و رنگ"><input className={inputCls} value={editing.v.name} disabled={ro} onChange={(e) => patchOne(editing.k, { name: e.target.value })} /></Label>
            <Label label="SKU"><input dir="ltr" className={inputCls} value={editing.v.sku} disabled={ro} onChange={(e) => patchOne(editing.k, { sku: e.target.value })} /></Label>
            {!editing.v.colorId && <Label label="رنگ (متن آزاد)"><input className={inputCls} value={editing.v.color} disabled={ro} onChange={(e) => patchOne(editing.k, { color: e.target.value })} /></Label>}
            {!editing.v.colorId && <Label label="کد رنگ"><input dir="ltr" className={inputCls} placeholder="#000000" value={editing.v.colorHex} disabled={ro} onChange={(e) => patchOne(editing.k, { colorHex: e.target.value })} /></Label>}
            <Label label="روش قیمت"><select className={inputCls} disabled={!canPrice} value={editing.v.pricingMode} onChange={(e) => patchOne(editing.k, { pricingMode: e.target.value as "AUTOMATIC" | "MANUAL" })}><option value="MANUAL">دستی</option><option value="AUTOMATIC">خودکار</option></select></Label>
            {canCost && <Label label="هزینه خرید"><input dir="ltr" type="number" min={0} className={inputCls} disabled={!canPrice} value={editing.v.costPrice} onChange={(e) => patchOne(editing.k, { costPrice: e.target.value })} /></Label>}
            <Label label={editing.v.pricingMode === "AUTOMATIC" ? "قیمت محاسبه‌شده" : "قیمت خرده (خالی = قیمت پایه)"}><input dir="ltr" type="number" min={0} className={inputCls} disabled={ro || !canPrice || editing.v.pricingMode === "AUTOMATIC"} value={editing.v.retailPrice} onChange={(e) => patchOne(editing.k, { retailPrice: e.target.value })} /></Label>
            <Label label="قیمت فروش ویژه" hint="باید کمتر از قیمت باشد؛ با تخفیف‌های دیگر، بهترین یکی اعمال می‌شود"><input dir="ltr" type="number" min={0} className={inputCls} disabled={ro || !canPrice} value={editing.v.salePrice} onChange={(e) => patchOne(editing.k, { salePrice: e.target.value })} /></Label>
            <Label label="قیمت عمده (اختیاری)"><input dir="ltr" type="number" min={0} className={inputCls} disabled={ro || !canPrice} value={editing.v.wholesalePrice} onChange={(e) => patchOne(editing.k, { wholesalePrice: e.target.value })} /></Label>
            <Label label="موجودی"><input dir="ltr" type="number" min={0} className={inputCls} disabled={ro || stockLocked(editing.v)} value={editing.v.stock} onChange={(e) => patchOne(editing.k, { stock: e.target.value })} /></Label>
            <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" disabled={ro} checked={editing.v.isActive} onChange={(e) => patchOne(editing.k, { isActive: e.target.checked })} />فعال (قابل خرید)</label>
          </div>
          <div className="mt-4 flex justify-end"><button type="button" className={btnPrimary} onClick={() => setEdit(null)}>بستن</button></div>
        </Modal>
      )}
    </div>
  );
}
