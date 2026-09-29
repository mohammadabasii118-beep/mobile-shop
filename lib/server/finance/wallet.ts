import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { conflict } from "@/lib/server/errors";

type Tx = Prisma.TransactionClient;

export type WalletTxType = "admin_credit" | "admin_debit" | "order_payment" | "order_cancel_restore" | "refund_credit";

export interface WalletOp {
  userId: string;
  direction: "in" | "out";
  amount: number;
  type: WalletTxType;
  /** Idempotency key: applying the same reference twice returns the first result and changes nothing. */
  reference: string;
  description?: string;
  orderId?: string;
  byId?: string;
}

/**
 * The only function that changes a wallet balance. Must run inside a transaction.
 *  - serialised per reference (advisory lock) so a duplicate request cannot double-apply,
 *  - the balance moves with one atomic conditional UPDATE, so it can never go negative,
 *  - records balanceBefore / balanceAfter / reference / actor for every movement.
 */
export async function walletApply(tx: Tx, op: WalletOp) {
  if (!Number.isInteger(op.amount) || op.amount <= 0) throw conflict("مبلغ نامعتبر است.", "invalid_amount");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"wallet:" + op.reference}))`;
  const existing = await tx.walletTransaction.findUnique({ where: { reference: op.reference }, include: { wallet: { select: { userId: true } } } });
  if (existing) {
    if (existing.wallet.userId !== op.userId) throw conflict("شناسه مرجع تکراری است.", "reference_reuse");
    return { transaction: existing, balance: existing.balanceAfter, replay: true as const };
  }
  const wallet = await tx.wallet.upsert({ where: { userId: op.userId }, update: {}, create: { userId: op.userId } });
  const delta = op.direction === "in" ? op.amount : -op.amount;
  const rows = await tx.$queryRaw<{ balance: number }[]>`UPDATE "Wallet" SET "balance" = "balance" + ${delta}, "updatedAt" = now() WHERE "id" = ${wallet.id} AND "balance" + ${delta} >= 0 RETURNING "balance"`;
  if (rows.length !== 1) throw conflict("موجودی کیف پول کافی نیست.", "insufficient_wallet");
  const after = rows[0]!.balance;
  const transaction = await tx.walletTransaction.create({
    data: { walletId: wallet.id, type: op.type, direction: op.direction, amount: op.amount, balanceBefore: after - delta, balanceAfter: after, reference: op.reference, description: op.description ?? null, orderId: op.orderId ?? null, createdById: op.byId ?? null },
  });
  return { transaction, balance: after, replay: false as const };
}

export async function getWalletBalance(userId: string) {
  return (await db.wallet.findUnique({ where: { userId }, select: { balance: true } }))?.balance ?? 0;
}

export const WALLET_TYPE_LABEL: Record<string, string> = {
  admin_credit: "افزایش اعتبار توسط پشتیبانی", admin_debit: "کاهش اعتبار توسط پشتیبانی", order_payment: "پرداخت سفارش",
  order_cancel_restore: "بازگشت اعتبار سفارش لغوشده", refund_credit: "بازگشت وجه به کیف پول", credit: "افزایش اعتبار", debit: "کاهش اعتبار", refund: "بازگشت وجه", admin_adjustment: "اصلاح توسط مدیر",
};

export async function walletHistory(userId: string, take = 50, skip = 0) {
  const w = await db.wallet.findUnique({ where: { userId } });
  if (!w) return { balance: 0, items: [], total: 0 };
  const [items, total] = await Promise.all([
    db.walletTransaction.findMany({ where: { walletId: w.id }, orderBy: { createdAt: "desc" }, take, skip }),
    db.walletTransaction.count({ where: { walletId: w.id } }),
  ]);
  return { balance: w.balance, items, total };
}
