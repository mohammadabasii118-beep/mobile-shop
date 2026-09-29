import Link from "next/link";
import { db } from "@/lib/db";
import { fmtToman } from "@/lib/format";

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده", DELIVERED: "تحویل داده شده", CANCELED: "لغو شده",
};

export default async function AdminOrdersPage() {
  const orders = await db.order.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">سفارش‌ها</h1>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">شماره سفارش</th>
              <th className="p-3 text-right">گیرنده</th>
              <th className="p-3 text-right">مبلغ</th>
              <th className="p-3 text-right">پرداخت</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">تاریخ</th>
              <th className="p-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t line">
                <td className="p-3 font-medium">{o.orderNumber}</td>
                <td className="p-3 muted">{o.shippingName}</td>
                <td className="p-3">{fmtToman(o.total)}</td>
                <td className="p-3 muted">{o.paymentMethod === "CARD_TRANSFER" ? "کارت‌به‌کارت" : "زرین‌پال"}</td>
                <td className="p-3">{statusLabel[o.status]}</td>
                <td className="p-3 muted">{new Date(o.createdAt).toLocaleDateString("fa-IR")}</td>
                <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="text-xs font-medium" style={{ color: "#404040" }}>جزئیات</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {orders.length === 0 && <p className="p-6 text-center muted text-sm">سفارشی ثبت نشده است.</p>}
      </div>
    </div>
  );
}
