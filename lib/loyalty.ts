import type { Prisma } from "@prisma/client";

// One loyalty point per 10,000 Toman actually paid on a real order. This
// number is intentionally simple and transparent (no hidden multipliers,
// no "double points" promotions that don't exist yet) — it can be tuned
// later, but whatever it is, it's always computed from a real order total,
// never invented or pre-seeded.
const TOMAN_PER_POINT = 10000;

// Redemption rate (Phase 5) — separate from the earn rate above by design:
// a point is worth less spent than it cost to earn (1,000 Toman redeemed
// vs. 10,000 Toman spent to earn it), which is a completely ordinary
// loyalty-program design (otherwise points would be a 1:1 cash
// equivalent, not a loyalty incentive) and is stated plainly here rather
// than buried in a calculation.
export const POINT_REDEEM_VALUE_TOMAN = 1000;

// A redemption can never cover more than this share of an order's
// pre-loyalty total — prevents an order from being reduced to (near) zero
// entirely via points, which would make the subtotal/shippingFee
// relationship nonsensical and could be abused if points were ever
// granted incorrectly.
export const MAX_LOYALTY_DISCOUNT_SHARE = 0.5;

/** Clamps a REQUESTED point-redemption amount to what's actually usable:
 * never more than the user's real balance, and never more than
 * MAX_LOYALTY_DISCOUNT_SHARE of the order's pre-discount total. Pure
 * function — the caller (checkout) already knows both real numbers. */
export function clampRedeemablePoints(requestedPoints: number, availablePoints: number, orderAmountBeforeLoyalty: number): number {
  if (requestedPoints <= 0) return 0;
  const maxByBalance = Math.max(0, availablePoints);
  const maxByOrderShare = Math.floor((orderAmountBeforeLoyalty * MAX_LOYALTY_DISCOUNT_SHARE) / POINT_REDEEM_VALUE_TOMAN);
  return Math.max(0, Math.min(requestedPoints, maxByBalance, maxByOrderShare));
}

/**
 * Credits loyalty points for an order the MOMENT it actually reaches PAID
 * — called from every real code path that sets Order.status to "PAID"
 * (the Zarinpal callback, card-transfer receipt approval, admin manual
 * status change, and a full wallet payment at checkout). Always called
 * with the SAME transaction client that just wrote the PAID status, so the
 * credit and the status change are committed or rolled back together.
 *
 * Idempotent: LoyaltyTransaction.orderId is @unique, so if this order was
 * somehow already credited (e.g. an admin flips status back and forth),
 * the duplicate create is skipped rather than double-crediting — checked
 * explicitly here rather than relying on the DB to throw, so a re-check is
 * simply a silent no-op instead of an unhandled error.
 */
export async function creditLoyaltyForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string | null | undefined,
  orderTotal: number
) {
  if (!userId) return; // guest orders have no account to credit
  const points = Math.floor(orderTotal / TOMAN_PER_POINT);
  if (points <= 0) return;

  const existing = await tx.loyaltyTransaction.findUnique({ where: { orderId } });
  if (existing) return;

  await tx.loyaltyTransaction.create({
    data: { userId, orderId, points, reason: "خرید سفارش" },
  });
  await tx.user.update({ where: { id: userId }, data: { loyaltyPoints: { increment: points } } });
}
