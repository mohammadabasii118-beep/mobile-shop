"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, Label, act, btnDanger, btnGhost, btnPrimary, inputCls } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface Props { number: number; status: string; paymentStatus: string; canWrite: boolean; canRefund: boolean; money: { totalPaid: number; cardPaid: number; walletPaid: number; refundable: number; bankRefundable: number }; allowed: { value: string; label: string }[]; methods: { value: string; label: string }[]; shipping: { methodId: string; company: string; tracking: string } }

export function OrderActions({ number, status, paymentStatus, canWrite, canRefund, money, allowed, methods, shipping }: Props) {
  const router = useRouter();
  const [next, setNext] = useState(""); const [note, setNote] = useState(""); const [sh, setSh] = useState(shipping); const [reason, setReason] = useState(""); const [restock, setRestock] = useState(true); const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"wallet" | "bank">("wallet"); const [amount, setAmount] = useState(""); const [bankNote, setBankNote] = useState(""); const [idem, setIdem] = useState(() => crypto.randomUUID());
  if (!canWrite && !canRefund) return null;
  const closed = status === "CANCELLED" || status === "REFUNDED";
  const run = async (m: string, path: string, body: unknown, msg: string) => { setBusy(true); const r = await act(m, `/api/admin/orders/${number}/${path}`, body, msg); setBusy(false); if (r.ok) router.refresh(); return r.ok; };
  return (
    <div className="space-y-4">
      {canWrite && allowed.length > 0 && (
        <Card className="space-y-3"><h3 className="text-sm font-black">تغییر وضعیت</h3>
          <Label label="وضعیت جدید"><select className={inputCls} value={next} onChange={(e) => setNext(e.target.value)}><option value="">انتخاب کنید…</option>{allowed.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></Label>
          <Label label="توضیح (نمایش در تایم‌لاین مشتری)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Label>
          <button className={cn(btnPrimary, "w-full")} disabled={!next || busy} onClick={async () => { if (await run("POST", "status", { status: next, note: note || undefined }, "وضعیت تغییر کرد.")) { setNext(""); setNote(""); } }}>ثبت وضعیت</button>
        </Card>
      )}
      {canWrite && !closed && (
        <Card className="space-y-3"><h3 className="text-sm font-black">ارسال</h3>
          <Label label="روش ارسال"><select className={inputCls} value={sh.methodId} onChange={(e) => setSh({ ...sh, methodId: e.target.value })}><option value="">—</option>{methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Label>
          <Label label="شرکت حمل"><input className={inputCls} value={sh.company} onChange={(e) => setSh({ ...sh, company: e.target.value })} maxLength={80} /></Label>
          <Label label="کد رهگیری"><input dir="ltr" className={inputCls} value={sh.tracking} onChange={(e) => setSh({ ...sh, tracking: e.target.value })} maxLength={60} /></Label>
          <button className={cn(btnGhost, "w-full")} disabled={busy} onClick={() => run("POST", "shipping", { shippingMethodId: sh.methodId || null, shippingCompany: sh.company, trackingNumber: sh.tracking }, "اطلاعات ارسال ذخیره شد.")}>ذخیره ارسال</button>
        </Card>
      )}
      {canWrite && !closed && paymentStatus !== "PAID" && (
        <Card className="space-y-3"><h3 className="text-sm font-black text-error">لغو سفارش (پرداخت‌نشده)</h3>
          <Label label="دلیل (الزامی)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Label>
          <button className={cn(btnDanger, "w-full")} disabled={reason.trim().length < 3 || busy} onClick={() => confirm("سفارش لغو شود؟ موجودی، کوپن، امتیاز و اعتبار کیف پولِ استفاده‌شده برگردانده می‌شود.") && run("POST", "cancel", { reason }, "سفارش لغو شد.")}>لغو سفارش</button>
        </Card>
      )}
      {!closed && paymentStatus === "PAID" && canRefund && (
        <Card className="space-y-3"><h3 className="text-sm font-black text-error">بازگشت وجه</h3>
          <p className="rounded-lg bg-surface-2 p-2 text-[11px] leading-6">پرداخت‌شده: {money.totalPaid.toLocaleString("fa-IR")} تومان (کارت {money.cardPaid.toLocaleString("fa-IR")} + کیف پول {money.walletPaid.toLocaleString("fa-IR")}) — قابل بازگشت: <b>{money.refundable.toLocaleString("fa-IR")}</b> · سقف بانکی: <b>{money.bankRefundable.toLocaleString("fa-IR")}</b></p>
          <Label label="مقصد"><select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as "wallet" | "bank")}><option value="wallet">کیف پول مشتری (با تأیید مشتری)</option><option value="bank">حساب بانکی — دستی (با تأیید مدیر)</option></select></Label>
          <Label label="مبلغ (تومان)"><input dir="ltr" type="number" min={1} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(method === "bank" ? money.bankRefundable : money.refundable)} /></Label>
          {method === "bank" && <Label label="مقصد واریز (شماره کارت / شبا و نام صاحب حساب) *"><input className={inputCls} value={bankNote} onChange={(e) => setBankNote(e.target.value)} maxLength={300} /></Label>}
          <Label label="دلیل (الزامی)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--primary)]" checked={restock} onChange={(e) => setRestock(e.target.checked)} />کالاها پس از بازگشت وجه به انبار برگردند</label>
          <button className={cn(btnDanger, "w-full")} disabled={busy || reason.trim().length < 3 || Number(amount) < 1 || (method === "bank" && bankNote.trim().length < 3)} onClick={() => run("POST", "refunds", { method, amount: Number(amount), reason, restock, bankNote: bankNote || undefined, idempotencyKey: idem }, "درخواست بازگشت وجه ثبت شد.").then((ok) => { if (ok) { setAmount(""); setReason(""); setIdem(crypto.randomUUID()); } })}>ثبت درخواست بازگشت وجه</button>
          <p className="text-[11px] text-muted">با ثبت درخواست هنوز پولی جابه‌جا نمی‌شود. وضعیت سفارش پس از بازگشت واقعی کل مبلغ «مرجوع‌شده» می‌شود.</p>
        </Card>
      )}
    </div>
  );
}
