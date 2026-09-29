import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtToman, fa } from "@/lib/format";
import OrderStatusForm from "@/components/admin/OrderStatusForm";
import OrderTrackingForm from "@/components/admin/OrderTrackingForm";
import ReceiptReviewActions from "@/components/admin/ReceiptReviewActions";
import RefundToWalletButton from "@/components/admin/RefundToWalletButton";
import OrderTimeline from "@/components/OrderTimeline";

const receiptStatusLabel: Record<string, string> = { PENDING: "در انتظار بررسی", APPROVED: "تأیید شده", REJECTED: "رد شده" };

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      user: true,
      receipts: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold mb-1">سفارش {order.orderNumber}</h1>
      <p className="muted text-sm mb-6">
        {new Date(order.createdAt).toLocaleString("fa-IR")} · روش پرداخت: {order.paymentMethod === "CARD_TRANSFER" ? "کارت‌به‌کارت" : "زرین‌پال"}
      </p>

      <div className="surface border line rounded-2xl p-5 mb-5">
        <h2 className="font-bold mb-3 text-sm">وضعیت سفارش</h2>
        <OrderStatusForm orderId={order.id} current={order.status} />
      </div>

      {order.userId && !order.refundedToWalletAt && ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status) && (
        <div className="surface border line rounded-2xl p-5 mb-5">
          <h2 className="font-bold mb-1 text-sm">بازگشت وجه</h2>
          <p className="text-xs muted mb-3">
            بدون اتصال به درگاه بازگشت وجه بانکی، می‌توانید مبلغ کامل این سفارش را به کیف پول حساب مشتری بازگردانید. این کار سفارش را لغو می‌کند و موجودی کالاها را به انبار بازمی‌گرداند.
          </p>
          <RefundToWalletButton orderId={order.id} />
        </div>
      )}
      {order.refundedToWalletAt && (
        <div className="surface2 rounded-2xl p-5 mb-5 text-xs muted">
          وجه این سفارش در تاریخ {new Date(order.refundedToWalletAt).toLocaleString("fa-IR")} به کیف پول مشتری بازگشت داده شده است.
        </div>
      )}

      <div className="surface border line rounded-2xl p-5 mb-5">
        <h2 className="font-bold mb-1 text-sm">اطلاعات رهگیری مرسوله</h2>
        <p className="text-xs muted mb-3">
          هیچ اتصال زنده‌ای به شرکت‌های پستی وجود ندارد — این‌ها همان اطلاعاتی هستند که خودتان اینجا وارد می‌کنید و مشتری در صفحه‌ی سفارش خودش می‌بیند تا بتواند در سایت شرکت پستی پیگیری کند.
        </p>
        <OrderTrackingForm orderId={order.id} initialCarrier={order.trackingCarrier} initialNumber={order.trackingNumber} />
      </div>

      <div className="mb-5">
        <OrderTimeline history={order.statusHistory.map((h) => ({ id: h.id, status: h.status, note: h.note, createdAt: h.createdAt.toISOString() }))} />
      </div>

      {order.paymentMethod === "CARD_TRANSFER" && (
        <div className="surface border line rounded-2xl p-5 mb-5">
          <h2 className="font-bold mb-3 text-sm">رسیدهای کارت‌به‌کارت</h2>
          {order.status === "PENDING_PAYMENT" && order.reservationExpiresAt && (
            <p className="text-xs muted mb-3">
              رزرو موجودی این سفارش تا {new Date(order.reservationExpiresAt).toLocaleString("fa-IR")} معتبر است؛ پس از آن در صورت اجرای اسکریپت آزادسازی، به‌صورت خودکار لغو و موجودی بازگردانده می‌شود (به README مراجعه کنید).
            </p>
          )}
          {order.receipts.length === 0 && <p className="muted text-sm">هنوز رسیدی ارسال نشده است.</p>}
          <div className="flex flex-col gap-3">
            {order.receipts.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 border-t line pt-3 first:border-t-0 first:pt-0">
                <a href={`/api/receipts/${r.imageFile}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <img src={`/api/receipts/${r.imageFile}`} alt="رسید" className="w-20 h-20 rounded-lg object-cover border line" />
                </a>
                <div className="flex-1 text-xs muted">
                  {r.trackingCode && <div>کد پیگیری: {r.trackingCode}</div>}
                  <div>{new Date(r.createdAt).toLocaleString("fa-IR")} · {receiptStatusLabel[r.status]}</div>
                  {r.status === "REJECTED" && r.rejectReason && <div>دلیل رد: {r.rejectReason}</div>}
                </div>
                {r.status === "PENDING" && <ReceiptReviewActions receiptId={r.id} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="surface border line rounded-2xl p-5 mb-5">
        <h2 className="font-bold mb-3 text-sm">مشتری و آدرس تحویل</h2>
        <div className="text-sm muted leading-7">
          <p>مشتری: {order.user?.name || order.shippingName} {order.user?.email ? `(${order.user.email})` : "(مهمان)"}</p>
          <p>گیرنده: {order.shippingName} — {order.shippingPhone}</p>
          <p>آدرس: {order.shippingCity}, {order.shippingAddress} {order.shippingPostal || ""}</p>
        </div>
      </div>

      <div className="surface border line rounded-2xl p-5 mb-5">
        <h2 className="font-bold mb-3 text-sm">اقلام سفارش</h2>
        <div className="flex flex-col gap-2">
          {order.items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm">
              <span>
                {it.nameSnapshot}
                {it.variantLabel && <span className="muted"> ({it.variantLabel})</span>} × {fa(it.quantity)}
              </span>
              <span>{fmtToman(it.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="surface2 rounded-2xl p-5 text-sm flex flex-col gap-1">
        <div className="flex justify-between"><span>جمع کالاها</span><span>{fmtToman(order.subtotal)}</span></div>
        {order.discountAmount > 0 && <div className="flex justify-between"><span>تخفیف ({order.discountCode})</span><span>-{fmtToman(order.discountAmount)}</span></div>}
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
        {order.paymentRefId && <p className="muted text-xs mt-2">کد رهگیری پرداخت: {order.paymentRefId}</p>}
      </div>
    </div>
  );
}
