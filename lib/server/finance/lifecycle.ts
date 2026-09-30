import type { Prisma } from "@/lib/generated/prisma/client";
import { walletApply } from "@/lib/server/finance/wallet";
import { reverseOrderPoints } from "@/lib/server/finance/loyalty";
import { rollbackDiscounts } from "@/lib/server/price-engine/discounts";

type Tx = Prisma.TransactionClient;

/** Returns the order's stock exactly once (Order.restockedAt is claimed atomically). Returns true if it restocked now. */
export async function restockOrder(tx: Tx, orderId: string, reason: "cancel" | "refund", note: string, byId?: string) {
  const claimed = await tx.order.updateMany({ where: { id: orderId, restockedAt: null }, data: { restockedAt: new Date() } });
  if (claimed.count !== 1) return false;
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const it of items) {
    if (!it.variantId) continue;
    const inv = await tx.inventory.update({ where: { variantId: it.variantId }, data: { quantity: { increment: it.quantity } } });
    await tx.inventoryMovement.create({ data: { inventoryId: inv.id, delta: it.quantity, balanceAfter: inv.quantity, reason, orderId, note, createdById: byId ?? null } });
  }
  return true;
}

/**
 * Gives the coupon use back (global counter and per-user count) when an order is cancelled or fully refunded.
 * Idempotent: the usage row is deleted, so a second call finds nothing and changes nothing.
 */
export async function rollbackCoupon(tx: Tx, orderId: string) {
  const usages = await tx.couponUsage.findMany({ where: { orderId } });
  if (!usages.length) return 0;
  const del = await tx.couponUsage.deleteMany({ where: { id: { in: usages.map((u) => u.id) } } });
  if (del.count > 0) for (const u of usages) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "id" = ${u.couponId}`;
  return del.count;
}

/**
 * Everything that must be undone when an UNPAID order is cancelled: stock, coupon, points spent on it,
 * and the wallet amount that was already deducted at checkout. Each part is idempotent on its own.
 */
export async function releaseUnpaidOrder(tx: Tx, orderId: string, note: string, byId?: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  await restockOrder(tx, orderId, "cancel", note, byId);
  await rollbackCoupon(tx, orderId);
  await rollbackDiscounts(tx, orderId);
  await reverseOrderPoints(tx, orderId, byId);
  if (o.walletUsed > 0 && o.userId) await walletApply(tx, { userId: o.userId, direction: "in", amount: o.walletUsed, type: "order_cancel_restore", reference: `order-restore:${orderId}`, description: `بازگشت اعتبار سفارش ${o.number}`, orderId, byId });
}
