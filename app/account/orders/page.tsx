import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtToman } from "@/lib/format";

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده", DELIVERED: "تحویل داده شده", CANCELED: "لغو شده",
};

export default async function OrderHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const orders = await db.order.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      <h1 className="text-2xl font-extrabold mb-6">تاریخچه سفارش‌ها</h1>
      {orders.length === 0 ? (
        <p className="muted text-sm">هنوز سفارشی ثبت نکرده‌اید.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/account/orders/${o.id}`} className="flex justify-between items-center surface border line rounded-2xl p-4">
              <div>
                <div className="font-medium text-sm">{o.orderNumber}</div>
                <div className="text-xs muted">
                  {statusLabel[o.status]} · {o.paymentMethod === "CARD_TRANSFER" ? "کارت‌به‌کارت" : "زرین‌پال"} · {new Date(o.createdAt).toLocaleDateString("fa-IR")}
                </div>
              </div>
              <div className="font-bold text-sm">{fmtToman(o.total)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
