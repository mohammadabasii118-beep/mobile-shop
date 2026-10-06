"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ImagePlus, Layers, Minus, Plus, Search, Trash2, Wand2, X } from "lucide-react";
import { Card, Pill, btnDanger, btnGhost, btnPrimary, inputCls } from "@/components/admin/kit";
import { COLORS, combos, initialAttrs, initialProduct, vkey, type Attr, type AttrUse, type Product, type Val, type Variant } from "@/components/admin/variants-demo/data";
import { cn } from "@/lib/utils";

const fa = (n: number) => n.toLocaleString("fa-IR");
const toman = (n: number) => `${fa(n)} تومان`;
const chipOn = "border-primary bg-primary/12 font-bold text-primary";
const chipOff = "border-border hover:bg-surface-2";
const small = "h-8 rounded-md border border-border bg-surface px-2 text-xs";

type Tab = "attrs" | "product" | "store";

export function VariantsDemo() {
  const [tab, setTab] = useState<Tab>("product");
  const [attrs, setAttrs] = useState<Attr[]>(initialAttrs);
  const [p, setP] = useState<Product>(initialProduct);
  const reset = () => { setAttrs(initialAttrs()); setP(initialProduct()); };
  const TABS: [Tab, string][] = [["attrs", "۱) مدیریت Attributeها (مرکزی)"], ["product", "۲) ویرایش محصول + ماتریس"], ["store", "۳) صفحه محصول (مشتری)"]];
  return (
    <div className="space-y-4" data-testid="variants-demo">
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs leading-6">
        <b>نمونه‌ی نمایشی (Prototype):</b> همه‌ی داده‌ها ساختگی‌اند و فقط داخل همین صفحه می‌مانند؛ هیچ‌چیز در دیتابیس ذخیره نمی‌شود و محصولات و تنوع‌های واقعی دست نمی‌خورند.
        <button type="button" onClick={reset} className="ms-3 cursor-pointer font-bold text-primary underline">بازنشانی دمو</button>
      </div>
      <div className="flex flex-wrap gap-1 rounded-lg bg-surface p-1 shadow-sm" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("h-10 cursor-pointer rounded-md px-4 text-sm", tab === k ? "bg-primary font-bold text-primary-fg" : "text-muted hover:bg-surface-2")}>{l}</button>)}
      </div>
      {tab === "attrs" && <AttributesTab attrs={attrs} setAttrs={setAttrs} />}
      {tab === "product" && <ProductTab attrs={attrs} p={p} setP={setP} />}
      {tab === "store" && <StoreTab attrs={attrs} p={p} />}
    </div>
  );
}

