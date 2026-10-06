"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { Card, Empty, ErrorBox, Label, Modal, PAY_LABEL, Pager, Spinner, StatusPill, act, btnDanger, btnGhost, btnPrimary, confirmAsk, fmtDate, fmtId, fmtToman, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface Row { id: string; amount: number; status: string; referenceNumber: string | null; submittedAt: string | null; createdAt: string; rejectReason: string | null; order: { number: number; customerName: string; customerPhone: string }; proofs: { id: string; originalName: string; mime: string }[] }
const TABS = [["REVIEW", "در انتظار بررسی"], ["PAID", "تأیید شده"], ["REJECTED", "رد شده"], ["PENDING", "پرداخت نشده"]] as const;

export function PaymentsClient() {
  const [status, setStatus] = useState<string>("REVIEW"); const [page, setPage] = useState(1); const [rej, setRej] = useState<Row | null>(null); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useApi<{ items: Row[]; total: number; page: number; pages: number }>(`/api/admin/payments?status=${status}&page=${page}`);
  const approve = async (p: Row) => { if (!confirmAsk(`پرداخت سفارش ${fmtId(p.order.number)} به مبلغ ${fmtToman(p.amount)} تأیید شود؟`)) return; setBusy(true); const r = await act("POST", `/api/admin/payments/${p.id}/approve`, undefined, "پرداخت تأیید شد."); setBusy(false); if (r.ok) reload(); };
  const reject = async () => { if (!rej) return; setBusy(true); const r = await act("POST", `/api/admin/payments/${rej.id}/reject`, { reason }, "پرداخت رد شد."); setBusy(false); if (r.ok) { setRej(null); setReason(""); reload(); } };
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-surface p-1 shadow-sm" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setPage(1); }} className={cn("h-9 cursor-pointer rounded-md px-4 text-sm font-bold", status === k ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}>{l}</button>)}</div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty text={status === "REVIEW" ? "پرداختی در انتظار بررسی نیست 🎉" : "موردی نیست."} /> : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.items.map((p) => (
              <Card key={p.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div><Link href={`/admin/orders/${p.order.number}`} className="text-lg font-black text-primary">سفارش #{fmtId(p.order.number)}</Link><div className="text-sm">{p.order.customerName} · <span dir="ltr">{p.order.customerPhone}</span></div></div>
                  <StatusPill map={PAY_LABEL} value={p.status} />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-[11px] text-muted">مبلغ</dt><dd className="font-black">{fmtToman(p.amount)}</dd></div><div><dt className="text-[11px] text-muted">تاریخ ارسال رسید</dt><dd>{fmtDate(p.submittedAt ?? p.createdAt)}</dd></div><div className="col-span-2"><dt className="text-[11px] text-muted">شماره پیگیری / مرجع</dt><dd dir="ltr" className="text-start font-bold">{p.referenceNumber ?? "—"}</dd></div></dl>
                {p.rejectReason && <p className="rounded-lg bg-error/10 p-2 text-xs text-error">دلیل رد: {p.rejectReason}</p>}
                <div className="flex flex-wrap gap-2">
                  {p.proofs.map((f) => f.mime.startsWith("image/")
                    ? <a key={f.id} href={`/api/orders/${p.order.number}/payment/proof/${f.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">{}<img src={`/api/orders/${p.order.number}/payment/proof/${f.id}`} alt={`رسید ${f.originalName}`} className="h-32 w-auto max-w-full object-cover" /></a>
                    : <a key={f.id} href={`/api/orders/${p.order.number}/payment/proof/${f.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 text-sm font-bold text-primary">📄 {f.originalName}</a>)}
                  {p.proofs.length === 0 && <span className="text-xs text-muted">رسیدی بارگذاری نشده.</span>}
                </div>
                {p.status === "REVIEW" && <div className="flex gap-2 border-t border-border pt-3"><button className={cn(btnPrimary, "flex-1")} disabled={busy} onClick={() => approve(p)}><Check className="size-4" />تأیید پرداخت</button><button className={cn(btnDanger, "flex-1")} disabled={busy} onClick={() => { setRej(p); setReason(""); }}><X className="size-4" />رد پرداخت</button></div>}
              </Card>
            ))}
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
      {rej && (
        <Modal title={`رد پرداخت سفارش ${fmtId(rej.order.number)}`} onClose={() => setRej(null)}>
          <Label label="دلیل رد (الزامی — برای مشتری نمایش داده می‌شود)"><textarea className={cn(inputCls, "h-24 py-2")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus /></Label>
          <div className="mt-4 flex justify-end gap-2"><button className={btnGhost} onClick={() => setRej(null)}>انصراف</button><button className={btnDanger} disabled={reason.trim().length < 3 || busy} onClick={reject}>ثبت رد پرداخت</button></div>
        </Modal>
      )}
    </div>
  );
}
