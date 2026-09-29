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
export function unitPriceFor(product: PricedProduct, variant: PricedVariant, qty: number, viewer: Viewer): { unitPrice: number; priceType: PriceType; listPrice: number } {
  const retailBase = variant.retailPrice ?? product.retailPrice;
  const retail = Math.max(0, retailBase - product.retailDiscount);
  const w = viewer?.wholesale;
  const wBase = variant.wholesalePrice ?? product.wholesalePrice;
  if (w && wBase != null && qty >= Math.max(1, product.minWholesaleQty)) {
    const afterDiscount = Math.max(0, wBase - product.wholesaleDiscount);
    const unit = Math.round((afterDiscount * (100 - w.discountPercent)) / 100);
    return { unitPrice: unit, priceType: "wholesale", listPrice: retailBase };
  }
  return { unitPrice: retail, priceType: "retail", listPrice: retailBase };
}