/* ───────────────────────── 1) central attributes ───────────────────────── */
function AttributesTab({ attrs, setAttrs }: { attrs: Attr[]; setAttrs: (f: (a: Attr[]) => Attr[]) => void }) {
  const [sel, setSel] = useState("model");
  const a = attrs.find((x) => x.key === sel)!;
  const patch = (fn: (vals: Val[]) => Val[]) => setAttrs((all) => all.map((x) => (x.key === sel ? { ...x, values: fn(x.values) } : x)));
  const [draft, setDraft] = useState({ label: "", brand: "Apple", series: "", hex: "#9ca3af" });
  const brands = [...new Set(attrs[0]!.values.map((v) => v.brand!))];
  const add = () => {
    const label = draft.label.trim(); if (!label) return;
    const id = "n" + Date.now();
    patch((v) => [...v, a.kind === "model" ? { id, label, brand: draft.brand, series: draft.series.trim() || label, active: true } : a.kind === "color" ? { id, label, hex: draft.hex, active: true } : { id, label, active: true }]);
    setDraft({ ...draft, label: "" });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card className="space-y-1">
        <h2 className="mb-2 text-sm font-black">Attributeها</h2>
        {attrs.map((x) => <button key={x.key} onClick={() => setSel(x.key)} className={cn("flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm", sel === x.key ? "bg-primary/12 font-bold text-primary" : "hover:bg-surface-2")}><span>{x.name}</span><Pill tone="mute">{fa(x.values.length)}</Pill></button>)}
        <p className="pt-2 text-[11px] leading-5 text-muted">هر Attribute یک‌بار تعریف می‌شود و همه‌ی محصولات از همان مقادیر استفاده می‌کنند. «مدل گوشی» و «رنگ» همان موجودی‌های فعلی سایت‌اند.</p>
      </Card>
      <Card className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-black">مقادیر «{a.name}»</h2><span className="text-xs text-muted">{fa(a.values.length)} مقدار</span></div>
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-2 p-2 text-xs" data-testid="attr-add">
          <label className="grow">مقدار جدید<input className={cn(inputCls, "h-9")} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder={a.kind === "model" ? "مثلاً Google Pixel 10" : "نام مقدار"} onKeyDown={(e) => e.key === "Enter" && add()} /></label>
          {a.kind === "model" && <><label>برند<select className={cn(inputCls, "h-9")} value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })}>{brands.map((b) => <option key={b}>{b}</option>)}</select></label>
            <label>سری<input className={cn(inputCls, "h-9 w-32")} value={draft.series} onChange={(e) => setDraft({ ...draft, series: e.target.value })} placeholder="Pixel" /></label></>}
          {a.kind === "color" && <label>کد رنگ<input type="color" className="block h-9 w-14 cursor-pointer rounded border border-border" value={draft.hex} onChange={(e) => setDraft({ ...draft, hex: e.target.value })} /></label>}
          <button type="button" className={cn(btnPrimary, "h-9 text-xs")} onClick={add}><Plus className="size-4" />افزودن</button>
        </div>
        <div className="max-h-[460px] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-xs"><thead className="sticky top-0 bg-surface-2 text-muted"><tr><th className="p-2 text-start">#</th><th className="p-2 text-start">نام</th>{a.kind === "model" && <><th className="p-2 text-start">برند</th><th className="p-2 text-start">سری</th></>}{a.kind === "color" && <th className="p-2 text-start">رنگ</th>}<th className="p-2 text-start">وضعیت</th><th className="p-2" /></tr></thead>
            <tbody className="divide-y divide-border/60">{a.values.map((v, i) => (
              <tr key={v.id} className={cn(!v.active && "opacity-50")}><td className="p-2 text-muted">{fa(i + 1)}</td><td className="p-2 font-bold">{v.label}</td>
                {a.kind === "model" && <><td className="p-2">{v.brand}</td><td className="p-2">{v.series}</td></>}
                {a.kind === "color" && <td className="p-2"><span className="inline-block size-5 rounded-full border border-border align-middle" style={{ background: v.hex }} /></td>}
                <td className="p-2"><label className="flex items-center gap-1.5"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={v.active} onChange={(e) => patch((all) => all.map((x) => (x.id === v.id ? { ...x, active: e.target.checked } : x)))} />{v.active ? "فعال" : "غیرفعال"}</label></td>
                <td className="p-2"><span className="flex justify-end gap-1"><button aria-label="بالا" className="cursor-pointer rounded p-1 hover:bg-surface-2" onClick={() => patch((all) => { const j = i - 1; if (j < 0) return all; const c = [...all]; [c[i], c[j]] = [c[j]!, c[i]!]; return c; })}><ArrowUp className="size-3.5" /></button>
                  <button aria-label="پایین" className="cursor-pointer rounded p-1 hover:bg-surface-2" onClick={() => patch((all) => { const j = i + 1; if (j >= all.length) return all; const c = [...all]; [c[i], c[j]] = [c[j]!, c[i]!]; return c; })}><ArrowDown className="size-3.5" /></button></span></td></tr>
            ))}</tbody></table>
        </div>
        <p className="text-[11px] text-muted">مثال: «Google Pixel 10» را اینجا اضافه کنید و به تب ۲ بروید؛ بدون ورود به تک‌تک محصولات، همان‌جا قابل انتخاب است.</p>
      </Card>
    </div>
  );
}

