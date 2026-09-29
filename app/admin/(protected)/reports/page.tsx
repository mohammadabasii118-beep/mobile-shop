import { db } from "@/lib/db";
import { fmtToman, fa } from "@/lib/format";

export const metadata = { title: "گزارش‌های مالی | پنل مدیریت" };

const PAID_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

type DailyRow = { day: Date; revenue: bigint | number; orders: bigint | number };

export default async function ReportsPage() {
  // Real daily revenue for the last 30 days, computed straight from actual
  // paid orders via a raw SQL date_trunc (Postgres) — grouping by calendar
  // day isn't something Prisma's query builder does portably, so this is
  // the one place in the project that uses $queryRaw, and only for a
  // read-only aggregate (no user input is interpolated into it).
  const dailyRaw = await db.$queryRaw<DailyRow[]>`
    SELECT date_trunc('day', "createdAt") AS day,
           SUM("total")::bigint AS revenue,
           COUNT(*)::bigint AS orders
    FROM "Order"
    WHERE "status" IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
      AND "createdAt" >= NOW() - INTERVAL '30 days'
    GROUP BY day
    ORDER BY day ASC
  `;
  const daily = dailyRaw.map((r) => ({ day: r.day, revenue: Number(r.revenue), orders: Number(r.orders) }));
  const totalRevenue30d = daily.reduce((s, d) => s + d.revenue, 0);
  const totalOrders30d = daily.reduce((s, d) => s + d.orders, 0);

  // Top-selling products by real quantity sold on paid orders — a genuine
  // aggregate over OrderItem, not a manually curated "featured" list.
  const topItemsRaw = await db.$queryRaw<{ productId: string; name: string; qty: bigint; revenue: bigint }[]>`
    SELECT oi."productId" AS "productId",
           oi."nameSnapshot" AS name,
           SUM(oi."quantity")::bigint AS qty,
           SUM(oi."total")::bigint AS revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o."status" IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
    GROUP BY oi."productId", oi."nameSnapshot"
    ORDER BY qty DESC
    LIMIT 10
  `;
  const topItems = topItemsRaw.map((r) => ({ productId: r.productId, name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) }));

  // Gross profit (Phase 6) — real revenue minus real cost, computed only
  // for order items whose product still has a costPrice set (Product.costPrice
  // is optional; an admin who never filled it in for a product simply gets
  // that item excluded from the cost side rather than a fabricated
  // estimate). IMPORTANT, documented honestly: this uses the product's
  // CURRENT costPrice, not a historical snapshot at the time of sale — cost
  // prices aren't versioned in this project, so a cost change today also
  // reshapes past orders' reported profit. Variant-only products (no
  // productId-less items — every OrderItem always keeps its productId, only
  // variantId is optional) are included the same way via their parent
  // Product's costPrice.
  const profitRaw = await db.$queryRaw<{ revenue: bigint; cost: bigint; qty: bigint; itemsWithCost: bigint; itemsTotal: bigint }[]>`
    SELECT
      COALESCE(SUM(oi."total"), 0)::bigint AS revenue,
      COALESCE(SUM(CASE WHEN p."costPrice" IS NOT NULL THEN p."costPrice" * oi."quantity" ELSE 0 END), 0)::bigint AS cost,
      COALESCE(SUM(oi."quantity"), 0)::bigint AS qty,
      COUNT(*) FILTER (WHERE p."costPrice" IS NOT NULL)::bigint AS "itemsWithCost",
      COUNT(*)::bigint AS "itemsTotal"
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    LEFT JOIN "Product" p ON p.id = oi."productId"
    WHERE o."status" IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
  `;
  const profitRow = profitRaw[0];
  const grossRevenueForProfit = Number(profitRow?.revenue || 0);
  // "cost" here only reflects the items that actually had a costPrice set —
  // revenue from items without one is included above (grossRevenueForProfit)
  // but their cost is unknown, so the profit figure below is a lower-bound
  // estimate whenever itemsWithCost < itemsTotal, and this is shown to the
  // admin explicitly rather than silently treating missing cost as zero.
  const knownCost = Number(profitRow?.cost || 0);
  const grossProfit = grossRevenueForProfit - knownCost;
  const itemsWithCost = Number(profitRow?.itemsWithCost || 0);
  const itemsTotal = Number(profitRow?.itemsTotal || 0);
  const hasIncompleteCostData = itemsTotal > 0 && itemsWithCost < itemsTotal;

  // Real order-status breakdown (all-time counts), useful as a quick
  // operational snapshot alongside the revenue numbers above.
  const statusCounts = await db.order.groupBy({ by: ["status"], _count: { _all: true } });
  const statusLabel: Record<string, string> = {
    PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", PROCESSING: "در حال آماده‌سازی",
    SHIPPED: "ارسال شده", DELIVERED: "تحویل داده شده", CANCELED: "لغو شده",
  };

  const maxDailyRevenue = Math.max(1, ...daily.map((d) => d.revenue));

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">گزارش‌های مالی</h1>
      <p className="muted text-sm mb-6">همه‌ی اعداد این صفحه مستقیماً از سفارش‌های واقعاً پرداخت‌شده (PAID به بعد) محاسبه می‌شوند — هیچ عدد نمایشی یا تخمینی وجود ندارد.</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="surface border line rounded-2xl p-5">
          <p className="text-xs muted mb-1">درآمد ۳۰ روز اخیر</p>
          <p className="text-xl font-extrabold">{fmtToman(totalRevenue30d)}</p>
        </div>
        <div className="surface border line rounded-2xl p-5">
          <p className="text-xs muted mb-1">تعداد سفارش پرداخت‌شده در ۳۰ روز اخیر</p>
          <p className="text-xl font-extrabold">{fa(totalOrders30d)}</p>
        </div>
      </div>

      <h2 className="font-bold text-sm mb-3">روند درآمد روزانه (۳۰ روز اخیر)</h2>
      {daily.length === 0 ? (
        <p className="muted text-sm mb-8">در ۳۰ روز اخیر هیچ سفارش پرداخت‌شده‌ای ثبت نشده است.</p>
      ) : (
        <div className="flex items-end gap-1 h-32 mb-2 surface2 rounded-xl p-3">
          {daily.map((d) => (
            <div
              key={d.day.toString()}
              title={`${new Date(d.day).toLocaleDateString("fa-IR")} — ${fmtToman(d.revenue)}`}
              className="flex-1 rounded-t"
              style={{ height: `${Math.max(4, (d.revenue / maxDailyRevenue) * 100)}%`, background: "var(--ink)" }}
            />
          ))}
        </div>
      )}
      {daily.length > 0 && (
        <p className="text-xs muted mb-8">از {new Date(daily[0].day).toLocaleDateString("fa-IR")} تا {new Date(daily[daily.length - 1].day).toLocaleDateString("fa-IR")} — روی هر ستون نگه دارید تا مبلغ دقیق را ببینید.</p>
      )}

      <h2 className="font-bold text-sm mb-3">پرفروش‌ترین محصولات (بر اساس تعداد فروش واقعی)</h2>
      {topItems.length === 0 ? (
        <p className="muted text-sm mb-8">هنوز هیچ سفارش پرداخت‌شده‌ای ثبت نشده است.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-8">
          {topItems.map((it, i) => (
            <div key={it.productId + i} className="flex justify-between surface border line rounded-xl p-3 text-sm">
              <span>{fa(i + 1)}. {it.name}</span>
              <span className="muted">{fa(it.qty)} عدد فروخته‌شده · {fmtToman(it.revenue)}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-bold text-sm mb-3">سود ناخالص (کل تاریخچه سفارش‌های پرداخت‌شده)</h2>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="surface border line rounded-2xl p-5">
          <p className="text-xs muted mb-1">درآمد کل</p>
          <p className="text-xl font-extrabold">{fmtToman(grossRevenueForProfit)}</p>
        </div>
        <div className="surface border line rounded-2xl p-5">
          <p className="text-xs muted mb-1">سود ناخالص (درآمد − قیمت تمام‌شده)</p>
          <p className="text-xl font-extrabold">{fmtToman(grossProfit)}</p>
        </div>
      </div>
      <p className="text-xs muted mb-8">
        سود ناخالص بر اساس قیمت تمام‌شدهٔ فعلی محصولات محاسبه شده (نه قیمت تمام‌شده در لحظهٔ فروش، چون این مقدار تاریخچه‌دار ذخیره نمی‌شود).
        {hasIncompleteCostData
          ? ` توجه: قیمت تمام‌شده برای ${fa(itemsTotal - itemsWithCost)} از ${fa(itemsTotal)} قلم فروخته‌شده ثبت نشده، بنابراین این عدد یک برآورد حداقلی است، نه سود واقعی دقیق.`
          : " قیمت تمام‌شده برای همهٔ اقلام فروخته‌شده ثبت شده است."}
      </p>

      <h2 className="font-bold text-sm mb-3">وضعیت سفارش‌ها (کل تاریخچه)</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {statusCounts.map((s) => (
          <div key={s.status} className="surface2 rounded-xl p-4">
            <p className="text-xs muted mb-1">{statusLabel[s.status] || s.status}</p>
            <p className="font-extrabold">{fa(s._count._all)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
