"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { ImageInput, Label, Modal, Pager, Pill, Table, Td, Empty, ErrorBox, Spinner, act, btnDanger, btnGhost, btnPrimary, confirmAsk, fmtDate, fmtNum, fmtToman, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

export interface Opt { value: string; label: string }
export interface FieldDef {
  key: string; label: string; type: "text" | "textarea" | "number" | "select" | "bool" | "date" | "image" | "products";
  options?: Opt[]; hint?: string; required?: boolean; nullable?: boolean; ltr?: boolean; lockOnEdit?: boolean; full?: boolean; placeholder?: string;
}
export interface ColDef { key: string; label: string; kind?: "text" | "bool" | "money" | "num" | "date" | "image" | "code"; map?: Record<string, string> }
export interface ManagerProps {
  resource: string; noun: string; columns: ColDef[]; fields: FieldDef[];
  filters?: { key: string; label: string; options: Opt[] }[];
  sortable?: boolean; canWrite?: boolean; defaults?: Record<string, unknown>; note?: string; toggleKey?: string;
}

const get = (o: unknown, path: string) => path.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), o);
const setDeep = (o: Record<string, unknown>, path: string, v: unknown) => {
  const ks = path.split("."); const out = { ...o }; let cur: Record<string, unknown> = out;
  ks.slice(0, -1).forEach((k) => { cur[k] = { ...((cur[k] as object) ?? {}) }; cur = cur[k] as Record<string, unknown>; });
  cur[ks.at(-1)!] = v; return out;
};
const toLocalInput = (v: unknown) => { if (!v) return ""; const d = new Date(String(v)); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function Cell({ row, col }: { row: unknown; col: ColDef }) {
  const v = get(row, col.key);
  switch (col.kind) {
    case "bool": return <Pill tone={v ? "ok" : "mute"}>{v ? "فعال" : "غیرفعال"}</Pill>;
    case "money": return <>{fmtToman(v as number)}</>;
    case "num": return <>{fmtNum(v as number)}</>;
    case "date": return <>{fmtDate(v as string)}</>;
    case "image": return v ? <img src={String(v)} alt="" className="size-10 rounded-md object-cover" /> : <span className="text-muted">—</span>;
    case "code": return <code dir="ltr" className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{String(v ?? "")}</code>;
    default: return <>{col.map ? col.map[String(v)] ?? String(v ?? "—") : v == null || v === "" ? "—" : String(v)}</>;
  }
}

function ProductPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const { data } = useApi<{ items: { id: string; name: string }[] }>(q.length >= 2 ? `/api/admin/products?q=${encodeURIComponent(q)}&per=8` : null);
  const names = useApi<{ items: { id: string; name: string }[] }>(value.length ? `/api/admin/products?per=200` : null);
  const nameOf = (id: string) => names.data?.items.find((p) => p.id === id)?.name ?? id.slice(0, 8);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">{value.map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs">{nameOf(id)}<button type="button" className="text-error" onClick={() => onChange(value.filter((x) => x !== id))} aria-label="حذف">✕</button></span>)}</div>
      <input className={inputCls} placeholder="جستجوی محصول برای افزودن…" value={q} onChange={(e) => setQ(e.target.value)} />
      {data?.items.length ? <ul className="rounded-md border border-border bg-surface">{data.items.filter((p) => !value.includes(p.id)).map((p) => <li key={p.id}><button type="button" className="w-full cursor-pointer px-3 py-2 text-start text-sm hover:bg-surface-2" onClick={() => { onChange([...value, p.id]); setQ(""); }}>{p.name}</button></li>)}</ul> : null}
      <p className="text-[11px] text-muted">اگر محصولی انتخاب شود، به‌جای دسته‌بندی همین محصولات نمایش داده می‌شوند.</p>
    </div>
  );
}