/* ───────────────────────── 2) product editor ───────────────────────── */
function ProductTab({ attrs, p, setP }: { attrs: Attr[]; p: Product; setP: (f: (p: Product) => Product) => void }) {
  const [addKey, setAddKey] = useState("");
  const [gen, setGen] = useState({ stock: "5", active: true });
  const used = attrs.filter((a) => p.use[a.key]?.enabled);
  const unused = attrs.filter((a) => !p.use[a.key]?.enabled);
  const varKeys = used.filter((a) => p.use[a.key]!.variations && p.use[a.key]!.values.length).map((a) => a.key);
  const planned = useMemo(() => combos(attrs, p.use), [attrs, p.use]);
  const have = new Set(p.variants.map((v) => vkey(v.sel, varKeys)));
  const fresh = planned.filter((c) => !have.has(vkey(c, varKeys)));
  const setUse = (key: string, patch: Partial<AttrUse>) => setP((o) => ({ ...o, use: { ...o.use, [key]: { ...(o.use[key] ?? { enabled: true, variations: true, values: [] }), ...patch } } }));
  const generate = () => setP((o) => ({ ...o, variants: [...o.variants, ...fresh.map((sel, i) => ({ id: "g" + Date.now() + i, sel, sku: `${o.skuPrefix}-${o.variants.length + i + 1}`, price: "", stock: Number(gen.stock) || 0, active: gen.active, image: false }))] }));
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-sm font-black">اطلاعات محصول</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs sm:col-span-3">نام محصول<input className={inputCls} value={p.name} onChange={(e) => setP((o) => ({ ...o, name: e.target.value }))} /></label>
          <label className="text-xs">قیمت پایه (تومان)<input dir="ltr" type="number" className={inputCls} value={p.basePrice} onChange={(e) => setP((o) => ({ ...o, basePrice: Number(e.target.value) || 0 }))} /></label>
          <label className="text-xs">پیشوند SKU<input dir="ltr" className={inputCls} value={p.skuPrefix} onChange={(e) => setP((o) => ({ ...o, skuPrefix: e.target.value }))} /></label>
          <div className="text-xs"><div className="mb-1">نوع محصول</div><div className="flex gap-4 pt-2">
            {([["simple", "محصول ساده"], ["variable", "محصول متغیر (Variable)"]] as const).map(([k, l]) => <label key={k} className="flex cursor-pointer items-center gap-1.5"><input type="radio" name="ptype" className="accent-[var(--primary)]" checked={p.type === k} onChange={() => setP((o) => ({ ...o, type: k }))} />{l}</label>)}</div></div>
        </div>
        {p.type === "simple" && <label className="block text-xs sm:w-56">موجودی<input dir="ltr" type="number" className={inputCls} value={p.simpleStock} onChange={(e) => setP((o) => ({ ...o, simpleStock: Number(e.target.value) || 0 }))} /></label>}
      </Card>

      {p.type === "variable" && (
        <>
          <Card className="space-y-3" data-testid="attr-card">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-black">Attributeهای این محصول</h2>
              <span className="flex gap-2"><select aria-label="افزودن Attribute" className={cn(inputCls, "h-9 w-44")} value={addKey} onChange={(e) => setAddKey(e.target.value)}><option value="">— انتخاب Attribute —</option>{unused.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</select>
                <button type="button" className={cn(btnGhost, "h-9 text-xs")} disabled={!addKey} onClick={() => { setUse(addKey, { enabled: true, variations: true, values: [] }); setAddKey(""); }}><Plus className="size-4" />افزودن Attribute</button></span></div>
            {used.map((a) => { const u = p.use[a.key]!; return (
              <div key={a.key} className="rounded-lg border border-border p-3" data-testid={`attr-${a.key}`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{a.name} <span className="text-xs font-normal text-muted">({fa(u.values.length)} انتخاب)</span></b>
                  <span className="flex items-center gap-3 text-xs"><label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={u.variations} onChange={(e) => setUse(a.key, { variations: e.target.checked })} />برای ساخت Variant استفاده شود</label>
                    <button type="button" className="cursor-pointer text-hot" onClick={() => setP((o) => ({ ...o, use: { ...o.use, [a.key]: { enabled: false, variations: true, values: [] } } }))}>حذف</button></span></div>
                {a.kind === "model" ? <ModelPicker values={a.values} selected={u.values} onChange={(v) => setUse(a.key, { values: v })} /> : <ValuePicker attr={a} selected={u.values} onChange={(v) => setUse(a.key, { values: v })} />}
              </div>
            ); })}
            {!used.length && <p className="text-xs text-muted">هنوز Attributeای اضافه نشده است.</p>}
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-primary/5 p-3">
              <div className="text-xs leading-6"><div>ترکیب‌های ممکن: <b>{fa(planned.length)}</b> · جدید: <b className="text-primary" data-testid="gen-new">{fa(fresh.length)}</b> · موجود: <b>{fa(planned.length - fresh.length)}</b></div>
                <div className="text-muted">ترکیب‌های ساخته‌شده فعلاً همه فعال‌اند؛ در «ماتریس» مشخص می‌کنید کدام واقعاً موجود است.</div></div>
              <div className="flex flex-wrap items-end gap-2 text-xs">
                <label>موجودی اولیه<input dir="ltr" type="number" min={0} className={cn(small, "block w-20")} value={gen.stock} onChange={(e) => setGen({ ...gen, stock: e.target.value })} /></label>
                <label className="flex h-8 items-center gap-1.5"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={gen.active} onChange={(e) => setGen({ ...gen, active: e.target.checked })} />فعال باشند</label>
                <button type="button" data-testid="gen-go" className={cn(btnPrimary, "h-9 text-xs")} disabled={!fresh.length} onClick={generate}><Wand2 className="size-4" />ایجاد {fresh.length ? fa(fresh.length) : ""} Variant</button></div>
            </div>
          </Card>
          <Matrix attrs={attrs} p={p} setP={setP} varKeys={varKeys} />
        </>
      )}
    </div>
  );
}

function ValuePicker({ attr, selected, onChange }: { attr: Attr; selected: string[]; onChange: (v: string[]) => void }) {
  const set = new Set(selected);
  const toggle = (id: string) => onChange(set.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const vals = attr.values.filter((v) => v.active);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {vals.map((v) => (
        <label key={v.id} className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors", set.has(v.id) ? chipOn : chipOff)}>
          <input type="checkbox" className="sr-only" checked={set.has(v.id)} onChange={() => toggle(v.id)} />
          {v.hex && <span className="size-3.5 rounded-full border border-border" style={{ background: v.hex }} />}{v.label}{set.has(v.id) && <Check className="size-3" />}</label>
      ))}
      <button type="button" className="ms-2 cursor-pointer text-[11px] font-bold text-primary" onClick={() => onChange(vals.map((v) => v.id))}>انتخاب همه</button>
      <button type="button" className="cursor-pointer text-[11px] text-muted" onClick={() => onChange([])}>پاک‌کردن</button>
    </div>
  );
}

/** Many phone models: search, brand filter, select by brand/series, selected summary. */
function ModelPicker({ values, selected, onChange }: { values: Val[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState(""); const [brand, setBrand] = useState("");
  const set = new Set(selected);
  const brands = [...new Set(values.map((v) => v.brand!))];
  const shown = values.filter((v) => v.active && (!brand || v.brand === brand) && (!q || v.label.toLowerCase().includes(q.toLowerCase())));
  const groups = [...new Set(shown.map((v) => `${v.brand}|${v.series}`))];
  const apply = (ids: string[], on: boolean) => { const n = new Set(selected); for (const id of ids) { if (on) n.add(id); else n.delete(id); } onChange([...n]); };
  const allShownOn = shown.length > 0 && shown.every((v) => set.has(v.id));
  return (
    <div className="space-y-2" data-testid="model-picker">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="pointer-events-none absolute start-2 top-2.5 size-4 text-muted" /><input className={cn(inputCls, "h-9 ps-8 text-xs sm:w-56")} placeholder="جستجوی مدل گوشی…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جستجوی مدل" /></div>
        <button type="button" onClick={() => setBrand("")} className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs", !brand ? chipOn : chipOff)}>همه برندها</button>
        {brands.map((b) => <button key={b} type="button" onClick={() => setBrand(b)} className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs", brand === b ? chipOn : chipOff)}>{b} <span className="text-muted">({fa(values.filter((v) => v.brand === b).length)})</span></button>)}
        <span className="ms-auto flex gap-2"><button type="button" data-testid="pick-all" className="cursor-pointer text-xs font-bold text-primary" onClick={() => apply(shown.map((v) => v.id), !allShownOn)}>{allShownOn ? "لغو انتخاب نتایج" : `انتخاب همه‌ی نتایج (${fa(shown.length)})`}</button>
          <button type="button" className="cursor-pointer text-xs text-muted" onClick={() => onChange([])}>پاک‌کردن همه</button></span>
      </div>
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-border bg-surface p-2">
        {groups.map((g) => { const [b, s] = g.split("|") as [string, string]; const list = shown.filter((v) => v.brand === b && v.series === s); const on = list.every((v) => set.has(v.id));
          const brandList = shown.filter((v) => v.brand === b); const brandOn = brandList.every((v) => set.has(v.id));
          return (
            <div key={g}>
              <div className="mb-1 flex flex-wrap items-center gap-3 text-[11px]"><b className="text-muted">{b} › {s}</b>
                <button type="button" className="cursor-pointer font-bold text-primary" onClick={() => apply(list.map((v) => v.id), !on)}>{on ? "لغو این سری" : "انتخاب این سری"}</button>
                <button type="button" className="cursor-pointer text-primary" data-testid={`pick-brand-${b}`} onClick={() => apply(brandList.map((v) => v.id), !brandOn)}>{brandOn ? `لغو همه‌ی ${b}` : `انتخاب همه‌ی ${b}`}</button></div>
              <div className="flex flex-wrap gap-1.5">{list.map((v) => (
                <label key={v.id} className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors", set.has(v.id) ? chipOn : chipOff)}>
                  <input type="checkbox" className="size-3.5 accent-[var(--primary)]" checked={set.has(v.id)} onChange={() => apply([v.id], !set.has(v.id))} />{v.label}</label>))}</div>
            </div>
          ); })}
        {!shown.length && <p className="text-xs text-muted">مدلی پیدا نشد.</p>}
      </div>
      {selected.length > 0 && <div className="flex flex-wrap items-center gap-1.5 text-[11px]"><b>انتخاب‌شده ({fa(selected.length)}):</b>{selected.slice(0, 12).map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5">{values.find((v) => v.id === id)?.label}<button type="button" aria-label="حذف" className="cursor-pointer" onClick={() => apply([id], false)}><X className="size-3" /></button></span>)}{selected.length > 12 && <span className="text-muted">و {fa(selected.length - 12)} مورد دیگر</span>}</div>}
    </div>
  );
}

/* ───────────────────────── variant matrix ───────────────────────── */
function Matrix({ attrs, p, setP, varKeys }: { attrs: Attr[]; p: Product; setP: (f: (p: Product) => Product) => void; varKeys: string[] }) {
  const [view, setView] = useState<"list" | "pivot">("list");
  const [q, setQ] = useState(""); const [brand, setBrand] = useState(""); const [status, setStatus] = useState("all"); const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState({ price: "", stock: "", prefix: "" });
  const lab = (key: string, id: string) => attrs.find((a) => a.key === key)?.values.find((v) => v.id === id);
  const text = (v: Variant) => varKeys.map((k) => lab(k, v.sel[k] ?? "")?.label ?? "").join(" ");
  const rows = p.variants.filter((v) => (!q || text(v).toLowerCase().includes(q.toLowerCase())) && (!brand || lab("model", v.sel.model ?? "")?.brand === brand) && (status === "all" || (status === "active" ? v.active && v.stock > 0 : status === "inactive" ? !v.active : v.stock === 0)));
  const PAGE = 25; const pages = Math.max(1, Math.ceil(rows.length / PAGE)); const cur = Math.min(page, pages - 1); const visible = rows.slice(cur * PAGE, cur * PAGE + PAGE);
  const target = sel.size ? p.variants.filter((v) => sel.has(v.id)) : rows; const tIds = new Set(target.map((v) => v.id));
  const edit = (id: string, patch: Partial<Variant>) => setP((o) => ({ ...o, variants: o.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
  const editMany = (patch: (v: Variant, i: number) => Partial<Variant>) => setP((o) => { let i = 0; return { ...o, variants: o.variants.map((v) => (tIds.has(v.id) ? { ...v, ...patch(v, i++) } : v)) }; });
  const brands = [...new Set(attrs[0]!.values.map((v) => v.brand!))];
  const counts = { active: p.variants.filter((v) => v.active && v.stock > 0).length, off: p.variants.filter((v) => !v.active).length, out: p.variants.filter((v) => v.active && v.stock === 0).length };
  const pivotKeys = varKeys.length === 2 ? varKeys : null;
  return (
    <Card className="space-y-3" data-testid="matrix">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-black"><Layers className="size-4" />مدیریت متغیرها (Variant Matrix) <span className="text-xs font-normal text-muted">{fa(p.variants.length)} Variant</span></h2>
        <span className="flex flex-wrap items-center gap-2"><Pill tone="ok">موجود: {fa(counts.active)}</Pill><Pill tone="warn">ناموجود: {fa(counts.out)}</Pill><Pill tone="mute">غیرفعال: {fa(counts.off)}</Pill>
          {pivotKeys && <span className="flex rounded-lg bg-surface-2 p-0.5 text-xs">{(["list", "pivot"] as const).map((k) => <button key={k} type="button" data-testid={`view-${k}`} onClick={() => setView(k)} className={cn("cursor-pointer rounded-md px-3 py-1", view === k ? "bg-primary font-bold text-primary-fg" : "text-muted")}>{k === "list" ? "فهرست" : "ماتریس مدل × رنگ"}</button>)}</span>}</span></div>
      {!p.variants.length && <p className="rounded-lg bg-surface-2 p-4 text-center text-xs text-muted">هنوز Variantای ساخته نشده؛ مقادیر را بالا انتخاب و «ایجاد Variant» را بزنید.</p>}
      {p.variants.length > 0 && view === "pivot" && pivotKeys && <Pivot attrs={attrs} p={p} setP={setP} keys={pivotKeys} lab={lab} />}
      {p.variants.length > 0 && view === "list" && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input className={cn(inputCls, "h-9 max-w-52 text-xs")} placeholder="فیلتر در جدول…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="فیلتر" />
            {varKeys.includes("model") && <select className={cn(inputCls, "h-9 w-36 text-xs")} value={brand} onChange={(e) => { setBrand(e.target.value); setPage(0); }} aria-label="برند"><option value="">همه برندها</option>{brands.map((b) => <option key={b}>{b}</option>)}</select>}
            <select className={cn(inputCls, "h-9 w-36 text-xs")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="وضعیت"><option value="all">همه وضعیت‌ها</option><option value="active">موجود</option><option value="out">ناموجود</option><option value="inactive">غیرفعال</option></select>
            <span className="text-muted">{fa(rows.length)} نتیجه</span>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-2 p-2 text-xs" data-testid="bulk-bar">
            <b>ویرایش گروهی روی {sel.size ? `${fa(sel.size)} ردیف انتخاب‌شده` : `همه‌ی ${fa(rows.length)} نتیجه`}:</b>
            <label>قیمت اختصاصی<input dir="ltr" type="number" className={cn(small, "block w-28")} value={bulk.price} onChange={(e) => setBulk({ ...bulk, price: e.target.value })} /></label>
            <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} disabled={bulk.price === ""} onClick={() => editMany(() => ({ price: bulk.price }))}>اعمال قیمت</button>
            <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} onClick={() => editMany(() => ({ price: "" }))}>قیمت = پایه</button>
            <label>موجودی<input dir="ltr" type="number" min={0} className={cn(small, "block w-20")} value={bulk.stock} onChange={(e) => setBulk({ ...bulk, stock: e.target.value })} /></label>
            <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} disabled={bulk.stock === ""} onClick={() => editMany(() => ({ stock: Number(bulk.stock) || 0 }))}>اعمال موجودی</button>
            <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} data-testid="bulk-on" onClick={() => editMany(() => ({ active: true }))}>فعال</button>
            <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} data-testid="bulk-off" onClick={() => editMany(() => ({ active: false }))}>غیرفعال</button>
            <label>پیشوند SKU<input dir="ltr" className={cn(small, "block w-28")} value={bulk.prefix} onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })} /></label>
            <button type="button" className={cn(btnGhost, "h-8 px-2 text-xs")} disabled={!bulk.prefix} onClick={() => editMany((_, i) => ({ sku: `${bulk.prefix}-${i + 1}` }))}>اعمال SKU</button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[820px] text-xs"><thead className="bg-surface-2 text-muted"><tr>
              <th className="p-2"><input type="checkbox" aria-label="انتخاب صفحه" className="size-4 accent-[var(--primary)]" checked={visible.length > 0 && visible.every((v) => sel.has(v.id))} onChange={(e) => setSel((s) => { const n = new Set(s); for (const v of visible) { if (e.target.checked) n.add(v.id); else n.delete(v.id); } return n; })} /></th>
              {varKeys.map((k) => <th key={k} className="p-2 text-start">{attrs.find((a) => a.key === k)?.name}</th>)}<th className="p-2 text-start">SKU</th><th className="p-2 text-start">قیمت (خالی = پایه)</th><th className="p-2 text-start">موجودی</th><th className="p-2 text-start">تصویر</th><th className="p-2 text-start">فعال</th><th className="p-2" /></tr></thead>
              <tbody className="divide-y divide-border/60">{visible.map((v) => (
                <tr key={v.id} data-testid="vrow" className={cn(!v.active && "opacity-50")}>
                  <td className="p-2"><input type="checkbox" aria-label="انتخاب" className="size-4 accent-[var(--primary)]" checked={sel.has(v.id)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(v.id); else n.delete(v.id); return n; })} /></td>
                  {varKeys.map((k) => <td key={k} className="p-2 font-bold"><span className="inline-flex items-center gap-1.5">{lab(k, v.sel[k] ?? "")?.hex && <span className="size-3 rounded-full border border-border" style={{ background: lab(k, v.sel[k] ?? "")?.hex }} />}{lab(k, v.sel[k] ?? "")?.label}</span></td>)}
                  <td className="p-2"><input dir="ltr" className={cn(small, "w-32")} value={v.sku} onChange={(e) => edit(v.id, { sku: e.target.value })} aria-label="SKU" /></td>
                  <td className="p-2"><input dir="ltr" type="number" className={cn(small, "w-28")} placeholder={String(p.basePrice)} value={v.price} onChange={(e) => edit(v.id, { price: e.target.value })} aria-label="قیمت" /></td>
                  <td className="p-2"><input dir="ltr" type="number" min={0} className={cn(small, "w-20", v.stock === 0 && "border-warning")} value={v.stock} onChange={(e) => edit(v.id, { stock: Math.max(0, Number(e.target.value) || 0) })} aria-label="موجودی" /></td>
                  <td className="p-2"><button type="button" className={cn("inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px]", v.image ? "border-primary text-primary" : "border-dashed border-border text-muted")} onClick={() => edit(v.id, { image: !v.image })}><ImagePlus className="size-3.5" />{v.image ? "تصویر دارد" : "افزودن"}</button></td>
                  <td className="p-2"><input type="checkbox" aria-label="فعال" className="size-4 accent-[var(--primary)]" checked={v.active} onChange={(e) => edit(v.id, { active: e.target.checked })} /></td>
                  <td className="p-2"><button type="button" aria-label="حذف" className="cursor-pointer rounded p-1 text-hot hover:bg-hot/10" onClick={() => setP((o) => ({ ...o, variants: o.variants.filter((x) => x.id !== v.id) }))}><Trash2 className="size-4" /></button></td>
                </tr>))}</tbody></table>
          </div>
          <div className="flex items-center justify-between text-xs"><span className="text-muted">صفحه {fa(cur + 1)} از {fa(pages)}</span><span className="flex gap-1"><button type="button" className={cn(btnGhost, "h-8 px-3 text-xs")} disabled={cur === 0} onClick={() => setPage(cur - 1)}>قبلی</button><button type="button" className={cn(btnGhost, "h-8 px-3 text-xs")} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>بعدی</button></span>
            {sel.size > 0 && <button type="button" className={cn(btnDanger, "h-8 px-3 text-xs")} onClick={() => { setP((o) => ({ ...o, variants: o.variants.filter((v) => !sel.has(v.id)) })); setSel(new Set()); }}>حذف {fa(sel.size)} ردیف انتخاب‌شده</button>}</div>
        </>
      )}
    </Card>
  );
}

