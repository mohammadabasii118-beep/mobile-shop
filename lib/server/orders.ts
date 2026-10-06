import type { OrderStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت",
  PAYMENT_REVIEW: "در حال بررسی پرداخت",
  PAID: "پرداخت شد",
  PROCESSING: "در حال پردازش",
  PREPARING: "در حال آماده‌سازی",
  READY_TO_SHIP: "آماده ارسال",
  SHIPPED: "تحویل به ارسال",
  IN_TRANSIT: "در مسیر",
  DELIVERED: "تحویل داده شد",
  CANCELLED: "لغو شد",
  REFUNDED: "مرجوع شد",
};
export const PAYMENT_STATUS_LABEL = { PENDING: "پرداخت نشده", REVIEW: "در حال بررسی", PAID: "پرداخت شده", REJECTED: "رد شده", REFUNDED: "بازگشت وجه" } as const;

/** Allowed status changes. Admin tools in later phases must go through this map. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAYMENT_REVIEW", "CANCELLED"],
  PAYMENT_REVIEW: ["PROCESSING", "PENDING_PAYMENT", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["PREPARING", "CANCELLED", "REFUNDED"],
  PREPARING: ["READY_TO_SHIP", "CANCELLED"],
  READY_TO_SHIP: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["IN_TRANSIT", "DELIVERED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export const TIMELINE: { status: OrderStatus; label: string }[] = [
  { status: "PENDING_PAYMENT", label: "سفارش ثبت شد" },
  { status: "PAYMENT_REVIEW", label: "پرداخت در حال بررسی" },
  { status: "PROCESSING", label: "پرداخت تأیید شد" },
  { status: "PREPARING", label: "سفارش در حال آماده‌سازی است" },
  { status: "READY_TO_SHIP", label: "آماده ارسال" },
  { status: "SHIPPED", label: "تحویل به ارسال" },
  { status: "IN_TRANSIT", label: "در مسیر" },
  { status: "DELIVERED", label: "تحویل داده شد" },
];

export async function listUserOrders(userId: string) {
  return db.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { items: { take: 3 }, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
}

/** Ownership is part of the query itself, so another user's order can never be loaded. */
export async function getUserOrder(userId: string, number: number) {
  return db.order.findFirst({
    where: { number, userId },
    include: {
      items: true,
      history: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, include: { proofs: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, mime: true, size: true, createdAt: true } } } },
      shippingMethod: { select: { name: true } },
      refunds: { orderBy: { createdAt: "desc" }, select: { id: true, method: true, amount: true, status: true, reason: true, bankReference: true, completedAt: true, createdAt: true } },
    },
  });
}
