import type { SessionUser } from "@/lib/server/auth/session";

export type PriceType = "retail" | "wholesale";
export type Viewer = Pick<SessionUser, "wholesale"> | null;

interface PricedProduct { retailPrice: number; retailDiscount: number; wholesalePrice: number | null; wholesaleDiscount: number; minWholesaleQty: number }
interface PricedVariant { retailPrice: number | null; wholesalePrice: number | null }

/**
 * The single place where a unit price is decided. Retail and wholesale prices are independent.
 * Wholesale applies only to an approved partner (checked from the DB, never from the client)
 * and only when the line quantity reaches the product's minimum wholesale quantity.
 */
export interface UnitPrice {
  unitPrice: number; priceType: PriceType;
  /** Retail base price (before any discount). */
  listPrice: number;
  /** Unit price before any discount, for the price type that applies (retail base, or wholesale base). */
  originalPrice: number;
  /** Per-unit discount actually taken and where it came from. */
  discountAmount: number; discountId: string | null; discountLabel: string | null;
}
/** A reduction already resolved by the discount engine (best of the legacy product discount and matching promotions). */
export interface PromoApplied { amount: number; id: string | null; label: string | null }

export function unitPriceFor(product: PricedProduct, variant: PricedVariant, qty: number, viewer: Viewer, promo?: PromoApplied): UnitPrice {
  const retailBase = variant.retailPrice ?? product.retailPrice;
  const retailDiscount = promo ? promo.amount : product.retailDiscount;
  const retail = Math.max(0, retailBase - retailDiscount);
  const w = viewer?.wholesale;
  const wBase = variant.wholesalePrice ?? product.wholesalePrice;
  if (w && wBase != null && qty >= Math.max(1, product.minWholesaleQty)) {
    const afterDiscount = Math.max(0, wBase - product.wholesaleDiscount);
    const unit = Math.round((afterDiscount * (100 - w.discountPercent)) / 100);
    return { unitPrice: unit, priceType: "wholesale", listPrice: retailBase, originalPrice: wBase, discountAmount: Math.max(0, wBase - unit), discountId: null, discountLabel: "قیمت همکار" };
  }
  return { unitPrice: retail, priceType: "retail", listPrice: retailBase, originalPrice: retailBase, discountAmount: retailBase - retail, discountId: promo?.id ?? null, discountLabel: promo?.label ?? (product.retailDiscount > 0 ? "تخفیف محصول" : null) };
}
