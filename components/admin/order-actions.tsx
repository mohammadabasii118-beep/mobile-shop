"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, Label, act, btnDanger, btnGhost, btnPrimary, inputCls } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface Props { number: number; status: string; paymentStatus: string; canWrite: boolean; allowed: { value: string; label: string }[]; methods: { value: string; label: string }[]; shipping: { methodId: string; company: string; tracking: string } }

export function OrderActions({ number, status, paymentStatus, canWrite, allowed, methods, shipping }: Props) {
  const router = useRouter();
  const [next, setNext] = useState(""); const [note, setNote] = useState(""); const [sh, setSh] = useState(shipping); const [reason, setReason] = useState(""); const [restock, setRestock] = useState(true); const [busy, setBusy] = useState(false);
  if (!canWrite) return null;
  const closed = status === "CANCELLED" || status === "REFUNDED";
  const run = async (m: string, path: string, body: unknown, msg: string) => { setBusy(true); const r = await act(m, `/api/admin/orders/${number}/${path}`, body, msg); setBusy(false); if (r.ok) router.refresh(); return r.ok; };
  return (
    <div className="space-y-4">
      {allowed.length > 0 && (
        <Card className="space-y-3"><h3 className="text-sm font-black">تغییر وضعیت</h3>
          <Label label="وضعیت جدید"><select className={inputCls} value={next} onChange={(e) => setNext(e.target.value)}><option value="">انتخاب کنید…</option>{allowed.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></Label>
          <Label label="توضیح (نمایش در تایم‌لاین مشتری)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Label>
          <button className={cn(btnPrimary, "w-full")} disabled={!next || busy} onClick={async () => { if (await run("POST", "status", { status: next, note: note || undefined }, "وضعیت تغییر کرد.")) { setNext(""); setNote(""); } }}>ثبت وضعیت</button>
        </Card>
      )}
      {!closed && (
        <Card className="space-y-3"><h3 className="text-sm font-black">ارسال</h3>
          <Label label="روش ارسال"><select className={inputCls} value={sh.methodId} onChange={(e) => setSh({ ...sh, methodId: e.target.value })}><option value="">—</option>{methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Label>
          <Label label="شرکت حمل"><input className={inputCls} value={sh.company} onChange={(e) => setSh({ ...sh, company: e.target.value })} maxLength={80} /></Label>
          <Label label="کد رهگیری"><input dir="ltr" className={inputCls} value={sh.tracking} onChange={(e) => setSh({ ...sh, tracking: e.target.value })} maxLength={60} /></Label>
          <button className={cn(btnGhost, "w-full")} disabled={busy} onClick={() => run("POST", "shipping", { shippingMethodId: sh.methodId || null, shippingCompany: sh.company, trackingNumber: sh.tracking }, "اطلاعات ارسال ذخیره شد.")}>ذخیره ارسال</button>
        </Card>
      )}
      {!closed && (
        <Card className="space-y-3"><h3 className="text-sm font-black text-error">لغو / بازگشت وجه</h3>
          <Label label="دلیل (الزامی)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Label>
          {paymentStatus === "PAID" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--primary)]" checked={restock} onChange={(e) => setRestock(e.target.checked)} />برگرداندن کالاها به انبار</label>}
          {paymentStatus === "PAID"
            ? <button className={cn(btnDanger, "w-full")} disabled={reason.trim().length < 3 || busy} onClick={() => confirm("بازگشت وجه ثبت شود؟") && run("POST", "refund", { reason, restock }, "بازگشت وجه ثبت شد.")}>شروع بازگشت وجه</button>
            : <button className={cn(btnDanger, "w-full")} disabled={reason.trim().length < 3 || busy} onClick={() => confirm("سفارش لغو و موجودی برگردانده شود؟") && run("POST", "cancel", { reason }, "سفارش لغو شد.")}>لغو سفارش</button>}
          {paymentStatus === "PAID" && <p className="text-[11px] text-muted">بازپرداخت پول به‌صورت دستی انجام می‌شود (بازگشت به کیف پول در فاز بعد).</p>}
        </Card>
      )}
    </div>
  );
}
