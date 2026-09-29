"use server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin } from "./guard";
import { cancelOrderAtomic } from "@/lib/orderLifecycle";

/**
 * The current logged-in user's real wallet balance and transaction
 * history — read straight from the database, never cached client-side.
 */
export async function getMyWallet() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { balance: 0, transactions: [] as any[] };
  const userId = session.user.id as string;
  const [user, transactions] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { walletBalance: true } }),
    db.walletTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return {
    balance: user?.walletBalance || 0,
    transactions: transactions.map((t) => ({
      id: t.id, amount: t.amount, reason: t.reason, createdAt: t.createdAt.toISOString(),
    })),
  };
}

/**
 * Admin-only, manual wallet adjustment — the only way to CREDIT a wallet
 * without a genuine underlying order refund. Always requires a real,
 * human-entered reason and is always written to the same append-only
 * ledger as every other wallet change, so it's fully auditable — never a
 * silent balance edit.
 */
export async function adjustWalletBalance(userId: string, amountDelta: number, reason: string) {
  await requireAdmin();
  if (!Number.isInteger(amountDelta) || amountDelta === 0) throw new Error("مبلغ نامعتبر است");
  if (!reason || reason.trim().length < 3) throw new Error("دلیل تغییر کیف پول را وارد کنید");

  await db.$transaction(async (tx) => {
    if (amountDelta < 0) {
      // Claim-guarded debit — same pattern used everywhere else in this
      // project for "never let a counter go negative under concurrency"
      // (stock, discount usage limits): only succeeds while the balance
      // actually covers the debit.
      const result = await tx.user.updateMany({
        where: { id: userId, walletBalance: { gte: -amountDelta } },
        data: { walletBalance: { increment: amountDelta } },
      });
      if (result.count === 0) throw new Error("موجودی کیف پول کاربر برای این کسر کافی نیست");
    } else {
      await tx.user.update({ where: { id: userId }, data: { walletBalance: { increment: amountDelta } } });
    }
    await tx.walletTransaction.create({ data: { userId, amount: amountDelta, reason: reason.trim() } });
  });

  revalidatePath(`/admin/users/${userId}`);
}

/**
 * Refunds a REAL, already-paid order's total straight to the customer's
 * wallet — used when there's no connected/tested gateway refund API, or
 * an admin simply chooses this over a bank refund. Reuses the same
 * claim-based cancelOrderAtomic() as every other cancellation path in this
 * project (admin manual cancel, the reservation-release script, the
 * Zarinpal callback's failure path), so the stock-restore + refund happen
 * atomically together and can never be double-applied under a race.
 */
export async function refundOrderToWallet(orderId: string) {
  await requireAdmin();
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, userId: true, refundedToWalletAt: true },
  });
  if (!order) throw new Error("سفارش پیدا نشد");
  if (!order.userId) throw new Error("سفارش‌های مهمان (بدون حساب کاربری) کیف پول ندارند — بازگشت وجه به کیف پول برای آن‌ها ممکن نیست");
  if (order.refundedToWalletAt) throw new Error("این سفارش قبلاً به کیف پول بازگشت داده شده است");
  if (!["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)) {
    throw new Error("فقط سفارش‌هایی که واقعاً پرداخت شده‌اند قابل بازگشت وجه به کیف پول هستند");
  }

  const result = await cancelOrderAtomic(orderId, "لغو سفارش و بازگشت وجه به کیف پول توسط مدیر", { refundToWallet: true });
  if (!result.canceled) throw new Error("این سفارش هم‌زمان توسط یک عملیات دیگر لغو شد — صفحه را رفرش کنید");
  if (!result.refunded) throw new Error("بازگشت وجه انجام نشد — وضعیت سفارش در همین حین تغییر کرده بود");

  revalidatePath(`/admin/orders/${orderId}`);
}
