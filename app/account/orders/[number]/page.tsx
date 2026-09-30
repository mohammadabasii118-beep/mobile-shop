import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { CopyField, ReceiptForm } from "@/components/account/receipt-form";
import { db } from "@/lib/db";
import { OrderExtras, RefundBox, ReviewForm } from "@/components/account/order-extras";
import { requirePageUser } from "@/lib/server/auth/guard";
import { getUserOrder, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, TIMELINE } from "@/lib/server/orders";
import { getProvider } from "@/lib/server/payments";
import { formatToman, toFa } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "جزئیات سفارش | CaseLine", robots: { index: false } };

const faDateTime = (d: Date) => d.toLocaleString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const n = Number(number);
  const user = await requirePageUser(`/account/orders/${number}`);
  const order = Number.isInteger(n) ? await getUserOrder(user.id, n) : null;
  if (!order) notFound();
  const payment = order.payments[0];
  const provider = getProvider(order.paymentMethod);
  const instructions = provider && payment ? await provider.instructions(order, payment.amount) : null;
  const reviewed = order.status === "DELIVERED" ? new Set((await db.review.findMany({ where: { userId: user.id, orderId: order.id }, select: { productId: true } })).map((r) => r.productId)) : new Set<string>();
  const canPay = order.status === "PENDING_PAYMENT" && payment && ["PENDING", "REJECTED"].includes(payment.status);
  const ended = order.status === "CANCELLED" || order.status === "REFUNDED";
  // The timeline highlights the current step; PAID is displayed as the "payment approved" step.
  const effective = order.status === "PAID" ? "PROCESSING" : order.status === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : order.status;
  const currentIdx = ended ? -1 : TIMELINE.findIndex((t) => t.status === effective);
  const addr = order.shippingAddress as { receiver: string; phone: string; province: string; city: string; postalCode?: string | null; address: string };

  return (
    <AccountShell active="orders">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">سفارش <span className="text-primary">#{order.number.toLocaleString("fa-IR", { useGrouping: false })}</span></h2>
            <p className="mt-1 text-xs text-muted">ثبت‌شده در {faDateTime(order.createdAt)}</p>
          </div>
          <span className="rounded-full bg-primary/12 px-3 py-1.5 text-xs font-bold text-primary">{ORDER_STATUS_LABEL[order.status]}</span>
        </div>

        {/* Timeline */}
        <section aria-label="وضعیت سفارش" className="rounded-2xl border border-border bg-surface-2 p-4">
          {ended && <p className="mb-3 rounded-lg bg-hot/10 px-3 py-2 text-xs font-bold text-hot">{ORDER_STATUS_LABEL[order.status]}</p>}
          <ol className="space-y-0">
            {TIMELINE.map((t, i) => {
              const state = ended ? "off" : i < currentIdx ? "done" : i === currentIdx ? "now" : "off";
              const at = order.history.filter((h) => h.status === t.status || (t.status === "PROCESSING" && h.status === "PAID")).at(-1);
              return (
                <li key={t.status} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < TIMELINE.length - 1 && <span className={cn("absolute start-[13px] top-7 h-[calc(100%-1.5rem)] w-0.5", state === "done" ? "bg-primary" : "bg-border")} />}
                  <span className={cn("z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold", state === "done" && "border-primary bg-primary text-primary-fg", state === "now" && "border-primary bg-surface text-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_18%,transparent)]", state === "off" && "border-border bg-surface text-muted/60")}>
                    {state === "done" ? <Check className="size-3.5" /> : toFa(i + 1)}
                  </span>
                  <div className={cn("pt-0.5", state === "off" && "opacity-50")}>
                    <div className={cn("text-[13px]", state === "now" ? "font-black text-primary" : "font-medium")}>{t.label}</div>
                    {at && state !== "off" && <div className="mt-0.5 text-[11px] text-muted">{faDateTime(at.createdAt)}{at.description ? ` — ${at.description}` : ""}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
          {order.trackingNumber && <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-xs">کد رهگیری {order.shippingCompany ?? ""}: <b dir="ltr" className="select-all">{order.trackingNumber}</b></p>}
        </section>

        {/* Payment */}
        {payment && (
          <section aria-label="پرداخت" className="rounded-2xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black">پرداخت</h2>
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-muted">{PAYMENT_STATUS_LABEL[payment.status]}</span>
            </div>
            {payment.status === "REJECTED" && <p className="mb-3 rounded-lg bg-hot/10 px-3 py-2 text-xs text-hot">پرداخت شما رد شد{payment.rejectReason ? `: ${payment.rejectReason}` : "."} لطفاً رسید صحیح را دوباره ارسال کنید.</p>}
            {payment.status === "REVIEW" && <p className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">رسید شما ارسال شد و در حال بررسی است. نتیجه از همین صفحه قابل مشاهده است.</p>}
            {payment.status === "PAID" && <p className="mb-3 rounded-lg bg-success/12 px-3 py-2 text-xs font-bold text-success">پرداخت شما تأیید شد.</p>}
            {canPay && instructions && (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-1 text-[13px] font-bold">{instructions.title}</h3>
                  {instructions.note && <p className="mb-2 text-xs leading-6 text-muted">{instructions.note}</p>}
                  <div className="rounded-xl bg-surface-2 px-4">{instructions.fields.map((f) => <CopyField key={f.label} {...f} />)}</div>
                </div>
                {instructions.requiresReceipt && <ReceiptForm orderNumber={order.number} resubmit={payment.status === "REJECTED"} />}
              </div>
            )}
            {payment.proofs.length > 0 && (
              <div className="mt-3 text-xs text-muted">
                رسیدهای ارسال‌شده:{" "}
                {payment.proofs.map((p, i) => <a key={p.id} href={`/api/orders/${order.number}/payment/proof/${p.id}`} target="_blank" rel="noopener noreferrer" className="me-3 text-primary hover:underline">رسید {toFa(i + 1)}</a>)}
                {payment.referenceNumber && <span>· شماره پیگیری: <b dir="ltr" className="text-foreground">{payment.referenceNumber}</b></span>}
              </div>
            )}
          </section>
        )}

        {/* Items and totals */}
        <section aria-label="اقلام سفارش" className="rounded-2xl border border-border p-4">
          <h2 className="mb-2 text-sm font-black">اقلام سفارش</h2>
          <ul className="divide-y divide-border/60">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-3 text-[13px]">
                <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">{it.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" className="size-full object-cover" />
                  )}</span>
                <span className="min-w-0 flex-1"><span className="line-clamp-2 font-bold">{it.name}</span>{it.option && <span className="block text-[11px] text-muted">{it.option}</span>}<span className="block text-[11px] text-muted">{formatToman(it.unitPrice)} × {toFa(it.quantity)}{it.priceType === "wholesale" ? " · قیمت همکار" : ""}</span></span>
                <b className="whitespace-nowrap">{formatToman(it.total)}</b>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">جمع اقلام</dt><dd className="font-bold">{formatToman(order.subtotal)}</dd></div>
            {order.discountTotal > 0 && <div className="flex justify-between"><dt className="text-muted">تخفیف{order.couponCode ? ` (${order.couponCode})` : ""}</dt><dd className="font-bold text-success">−{formatToman(order.discountTotal)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">ارسال ({order.shippingMethod?.name ?? "—"})</dt><dd className="font-bold">{order.shippingCost ? formatToman(order.shippingCost) : "رایگان"}</dd></div>
            {order.loyaltyPointsUsed > 0 && <div className="flex justify-between"><dt className="text-muted">شامل تخفیف امتیاز ({toFa(order.loyaltyPointsUsed)} امتیاز)</dt><dd className="font-bold text-success">−{formatToman(order.loyaltyDiscount)}</dd></div>}
            <div className="flex justify-between border-t border-border pt-3 text-base"><dt className="font-black">مبلغ نهایی</dt><dd className="font-black text-primary">{formatToman(order.total)}</dd></div>
            {order.walletUsed > 0 && <div className="flex justify-between"><dt className="text-muted">پرداخت از کیف پول</dt><dd className="font-bold">{formatToman(order.walletUsed)}</dd></div>}
            {order.walletUsed > 0 && order.walletUsed < order.total && <div className="flex justify-between"><dt className="text-muted">مبلغ کارت به کارت</dt><dd className="font-bold">{formatToman(order.total - order.walletUsed)}</dd></div>}
          </dl>
        </section>

        {order.refunds.length > 0 && <RefundBox refunds={order.refunds.map((r) => ({ id: r.id, method: r.method, amount: r.amount, status: r.status, reason: r.reason, bankReference: r.bankReference }))} />}
        {order.status === "DELIVERED" && <ReviewForm orderNumber={order.number} items={order.items.filter((i) => i.productId && !reviewed.has(i.productId)).map((i) => ({ productId: i.productId!, name: i.name }))} />}

        <section aria-label="آدرس تحویل" className="rounded-2xl border border-border p-4 text-[13px] leading-7">
          <h2 className="mb-1 text-sm font-black">آدرس تحویل</h2>
          <p><b>{addr.receiver}</b> · <span dir="ltr">{addr.phone}</span></p>
          <p className="text-muted">{addr.province}، {addr.city}، {addr.address}{addr.postalCode ? ` — کد پستی ${addr.postalCode}` : ""}</p>
        </section>

        {order.status === "PENDING_PAYMENT" && <OrderExtras number={order.number} />}
        <div className="flex flex-wrap gap-2"><Link href="/account/orders" className="cl-btn cl-btn-ghost !inline-flex px-5">بازگشت به سفارش‌ها</Link><Link href={`/account/tickets?order=${order.number}${order.paymentStatus === "PAID" && !ended ? "&category=return" : ""}`} className="cl-btn cl-btn-ghost !inline-flex px-5">پشتیبانی این سفارش</Link></div>
      </div>
    </AccountShell>
  );
}
