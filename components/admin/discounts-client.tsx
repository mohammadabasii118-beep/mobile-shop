"use client";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Empty, ErrorBox, Label, Modal, Pager, Pill, Spinner, Table, Td, act, btnDanger, btnGhost, btnPrimary, confirmAsk, fmtDate, fmtNum, fmtToman, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

type Scope = "ALL" | "PRODUCT" | "CATEGORY" | "VARIANT" | "BRAND" | "MODEL";
interface Row { id: string; name: string; type: "PERCENT" | "FIXED"; value: number; scope: Scope; targetId: string; targetLabel: string; startsAt: string | null; endsAt: string | null; minOrder: number; usageLimit: number | null; perUserLimit: number | null; usedCount: number; isActive: boolean; status: string }
const SCOPES: [Scope, string][] = [["ALL", "همهٔ محصولات"], ["CATEGORY", "دسته‌بندی"], ["PRODUCT", "محصول"], ["VARIANT", "تنوع (Variant)"], ["BRAND", "برند"], ["MODEL", "مدل گوشی"]];
const STATUS: Record<string, ["ok" | "warn" | "mute" | "bad" | "info", string]> = { active: ["ok", "فعال"], scheduled: ["info", "زمان‌بندی‌شده"], expired: ["mute", "منقضی"], off: ["mute", "غیرفعال"], exhausted: ["warn", "ظرفیت تمام"] };

const toLocal = (v: string | null) => { if (!v) return ""; const d = new Date(v); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function TargetPicker({ scope, value, label, onPick }: { scope: Scope; value: string; label: string; onPick: (id: string, label: string) => void }) {
  const [q, setQ] = useState(""); const [opts, setOpts] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    if (scope === "ALL") return;
    const t = setTimeout(async () => { try { const r = await fetch(`/api/admin/pricing/targets?scope=${scope}&q=${encodeURIComponent(q)}`); const j = await r.json(); if (j.ok) setOpts(j.data); } catch {} }, 250);
    return () => clearTimeout(t);
  }, [scope, q]);
  if (scope === "ALL") return <p className="text-xs text-muted">این تخفیف روی همهٔ محصولات اعمال می‌شود.</p>;
  return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="جستجو برای انتخاب هدف…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جستجوی هدف" />
      {value && <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm">انتخاب‌شده: <b>{label}</b></div>}
      <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
        {opts.length === 0 && <li className="p-3 text-center text-muted">موردی پیدا نشد.</li>}
        {opts.map((o) => <li key={o.id}><button type="button" onClick={() => onPick(o.id, o.label)} className={cn("w-full cursor-pointer px-3 py-2 text-start hover:bg-surface-2", o.id === value && "bg-primary/10 font-bold")}>{o.label}</button></li>)}
      </ul>
    </div>
  );
}

interface Form { name: string; type: "PERCENT" | "FIXED"; value: string; scope: Scope; targetId: string; targetLabel: string; startsAt: string; endsAt: string; minOrder: string; usageLimit: string; perUserLimit: string; isActive: boolean }
const blank: Form = { name: "", type: "PERCENT", value: "", scope: "ALL", targetId: "", targetLabel: "", startsAt: "", endsAt: "", minOrder: "0", usageLimit: "", perUserLimit: "", isActive: true };

