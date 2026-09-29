import { db } from "@/lib/db";
import { fmtToman, fa } from "@/lib/format";

export default async function AdminDashboard() {
  const [productCount, orderCount, userCount, pendingOrders, revenueAgg] = await Promise.all([
    db.product.count(),
    db.order.count(),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.order.count({ where: { status: "PENDING_PAYMENT" } }),
    db.order.aggregate({ _sum: { total: true }, where: { status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } } }),
  ]);

  const cards = [
    { label: "محصولات", value: fa(productCount), icon: "📦" },
    { label: "سفارش‌ها", value: fa(orderCount), icon: "🧾" },
    { label: "کاربران", value: fa(userCount), icon: "👥" },
    { label: "در انتظار پرداخت", value: fa(pendingOrders), icon: "🕓" },
    { label: "درآمد کل (سفارش‌های پرداخت‌شده)", value: fmtToman(revenueAgg._sum.total || 0), icon: "💰" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">داشبورد</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="surface border line rounded-2xl p-5">
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className="text-xl font-extrabold mb-1">{c.value}</div>
            <div className="text-xs muted">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
