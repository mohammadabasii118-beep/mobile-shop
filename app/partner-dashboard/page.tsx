import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtToman, fa } from "@/lib/format";

export const metadata = { title: "پنل همکاری" };

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده", DELIVERED: "تحویل داده شده", CANCELED: "لغو شده",
};

/**
 * A dedicated landing page for an approved wholesale partner (Phase 3) —
 * their own order history (already at real wholesale prices, since
 * checkout already resolved those at the time each order was placed),
 * lifetime totals, and the current quantity-discount tiers. There is no
 * separate "bulk order form": ordering still goes through the normal
 * catalog/checkout, which already applies wholesale pricing automatically
 * for an approved partner — this page is where that account keeps track
 * of it, not a parallel ordering system.
 */
export default async function PartnerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { isWholesale: true } });
  if (!user?.isWholesale) redirect("/partners");

  const [orders, tiers] = await Promise.all([
    db.order.findMany({
      where: { userId: session.user.id as string, status: { not: "CANCELED" } },
      orderBy: { createdAt: "desc" },
    }),
    db.wholesaleTier.findMany({ where: { isActive: true }, orderBy: { minQuantity: "asc" } }),
  ]);

  const lifetimeTotal = orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      <h1 className="text-2xl font-extrabold mb-1">پنل همکاری</h1>
      <p className="text-sm muted mb-8">حساب شما به‌عنوان همکار (عمده‌فروش) تأیید شده و قیمت عمده در تمام سایت برای شما اعمال می‌شود.</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="surface border line rounded-2xl p-5">
          <div className="text-xs muted mb-1">تعداد سفارش‌ها</div>
          <div className="text-xl font-bold">{fa(orders.length)}</div>
        </div>
        <div className="surface border line rounded-2xl p-5">
          <div className="text-xs muted mb-1">مجموع خرید (تاکنون)</div>
          <div className="text-xl font-bold">{fmtToman(lifetimeTotal)}</div>
        </div>
      </div>

      {tiers.length > 0 && (
        <div className="surface border line rounded-2xl p-5 mb-8">
          <h2 className="font-bold text-sm mb-3">پله‌های تخفیف حجمی</h2>
          <p className="text-xs muted mb-3">در هر سفارش، هر خط با تعداد رسیده به این آستانه، تخفیف اضافه‌ی زیر را (روی قیمت عمده) می‌گیرد.</p>
          <ul className="text-sm flex flex-col gap-1">
            {tiers.map((t) => (
              <li key={t.id}>خرید {fa(t.minQuantity)} عدد یا بیشتر از یک کالا: {fa(t.discountPercent)}٪ تخفیف اضافه</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-sm">سفارش‌های شما</h2>
        <Link href="/" className="text-xs font-medium" style={{ color: "#404040" }}>مشاهده کاتالوگ →</Link>
      </div>
      {orders.length === 0 ? (
        <p className="muted text-sm">هنوز سفارشی ثبت نکرده‌اید.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/account/orders/${o.id}`} className="flex justify-between items-center surface border line rounded-2xl p-4">
              <div>
                <div className="font-medium text-sm">{o.orderNumber}</div>
                <div className="text-xs muted">{statusLabel[o.status]} · {new Date(o.createdAt).toLocaleDateString("fa-IR")}</div>
              </div>
              <div className="font-bold text-sm">{fmtToman(o.total)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
