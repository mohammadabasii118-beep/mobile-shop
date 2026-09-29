import { db } from "@/lib/db";

/**
 * Pricing Engine
 * Given a supplier/cost price, finds the matching admin-configured band
 * and returns the sell price. Rules are fully editable from /admin/pricing-rules.
 * Used when syncing products from a supplier (see lib/supplier).
 */
export async function calculateSellPrice(costPrice: number): Promise<number | null> {
  const rule = await db.pricingRule.findFirst({
    where: { isActive: true, minPrice: { lte: costPrice }, maxPrice: { gte: costPrice } },
    orderBy: { minPrice: "asc" },
  });
  return rule ? rule.sellPrice : null;
}
