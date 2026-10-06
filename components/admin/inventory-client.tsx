"use client";
import { useMemo, useState } from "react";
import { Empty, ErrorBox, Label, Modal, Pager, Pill, Spinner, Table, Td, act, btnGhost, btnPrimary, fmtDate, fmtNum, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface Row { variantId: string; sku: string; variant: string; product: { id: string; name: string }; quantity: number; lowStockThreshold: number; low: boolean }
const REASONS = [["restock", "ورود کالا / تأمین"], ["manual", "اصلاح دستی"], ["correction", "اصلاح شمارش انبار"], ["damage", "خرابی / مرجوعی معیوب"], ["return", "مرجوعی سالم"]];

function Adjust({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"add" | "remove" | "set">("add"); const [qty, setQty] = useState(""); const [reason, setReason] = useState("restock"); const [note, setNote] = useState(""); const [th, setTh] = useState(String(row.lowStockThreshold)); const [busy, setBusy] = useState(false);
  const hist = useApi<{ id: string; delta: number; balanceAfter: number | null; reason: string; note: string | null; createdAt: string; by: string | null }[]>(`/api/admin/inventory/${row.variantId}`);
  const preview = mode === "add" ? row.quantity + Number(qty || 0) : mode === "remove" ? row.quantity - Number(qty || 0) : Number(qty || 0);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); const r = await act("POST", `/api/admin/inventory/${row.variantId}/adjust`, { mode, quantity: Number(qty), reason, note: note || undefined }, "موجودی به‌روزرسانی شد."); setBusy(false); if (r.ok) { onDone(); onClose(); } };
  const saveTh = async () => { const r = await act("POST", `/api/admin/inventory/${row.variantId}/threshold`, { lowStockThreshold: Number(th) }, "آستانه ذخیره شد."); if (r.ok) onDone(); };
  return (
    <Modal title={`${row.product.name} — ${row.variant}`} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <form onSubmit={submit} className="space-y-3">
          <div className="text-sm">موجودی فعلی: <b>{fmtNum(row.quantity)}</b> <span dir="ltr" className="text-xs text-muted">({row.sku})</span></div>
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1" role="tablist">{([["add", "افزایش"], ["remove", "کاهش"], ["set", "تنظیم مقدار"]] as const).map(([m, l]) => <button type="button" key={m} onClick={() => setMode(m)} className={cn("h-9 flex-1 cursor-pointer rounded-md text-sm font-bold", mode === m ? "bg-primary text-primary-fg" : "")}>{l}</button>)}</div>
          <Label label={mode === "set" ? "مقدار جدید" : "تعداد"}><input dir="ltr" type="number" min={0} required className={inputCls} value={qty} onChange={(e) => setQty(e.target.value)} /></Label>
          <Label label="دلیل"><select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Label>
          <Label label="توضیح" hint={mode !== "add" && reason !== "damage" ? "برای کاهش/تنظیم لازم است" : undefined}><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Label>
          {qty !== "" && <div className={cn("rounded-lg p-2 text-sm", preview < 0 ? "bg-error/10 text-error" : "bg-primary/10")}>موجودی پس از تغییر: <b>{fmtNum(preview)}</b></div>}
          <button className={cn(btnPrimary, "w-full")} disabled={busy || qty === "" || preview < 0}>{busy ? "…" : "ثبت تغییر"}</button>
          <div className="flex items-end gap-2 border-t border-border pt-3"><Label label="آستانه کم‌موجودی" className="flex-1"><input dir="ltr" type="number" min={0} className={inputCls} value={th} onChange={(e) => setTh(e.target.value)} /></Label><button type="button" className={btnGhost} onClick={saveTh}>ذخیره</button></div>
        </form>
        <div>
          <h3 className="mb-2 text-sm font-black">تاریخچه تغییرات</h3>
          {hist.loading ? <Spinner /> : !hist.data?.length ? <Empty text="تغییری ثبت نشده." /> : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto text-xs">{hist.data.map((m) => <li key={m.id} className="py-2"><div className="flex items-center justify-between"><b dir="ltr" className={m.delta > 0 ? "text-success" : "text-error"}>{m.delta > 0 ? "+" : ""}{fmtNum(m.delta)}</b><span className="text-muted">← {fmtNum(m.balanceAfter)}</span><span className="text-muted">{fmtDate(m.createdAt)}</span></div><div className="text-muted">{m.reason}{m.note ? ` — ${m.note}` : ""}{m.by ? ` (${m.by})` : ""}</div></li>)}</ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function InventoryClient({ initialQ, initialLow, canWrite }: { initialQ: string; initialLow: boolean; canWrite: boolean }) {
  const [q, setQ] = useState(initialQ); const [low, setLow] = useState(initialLow); const [page, setPage] = useState(1); const [row, setRow] = useState<Row | null>(null);
  const url = useMemo(() => { const u = new URLSearchParams({ page: String(page) }); if (q) u.set("q", q); if (low) u.set("low", "1"); return `/api/admin/inventory?${u}`; }, [q, low, page]);
  const { data, error, loading, reload } = useApi<{ items: Row[]; total: number; page: number; pages: number }>(url);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input className={cn(inputCls, "max-w-64")} placeholder="نام محصول یا SKU…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="جستجو" />
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-[var(--primary)]" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(1); }} />فقط کم‌موجودی</label>
      </div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty /> : (
        <>
          <Table head={["محصول", "تنوع", "SKU", "موجودی", "آستانه", ""]}>
            {data.items.map((r) => <tr key={r.variantId} className="hover:bg-surface-2/60"><Td className="font-bold">{r.product.name}</Td><Td>{r.variant}</Td><Td><code dir="ltr" className="text-xs">{r.sku}</code></Td><Td><Pill tone={r.quantity === 0 ? "bad" : r.low ? "warn" : "ok"}>{fmtNum(r.quantity)}</Pill></Td><Td>{fmtNum(r.lowStockThreshold)}</Td><Td className="text-end"><button className={cn(btnGhost, "h-8 px-3 text-xs")} onClick={() => setRow(r)}>{canWrite ? "تنظیم موجودی" : "تاریخچه"}</button></Td></tr>)}
          </Table>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
      {row && <Adjust row={row} onClose={() => setRow(null)} onDone={reload} />}
    </div>
  );
}
