export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت",
  PAID: "پرداخت شده",
  PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELED: "لغو شده",
};

// The normal forward order a non-canceled order moves through. Used only to
// order timeline rows chronologically as a fallback — the real source of
// truth for what actually happened is always OrderStatusHistory.createdAt.
export const ORDER_STATUS_SEQUENCE = ["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"];
