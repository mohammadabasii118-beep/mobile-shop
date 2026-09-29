import Link from "next/link";
import { db } from "@/lib/db";
import { fa } from "@/lib/format";

export const metadata = { title: "انبار | پنل مدیریت" };

// A simple, honest low-stock threshold — not a forecasting/reorder-point
// algorithm (that would need real sales-velocity data this project
// doesn't compute yet). Just "how many units are actually left, right
// now, in the real stock column" — sorted lowest first so the most urgent
// items are on top.
const LOW_STOCK_THRESHOLD = 5;

export default async function InventoryPage() {
  const [simpleProducts, variants] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, hasVariants: false, stock: { lte: LOW_STOCK_THRESHOLD } },
      orderBy: { stock: "asc" },
      select: { id: true, name: true, stock: true, sku: true },
    }),
    db.productVariant.findMany({
      where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } },
      orderBy: { stock: "asc" },
      include: { product: { select: { id: true, name: true } }, brand: true, phoneModel: true, color: true },
    }),
  ]);

  const rows = [
    ...simpleProducts.map((p) => ({
      key: `p-${p.id}`,
      label: p.name,
      sub: p.sku || null,
      stock: p.stock,
      href: `/admin/products/${p.id}/edit`,
    })),
    ...variants.map((v) => ({
      key: `v-${v.id}`,
      label: v.product.name,
      sub: [v.brand?.name, v.phoneModel?.name, v.color?.name].filter(Boolean).join(" / ") || null,
      stock: v.stock,
      href: `/admin/products/${v.product.id}/variants/${v.id}/edit`,
    })),
  ].sort((a, b) => a.stock - b.stock);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">انبار — موجودی کم</h1>
      <p className="muted text-sm mb-6">
        محصولات و ترکیب‌های فعالی که موجودی واقعی‌شان {fa(LOW_STOCK_THRESHOLD)} عدد یا کمتر است — مرتب‌شده از کم‌ترین موجودی. این فقط یک آستانه‌ی ثابت است، نه یک سامانه‌ی پیش‌بینی سفارش مجدد بر اساس سرعت فروش.
      </p>

      {rows.length === 0 ? (
        <p className="muted text-sm">در حال حاضر هیچ محصول/ترکیب فعالی با موجودی کم وجود ندارد. 🎉</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <Link key={r.key} href={r.href} className="flex justify-between items-center surface border line rounded-xl p-3 text-sm">
              <div>
                <p className="font-medium">{r.label}</p>
                {r.sub && <p className="text-xs muted mt-0.5">{r.sub}</p>}
              </div>
              <span
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={r.stock === 0 ? { background: "#f6eae6", color: "#a24e56" } : { background: "var(--surface-2)" }}
              >
                {r.stock === 0 ? "ناموجود" : `${fa(r.stock)} عدد باقی‌مانده`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
