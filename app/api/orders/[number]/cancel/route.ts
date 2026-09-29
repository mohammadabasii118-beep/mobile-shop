import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/server/errors";
import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { cancelOrder } from "@/lib/server/payments/service";
import { rateLimit } from "@/lib/server/rate-limit";

/** A customer may cancel their own order only while it is still unpaid; anything paid goes through support + refund. */
export const POST = route<{ params: Promise<{ number: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  await rateLimit(`order:cancel:${user.id}`, 10, 3600);
  const n = Number((await params).number);
  if (!Number.isInteger(n)) throw badRequest("شماره سفارش نامعتبر است.");
  const o = await db.order.findFirst({ where: { number: n, userId: user.id }, select: { id: true, status: true } });
  if (!o) throw notFound("سفارش پیدا نشد.");
  if (o.status !== "PENDING_PAYMENT") throw badRequest("فقط سفارش پرداخت‌نشده را می‌توانید لغو کنید. برای سفارش‌های دیگر با پشتیبانی تماس بگیرید.", "not_cancellable");
  return cancelOrder(o.id, user.id, "لغو توسط مشتری");
});
