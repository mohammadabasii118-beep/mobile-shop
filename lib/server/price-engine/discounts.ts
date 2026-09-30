import type { Discount, Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { conflict } from "@/lib/server/errors";
import { pickBestDiscount, type AppliedDiscount, type DiscountLike } from "@/lib/server/price-engine/calc";

type Db = Prisma.TransactionClient | typeof db;

/** What a discount can be matched against. All ids come from the database, never from the client. */
export interface LineCtx {
  productId: string; variantId: string | null;
  categoryIds: string[]; // the product's category and its ancestors
  productBrandId: string | null; extraBrandIds?: string[]; // the product's primary brand and any additional ones
  phoneBrandId: string | null; phoneModelId: string | null;
}

/** Currently usable promotions: enabled, inside their time window, and not out of global capacity. */
export async function loadActiveDiscounts(client: Db = db, now = new Date()): Promise<Discount[]> {
  const rows = await client.discount.findMany({
    where: { isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] },
    orderBy: { createdAt: "asc" },
  });
  return rows.filter((d) => d.usageLimit == null || d.usedCount < d.usageLimit);
}

const brandIdsOf = (c: LineCtx) => [c.productBrandId ?? "", ...(c.extraBrandIds ?? [])].filter(Boolean);

export function matchesLine(d: Pick<Discount, "scope" | "targetId">, c: LineCtx): boolean {
  switch (d.scope) {
    case "ALL": return true;
    case "PRODUCT": return d.targetId === c.productId;
    case "VARIANT": return !!c.variantId && d.targetId === c.variantId;
    case "CATEGORY": return c.categoryIds.includes(d.targetId);
    case "MODEL": return !!c.phoneModelId && d.targetId === c.phoneModelId;
    case "PRODUCT_BRAND": return brandIdsOf(c).includes(d.targetId); // the maker of the product (Spigen)
    case "PHONE_BRAND": return !!c.phoneBrandId && d.targetId === c.phoneBrandId; // the brand of the variant's phone model (Apple)
    case "BRAND": return brandIdsOf(c).includes(d.targetId) || (!!c.phoneBrandId && d.targetId === c.phoneBrandId); // legacy rows only
  }
}

export interface DiscountEnv {
  /** Cart retail subtotal BEFORE discounts. Omit on product/list pages: promotions with a minimum order then do not show. */
  cartRetailSubtotal?: number;
  /** How many times the signed-in user already used each discount (for per-user limits). */
  userUses?: Map<string, number>;
}

/**
 * Best single reduction for one unit: the legacy per-product fixed discount competes with matching promotions.
 * Nothing stacks, so the same price can never be discounted twice.
 */
export function resolveUnitDiscount(discounts: Discount[], line: LineCtx, baseUnit: number, legacyFixed: number, env: DiscountEnv = {}): AppliedDiscount {
  const cands: DiscountLike[] = [];
  if (legacyFixed > 0) cands.push({ id: null, label: "تخفیف محصول", type: "FIXED", value: legacyFixed });
  for (const d of discounts) {
    if (!matchesLine(d, line)) continue;
    if (d.minOrder > 0 && (env.cartRetailSubtotal == null || env.cartRetailSubtotal < d.minOrder)) continue;
    if (d.perUserLimit != null && env.userUses && (env.userUses.get(d.id) ?? 0) >= d.perUserLimit) continue;
    cands.push({ id: d.id, label: d.name, type: d.type, value: d.value });
  }
  return pickBestDiscount(baseUnit, cands);
}

export async function userDiscountUses(client: Db, userId: string, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await client.discountUsage.groupBy({ by: ["discountId"], where: { userId, discountId: { in: ids } }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.discountId, r._count._all]));
}

/** Called inside the order transaction for every promotion that reduced a price: enforces limits atomically and records the use. */
export async function reserveDiscounts(tx: Prisma.TransactionClient, userId: string, orderId: string, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) {
    const d = await tx.discount.findUnique({ where: { id } });
    if (!d) throw conflict("یکی از تخفیف‌های اعمال‌شده دیگر معتبر نیست؛ دوباره تلاش کنید.", "discount_gone");
    if (d.perUserLimit != null && (await tx.discountUsage.count({ where: { discountId: id, userId } })) >= d.perUserLimit) throw conflict("سقف استفادهٔ شما از یکی از تخفیف‌ها تمام شده است؛ دوباره تلاش کنید.", "discount_user_limit");
    const bumped = await tx.$executeRaw`UPDATE "Discount" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${id} AND "isActive" = true AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
    if (bumped !== 1) throw conflict("ظرفیت یکی از تخفیف‌ها تمام شده است؛ دوباره تلاش کنید.", "discount_exhausted");
    await tx.discountUsage.create({ data: { discountId: id, userId, orderId } });
  }
}

/** Gives promotion uses back when an order is cancelled or fully refunded. Idempotent (usage rows are deleted once). */
export async function rollbackDiscounts(tx: Prisma.TransactionClient, orderId: string) {
  const usages = await tx.discountUsage.findMany({ where: { orderId } });
  if (!usages.length) return 0;
  const del = await tx.discountUsage.deleteMany({ where: { id: { in: usages.map((u) => u.id) } } });
  if (del.count > 0) for (const u of usages) await tx.$executeRaw`UPDATE "Discount" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "id" = ${u.discountId}`;
  return del.count;
}
