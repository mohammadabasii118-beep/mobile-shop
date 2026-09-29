import { db } from "@/lib/db";
import { fmtToman } from "@/lib/format";
import ReceiptReviewActions from "@/components/admin/ReceiptReviewActions";

const statusLabel: Record<string, string> = { PENDING: "در انتظار بررسی", APPROVED: "تأیید شده", REJECTED: "رد شده" };

export default async function AdminCardTransfersPage() {
  const receipts = await db.cardTransferReceipt.findMany({
    orderBy: { createdAt: "desc" },
    include: { order: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">پرداخت‌های کارت‌به‌کارت</h1>
      <p className="text-sm muted mb-6">رسیدهای ارسالی مشتریان برای پرداخت کارت‌به‌کارت. بعد از بررسی واریزی در حساب بانکی، پرداخت را تأیید یا رد کنید.</p>

      <div className="flex flex-col gap-4">
        {receipts.map((r) => (
          <div key={r.id} className="surface border line rounded-2xl p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
            <a href={`/api/receipts/${r.imageFile}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img src={`/api/receipts/${r.imageFile}`} alt="رسید" className="w-24 h-24 rounded-xl object-cover border line" />
            </a>
            <div className="flex-1 min-w-0 text-sm">
              <div className="font-bold">{r.order.orderNumber} — {fmtToman(r.order.total)}</div>
              <div className="muted">مشتری: {r.order.shippingName} — {r.order.shippingPhone}</div>
              {r.trackingCode && <div className="muted">کد پیگیری: {r.trackingCode}</div>}
              <div className="muted text-xs mt-1">
                تاریخ ثبت: {new Date(r.createdAt).toLocaleString("fa-IR")} · وضعیت: {statusLabel[r.status]}
                {r.status === "REJECTED" && r.rejectReason ? ` (${r.rejectReason})` : ""}
              </div>
            </div>
            <div className="shrink-0">
              {r.status === "PENDING" ? (
                <ReceiptReviewActions receiptId={r.id} />
              ) : (
                <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: r.status === "APPROVED" ? "var(--surface-2)" : "#f6eae6", color: r.status === "APPROVED" ? "var(--text)" : "#a24e56" }}>
                  {statusLabel[r.status]}
                </span>
              )}
            </div>
          </div>
        ))}
        {receipts.length === 0 && <p className="surface border line rounded-2xl p-6 text-center muted text-sm">رسیدی ثبت نشده است.</p>}
      </div>
    </div>
  );
}
