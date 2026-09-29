import { db } from "@/lib/db";
import { logOrderStatus } from "@/lib/orderStatusHistory";

// Shared, race-safe "cancel this order and give its reserved stock back"
// logic, used by:
//   - the admin "change order status to canceled" action
//   - the reservation-expiry release script (scripts/releaseExpiredReservations.ts)
//   - the Zarinpal callback's failure/NOK path
//
// Everything happens inside one transaction, and the cancel itself is a
// conditional "claim" (updateMany with `status: { not: "CANCELED" }`) so
// two concurrent callers (e.g. an admin click racing the release script,
// or two duplicate gateway callbacks) can never both restore the same
// order's stock — only the caller that wins the claim does the restore.
export async function cancelOrderAtomic(
  orderId: string,
  note?: string,
  options?: { refundToWallet?: boolean }
): Promise<{ canceled: boolean; refunded?: boolean }> {
  return db.$transaction(async (tx) => {
    // Read BEFORE the claim, since the claim below immediately overwrites
    // status to CANCELED — this is the only chance to know whether the
    // order had genuinely been paid (only a paid order's money can be
    // refunded; a still-PENDING_PAYMENT order never collected anything).
    const before = await tx.order.findUnique({ where: { id: orderId } });
    if (!before) return { canceled: false };
    const wasPaid = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(before.status);

    const claim = await tx.order.updateMany({
      where: { id: orderId, status: { not: "CANCELED" } },
      data: { status: "CANCELED" },
    });
    if (claim.count === 0) {
      // Already canceled by someone else — nothing to restore, not an error.
      return { canceled: false };
    }

    await logOrderStatus(tx, orderId, "CANCELED", note);

    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const it of items) {
      if (it.variantId) {
        await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
      } else if (it.productId) {
        await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
      }
    }

    // Refund-to-wallet, when asked for, only ever applies to an order that
    // was truly paid, belongs to a real account, and hasn't already been
    // refunded this way — all three checked here, inside the same
    // transaction as the cancel + restock, so it can't race with another
    // refund attempt on the same order.
    let refunded = false;
    if (options?.refundToWallet && wasPaid && before.userId && !before.refundedToWalletAt) {
      await tx.order.update({ where: { id: orderId }, data: { refundedToWalletAt: new Date() } });
      await tx.user.update({ where: { id: before.userId }, data: { walletBalance: { increment: before.total } } });
      await tx.walletTransaction.create({
        data: {
          userId: before.userId,
          amount: before.total,
          reason: `بازگشت وجه سفارش ${before.orderNumber}`,
          orderId: before.id,
        },
      });
      refunded = true;
    }

    return { canceled: true, refunded };
  });
}
