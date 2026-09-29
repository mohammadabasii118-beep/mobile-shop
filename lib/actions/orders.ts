"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "./guard";
import { cancelOrderAtomic } from "@/lib/orderLifecycle";
import { logOrderStatus } from "@/lib/orderStatusHistory";
import { creditLoyaltyForOrder } from "@/lib/loyalty";
import { runAutomationRules } from "@/lib/automation";
import { trackingSchema } from "@/lib/validation";
import type { OrderStatus } from "@prisma/client";

export async function updateOrderStatus(id: string, status: OrderStatus) {
  await requireAdmin();

  if (status === "CANCELED") {
    // Atomic claim-based cancel + stock restore — safe even if this races
    // with the expired-reservation release script or another admin action
    // targeting the same order at the same time.
    const result = await cancelOrderAtomic(id, "لغو دستی توسط مدیر");
    if (!result.canceled) {
      // Order was already canceled by someone else in the meantime; treat
      // as a no-op success rather than an error.
    }
  } else {
    const order = await db.order.findUnique({ where: { id } });
    if (!order) throw new Error("سفارش پیدا نشد");
    await db.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status } });
      await logOrderStatus(tx, id, status, "به‌روزرسانی دستی توسط مدیر");
      // Manually flipping an order to PAID (e.g. a payment confirmed by
      // phone/bank statement outside the normal gateway/receipt flow) is a
      // real PAID transition too, so it earns loyalty points just like the
      // automatic paths — creditLoyaltyForOrder's own orderId-uniqueness
      // check prevents any double-credit if it was already paid before.
      if (status === "PAID") {
        await creditLoyaltyForOrder(tx, id, order.userId, order.total);
      }
      if (status === "DELIVERED") {
        await runAutomationRules(tx, "ORDER_DELIVERED", {
          orderId: id,
          userId: order.userId || undefined,
          orderTotal: order.total,
          message: `سفارش ${id} به مشتری تحویل داده شد`,
          link: `/admin/orders/${id}`,
        });
      }
    });
  }

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
}

// Real shipment tracking (carrier name + tracking number), entered by an
// admin once the order is actually handed to a carrier. This is a plain
// data update, not a status transition — but a note is still written to
// OrderStatusHistory so the audit trail shows exactly when and what
// tracking info was recorded, consistent with every other order change in
// this project being logged rather than silent.
export async function updateOrderTracking(id: string, formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const data = trackingSchema.parse(raw);
  const trackingCarrier = data.trackingCarrier || null;
  const trackingNumber = data.trackingNumber || null;

  const order = await db.order.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!order) throw new Error("سفارش پیدا نشد");

  await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { trackingCarrier, trackingNumber } });
    // Not a status transition — the order's status is unchanged — but this
    // is still a real event at a real moment, so it's logged with the
    // order's CURRENT status (not invented) and a note describing what
    // actually happened, consistent with every other history row here.
    const note =
      trackingCarrier || trackingNumber
        ? `اطلاعات رهگیری ثبت شد: ${[trackingCarrier, trackingNumber].filter(Boolean).join(" — ")}`
        : "اطلاعات رهگیری پاک شد";
    await logOrderStatus(tx, id, order.status, note);
  });

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/account/orders");
}