function FormModal({ p, row, onClose, onSaved }: { p: ManagerProps; row: Record<string, unknown> | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = { ...(p.defaults ?? {}) };
    for (const f of p.fields) {
      const cur = row ? get(row, f.key) : get(init, f.key);
      let val: unknown = cur ?? (f.type === "bool" ? true : f.type === "products" ? [] : "");
      if (f.type === "date") val = toLocalInput(cur);
      Object.assign(init, setDeep(init, f.key, val));
    }
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: string, val: unknown) => setV((o) => setDeep(o, k, val));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrs({});
    let body: Record<string, unknown> = {};
    for (const f of p.fields) {
      if (row && f.lockOnEdit) continue;
      let val = get(v, f.key);
      if (f.type === "number") val = val === "" || val == null ? (f.nullable ? null : undefined) : Number(val);
      if (f.type === "date") val = val ? new Date(String(val)).toISOString() : null;
      if (f.type === "select" && (val === "" || val == null) && f.nullable) val = null;
      if (f.type === "products") { const ids = val as string[]; body = setDeep(body, f.key, ids.length ? ids : undefined); continue; }
      if (val !== undefined) body = setDeep(body, f.key, val);
    }
    // a homepage "config" left empty must still be an object/null the API accepts
    const r = await act(row ? "PATCH" : "POST", row ? `/api/admin/r/${p.resource}/${row.id}` : `/api/admin/r/${p.resource}`, body, row ? "تغییرات ذخیره شد." : `${p.noun} ایجاد شد.`);
    setBusy(false);
    if (r.ok) { onSaved(); onClose(); } else if (r.fields) setErrs(r.fields);
  };

  return (
    <Modal title={row ? `ویرایش ${p.noun}` : `${p.noun} جدید`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {p.fields.map((f) => {
          const val = get(v, f.key);
          const err = errs[f.key] ?? errs[f.key.split(".")[0]!];
          const dis = !!row && !!f.lockOnEdit;
          return (
            <Label key={f.key} label={f.label + (f.required ? " *" : "")} hint={f.hint} error={err} className={cn((f.type === "textarea" || f.type === "image" || f.type === "products" || f.full) && "sm:col-span-2")}>
              {f.type === "textarea" ? <textarea className={cn(inputCls, "h-28 py-2")} value={String(val ?? "")} onChange={(e) => set(f.key, e.target.value)} />
                : f.type === "select" ? <select className={inputCls} value={String(val ?? "")} disabled={dis} onChange={(e) => set(f.key, e.target.value)}>{f.nullable && <option value="">— بدون —</option>}{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                : f.type === "bool" ? <span className="flex h-10 items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={!!val} onChange={(e) => set(f.key, e.target.checked)} /><span className="text-sm">{val ? "فعال" : "غیرفعال"}</span></span>
                : f.type === "image" ? <ImageInput value={(val as string) || null} onChange={(u) => set(f.key, u ?? "")} label={f.label} />
                : f.type === "products" ? <ProductPicker value={(val as string[]) ?? []} onChange={(ids) => set(f.key, ids)} />
                : <input className={inputCls} type={f.type === "number" ? "number" : f.type === "date" ? "datetime-local" : "text"} dir={f.ltr || f.type === "number" ? "ltr" : undefined} value={String(val ?? "")} disabled={dis} placeholder={f.placeholder} required={f.required && f.type !== "number"} onChange={(e) => set(f.key, e.target.value)} />}
            </Label>
          );
        })}
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <button type="button" className={btnGhost} onClick={onClose}>انصراف</button>
          <button className={btnPrimary} disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیره"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ResourceManager(p: ManagerProps) {
  const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [flt, setFlt] = useState<Record<string, string>>({});
  const [edit, setEdit] = useState<Record<string, unknown> | "new" | null>(null);
  const per = p.sortable ? 200 : 30;
  const url = useMemo(() => { const u = new URLSearchParams({ page: String(page), per: String(per) }); if (q) u.set("q", q); Object.entries(flt).forEach(([k, val]) => val && u.set(k, val)); return `/api/admin/r/${p.resource}?${u}`; }, [p.resource, q, page, flt, per]);
  const { data, error, loading, reload } = useApi<{ items: Record<string, unknown>[]; total: number; page: number; pages: number }>(url);

  const del = async (row: Record<string, unknown>) => { if (confirmAsk(`این ${p.noun} حذف شود؟`)) { const r = await act("DELETE", `/api/admin/r/${p.resource}/${row.id}`, undefined, "حذف شد."); if (r.ok) reload(); } };
  const toggle = async (row: Record<string, unknown>) => { const k = p.toggleKey ?? "isActive"; const r = await act("PATCH", `/api/admin/r/${p.resource}/${row.id}`, { [k]: !row[k] }, "وضعیت تغییر کرد."); if (r.ok) reload(); };
  const move = async (i: number, dir: -1 | 1) => {
    const items = data!.items; const j = i + dir; if (j < 0 || j >= items.length) return;
    const ids = items.map((x) => String(x.id)); [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    const r = await act("POST", `/api/admin/r/${p.resource}/reorder`, { ids }, "ترتیب ذخیره شد."); if (r.ok) reload();
  };
  const canReorder = p.sortable && p.canWrite !== false && !q && !Object.values(flt).some(Boolean);

  return (
    <div>
      {p.note && <p className="mb-3 rounded-lg bg-primary/10 p-3 text-xs leading-6">{p.note}</p>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className={cn(inputCls, "max-w-64")} placeholder="جستجو…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="جستجو" />
        {p.filters?.map((f) => <select key={f.key} className={cn(inputCls, "w-auto")} value={flt[f.key] ?? ""} aria-label={f.label} onChange={(e) => { setFlt((o) => ({ ...o, [f.key]: e.target.value })); setPage(1); }}><option value="">{f.label}: همه</option>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}
        {p.canWrite !== false && <button className={cn(btnPrimary, "ms-auto")} onClick={() => setEdit("new")}><Plus className="size-4" />{p.noun} جدید</button>}
      </div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data || data.items.length === 0 ? <Empty /> : (
        <>
          <Table head={[...p.columns.map((c) => c.label), ""]}>
            {data.items.map((row, i) => (
              <tr key={String(row.id)} className="hover:bg-surface-2/60">
                {p.columns.map((c) => <Td key={c.key}><Cell row={row} col={c} /></Td>)}
                <Td className="whitespace-nowrap text-end">
                  {p.canWrite !== false && (
                    <span className="inline-flex items-center gap-1">
                      {canReorder && <><button className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-surface-2 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="بالا"><ArrowUp className="size-4" /></button><button className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-surface-2 disabled:opacity-30" disabled={i === data.items.length - 1} onClick={() => move(i, 1)} aria-label="پایین"><ArrowDown className="size-4" /></button></>}
                      {(p.toggleKey || "isActive" in row) && <button className={cn(btnGhost, "h-8 px-2 text-xs")} onClick={() => toggle(row)}>{row[p.toggleKey ?? "isActive"] ? "غیرفعال" : "فعال"}</button>}
                      <button className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-primary/10 hover:text-primary" onClick={() => setEdit(row)} aria-label="ویرایش"><Pencil className="size-4" /></button>
                      <button className={cn(btnDanger, "size-8 p-0")} onClick={() => del(row)} aria-label="حذف"><Trash2 className="size-4" /></button>
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          {!p.sortable && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
        </>
      )}
      {edit && <FormModal p={p} row={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  );
}
