import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtToman, fa } from "@/lib/format";
import OrderTimeline from "@/components/OrderTimeline";

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده", DELIVERED: "تحویل داده شده", CANCELED: "لغو شده",
};
const receiptStatusLabel: Record<string, string> = { PENDING: "در انتظار تأیید مدیر", APPROVED: "تأیید شده", REJECTED: "رد شده" };

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      receipts: { orderBy: { createdAt: "desc" }, take: 1 },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order || order.userId !== session.user.id) notFound();
  const latestReceipt = order.receipts[0] || null;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-10">
      <h1 className="text-xl font-extrabold mb-1">سفارش {order.orderNumber}</h1>
      <p className="muted text-sm mb-1">وضعیت: {statusLabel[order.status]}</p>
      <p className="muted text-sm mb-6">
        روش پرداخت: {order.paymentMethod === "CARD_TRANSFER" ? "کارت‌به‌کارت" : "زرین‌پال"}
        {order.paymentMethod === "CARD_TRANSFER" && latestReceipt && ` — ${receiptStatusLabel[latestReceipt.status]}`}
      </p>

      {order.paymentMethod === "CARD_TRANSFER" && order.status === "PENDING_PAYMENT" && (!latestReceipt || latestReceipt.status === "REJECTED") && (
        <div className="rounded-xl p-4 text-sm mb-6" style={{ background: "#f6eae6" }}>
          {latestReceipt?.status === "REJECTED" ? `رسید قبلی تأیید نشد${latestReceipt.rejectReason ? `: ${latestReceipt.rejectReason}` : ""}. ` : "برای این سفارش هنوز رسیدی ارسال نکرده‌اید. "}
          <Link href={`/checkout/card-transfer/${order.id}`} className="font-bold underline underline-offset-4">ارسال رسید</Link>
        </div>
      )}

      {(order.trackingCarrier || order.trackingNumber) && (
        <div className="rounded-xl p-4 text-sm mb-6 surface2">
          <p className="font-bold mb-1">اطلاعات رهگیری مرسوله</p>
          {order.trackingCarrier && <p className="muted">شرکت پستی: {order.trackingCarrier}</p>}
          {order.trackingNumber && <p className="muted">کد رهگیری: {order.trackingNumber}</p>}
        </div>
      )}

      <div className="mb-6">
        <OrderTimeline history={order.statusHistory.map((h) => ({ id: h.id, status: h.status, note: h.note, createdAt: h.createdAt.toISOString() }))} />
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between text-sm surface border line rounded-xl p-3">
            <span>
              {it.nameSnapshot}
              {it.variantLabel && <span className="muted"> ({it.variantLabel})</span>} × {fa(it.quantity)}
            </span>
            <span className="font-medium">{fmtToman(it.total)}</span>
          </div>
        ))}
      </div>

      <div className="surface2 rounded-xl p-4 text-sm flex flex-col gap-1 mb-6">
        <div className="flex justify-between"><span>جمع کالاها</span><span>{fmtToman(order.subtotal)}</span></div>
        {order.discountAmount > 0 && <div className="flex justify-between"><span>تخفیف</span><span>-{fmtToman(order.discountAmount)}</span></div>}
        <div className="flex justify-between"><span>هزینه ارسال</span><span>{order.shippingFee === 0 ? "رایگان" : fmtToman(order.shippingFee)}</span></div>
        {order.loyaltyDiscount > 0 && (
          <div className="flex justify-between"><span>تخفیف امتیاز باشگاه مشتریان ({order.loyaltyPointsUsed} امتیاز)</span><span>-{fmtToman(order.loyaltyDiscount)}</span></div>
        )}
        <div className="flex justify-between font-bold border-t line pt-2 mt-1"><span>مبلغ نهایی</span><span>{fmtToman(order.total)}</span></div>
        {order.walletAmountUsed > 0 && (
          <div className="flex justify-between text-xs muted"><span>پرداخت‌شده از کیف پول</span><span>{fmtToman(order.walletAmountUsed)}</span></div>
        )}
        {order.walletAmountUsed > 0 && order.total - order.walletAmountUsed > 0 && (
          <div className="flex justify-between text-xs font-medium"><span>باقی‌مانده برای پرداخت</span><span>{fmtToman(order.total - order.walletAmountUsed)}</span></div>
        )}
      </div>

      <div className="text-sm muted">
        <p>گیرنده: {order.shippingName} — {order.shippingPhone}</p>
        <p>آدرس: {order.shippingCity}, {order.shippingAddress}</p>
      </div>
    </div>
  );
}
