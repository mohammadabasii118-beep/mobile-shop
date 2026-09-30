import type { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/server/errors";

type Db = Prisma.TransactionClient | typeof db;

/**
 * The configurable relationship between wholesale and retail price (admin setting "wholesalePolicy").
 *  - minDiscountPercent: wholesale must be at least this much BELOW the retail base price (0 = "not above retail").
 *  - maxDiscountPercent: wholesale may not be more than this much below retail (0 = no lower limit).
 *  - capAtRetail: at checkout a partner never pays more than the public retail price of the day.
 * Percentages have at most two decimals.
 */
export interface WholesalePolicy { minDiscountPercent: number; maxDiscountPercent: number; capAtRetail: boolean }
export const DEFAULT_WHOLESALE_POLICY: WholesalePolicy = { minDiscountPercent: 0, maxDiscountPercent: 0, capAtRetail: true };

export async function getWholesalePolicy(client: Db = db): Promise<WholesalePolicy> {
  const row = await client.siteSetting.findUnique({ where: { key: "wholesalePolicy" } });
  const v = (row?.value ?? {}) as Partial<WholesalePolicy>;
  return {
    minDiscountPercent: Number.isFinite(v.minDiscountPercent) ? Number(v.minDiscountPercent) : DEFAULT_WHOLESALE_POLICY.minDiscountPercent,
    maxDiscountPercent: Number.isFinite(v.maxDiscountPercent) ? Number(v.maxDiscountPercent) : DEFAULT_WHOLESALE_POLICY.maxDiscountPercent,
    capAtRetail: v.capAtRetail !== false,
  };
}

const bp = (pct: number) => Math.round(pct * 100);

/** The wholesale prices allowed for a given retail base price (integers, Toman). */
export function allowedWholesale(retail: number, p: WholesalePolicy): { min: number; max: number } {
  const max = Math.floor((retail * (10_000 - bp(p.minDiscountPercent))) / 10_000);
  const min = p.maxDiscountPercent > 0 ? Math.ceil((retail * (10_000 - bp(p.maxDiscountPercent))) / 10_000) : 0;
  return { min, max };
}

/** `null` when the pair is valid (or there is no wholesale price); otherwise the reason, in Persian. */
export function wholesaleProblem(retail: number, wholesale: number | null | undefined, p: WholesalePolicy): string | null {
  if (wholesale == null) return null;
  const { min, max } = allowedWholesale(retail, p);
  const t = (n: number) => `${n.toLocaleString("fa-IR")} تومان`;
  if (wholesale > max) return p.minDiscountPercent > 0 ? `قیمت عمده (${t(wholesale)}) باید حداقل ${p.minDiscountPercent.toLocaleString("fa-IR")}٪ پایین‌تر از قیمت خرده (${t(retail)}) باشد؛ حداکثر مجاز ${t(max)}.` : `قیمت عمده (${t(wholesale)}) نباید بیشتر از قیمت خرده (${t(retail)}) باشد.`;
  if (wholesale < min) return `قیمت عمده (${t(wholesale)}) نباید بیش از ${p.maxDiscountPercent.toLocaleString("fa-IR")}٪ پایین‌تر از قیمت خرده (${t(retail)}) باشد؛ حداقل مجاز ${t(min)}.`;
  return null;
}

/** `unpriced`: an AUTOMATIC item that has no computed price yet (no cost or no rule). It has nothing to compare, so it is not judged until it gets a price. */
export interface PriceState { productId: string; variantId: string | null; sku: string; retail: number; wholesale: number | null; unpriced: boolean }

/** Every sellable price pair of a product as it is stored now: the product itself plus each active variant (a variant without its own price inherits the product's). */
export async function priceStates(tx: Db, productId: string): Promise<PriceState[]> {
  const p = await tx.product.findUnique({ where: { id: productId }, include: { variants: true } });
  if (!p) return [];
  const out: PriceState[] = [{ productId, variantId: null, sku: p.sku, retail: p.retailPrice, wholesale: p.wholesalePrice, unpriced: p.pricingMode === "AUTOMATIC" && p.retailPrice <= 0 }];
  for (const v of p.variants) out.push({ productId, variantId: v.id, sku: v.sku, retail: v.retailPrice ?? p.retailPrice, wholesale: v.wholesalePrice ?? p.wholesalePrice, unpriced: v.pricingMode === "AUTOMATIC" && (v.retailPrice ?? p.retailPrice) <= 0 });
  return out;
}

/**
 * Save-time guard. Only pairs whose retail or wholesale price CHANGED (or that are new) are checked, so an unrelated edit of a product that is
 * already inconsistent (e.g. after the policy was tightened) is not blocked, and nothing existing is rewritten. Throws inside the caller's
 * transaction, which rolls the whole edit back.
 */
export async function assertWholesaleConsistent(tx: Db, productId: string, before: PriceState[], policy: WholesalePolicy) {
  const was = new Map(before.map((s) => [s.variantId ?? "", s]));
  const problems: string[] = [];
  for (const s of await priceStates(tx, productId)) {
    const b = was.get(s.variantId ?? "");
    if (s.unpriced || (b && b.retail === s.retail && b.wholesale === s.wholesale)) continue;
    const msg = wholesaleProblem(s.retail, s.wholesale, policy);
    if (msg) problems.push(`${s.sku}: ${msg}`);
  }
  if (problems.length) throw badRequest(problems.slice(0, 3).join(" — "), "wholesale_policy");
}
