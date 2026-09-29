"use client";
import { useRef, useState } from "react";
import { submitReceipt } from "@/lib/actions/cardTransfer";
import { fmtToman } from "@/lib/format";
import Icon from "@/components/Icon";

type Bank = { cardNumber: string; cardHolderName: string; bankName: string };
type LatestReceipt = { status: "PENDING" | "APPROVED" | "REJECTED"; rejectReason: string | null } | null;

export default function CardTransferForm({
  orderId,
  guestToken,
  orderStatus,
  amount,
  bank,
  latestReceipt,
  reservationExpiresAt,
}: {
  orderId: string;
  guestToken?: string | null;
  orderStatus: string;
  amount: number;
  bank: Bank;
  latestReceipt: LatestReceipt;
  reservationExpiresAt?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const alreadyPaid = orderStatus === "PAID" || orderStatus === "PROCESSING" || orderStatus === "SHIPPED" || orderStatus === "DELIVERED";
  const showForm = !alreadyPaid && !submitted && (!latestReceipt || latestReceipt.status === "REJECTED");

  function copyCard() {
    navigator.clipboard.writeText(bank.cardNumber.replace(/\s|-/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("لطفاً تصویر رسید را انتخاب کنید"); return; }
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    if (trackingCode) fd.append("trackingCode", trackingCode);
    const res = await submitReceipt(orderId, guestToken ?? null, fd);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setSubmitted(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="surface border line rounded-2xl p-5">
        <h2 className="font-bold text-sm mb-4">اطلاعات کارت مقصد</h2>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="muted">شماره کارت</span>
            <div className="flex items-center gap-2">
              <span dir="ltr" className="font-mono font-bold">{bank.cardNumber}</span>
              <button type="button" onClick={copyCard} className="w-8 h-8 rounded-full border line flex items-center justify-center" aria-label="کپی شماره کارت">
                <Icon name={copied ? "check" : "copy"} className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between"><span className="muted">صاحب کارت</span><span className="font-medium">{bank.cardHolderName}</span></div>
          <div className="flex items-center justify-between"><span className="muted">بانک</span><span className="font-medium">{bank.bankName}</span></div>
          <div className="flex items-center justify-between border-t line pt-3 mt-1"><span className="muted">مبلغ دقیق قابل پرداخت</span><span className="font-extrabold">{fmtToman(amount)}</span></div>
        </div>
        {copied && <p className="text-xs mt-2" style={{ color: "#404040" }}>شماره کارت کپی شد</p>}
      </div>

      {!alreadyPaid && reservationExpiresAt && (
        <p className="text-xs muted text-center">
          موجودی این سفارش تا {new Date(reservationExpiresAt).toLocaleString("fa-IR")} برای شما رزرو شده است. لطفاً پیش از این زمان رسید پرداخت را ارسال کنید، در غیر این صورت سفارش لغو و موجودی آزاد می‌شود.
        </p>
      )}

      {alreadyPaid && (
        <div className="surface border line rounded-2xl p-5 text-center">
          <Icon name="check" className="w-10 h-10 mx-auto mb-2 opacity-80" />
          <p className="font-bold text-sm">این سفارش پرداخت‌شده است</p>
        </div>
      )}

      {!alreadyPaid && latestReceipt?.status === "PENDING" && !submitted && (
        <div className="surface border line rounded-2xl p-5 text-center">
          <Icon name="clock" className="w-10 h-10 mx-auto mb-2 opacity-70" />
          <p className="font-bold text-sm mb-1">رسید شما ثبت شد و در انتظار تأیید مدیر است</p>
          <p className="muted text-xs">پس از بررسی، وضعیت سفارش شما به‌روزرسانی می‌شود.</p>
        </div>
      )}

      {!alreadyPaid && latestReceipt?.status === "REJECTED" && !submitted && (
        <div className="rounded-2xl p-4 text-sm" style={{ background: "#f6eae6", color: "#a24e56" }}>
          رسید قبلی شما تأیید نشد{latestReceipt.rejectReason ? `: ${latestReceipt.rejectReason}` : ""}. لطفاً رسید جدید ارسال کنید.
        </div>
      )}

      {submitted && (
        <div className="surface border line rounded-2xl p-5 text-center">
          <Icon name="clock" className="w-10 h-10 mx-auto mb-2 opacity-70" />
          <p className="font-bold text-sm">رسید شما ثبت شد و در انتظار تأیید مدیر است</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="surface border line rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="font-bold text-sm">ارسال رسید پرداخت</h2>
          <div>
            <label className="text-sm font-medium block mb-1">تصویر رسید بانکی</label>
            {preview && <img src={preview} alt="پیش‌نمایش رسید" className="w-32 h-32 object-cover rounded-lg border line mb-2" />}
            <button type="button" onClick={() => fileRef.current?.click()} className="px-4 h-10 rounded-full border line text-sm">
              {preview ? "تغییر تصویر" : "انتخاب تصویر رسید"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">شماره پیگیری تراکنش (اختیاری)</label>
            <input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" />
          </div>
          {error && <p className="text-sm" style={{ color: "#a24e56" }}>{error}</p>}
          <button disabled={loading} className="h-11 rounded-full text-white font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
            {loading ? "در حال ارسال…" : "ارسال رسید"}
          </button>
        </form>
      )}
    </div>
  );
}