/** Model × colour grid: click a cell to create / switch on / switch off that combination; headers switch a whole row or column. */
function Pivot({ attrs, p, setP, keys, lab }: { attrs: Attr[]; p: Product; setP: (f: (p: Product) => Product) => void; keys: string[]; lab: (k: string, id: string) => Val | undefined }) {
  const [rk, ck] = keys as [string, string];
  const rowIds = [...new Set(p.variants.map((v) => v.sel[rk]!))], colIds = [...new Set(p.variants.map((v) => v.sel[ck]!))];
  const find = (r: string, c: string) => p.variants.find((v) => v.sel[rk] === r && v.sel[ck] === c);
  const setCell = (r: string, c: string, fn: (v: Variant | undefined) => Variant | null) => setP((o) => {
    const ex = o.variants.find((v) => v.sel[rk] === r && v.sel[ck] === c); const nv = fn(ex);
    if (!nv) return { ...o, variants: o.variants.filter((v) => v !== ex) };
    return { ...o, variants: ex ? o.variants.map((v) => (v === ex ? nv : v)) : [...o.variants, nv] };
  });
  const flip = (r: string, c: string) => setCell(r, c, (v) => (v ? { ...v, active: !v.active } : { id: "p" + Date.now() + r + c, sel: { [rk]: r, [ck]: c }, sku: `${p.skuPrefix}-${p.variants.length + 1}`, price: "", stock: 5, active: true, image: false }));
  const line = (ids: { r?: string; c?: string }) => setP((o) => { const hit = o.variants.filter((v) => (ids.r ? v.sel[rk] === ids.r : v.sel[ck] === ids.c)); const on = hit.every((v) => v.active); return { ...o, variants: o.variants.map((v) => (hit.includes(v) ? { ...v, active: !on } : v)) }; });
  void attrs;
  return (
    <div className="space-y-2" data-testid="pivot">
      <p className="text-xs text-muted">هر خانه یک ترکیب است: ✓ موجود · ۰ ناموجود · ✕ غیرفعال · + ساخت ترکیب. روی خانه بزنید تا تغییر کند؛ روی نام ردیف/ستون بزنید تا کل آن ردیف/ستون فعال یا غیرفعال شود.</p>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-xs"><thead className="bg-surface-2"><tr><th className="p-2 text-start text-muted">{attrs.find((a) => a.key === rk)?.name} ↓ / {attrs.find((a) => a.key === ck)?.name} →</th>
        {colIds.map((c) => <th key={c} className="p-2"><button type="button" className="inline-flex cursor-pointer items-center gap-1.5 font-bold hover:text-primary" onClick={() => line({ c })}>{lab(ck, c)?.hex && <span className="size-3 rounded-full border border-border" style={{ background: lab(ck, c)?.hex }} />}{lab(ck, c)?.label}</button></th>)}</tr></thead>
        <tbody className="divide-y divide-border/60">{rowIds.map((r) => (
          <tr key={r}><th className="p-2 text-start"><button type="button" className="cursor-pointer font-bold hover:text-primary" onClick={() => line({ r })}>{lab(rk, r)?.label}</button></th>
            {colIds.map((c) => { const v = find(r, c); const st = !v ? "none" : !v.active ? "off" : v.stock === 0 ? "out" : "ok";
              return <td key={c} className="p-1 text-center"><button type="button" data-testid={`cell-${r}-${c}`} data-state={st} onClick={() => flip(r, c)} aria-label={`${lab(rk, r)?.label} ${lab(ck, c)?.label}`}
                className={cn("h-8 w-full min-w-14 cursor-pointer rounded-md border text-sm font-bold", st === "ok" && "border-success/40 bg-success/15 text-success", st === "out" && "border-warning/50 bg-warning/15 text-warning", st === "off" && "border-border bg-surface-2 text-muted", st === "none" && "border-dashed border-border text-muted")}>{st === "ok" ? "✓" : st === "out" ? "۰" : st === "off" ? "✕" : <Plus className="mx-auto size-3.5" />}</button></td>; })}</tr>))}</tbody></table></div>
    </div>
  );
}

