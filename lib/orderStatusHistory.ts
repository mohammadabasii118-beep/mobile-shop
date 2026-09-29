import type { Prisma, OrderStatus } from "@prisma/client";

/**
 * Appends one real status-history row. Always called with the SAME
 * transaction client (`tx`) that just wrote the status change on `Order`
 * itself, so the history row and the status it describes are committed
 * (or rolled back) together — never out of sync.
 */
export async function logOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
  status: OrderStatus,
  note?: string
) {
  await tx.orderStatusHistory.create({ data: { orderId, status, note } });
}
