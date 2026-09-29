import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, PageHead, StatusPill } from "@/components/admin/kit";
import { ORDER_LABEL, PAY_LABEL, fmtDate, fmtId, fmtNum, fmtToman } from "@/lib/admin/format";
import { OrderActions } from "@/components/admin/order-actions";
import { getOrder } from "@/lib/server/admin/orders";
import { ORDER_STATUS_LABEL, ORDER_TRANSITIONS } from "@/lib/server/orders";
import { requireAdminPage } from "@/lib/server/admin/page";

const REFUND_STATUS_LABEL: Record<string, string> = { AWAITING_CUSTOMER: "در انتظار تأیید مشتری", PENDING_BANK: "در انتظار واریز بانکی", COMPLETED: "انجام شد", REJECTED: "رد توسط مشتری", CANCELLED: "لغو شد" };

export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const u = await requireAdminPage("order.read", `/admin/orders/${number}`);
  if (!/^\d{1,9}$/.test(number)) notFound();
  const o = await getOrder(Number(number)).catch(() => null);
  if (!o) notFound();
  const methods = await db.shippingMethod.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const blocked = ["PENDING_PAYMENT", "PAYMENT_REVIEW", "PAID", "CANCELLED", "REFUNDED"];
  const allowed = ORDER_TRANSITIONS[o.status].filter((s) => !blocked.includes(s) && (s !== "PROCESSING" || o.paymentStatus === "PAID")).map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }));
  const a = o.shippingAddress as Record<string, string>;
  const payment = o.payments[0];
  return (
    <>
      <PageHead title={`سفارش #${fmtId(o.number)}`} sub={fmtDate(o.createdAt)} actions={<><StatusPill map={ORDER_LABEL} value={o.status} /><StatusPill map={PAY_LABEL} value={o.paymentStatus} /></>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-sm font-black">اقلام</h2>
            <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="text-xs text-muted"><th className="pb-2 text-start">کالا</th><th className="pb-2 text-start">قیمت واحد</th><th className="pb-2 text-start">تعداد</th><th className="pb-2 text-start">جمع</th></tr></thead>
              <tbody className="divide-y divide-border">{o.items.map((i) => <tr key={i.id}><td className="py-2">{i.name}{i.option && <span className="text-xs text-muted"> — {i.option}</span>}<div dir="ltr" className="text-start text-[11px] text-muted">{i.sku}{i.priceType === "wholesale" ? " · عمده" : ""}</div></td><td>{fmtToman(i.unitPrice)}</td><td>{fmtNum(i.quantity)}</td><td className="font-bold">{fmtToman(i.total)}</td></tr>)}</tbody></table></div>
            <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">جمع اقلام</dt><dd>{fmtToman(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">تخفیف{o.couponCode ? ` (${o.couponCode})` : ""}{o.loyaltyPointsUsed > 0 ? ` · ${o.loyaltyPointsUsed} امتیاز` : ""}</dt><dd>{fmtToman(o.discountTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">ارسال ({o.shippingMethod?.name ?? "—"})</dt><dd>{fmtToman(o.shippingCost)}</dd></div>
              <div className="flex justify-between text-base font-black"><dt>مبلغ نهایی</dt><dd>{fmtToman(o.total)}</dd></div>
              {o.walletUsed > 0 && <div className="flex justify-between"><dt className="text-muted">پرداخت از کیف پول</dt><dd>{fmtToman(o.walletUsed)}</dd></div>}
            </dl>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card><h2 className="mb-2 text-sm font-black">مشتری</h2><p className="text-sm">{o.customerName}</p><p dir="ltr" className="text-start text-sm text-muted">{o.customerPhone}</p>{o.user && <Link href={`/admin/customers/${o.user.id}`} className="mt-1 inline-block text-xs font-bold text-primary">مشاهده پروفایل</Link>}{o.note && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-xs">یادداشت مشتری: {o.note}</p>}</Card>
            <Card><h2 className="mb-2 text-sm font-black">آدرس تحویل</h2><p className="text-sm leading-7">{a.receiver} — <span dir="ltr">{a.phone}</span><br />{a.province}، {a.city}<br />{a.address}{a.postalCode ? <><br />کد پستی: {a.postalCode}</> : null}</p>{(o.shippingCompany || o.trackingNumber) && <p className="mt-2 text-xs text-muted">{o.shippingCompany} {o.trackingNumber && <>کد رهگیری: <b dir="ltr">{o.trackingNumber}</b></>}</p>}</Card>
          </div>
          {payment && (
            <Card>
              <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-black">پرداخت</h2>{o.paymentStatus === "REVIEW" && u.permissions.includes("payment.review") && <Link href="/admin/payments" className="text-xs font-bold text-primary">رفتن به بررسی پرداخت</Link>}</div>
              <p className="text-sm">مبلغ: <b>{fmtToman(payment.amount)}</b> · روش: {payment.provider === "wallet" ? "کیف پول" : "کارت‌به‌کارت"} · شماره پیگیری: <b dir="ltr">{payment.referenceNumber ?? "—"}</b></p>
              {payment.rejectReason && <p className="mt-1 text-xs text-error">دلیل رد: {payment.rejectReason}</p>}
              {u.permissions.includes("payment.review") && payment.proofs.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{payment.proofs.map((p) => <a key={p.id} className="rounded-md border border-border px-3 py-1.5 text-xs font-bold hover:border-primary" target="_blank" rel="noreferrer" href={`/api/orders/${o.number}/payment/proof/${p.id}`}>{p.originalName}</a>)}</div>}
            </Card>
          )}
          {o.refunds.length > 0 && (
            <Card>
              <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-black">بازگشت وجه</h2><Link href="/admin/refunds" className="text-xs font-bold text-primary">صف بازگشت وجه</Link></div>
              <ul className="divide-y divide-border text-sm">{o.refunds.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b>{fmtToman(r.amount)}</b> — {r.method === "wallet" ? "کیف پول" : "بانکی"}<span className="block text-xs text-muted">{r.reason}{r.bankReference ? ` · پیگیری ${r.bankReference}` : ""}</span></span><span className="text-xs font-bold">{REFUND_STATUS_LABEL[r.status]}</span></li>)}</ul>
            </Card>
          )}
          <Card>
            <h2 className="mb-3 text-sm font-black">تایم‌لاین</h2>
            <ol className="space-y-3 border-s-2 border-border ps-4">{o.history.map((h) => <li key={h.id} className="relative"><i className="absolute -start-[21px] top-1.5 size-2.5 rounded-full bg-primary" /><div className="text-sm font-bold">{ORDER_STATUS_LABEL[h.status]}</div><div className="text-xs text-muted">{h.description}{h.by ? ` — ${h.by}` : ""} · {fmtDate(h.createdAt)}</div></li>)}</ol>
          </Card>
        </div>
        <OrderActions number={o.number} status={o.status} paymentStatus={o.paymentStatus} canWrite={u.permissions.includes("order.write")} canRefund={u.permissions.includes("refund.manage")} money={o.money} allowed={allowed} methods={methods.map((m) => ({ value: m.id, label: m.name }))} shipping={{ methodId: o.shippingMethodId ?? "", company: o.shippingCompany ?? "", tracking: o.trackingNumber ?? "" }} />
      </div>
    </>
  );
}