/* ───────────────────────── 3) storefront ───────────────────────── */
function StoreTab({ attrs, p }: { attrs: Attr[]; p: Product }) {
  const keys = attrs.filter((a) => p.use[a.key]?.enabled && p.use[a.key]!.variations && p.use[a.key]!.values.length).map((a) => a.key);
  const [pick, setPick] = useState<Record<string, string>>({});
  const live = p.variants.filter((v) => v.active);
  const lab = (k: string, id: string) => attrs.find((a) => a.key === k)?.values.find((v) => v.id === id);
  /** An option is available when an active, in-stock variant exists with it plus the other chosen values. */
  const state = (k: string, id: string): "ok" | "out" | "none" => {
    const m = live.filter((v) => v.sel[k] === id && keys.every((o) => o === k || !pick[o] || v.sel[o] === pick[o]));
    return !m.length ? "none" : m.some((v) => v.stock > 0) ? "ok" : "out";
  };
  const choose = (k: string, id: string) => setPick((cur) => {
    const next = { ...cur, [k]: cur[k] === id ? "" : id };
    for (const o of keys) { if (o !== k && next[o] && !live.some((v) => keys.every((x) => !next[x] || v.sel[x] === next[x]) && v.stock > 0)) next[o] = ""; } // never keep an impossible combination
    return next;
  });
  const chosen = keys.every((k) => pick[k]) ? live.find((v) => keys.every((k) => v.sel[k] === pick[k])) : undefined;
  const price = chosen ? (chosen.price ? Number(chosen.price) : p.basePrice) : p.basePrice;
  const anyStock = live.some((v) => v.stock > 0);
  const hex = chosen ? lab("color", chosen.sel.color ?? "")?.hex : undefined;
  if (p.type === "simple") return <Card><p className="text-sm">محصول «ساده» است؛ انتخاب Variant ندارد. در تب ۲ نوع را «متغیر» کنید.</p></Card>;
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]" data-testid="store-preview">
      <Card className="space-y-4">
        <h2 className="text-base font-black">{p.name}</h2>
        <div className="text-lg font-black text-hot" data-testid="store-price">{toman(price)}{!chosen && <span className="ms-2 text-xs font-normal text-muted">(قیمت پایه)</span>}</div>
        {!anyStock && <p className="rounded-lg bg-warning/10 p-2 text-xs">این محصول در حال حاضر ناموجود است.</p>}
        {keys.map((k) => {
          const a = attrs.find((x) => x.key === k)!; const ids = p.use[k]!.values;
          return (
            <div key={k}><div className="mb-2 text-xs text-muted">انتخاب {a.name}:</div>
              <div className="flex flex-wrap gap-2">{ids.map((id) => { const v = lab(k, id)!; const s = state(k, id); const on = pick[k] === id;
                return <button key={id} type="button" disabled={s !== "ok"} aria-pressed={on} data-testid={`opt-${k}-${id}`} data-state={s} onClick={() => choose(k, id)}
                  className={cn("inline-flex min-w-20 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs transition-colors", on ? "border-primary bg-primary/10 font-bold text-primary" : "border-border", s === "ok" ? "cursor-pointer hover:border-primary" : "cursor-not-allowed opacity-45", s === "none" && "line-through")}>
                  {v.hex && <span className="size-3.5 rounded-full border border-border" style={{ background: v.hex }} />}{v.label}{s === "out" && <span className="text-[10px]">(ناموجود)</span>}</button>; })}</div></div>
          );
        })}
        <div className="rounded-lg bg-surface-2 p-3 text-xs leading-7" data-testid="store-info">{chosen ? <>SKU: <b dir="ltr">{chosen.sku}</b> · موجودی: <b>{chosen.stock > 5 ? "موجود" : `فقط ${fa(chosen.stock)} عدد`}</b> · {chosen.price ? "قیمت اختصاصی این Variant" : "قیمت پایه محصول"}</> : "برای دیدن قیمت و موجودی دقیق، همه‌ی گزینه‌ها را انتخاب کنید."}</div>
        <button type="button" disabled={!chosen} className={cn(btnPrimary, "h-12 w-full text-sm")}>{chosen ? "افزودن به سبد خرید" : "ابتدا گزینه‌ها را انتخاب کنید"}</button>
        <p className="text-[11px] text-muted">گزینه‌های بی‌موجود، غیرفعال یا ناسازگار با انتخاب قبلی قابل کلیک نیستند؛ کاربر نمی‌تواند ترکیب نامعتبر بسازد.</p>
      </Card>
      <Card className="space-y-2">
        <div className="grid aspect-square place-items-center rounded-2xl text-center text-xs text-white" style={{ background: hex ? `linear-gradient(160deg, ${hex}, #0f172a)` : "linear-gradient(160deg,#64748b,#0f172a)" }}>
          <div>{chosen?.image ? "تصویر اختصاصی Variant" : "تصویر اصلی محصول"}<div className="mt-1 text-[11px] opacity-80">{chosen ? keys.map((k) => lab(k, chosen.sel[k] ?? "")?.label).join(" · ") : "—"}</div></div></div>
        <p className="text-[11px] text-muted">اگر Variant تصویر اختصاصی داشته باشد همان نمایش داده می‌شود، وگرنه تصویر اصلی محصول.</p>
        <div className="flex items-center gap-1 text-[11px] text-muted"><Minus className="size-3" />مقادیر Attribute «رنگ» از مرکز Attributeها می‌آیند ({fa(COLORS.length)} رنگ تعریف‌شده)</div>
      </Card>
    </div>
  );
}
