import type { Discount } from "@/lib/generated/prisma/client";
import { legacyFixedOf, resolveUnitDiscount, type LineCtx } from "@/lib/server/price-engine/discounts";
import { unitPriceFor, type UnitPrice, type Viewer } from "@/lib/server/pricing";
import { DEFAULT_WHOLESALE_POLICY, type WholesalePolicy } from "@/lib/server/price-engine/wholesale";

export interface PriceInput {
  qty: number;
  product: { id: string; categoryId: string; category?: { parentId: string | null } | null; extraCategories?: { categoryId: string; category: { parentId: string | null } }[]; extraBrands?: { brandId: string }[]; brandId: string | null; retailPrice: number; retailDiscount: number; wholesalePrice: number | null; wholesaleDiscount: number; minWholesaleQty: number };
  variant: { id: string; retailPrice: number | null; salePrice?: number | null; wholesalePrice: number | null; phoneModelId?: string | null; phoneModel?: { brandId: string } | null };
}

export const lineCtx = (i: PriceInput["product"], v: PriceInput["variant"]): LineCtx => ({
  productId: i.id, variantId: v.id, categoryIds: [i.categoryId, i.category?.parentId ?? "", ...(i.extraCategories ?? []).flatMap((e) => [e.categoryId, e.category.parentId ?? ""])].filter(Boolean),
  productBrandId: i.brandId, extraBrandIds: (i.extraBrands ?? []).map((b) => b.brandId), phoneBrandId: v.phoneModel?.brandId ?? null, phoneModelId: v.phoneModelId ?? null,
});

/**
 * THE way a cart/checkout line is priced. Cart and checkout both call this, so their totals cannot diverge.
 * Pass 1 decides which lines are retail (wholesale eligibility depends on the viewer and quantity) and their
 * pre-discount subtotal; pass 2 resolves the single best discount per unit and prices the line.
 */
export function priceLines(inputs: PriceInput[], viewer: Viewer, discounts: Discount[], userUses?: Map<string, number>, policy: WholesalePolicy = DEFAULT_WHOLESALE_POLICY): UnitPrice[] {
  // Public price of the day (best unconditional discount): the ceiling for a partner's unit price when the policy says so.
  const publicRetail = (i: PriceInput) => { const base = i.variant.retailPrice ?? i.product.retailPrice; return Math.max(0, base - resolveUnitDiscount(discounts, lineCtx(i.product, i.variant), base, legacyFixedOf(i.product.retailDiscount, base, i.variant.salePrice)).amount); };
  const first = inputs.map((i) => unitPriceFor(i.product, i.variant, i.qty, viewer, undefined, policy.capAtRetail && viewer?.wholesale ? publicRetail(i) : undefined));
  const cartRetailSubtotal = inputs.reduce((a, i, k) => a + (first[k]!.priceType === "retail" ? first[k]!.listPrice * i.qty : 0), 0);
  return inputs.map((i, k) => {
    if (first[k]!.priceType === "wholesale") return first[k]!;
    const base = first[k]!.listPrice;
    const promo = resolveUnitDiscount(discounts, lineCtx(i.product, i.variant), base, legacyFixedOf(i.product.retailDiscount, base, i.variant.salePrice), { cartRetailSubtotal, userUses });
    return unitPriceFor(i.product, i.variant, i.qty, viewer, promo);
  });
}
