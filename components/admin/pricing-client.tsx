"use client";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Empty, ErrorBox, Label, Modal, Pager, Pill, Spinner, Table, Td, act, btnDanger, btnGhost, btnPrimary, confirmAsk, fmtDate, fmtNum, fmtToman, inputCls, useApi } from "@/components/admin/kit";
import type { Opt } from "@/components/admin/resource-manager";
import { cn } from "@/lib/utils";

export interface PricingProps { categories: Opt[]; phoneBrands: Opt[]; productBrands: Opt[]; models: (Opt & { group: string })[]; colors: Opt[]; canWrite: boolean; initialTab: string }

const SCOPE_FA: Record<string, string> = { GLOBAL: "سراسری", CATEGORY: "دسته‌بندی", PRODUCT: "محصول", VARIANT: "تنوع" };
/** `SCOPE:target:TYPE:value:round` (stored in history) → readable Persian. */
function fmtRule(l: string) {
  if (l === "MANUAL") return "دستی"; if (l === "AUTOMATIC") return "خودکار";
  const [scope, , type, val, round] = l.split(":");
  const m = type === "PERCENT" ? `${fmtNum(Number(val) / 100)}٪` : fmtToman(Number(val));
  return `${SCOPE_FA[scope!] ?? scope} · ${m}${Number(round) > 1 ? ` · گرد به ${fmtNum(Number(round))}` : ""}`;
}
const Sel = ({ value, onChange, opts, ph, cls }: { value: string; onChange: (v: string) => void; opts: Opt[]; ph: string; cls?: string }) => (
  <select aria-label={ph} className={cn(inputCls, "max-w-44", cls)} value={value} onChange={(e) => onChange(e.target.value)}><option value="">{ph}</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
);

/* ───────────── prices table ───────────── */
interface PRow { variantId: string; productId: string; product: string; variant: string; sku: string; category: string; brand: string | null; model: string | null; color: string | null; mode: "AUTOMATIC" | "MANUAL"; cost: number | null; marginPercent: number | null; rule: { label: string } | null; wholesale: number | null; wholesaleProblem: string | null; calculatedPrice: number; discount: number; discountLabel: string | null; finalPrice: number; stock: number; lowStockThreshold: number; isActive: boolean }

