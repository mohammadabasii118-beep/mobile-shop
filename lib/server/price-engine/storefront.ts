import "server-only";
import type { Discount } from "@/lib/generated/prisma/client";
import { priceLines } from "@/lib/server/price-engine/line";
import type { Viewer } from "@/lib/server/pricing";
import type { VariantOption } from "@/lib/types";

interface RowV {
  id: string; sku: string; isActive: boolean; retailPrice: number | null; wholesalePrice: number | null; name: string;
  phoneModelId: string | null; colorId: string | null;
  phoneModel: { id: string; name: string; brandId: string; brand: { name: string } } | null;
  colorRef: { name: string; hex: string | null } | null;
  inventory: { quantity: number } | null;
}
interface RowP { id: string; categoryId: string; category: { parentId: string | null }; brandId: string | null; retailPrice: number; retailDiscount: number; wholesalePrice: number | null; wholesaleDiscount: number; minWholesaleQty: number; variants: RowV[] }

/**
 * Selectable variants of a product for the product page: brand → model → colour, each with its own stock and its own
 * server-computed price (after the best discount). Display only: the cart and checkout recompute everything again.
 */
export function buildVariantOptions(p: RowP, viewer: Viewer, discounts: Discount[]): VariantOption[] | null {
  const modelled = p.variants.filter((v) => v.isActive && (v.phoneModelId || v.colorId));
  if (!modelled.length) return null;
  return modelled.map((v) => {
    const retail = priceLines([{ qty: 1, product: p, variant: v }], null, discounts)[0]!;
    const ws = viewer?.wholesale && p.wholesalePrice != null ? priceLines([{ qty: Math.max(1, p.minWholesaleQty), product: p, variant: v }], viewer, discounts)[0]! : null;
    return {
      id: v.id, sku: v.sku, stock: v.inventory?.quantity ?? 0,
      brandId: v.phoneModel?.brandId ?? null, brandName: v.phoneModel?.brand.name ?? null,
      modelId: v.phoneModelId, modelName: v.phoneModel?.name ?? null,
      colorId: v.colorId, colorName: v.colorRef?.name ?? null, colorHex: v.colorRef?.hex ?? null,
      price: retail.unitPrice, oldPrice: retail.discountAmount > 0 ? retail.originalPrice : undefined,
      wholesale: ws && ws.priceType === "wholesale" ? { unit: ws.unitPrice, min: p.minWholesaleQty } : null,
    };
  });
}
