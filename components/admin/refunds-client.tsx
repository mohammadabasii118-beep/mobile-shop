"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, Empty, ErrorBox, Label, Modal, Pager, Pill, Spinner, act, btnDanger, btnGhost, btnPrimary, fmtDate, fmtId, fmtToman, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface R { id: string; method: string; amount: number; status: string; reason: string; bankNote: string | null; bankReference: string | null; restock: boolean; createdAt: string; completedAt: string | null; order: { number: number; customerName: string; customerPhone: string; total: number } }
export const REFUND_STATUS: Record<string, [string, "warn" | "info" | "ok" | "bad" | "mute"]> = { AWAITING_CUSTOMER: ["در انتظار تأیید مشتری", "info"], PENDING_BANK: ["در انتظار واریز بانکی", "warn"], COMPLETED: ["انجام شد", "ok"], REJECTED: ["رد توسط مشتری", "bad"], CANCELLED: ["لغو شد", "mute"] };
const TABS = [["PENDING_BANK", "واریز بانکی"], ["AWAITING_CUSTOMER", "منتظر مشتری"], ["COMPLETED", "انجام‌شده"], ["REJECTED", "ردشده"], ["CANCELLED", "لغوشده"]] as const;

export function RefundsClient({ canApprove }: { canApprove: boolean }) {
  const [status, setStatus] = useState<string>("PENDING_BANK"); const [page, setPage] = useState(1);
  const [dlg, setDlg] = useState<{ r: R; kind: "complete" | "cancel" } | null>(null); const [ref, setRef] = useState(""); const [reason, setReason] = useState(""); const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useApi<{ items: R[]; total: number; page: number; pages: number }>(`/api/admin/refunds?status=${status}&page=${page}`);
  const close = () => { setDlg(null); setRef(""); setReason(""); setConfirm(false); };
  const submit = async () => {
    if (!dlg) return; setBusy(true);
    const r = dlg.kind === "complete" ? await act("POST", `/api/admin/refunds/${dlg.r.id}/complete`, { bankReference: ref, confirm }, "واریز بانکی ثبت شد.") : await act("POST", `/api/admin/refunds/${dlg.r.id}/cancel`, { reason }, "درخواست لغو شد.");
    setBusy(false); if (r.ok) { close(); reload(); }
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-surface p-1 shadow-sm" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setPage(1); }} className={cn("h-9 cursor-pointer rounded-md px-4 text-sm font-bold", status === k ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}>{l}</button>)}</div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty text="موردی نیست." /> : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.items.map((r) => (
              <Card key={r.id} className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-2"><div><Link href={`/admin/orders/${r.order.number}`} className="text-base font-black text-primary">سفارش #{fmtId(r.order.number)}</Link><div>{r.order.customerName} · <span dir="ltr">{r.order.customerPhone}</span></div></div><Pill tone={REFUND_STATUS[r.status]![1]}>{REFUND_STATUS[r.status]![0]}</Pill></div>
                <dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted">مبلغ</dt><dd className="text-base font-black">{fmtToman(r.amount)}</dd></div><div><dt className="text-muted">مقصد</dt><dd className="font-bold">{r.method === "wallet" ? "کیف پول مشتری" : "حساب بانکی (دستی)"}</dd></div><div className="col-span-2"><dt className="text-muted">دلیل</dt><dd>{r.reason}{r.restock ? " · بازگشت به انبار" : ""}</dd></div>{r.bankNote && <div className="col-span-2"><dt className="text-muted">مقصد واریز</dt><dd dir="auto" className="rounded-lg bg-surface-2 p-2">{r.bankNote}</dd></div>}{r.bankReference && <div className="col-span-2"><dt className="text-muted">شماره پیگیری بانکی</dt><dd dir="ltr" className="text-start font-black">{r.bankReference}</dd></div>}<div className="col-span-2 text-muted">ثبت: {fmtDate(r.createdAt)}{r.completedAt ? ` · تکمیل: ${fmtDate(r.completedAt)}` : ""}</div></dl>
                {(r.status === "PENDING_BANK" || r.status === "AWAITING_CUSTOMER") && <div className="flex gap-2 border-t border-border pt-3">
                  {r.status === "PENDING_BANK" && canApprove && <button className={cn(btnPrimary, "flex-1")} onClick={() => setDlg({ r, kind: "complete" })}>تأیید واریز و ثبت شماره پیگیری</button>}
                  <button className={cn(btnGhost, "flex-1")} onClick={() => setDlg({ r, kind: "cancel" })}>لغو درخواست</button></div>}
              </Card>
            ))}
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
      {dlg && (
        <Modal title={dlg.kind === "complete" ? `تأیید واریز — سفارش ${fmtId(dlg.r.order.number)}` : "لغو درخواست بازگشت وجه"} onClose={close}>
          <div className="space-y-3">
            {dlg.kind === "complete" ? (
              <>
                <p className="rounded-lg bg-warning/10 p-3 text-xs leading-6">مبلغ <b>{fmtToman(dlg.r.amount)}</b> باید قبلاً از بانک به مقصد زیر واریز شده باشد:<br /><b dir="auto">{dlg.r.bankNote}</b></p>
                <Label label="شماره پیگیری بانکی *"><input dir="ltr" className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} autoFocus /></Label>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-[var(--primary)]" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />تأیید می‌کنم که واریز واقعی انجام شده است. (پس از ثبت قابل بازگشت نیست.)</label>
              </>
            ) : <Label label="دلیل لغو (الزامی)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus /></Label>}
            <div className="flex justify-end gap-2"><button className={btnGhost} onClick={close}>انصراف</button><button className={dlg.kind === "complete" ? btnPrimary : btnDanger} disabled={busy || (dlg.kind === "complete" ? !confirm || ref.trim().length < 4 : reason.trim().length < 3)} onClick={submit}>ثبت</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
