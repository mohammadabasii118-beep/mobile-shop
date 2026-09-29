import type { Metadata } from "next";
import Link from "next/link";
import { AccountShell } from "@/components/account-shell";
import { requirePageUser } from "@/lib/server/auth/guard";
import { listUserOrders, ORDER_STATUS_LABEL } from "@/lib/server/orders";
import { formatToman } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "سفارش‌های من | CaseLine", robots: { index: false } };

const DONE = ["DELIVERED", "CANCELLED", "REFUNDED"];
const faDate = (d: Date) => d.toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" });

type Order = Awaited<ReturnType<typeof listUserOrders>>[number];

function OrderCard({ o }: { o: Order }) {
  const pay = o.payments[0];
  const unpaid = o.status === "PENDING_PAYMENT";
  const tone = unpaid ? "pending" : o.status === "DELIVERED" ? "done" : "active";
  return (
    <article className="ord" data-s={tone}>
      <header>
        <div>
          <h3>سفارش <b>#{o.number.toLocaleString("fa-IR", { useGrouping: false })}</b></h3>
          <div className="ord-meta"><span>{faDate(o.createdAt)}</span><span>{formatToman(o.total)}</span></div>
        </div>
        <span className="ord-st">{ORDER_STATUS_LABEL[o.status]}</span>
      </header>
      <p className="ord-title">{o.items[0]?.name}{o.items.length > 1 ? ` و ${(o.items.length - 1).toLocaleString("fa-IR")} مورد دیگر` : ""}</p>
      {unpaid && pay?.status === "REJECTED" && <div className="ord-note ord-warn">پرداخت شما رد شد{pay.rejectReason ? `: ${pay.rejectReason}` : "."} لطفاً رسید صحیح را دوباره ارسال کنید.</div>}
      {unpaid && pay?.status !== "REJECTED" && <div className="ord-note ord-warn">این سفارش هنوز پرداخت نشده است.</div>}
      {o.status === "PAYMENT_REVIEW" && <div className="ord-note ord-info">رسید شما ارسال شد و در حال بررسی است.</div>}
      <div className="ord-btns">
        {unpaid && <Link href={`/account/orders/${o.number}`} className="cl-btn ord-pay">پرداخت</Link>}
        <Link href={`/account/orders/${o.number}`} className="cl-btn cl-btn-ghost ord-sup">جزئیات سفارش</Link>
        <Link href="/support" className="cl-btn cl-btn-ghost ord-sup">پشتیبانی این سفارش</Link>
      </div>
    </article>
  );
}

export default async function OrdersPage() {
  const user = await requirePageUser("/account/orders");
  const orders = await listUserOrders(user.id);
  const active = orders.filter((o) => !DONE.includes(o.status));
  const done = orders.filter((o) => DONE.includes(o.status));
  return (
    <AccountShell active="orders">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-black">سفارش‌های در جریان<span className="grid size-6 place-items-center rounded-full bg-surface-2 text-[11px] text-muted">{active.length.toLocaleString("fa-IR")}</span></h2>
        <div className="space-y-3">
          {active.length ? active.map((o) => <OrderCard key={o.id} o={o} />) : <div className="cl-empty">سفارش فعالی ندارید. <Link href="/shop" className="text-primary">مشاهده فروشگاه</Link></div>}
        </div>
        <h2 className="mb-3 mt-6 text-[15px] font-black">سفارش‌های تمام‌شده</h2>
        {done.length ? <div className="space-y-3">{done.map((o) => <OrderCard key={o.id} o={o} />)}</div> : <div className="rounded-2xl border border-dashed border-primary/30 px-4 py-9 text-center text-xs text-muted">سفارش تمام‌شده‌ای ندارید.</div>}
      </section>
    </AccountShell>
  );
}
