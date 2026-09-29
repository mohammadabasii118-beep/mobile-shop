import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Whether the CURRENT logged-in viewer is an approved wholesale partner.
 * Always re-checked against the database (never trusted from the session
 * token), since a partner application can be approved or — in principle —
 * revoked after the session was issued.
 */
export async function isViewerWholesale(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { isWholesale: true } });
  return !!user?.isWholesale;
}

/**
 * Resolves the price a specific viewer should see/pay for one product or
 * variant. A wholesale price only ever applies when BOTH are true: the
 * viewer is an approved partner (User.isWholesale) AND this exact
 * product/variant has a wholesalePrice set by an admin. Otherwise the
 * normal retail price is used — there is no fallback discount or
 * percentage guess, only real admin-entered numbers.
 */
export function effectivePrice(
  retailPrice: number,
  wholesalePrice: number | null | undefined,
  isWholesale: boolean
): number {
  if (isWholesale && wholesalePrice != null) return wholesalePrice;
  return retailPrice;
}

export type WholesaleTier = { minQuantity: number; discountPercent: number };

/** All active quantity tiers, highest minQuantity first — so the caller can
 * pick the first one a given quantity qualifies for (the biggest tier it
 * reaches). Only ever consulted for a viewer already confirmed wholesale;
 * a retail customer's price never calls this. */
export async function getActiveWholesaleTiers(): Promise<WholesaleTier[]> {
  const tiers = await db.wholesaleTier.findMany({ where: { isActive: true }, orderBy: { minQuantity: "desc" } });
  return tiers.map((t) => ({ minQuantity: t.minQuantity, discountPercent: t.discountPercent }));
}

/**
 * Applies the best-matching quantity tier discount on top of an already
 * wholesale-resolved unit price. Pure function — the caller (checkout,
 * currently the only authoritative pricing point that also knows a line's
 * real quantity) supplies the tier list already fetched from the database.
 * Never called for a non-wholesale viewer.
 */
export function applyWholesaleTier(unitPrice: number, quantity: number, tiers: WholesaleTier[]): number {
  const tier = tiers.find((t) => quantity >= t.minQuantity);
  if (!tier) return unitPrice;
  return Math.round(unitPrice * (1 - tier.discountPercent / 100));
}