function PricesTab({ p }: { p: PricingProps }) {
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [brand, setBrand] = useState(""); const [pbrand, setPbrand] = useState(""); const [model, setModel] = useState(""); const [mode, setMode] = useState(""); const [stock, setStock] = useState(""); const [sort, setSort] = useState("name"); const [dir, setDir] = useState("asc"); const [page, setPage] = useState(1);
  const url = useMemo(() => { const u = new URLSearchParams({ page: String(page), sort, dir }); if (q) u.set("q", q); if (cat) u.set("categoryId", cat); if (brand) u.set("brandId", brand); if (pbrand) u.set("productBrandId", pbrand); if (model) u.set("modelId", model); if (mode) u.set("mode", mode); if (stock) u.set("stock", stock); return `/api/admin/pricing?${u}`; }, [q, cat, brand, pbrand, model, mode, stock, sort, dir, page]);
  const { data, error, loading } = useApi<{ items: PRow[]; total: number; page: number; pages: number }>(url);
  const reset = (fn: () => void) => { fn(); setPage(1); };
  return (
    <div>
      <WholesaleBanner />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className={cn(inputCls, "max-w-56")} placeholder="محصول یا SKU…" aria-label="جستجو" value={q} onChange={(e) => reset(() => setQ(e.target.value))} />
        <Sel value={cat} onChange={(v) => reset(() => setCat(v))} opts={p.categories} ph="همهٔ دسته‌ها" />
        <Sel value={pbrand} onChange={(v) => reset(() => setPbrand(v))} opts={p.productBrands} ph="برند محصول" />
        <Sel value={brand} onChange={(v) => reset(() => { setBrand(v); setModel(""); })} opts={p.phoneBrands} ph="برند گوشی" />
        <Sel value={model} onChange={(v) => reset(() => setModel(v))} opts={p.models.filter((m) => !brand || p.phoneBrands.find((b) => b.value === brand)?.label === m.group)} ph="مدل گوشی" />
        <Sel value={mode} onChange={(v) => reset(() => setMode(v))} opts={[{ value: "AUTOMATIC", label: "خودکار" }, { value: "MANUAL", label: "دستی" }]} ph="روش قیمت" />
        <Sel value={stock} onChange={(v) => reset(() => setStock(v))} opts={[{ value: "low", label: "کم‌موجودی" }, { value: "out", label: "ناموجود" }]} ph="موجودی" />
        <Sel value={sort} onChange={setSort} opts={[{ value: "name", label: "نام" }, { value: "sku", label: "SKU" }, { value: "price", label: "قیمت" }, { value: "cost", label: "هزینه" }, { value: "stock", label: "موجودی" }]} ph="مرتب‌سازی" cls="max-w-32" />
        <button className={btnGhost} onClick={() => setDir(dir === "asc" ? "desc" : "asc")} aria-label="جهت مرتب‌سازی">{dir === "asc" ? "صعودی ↑" : "نزولی ↓"}</button>
      </div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty /> : (
        <>
          <Table head={["محصول", "تنوع", "هزینه", "سود", "قیمت محاسبه‌شده", "تخفیف", "قیمت نهایی", "قیمت عمده", "موجودی", "وضعیت"]}>
            {data.items.map((r) => (
              <tr key={r.variantId} className="hover:bg-surface-2/60">
                <Td className="font-bold"><a className="hover:text-primary" href={`/admin/products/${r.productId}`}>{r.product}</a><div className="text-[11px] font-normal text-muted">{r.category}</div></Td>
                <Td><div>{r.variant}</div><code dir="ltr" className="text-[11px] text-muted">{r.sku}</code></Td>
                <Td>{r.cost == null ? <span className="text-muted">—</span> : fmtToman(r.cost)}</Td>
                <Td className="text-xs">{r.marginPercent == null ? "—" : `${fmtNum(r.marginPercent)}٪`}<div className="text-muted">{r.rule ? fmtRule(r.rule.label) : r.mode === "MANUAL" ? "دستی" : "بدون قانون"}</div></Td>
                <Td>{fmtToman(r.calculatedPrice)}<div><Pill tone={r.mode === "AUTOMATIC" ? "info" : "mute"}>{r.mode === "AUTOMATIC" ? "خودکار" : "دستی"}</Pill></div></Td>
                <Td className="text-xs">{r.discount ? <><b className="text-success">−{fmtToman(r.discount)}</b><div className="text-muted">{r.discountLabel}</div></> : "—"}</Td>
                <Td className="font-black">{fmtToman(r.finalPrice)}</Td>
                <Td className="text-xs">{r.wholesale == null ? <span className="text-muted">—</span> : fmtToman(r.wholesale)}{r.wholesaleProblem && <div title={r.wholesaleProblem}><Pill tone="bad">ناسازگار با خرده</Pill></div>}</Td>
                <Td><Pill tone={r.stock === 0 ? "bad" : r.stock <= r.lowStockThreshold ? "warn" : "ok"}>{fmtNum(r.stock)}</Pill></Td>
                <Td><Pill tone={r.isActive ? "ok" : "mute"}>{r.isActive ? "فعال" : "غیرفعال"}</Pill></Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/** Read-only report of stored price pairs that break the wholesale/retail policy (the policy lives in تنظیمات ‹ رابطهٔ قیمت عمده و خرده). */
function WholesaleBanner() {
  const { data } = useApi<{ conflictCount: number; checked: number; items: { variantId: string; productId: string; product: string; sku: string; problem: string }[] }>("/api/admin/pricing/wholesale");
  const [open, setOpen] = useState(false);
  if (!data || data.conflictCount === 0) return null;
  return (
    <div className="mb-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span><b>{fmtNum(data.conflictCount)}</b> مورد قیمت عمده با قاعدهٔ رابطهٔ عمده/خرده ناسازگار است (قیمت‌ها تغییر نکرده‌اند؛ ذخیرهٔ قیمت ناسازگار جدید رد می‌شود).</span><button className={cn(btnGhost, "h-8 px-3 text-xs")} onClick={() => setOpen(!open)}>{open ? "بستن" : "مشاهده"}</button></div>
      {open && <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">{data.items.map((i) => <li key={i.variantId}><a className="font-bold hover:text-primary" href={`/admin/products/${i.productId}`}>{i.product}</a> <code dir="ltr" className="text-muted">{i.sku}</code> — {i.problem}</li>)}</ul>}
    </div>
  );
}

/* ───────────── shared preview of changes ───────────── */
interface Change { productId: string; productName: string; variantId: string | null; sku: string; oldPrice: number; newPrice: number; oldCost: number | null; newCost: number | null; oldRule: string; newRule: string }
function ChangesTable({ rows, title }: { rows: { key: string; name: string; sku: string; oldPrice: number; newPrice: number; oldCost: number | null; newCost: number | null; note?: string }[]; title: string }) {
  if (!rows.length) return <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">{title}: تغییری در قیمت‌ها ایجاد نمی‌شود.</p>;
  return (
    <div>
      <h3 className="mb-2 text-sm font-black">{title}</h3>
      <Table head={["محصول", "قیمت قبلی", "", "قیمت جدید", "هزینه", "توضیح"]}>
        {rows.map((r) => (
          <tr key={r.key}><Td><div className="font-bold">{r.name}</div><code dir="ltr" className="text-[11px] text-muted">{r.sku}</code></Td><Td className="text-muted"><s>{fmtToman(r.oldPrice)}</s></Td><Td>‹</Td>
            <Td className={cn("font-black", r.newPrice > r.oldPrice ? "text-hot" : r.newPrice < r.oldPrice ? "text-success" : "")}>{fmtToman(r.newPrice)}</Td>
            <Td className="text-xs">{r.oldCost !== r.newCost ? <>{r.oldCost == null ? "—" : fmtToman(r.oldCost)} ‹ {r.newCost == null ? "—" : fmtToman(r.newCost)}</> : r.newCost == null ? "—" : fmtToman(r.newCost)}</Td><Td className="text-xs text-warning">{r.note ?? ""}</Td></tr>
        ))}
      </Table>
    </div>
  );
}

/* ───────────── rules ───────────── */
interface RuleRow { id: string; scope: string; targetId: string; targetLabel?: string; marginType: "PERCENT" | "FIXED"; marginValue: number; marginHuman: number; roundTo: number; isActive: boolean; note: string | null }
interface RuleResult { rule: RuleRow; changedCount: number; skippedCount: number; wholesaleConflictCount?: number; changes: Change[]; skipped: { sku: string; reason: string }[] }

function TargetSearch({ scope, value, label, onPick }: { scope: string; value: string; label: string; onPick: (id: string, l: string) => void }) {
  const [q, setQ] = useState(""); const [opts, setOpts] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => { if (scope === "GLOBAL") return; const t = setTimeout(async () => { try { const r = await fetch(`/api/admin/pricing/targets?scope=${scope}&q=${encodeURIComponent(q)}`); const j = await r.json(); if (j.ok) setOpts(j.data); } catch {} }, 250); return () => clearTimeout(t); }, [scope, q]);
  if (scope === "GLOBAL") return <p className="text-xs text-muted">قانون سراسری برای همهٔ محصولات، وقتی قانون دقیق‌تری وجود نداشته باشد.</p>;
  return (
    <div className="space-y-2"><input className={inputCls} placeholder="جستجوی هدف…" aria-label="جستجوی هدف" value={q} onChange={(e) => setQ(e.target.value)} />
      {value && <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm">انتخاب‌شده: <b>{label}</b></div>}
      <ul className="max-h-36 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">{opts.map((o) => <li key={o.id}><button type="button" onClick={() => onPick(o.id, o.label)} className={cn("w-full cursor-pointer px-3 py-2 text-start hover:bg-surface-2", o.id === value && "bg-primary/10 font-bold")}>{o.label}</button></li>)}</ul></div>
  );
}

function RuleEditor({ row, onClose, onDone }: { row: RuleRow | null; onClose: () => void; onDone: () => void }) {
  const [scope, setScope] = useState(row?.scope ?? "GLOBAL"); const [targetId, setTargetId] = useState(row?.targetId ?? ""); const [targetLabel, setTargetLabel] = useState(row?.targetLabel ?? "");
  const [type, setType] = useState<"PERCENT" | "FIXED">(row?.marginType ?? "PERCENT"); const [value, setValue] = useState(row ? String(row.marginHuman) : ""); const [roundTo, setRoundTo] = useState(String(row?.roundTo ?? 0)); const [active, setActive] = useState(row?.isActive ?? true); const [note, setNote] = useState(row?.note ?? "");
  const [res, setRes] = useState<RuleResult | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const body = (preview: boolean) => ({ scope, targetId: scope === "GLOBAL" ? "" : targetId, marginType: type, marginValue: Number(value), roundTo: Number(roundTo || 0), isActive: active, note: note || undefined, preview });
  const run = async (preview: boolean) => {
    setBusy(true); setErr("");
    const r = await act<{ preview: boolean; result: RuleResult }>("POST", "/api/admin/pricing/rules", body(preview), preview ? "پیش‌نمایش آماده شد." : "قانون ذخیره و قیمت‌ها به‌روز شد.");
    setBusy(false);
    if (!r.ok) { setErr(r.message ?? "خطا"); return; }
    if (preview) setRes(r.data!.result); else { onDone(); onClose(); }
  };
  return (
    <Modal title={row ? "ویرایش قانون قیمت‌گذاری" : "قانون قیمت‌گذاری جدید"} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label label="سطح قانون"><select className={inputCls} disabled={!!row} value={scope} onChange={(e) => { setScope(e.target.value); setTargetId(""); setTargetLabel(""); setRes(null); }}>{Object.entries(SCOPE_FA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Label>
        <Label label="نوع سود"><select className={inputCls} value={type} onChange={(e) => { setType(e.target.value as "PERCENT" | "FIXED"); setRes(null); }}><option value="PERCENT">درصدی روی هزینه</option><option value="FIXED">مبلغ ثابت (تومان)</option></select></Label>
        {!row && <div className="sm:col-span-2"><TargetSearch scope={scope} value={targetId} label={targetLabel} onPick={(id, l) => { setTargetId(id); setTargetLabel(l); setRes(null); }} /></div>}
        {row && scope !== "GLOBAL" && <div className="rounded-lg bg-surface-2 p-2 text-sm sm:col-span-2">هدف: <b>{row.targetLabel ?? row.targetId}</b></div>}
        <Label label={type === "PERCENT" ? "درصد سود *" : "مبلغ سود (تومان) *"}><input dir="ltr" type="number" min={0} step={type === "PERCENT" ? "0.01" : "1"} required className={inputCls} value={value} onChange={(e) => { setValue(e.target.value); setRes(null); }} /></Label>
        <Label label="گرد کردن قیمت به بالا" hint="مثلاً ۱۰۰۰ = نزدیک‌ترین هزار تومان بالاتر؛ ۰ = بدون گرد کردن"><input dir="ltr" type="number" min={0} className={inputCls} value={roundTo} onChange={(e) => { setRoundTo(e.target.value); setRes(null); }} /></Label>
        <Label label="یادداشت" className="sm:col-span-2"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={active} onChange={(e) => { setActive(e.target.checked); setRes(null); }} />قانون فعال باشد</label>
      </div>
      {err && <div className="mt-3"><ErrorBox message={err} /></div>}
      {res && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-primary/10 p-3 text-sm">با ذخیرهٔ این قانون قیمت <b>{fmtNum(res.changedCount)}</b> مورد تغییر می‌کند{res.skippedCount ? <> و <b>{fmtNum(res.skippedCount)}</b> مورد بدون تغییر می‌ماند{res.wholesaleConflictCount ? <> (<b>{fmtNum(res.wholesaleConflictCount)}</b> مورد به‌خاطر ناسازگاری با قیمت عمده)</> : null}</> : null}.</div>
          <ChangesTable title="پیش‌نمایش تغییر قیمت" rows={res.changes.map((c) => ({ key: (c.variantId ?? c.productId) + c.sku, name: c.productName, sku: c.sku, oldPrice: c.oldPrice, newPrice: c.newPrice, oldCost: c.oldCost, newCost: c.newCost }))} />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2"><button className={btnGhost} onClick={onClose}>انصراف</button><button className={btnGhost} disabled={busy || !value || (scope !== "GLOBAL" && !targetId)} onClick={() => run(true)}>پیش‌نمایش</button><button className={btnPrimary} disabled={busy || !res} onClick={() => run(false)}>{busy ? "…" : "ذخیره و اعمال"}</button></div>
    </Modal>
  );
}

function RulesTab({ canWrite }: { canWrite: boolean }) {
  const { data, error, loading, reload } = useApi<RuleRow[]>("/api/admin/pricing/rules");
  const [edit, setEdit] = useState<RuleRow | null | "new">(null);
  const del = async (r: RuleRow) => {
    const pre = await act<{ result: RuleResult }>("DELETE", `/api/admin/pricing/rules/${r.id}`, { preview: true }, "پیش‌نمایش آماده شد.");
    const n = pre.data?.result.changedCount ?? 0;
    if (!confirmAsk(`با حذف این قانون قیمت ${n.toLocaleString("fa-IR")} مورد تغییر می‌کند. ادامه می‌دهید؟`)) return;
    const x = await act("DELETE", `/api/admin/pricing/rules/${r.id}`, { preview: false }, "قانون حذف شد."); if (x.ok) reload();
  };
  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3"><p className="max-w-2xl text-xs leading-6 text-muted">قیمت فروش = هزینه خرید + سود. برای هر کالا دقیق‌ترین قانون فعال اعمال می‌شود: <b>تنوع ‹ محصول ‹ دسته‌بندی (نزدیک‌ترین) ‹ سراسری</b>. کالای «دستی» هرگز از قانون تأثیر نمی‌گیرد.</p>{canWrite && <button className={btnPrimary} onClick={() => setEdit("new")}><Plus className="size-4" />قانون جدید</button>}</div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.length ? <Empty text="هنوز قانونی تعریف نشده. با یک قانون سراسری شروع کنید." /> : (
        <Table head={["سطح", "هدف", "سود", "گرد کردن", "وضعیت", ""]}>
          {data.map((r) => <tr key={r.id}><Td><Pill tone="info">{SCOPE_FA[r.scope]}</Pill></Td><Td>{r.targetLabel ?? "—"}</Td><Td className="font-bold">{r.marginType === "PERCENT" ? `${fmtNum(r.marginHuman)}٪` : fmtToman(r.marginHuman)}</Td><Td>{r.roundTo > 1 ? fmtNum(r.roundTo) : "—"}</Td><Td><Pill tone={r.isActive ? "ok" : "mute"}>{r.isActive ? "فعال" : "غیرفعال"}</Pill></Td>
            <Td>{canWrite && <div className="flex gap-1"><button aria-label="ویرایش" className={cn(btnGhost, "h-8 px-2")} onClick={() => setEdit(r)}><Pencil className="size-4" /></button><button aria-label="حذف" className={cn(btnDanger, "h-8 px-2")} onClick={() => del(r)}><Trash2 className="size-4" /></button></div>}</Td></tr>)}
        </Table>
      )}
      {edit && <RuleEditor row={edit === "new" ? null : edit} onClose={() => setEdit(null)} onDone={reload} />}
    </div>
  );
}

/* ───────────── bulk ───────────── */
interface BulkResult { targets: number; changedCount: number; skippedCount: number; truncated: boolean; rows: { variantId: string; product: string; sku: string; oldPrice: number; newPrice: number; oldCost: number | null; newCost: number | null; note?: string }[] }
const OPS: [string, string, string][] = [
  ["cost_percent", "تغییر هزینه خرید (٪)", "مثلاً 10 یا -5"], ["cost_delta", "تغییر هزینه خرید (تومان)", "مثلاً 50000 یا -20000"], ["cost_set", "تعیین هزینه خرید (تومان)", "هزینهٔ جدید"],
  ["margin_set", "تعیین سود", "درصد سود (یا مبلغ)"], ["price_percent", "تغییر قیمت دستی (٪)", "فقط کالاهای دستی"], ["price_delta", "تغییر قیمت دستی (تومان)", "فقط کالاهای دستی"], ["mode_set", "تغییر روش قیمت‌گذاری", ""],
];

function BulkTab({ p }: { p: PricingProps }) {
  const [f, setF] = useState({ categoryId: "", productBrandId: "", phoneBrandId: "", phoneModelId: "", colorId: "", q: "" });
  const [kind, setKind] = useState("cost_percent"); const [value, setValue] = useState(""); const [marginType, setMarginType] = useState<"PERCENT" | "FIXED">("PERCENT"); const [mode, setMode] = useState<"AUTOMATIC" | "MANUAL">("AUTOMATIC"); const [reason, setReason] = useState("");
  const [res, setRes] = useState<BulkResult | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const filter = Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string>;
  const op = kind === "mode_set" ? { kind, mode } : kind === "margin_set" ? { kind, marginType, value: Number(value) } : { kind, value: Number(value) };
  const run = async (preview: boolean) => {
    setBusy(true); setErr("");
    const r = await act<{ preview: boolean; result: BulkResult }>("POST", "/api/admin/pricing/bulk", { preview, filter, op, reason: reason || undefined }, preview ? "پیش‌نمایش آماده شد." : "تغییرات اعمال شد.");
    setBusy(false);
    if (!r.ok) { setErr(r.message ?? "خطا"); return; }
    setRes(preview ? r.data!.result : null);
    if (!preview) { setValue(""); }
  };
  const set = (k: keyof typeof f, v: string) => { setF((o) => ({ ...o, [k]: v })); setRes(null); };
  const ready = Object.keys(filter).length > 0 && (kind === "mode_set" || value !== "");
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-black">۱) کدام تنوع‌ها؟ <span className="text-[11px] font-normal text-muted">(حداقل یک فیلتر)</span></h3>
        <div className="flex flex-wrap gap-2">
          <Sel value={f.categoryId} onChange={(v) => set("categoryId", v)} opts={p.categories} ph="دسته‌بندی" />
          <Sel value={f.phoneBrandId} onChange={(v) => set("phoneBrandId", v)} opts={p.phoneBrands} ph="برند گوشی" />
          <Sel value={f.phoneModelId} onChange={(v) => set("phoneModelId", v)} opts={p.models} ph="مدل گوشی" />
          <Sel value={f.colorId} onChange={(v) => set("colorId", v)} opts={p.colors} ph="رنگ" />
          <Sel value={f.productBrandId} onChange={(v) => set("productBrandId", v)} opts={p.productBrands} ph="برند محصول" />
          <input className={cn(inputCls, "max-w-52")} placeholder="نام یا SKU…" aria-label="جستجو" value={f.q} onChange={(e) => set("q", e.target.value)} />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-black">۲) چه تغییری؟</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Label label="عملیات"><select className={inputCls} value={kind} onChange={(e) => { setKind(e.target.value); setRes(null); }}>{OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Label>
          {kind === "margin_set" && <Label label="نوع سود"><select className={inputCls} value={marginType} onChange={(e) => { setMarginType(e.target.value as "PERCENT" | "FIXED"); setRes(null); }}><option value="PERCENT">درصدی</option><option value="FIXED">مبلغ ثابت</option></select></Label>}
          {kind === "mode_set" ? <Label label="روش جدید"><select className={inputCls} value={mode} onChange={(e) => { setMode(e.target.value as "AUTOMATIC" | "MANUAL"); setRes(null); }}><option value="AUTOMATIC">خودکار</option><option value="MANUAL">دستی</option></select></Label>
            : <Label label="مقدار" hint={OPS.find((o) => o[0] === kind)?.[2]}><input dir="ltr" type="number" step="0.01" className={inputCls} value={value} onChange={(e) => { setValue(e.target.value); setRes(null); }} /></Label>}
          <Label label="دلیل (برای تاریخچه)" className="sm:col-span-3"><input className={inputCls} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Label>
        </div>
        <div className="mt-3 flex justify-end gap-2"><button className={btnGhost} disabled={busy || !ready} onClick={() => run(true)}>پیش‌نمایش</button></div>
      </div>
      {err && <ErrorBox message={err} />}
      {res && (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-surface p-4">
          <div className="text-sm">پیش‌نمایش: <b>{fmtNum(res.targets)}</b> تنوع انتخاب شد؛ <b className="text-primary">{fmtNum(res.changedCount)}</b> مورد تغییر می‌کند{res.skippedCount ? <>، <b className="text-warning">{fmtNum(res.skippedCount)}</b> مورد قابل انجام نیست</> : null}.{res.truncated && " (فقط ۳۰۰ ردیف اول نمایش داده می‌شود؛ همهٔ موارد اعمال می‌شود.)"}</div>
          <ChangesTable title="قیمت قبلی ‹ قیمت جدید" rows={res.rows.map((r) => ({ key: r.variantId, name: r.product, sku: r.sku, oldPrice: r.oldPrice, newPrice: r.newPrice, oldCost: r.oldCost, newCost: r.newCost, note: r.note }))} />
          <div className="flex justify-end"><button className={btnPrimary} disabled={busy || res.changedCount === 0} onClick={() => { if (confirmAsk(`تغییر ${res.changedCount.toLocaleString("fa-IR")} مورد اعمال شود؟`)) run(false); }}>{busy ? "…" : "تأیید و اعمال"}</button></div>
        </div>
      )}
    </div>
  );
}

/* ───────────── history ───────────── */
interface HRow { id: string; createdAt: string; product: { name: string }; variant: { sku: string } | null; oldPrice: number; newPrice: number; oldCost: number | null; newCost: number | null; oldRule: string | null; newRule: string | null; source: string; reason: string | null; admin: string | null; type: string }
function HistoryTab() {
  const [page, setPage] = useState(1); const [source, setSource] = useState("");
  const { data, error, loading } = useApi<{ items: HRow[]; total: number; page: number; pages: number }>(`/api/admin/pricing/history?page=${page}${source ? `&source=${source}` : ""}`);
  return (
    <div>
      <div className="mb-3"><Sel value={source} onChange={(v) => { setSource(v); setPage(1); }} opts={[{ value: "manual", label: "دستی" }, { value: "rule", label: "قانون" }, { value: "bulk", label: "تغییر گروهی" }]} ph="همهٔ منبع‌ها" /></div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty text="تغییری ثبت نشده." /> : (
        <>
          <Table head={["زمان", "محصول", "قیمت", "هزینه", "قانون", "منبع", "توسط"]}>
            {data.items.map((h) => <tr key={h.id}><Td className="text-xs">{fmtDate(h.createdAt)}</Td><Td><div className="font-bold">{h.product.name}</div>{h.variant && <code dir="ltr" className="text-[11px] text-muted">{h.variant.sku}</code>}{h.type === "wholesale" && <Pill tone="warn">عمده</Pill>}</Td>
              <Td className="text-xs"><s className="text-muted">{fmtToman(h.oldPrice)}</s> ‹ <b>{fmtToman(h.newPrice)}</b></Td>
              <Td className="text-xs">{h.oldCost == null && h.newCost == null ? "—" : `${h.oldCost == null ? "—" : fmtToman(h.oldCost)} ‹ ${h.newCost == null ? "—" : fmtToman(h.newCost)}`}</Td>
              <Td className="text-xs">{h.oldRule || h.newRule ? `${fmtRule(h.oldRule ?? "MANUAL")} ‹ ${fmtRule(h.newRule ?? "MANUAL")}` : "—"}</Td>
              <Td><Pill tone={h.source === "manual" ? "mute" : h.source === "rule" ? "info" : "warn"}>{h.source === "manual" ? "دستی" : h.source === "rule" ? "قانون" : "گروهی"}</Pill>{h.reason && <div className="mt-0.5 text-[11px] text-muted">{h.reason}</div>}</Td><Td className="text-xs">{h.admin ?? "—"}</Td></tr>)}
          </Table>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export function PricingClient(p: PricingProps) {
  const [tab, setTab] = useState(["prices", "rules", "bulk", "history"].includes(p.initialTab) ? p.initialTab : "prices");
  const tabs: [string, string][] = [["prices", "جدول قیمت‌ها"], ["rules", "قوانین قیمت‌گذاری"], ...(p.canWrite ? [["bulk", "تغییر گروهی"] as [string, string]] : []), ["history", "تاریخچهٔ قیمت"]];
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("cursor-pointer rounded-lg px-4 py-2 text-sm font-bold transition-colors", tab === k ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-foreground")}>{l}</button>)}
      </div>
      {tab === "prices" && <PricesTab p={p} />}
      {tab === "rules" && <RulesTab canWrite={p.canWrite} />}
      {tab === "bulk" && p.canWrite && <BulkTab p={p} />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}
