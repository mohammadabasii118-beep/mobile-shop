import Link from "next/link";
import { db } from "@/lib/db";
import { fmtToman } from "@/lib/format";

export const metadata = { title: "جستجو | پنل مدیریت" };

const orderStatusLabel: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده", DELIVERED: "تحویل داده شده", CANCELED: "لغو شده",
};

export default async function AdminSearchPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q || "").trim();

  if (!q) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-6">جستجو</h1>
        <p className="muted text-sm">عبارتی برای جستجو در محصولات، سفارش‌ها و کاربران وارد کنید.</p>
      </div>
    );
  }

  // Real search across three real tables — no fuzzy/AI matching, just
  // case-insensitive substring matches on the fields an admin would
  // actually type (name/SKU for products, order number/phone for orders,
  // name/email/phone for users). Capped at 10 results per section so the
  // page stays fast and scannable rather than a full paginated search UI.
  const [products, orders, users] = await Promise.all([
    db.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
    db.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { shippingPhone: { contains: q, mode: "insensitive" } },
          { shippingName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const noResults = products.length === 0 && orders.length === 0 && users.length === 0;

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">نتایج جستجو برای «{q}»</h1>
      {noResults && <p className="muted text-sm mt-4">هیچ محصول، سفارش یا کاربری با این عبارت پیدا نشد.</p>}

      {products.length > 0 && (
        <div className="mt-6">
          <h2 className="font-bold text-sm mb-3">محصولات ({products.length})</h2>
          <div className="flex flex-col gap-2">
            {products.map((p) => (
              <Link key={p.id} href={`/admin/products/${p.id}/edit`} className="flex justify-between surface border line rounded-xl p-3 text-sm">
                <span>{p.name}{p.sku ? <span className="muted"> — {p.sku}</span> : null}</span>
                <span className="font-medium">{fmtToman(p.price)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-6">
          <h2 className="font-bold text-sm mb-3">سفارش‌ها ({orders.length})</h2>
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex justify-between surface border line rounded-xl p-3 text-sm">
                <span>{o.orderNumber} — {o.shippingName} ({o.shippingPhone})</span>
                <span className="font-medium">{orderStatusLabel[o.status]}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {users.length > 0 && (
        <div className="mt-6">
          <h2 className="font-bold text-sm mb-3">کاربران ({users.length})</h2>
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="flex justify-between surface border line rounded-xl p-3 text-sm">
                <span>{u.name}</span>
                <span className="muted">{u.email}{u.phone ? ` · ${u.phone}` : ""}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
