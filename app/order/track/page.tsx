import Link from "next/link";
import { headers } from "next/headers";
import { lookupOrderForTracking, TrackedOrder, TrackLookupResult } from "@/lib/trackLookup";
import { fmtToman, fa } from "@/lib/format";
import OrderTimeline from "@/components/OrderTimeline";

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت",
  PAID: "پرداخت شده",
  PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELED: "لغو شده",
};

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

export default async function TrackOrderPage(props: { searchParams: Promise<{ order?: string; phone?: string }> }) {
  const searchParams = await props.searchParams;
  let order: TrackedOrder | null = null;
  let errorMessage = "";

  if (searchParams.order && searchParams.phone) {
    const result: TrackLookupResult = await lookupOrderForTracking(searchParams.order.trim(), searchParams.phone.trim(), await clientIp());
    if (result.ok) {
      order = result.order;
    } else if (result.reason === "rate_limited") {
      errorMessage = "تعداد تلاش‌های شما بیش از حد مجاز بود. لطفاً چند دقیقه دیگر دوباره امتحان کنید.";
    } else if (result.reason === "requires_login") {
      errorMessage = "این سفارش به یک حساب کاربری متصل است. برای مشاهده جزئیات، لطفاً وارد حساب کاربری خود شوید.";
    } else {
      errorMessage = "سفارشی با این مشخصات یافت نشد.";
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 md:px-8 py-14">
      <h1 className="text-2xl font-extrabold mb-6 text-center">پیگیری سفارش</h1>
      <form className="flex flex-col gap-3 mb-8" method="GET">
        <input name="order" defaultValue={searchParams.order} placeholder="شماره سفارش (مثلاً CL-12345678)" className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" required />
        <input name="phone" defaultValue={searchParams.phone} placeholder="شماره موبایل گیرنده" className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none" required />
        <button className="h-11 rounded-full text-white font-bold" style={{ background: "var(--ink)" }}>پیگیری</button>
      </form>

      {errorMessage && (
        <p className="text-center text-sm mb-4" style={{ color: "#a24e56" }}>
          {errorMessage}
          {searchParams.order && errorMessage.includes("حساب کاربری") && (
            <>
              {" "}
              <Link href="/login" className="underline underline-offset-4 font-bold">ورود به حساب</Link>
            </>
          )}
        </p>
      )}

      {order && (
        <div className="surface border line rounded-2xl p-5">
          <div className="flex justify-between mb-1">
            <span className="font-bold">سفارش {order.orderNumber}</span>
            <span className="text-sm font-medium">{statusLabel[order.status]}</span>
          </div>
          <p className="text-xs muted mb-3">روش پرداخت: {order.paymentMethod === "CARD_TRANSFER" ? "کارت‌به‌کارت" : "زرین‌پال"}</p>

          {order.paymentMethod === "CARD_TRANSFER" && order.status === "PENDING_PAYMENT" && (
            <div className="rounded-xl p-3 text-xs mb-4" style={{ background: "#f6eae6" }}>
              {order.receipts[0]?.status === "REJECTED"
                ? `رسید قبلی تأیید نشد${order.receipts[0].rejectReason ? `: ${order.receipts[0].rejectReason}` : ""}. `
                : order.receipts[0]?.status === "PENDING"
                ? "رسید شما در انتظار تأیید مدیر است. "
                : "برای این سفارش هنوز رسیدی ارسال نکرده‌اید. "}
              {(!order.receipts[0] || order.receipts[0].status === "REJECTED") && (
                <Link
                  href={`/checkout/card-transfer/${order.id}${order.guestToken ? `?t=${encodeURIComponent(order.guestToken)}` : ""}`}
                  className="font-bold underline underline-offset-4"
                >
                  ارسال رسید
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm muted mb-4">
            {order.items.map((it) => (
              <div key={it.id} className="flex justify-between">
                <span>
                  {it.nameSnapshot}
                  {it.variantLabel && <span> ({it.variantLabel})</span>} × {fa(it.quantity)}
                </span>
                <span>{fmtToman(it.total)}</span>
              </div>
            ))}
          </div>
          <div className="border-t line pt-3 flex justify-between font-bold mb-4">
            <span>مبلغ کل</span><span>{fmtToman(order.total)}</span>
          </div>

          {(order.trackingCarrier || order.trackingNumber) && (
            <div className="rounded-xl p-3 text-xs mb-4 surface2">
              <p className="font-bold mb-1">اطلاعات رهگیری مرسوله</p>
              {order.trackingCarrier && <p className="muted">شرکت پستی: {order.trackingCarrier}</p>}
              {order.trackingNumber && <p className="muted">کد رهگیری: {order.trackingNumber}</p>}
            </div>
          )}

          <OrderTimeline history={order.statusHistory.map((h) => ({ id: h.id, status: h.status, note: h.note, createdAt: h.createdAt.toISOString() }))} />
        </div>
      )}
    </div>
  );
}
