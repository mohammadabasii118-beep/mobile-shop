import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { fmtToman, fa } from "@/lib/format";
import WalletAdjustForm from "@/components/admin/WalletAdjustForm";

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده", DELIVERED: "تحویل داده شده", CANCELED: "لغو شده",
};

export default async function AdminUserDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await db.user.findUnique({ where: { id: params.id }, include: { orders: { orderBy: { createdAt: "desc" } } } });
  if (!user) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold mb-1">{user.name}</h1>
      <p className="muted text-sm mb-6">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p>

      <div className="surface border line rounded-2xl p-5 mb-6">
        <h2 className="font-bold mb-1 text-sm">کیف پول و امتیاز</h2>
        <p className="text-sm muted mb-3">
          موجودی فعلی کیف پول: <span className="font-bold" style={{ color: "var(--text)" }}>{fmtToman(user.walletBalance)}</span>
          {" · "}امتیاز باشگاه مشتریان: <span className="font-bold" style={{ color: "var(--text)" }}>{fa(user.loyaltyPoints)}</span>
        </p>
        <WalletAdjustForm userId={user.id} />
      </div>

      <h2 className="font-bold mb-3 text-sm">سفارش‌های این کاربر</h2>
      <div className="flex flex-col gap-2">
        {user.orders.map((o) => (
          <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex justify-between surface border line rounded-xl p-3 text-sm">
            <span>{o.orderNumber} — {statusLabel[o.status]}</span>
            <span className="font-medium">{fmtToman(o.total)}</span>
          </Link>
        ))}
        {user.orders.length === 0 && <p className="muted text-sm">سفارشی ثبت نکرده است.</p>}
      </div>
    </div>
  );
}