function Editor({ row, onClose, onDone }: { row: Row | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<Form>(row ? { name: row.name, type: row.type, value: String(row.value), scope: row.scope, targetId: row.targetId, targetLabel: row.targetLabel, startsAt: toLocal(row.startsAt), endsAt: toLocal(row.endsAt), minOrder: String(row.minOrder), usageLimit: row.usageLimit == null ? "" : String(row.usageLimit), perUserLimit: row.perUserLimit == null ? "" : String(row.perUserLimit), isActive: row.isActive } : blank);
  const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((o) => ({ ...o, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErrs({});
    const body = { name: f.name, type: f.type, value: Number(f.value), scope: f.scope, targetId: f.scope === "ALL" ? "" : f.targetId, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null, endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null, minOrder: Number(f.minOrder || 0), usageLimit: f.usageLimit ? Number(f.usageLimit) : null, perUserLimit: f.perUserLimit ? Number(f.perUserLimit) : null, isActive: f.isActive };
    const r = await act(row ? "PATCH" : "POST", row ? `/api/admin/r/discounts/${row.id}` : "/api/admin/r/discounts", body, row ? "تخفیف ذخیره شد." : "تخفیف ایجاد شد.");
    setBusy(false);
    if (r.ok) { onDone(); onClose(); } else setErrs(r.fields ?? {});
  };
  return (
    <Modal title={row ? "ویرایش تخفیف" : "تخفیف جدید"} onClose={onClose} wide>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Label label="نام تخفیف *" error={errs.name} className="sm:col-span-2"><input className={inputCls} required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="مثلاً جشنواره مهر" /></Label>
        <Label label="نوع"><select className={inputCls} value={f.type} onChange={(e) => set("type", e.target.value as Form["type"])}><option value="PERCENT">درصدی</option><option value="FIXED">مبلغ ثابت (تومان، برای هر عدد)</option></select></Label>
        <Label label={f.type === "PERCENT" ? "درصد *" : "مبلغ (تومان) *"} error={errs.value}><input dir="ltr" type="number" min={1} max={f.type === "PERCENT" ? 100 : undefined} required className={inputCls} value={f.value} onChange={(e) => set("value", e.target.value)} /></Label>
        <Label label="اعمال روی" className="sm:col-span-2"><select className={inputCls} value={f.scope} onChange={(e) => setF((o) => ({ ...o, scope: e.target.value as Scope, targetId: "", targetLabel: "" }))}>{SCOPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Label>
        <div className="sm:col-span-2"><TargetPicker scope={f.scope} value={f.targetId} label={f.targetLabel} onPick={(id, l) => setF((o) => ({ ...o, targetId: id, targetLabel: l }))} />{errs.targetId && <p className="mt-1 text-xs font-bold text-error">{errs.targetId}</p>}</div>
        <Label label="شروع" hint="خالی = از همین حالا"><input type="datetime-local" className={inputCls} value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Label>
        <Label label="پایان" hint="خالی = بدون پایان" error={errs.endsAt}><input type="datetime-local" className={inputCls} value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></Label>
        <Label label="حداقل مبلغ خرید (تومان)" hint="مبلغ کالاهای خرده در سبد، پیش از تخفیف"><input dir="ltr" type="number" min={0} className={inputCls} value={f.minOrder} onChange={(e) => set("minOrder", e.target.value)} /></Label>
        <Label label="سقف کل استفاده" hint="خالی = نامحدود"><input dir="ltr" type="number" min={1} className={inputCls} value={f.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} /></Label>
        <Label label="سقف برای هر کاربر" hint="خالی = نامحدود"><input dir="ltr" type="number" min={1} className={inputCls} value={f.perUserLimit} onChange={(e) => set("perUserLimit", e.target.value)} /></Label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />فعال</label>
        <p className="text-[11px] leading-6 text-muted sm:col-span-2">تخفیف‌ها روی هم جمع نمی‌شوند: برای هر کالا بهترین (بیشترین) تخفیف اعمال می‌شود، سپس کد کوپن (اگر باشد) روی مبلغ باقی‌مانده. تخفیف فقط روی قیمت خرده اعمال می‌شود؛ قیمت همکار جداست.</p>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={btnGhost} onClick={onClose}>انصراف</button><button className={btnPrimary} disabled={busy}>{busy ? "…" : "ذخیره"}</button></div>
      </form>
    </Modal>
  );
}

export function DiscountsClient() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [scope, setScope] = useState(""); const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Row | null | "new">(null);
  const url = useMemo(() => { const u = new URLSearchParams({ page: String(page) }); if (q) u.set("q", q); if (status) u.set("status", status); if (scope) u.set("scope", scope); return `/api/admin/discounts?${u}`; }, [q, status, scope, page]);
  const { data, error, loading, reload } = useApi<{ items: Row[]; total: number; page: number; pages: number }>(url);
  const del = async (r: Row) => { if (!confirmAsk(`تخفیف «${r.name}» حذف شود؟`)) return; const x = await act("DELETE", `/api/admin/r/discounts/${r.id}`, undefined, "تخفیف حذف شد."); if (x.ok) reload(); };
  const toggle = async (r: Row) => { const x = await act("PATCH", `/api/admin/r/discounts/${r.id}`, { isActive: !r.isActive }, r.isActive ? "تخفیف غیرفعال شد." : "تخفیف فعال شد."); if (x.ok) reload(); };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className={cn(inputCls, "max-w-56")} placeholder="جستجوی نام…" aria-label="جستجو" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className={cn(inputCls, "max-w-40")} aria-label="وضعیت" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">همهٔ وضعیت‌ها</option><option value="active">فعال</option><option value="scheduled">زمان‌بندی‌شده</option><option value="expired">منقضی</option><option value="off">غیرفعال</option></select>
        <select className={cn(inputCls, "max-w-40")} aria-label="نوع هدف" value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }}><option value="">همهٔ اهداف</option>{SCOPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button className={cn(btnPrimary, "ms-auto")} onClick={() => setEdit("new")}><Plus className="size-4" />تخفیف جدید</button>
      </div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty text="هنوز تخفیفی تعریف نشده است." /> : (
        <>
          <Table head={["نام", "هدف", "مقدار", "بازهٔ زمانی", "حداقل خرید", "استفاده", "وضعیت", ""]}>
            {data.items.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2/60">
                <Td className="font-bold">{r.name}</Td>
                <Td><span className="text-xs text-muted">{SCOPES.find(([v]) => v === r.scope)?.[1]}</span><br />{r.targetLabel}</Td>
                <Td>{r.type === "PERCENT" ? `${fmtNum(r.value)}٪` : fmtToman(r.value)}</Td>
                <Td className="text-xs">{r.startsAt ? fmtDate(r.startsAt) : "از هم‌اکنون"}<br />{r.endsAt ? fmtDate(r.endsAt) : "بدون پایان"}</Td>
                <Td>{r.minOrder ? fmtToman(r.minOrder) : "—"}</Td>
                <Td className="text-xs">{fmtNum(r.usedCount)}{r.usageLimit ? ` / ${fmtNum(r.usageLimit)}` : ""}{r.perUserLimit ? <><br />هر کاربر: {fmtNum(r.perUserLimit)}</> : null}</Td>
                <Td><Pill tone={STATUS[r.status]?.[0] ?? "mute"}>{STATUS[r.status]?.[1] ?? r.status}</Pill></Td>
                <Td><div className="flex gap-1"><button className={cn(btnGhost, "h-8 px-2 text-xs")} onClick={() => toggle(r)}>{r.isActive ? "غیرفعال" : "فعال"}</button><button aria-label="ویرایش" className={cn(btnGhost, "h-8 px-2")} onClick={() => setEdit(r)}><Pencil className="size-4" /></button><button aria-label="حذف" className={cn(btnDanger, "h-8 px-2")} onClick={() => del(r)}><Trash2 className="size-4" /></button></div></Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
      {edit && <Editor row={edit === "new" ? null : edit} onClose={() => setEdit(null)} onDone={reload} />}
    </div>
  );
}
