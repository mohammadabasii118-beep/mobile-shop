/** Pure helpers shared by server pages and client components (kit.tsx is a client module, so nothing here may live there). */
export type Tone = "ok" | "warn" | "bad" | "info" | "mute";
export const fmtDate = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const fmtNum = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("fa-IR"));
/** Identifiers (order numbers) are shown without thousands separators. */
export const fmtId = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
export const fmtToman = (n: number | null | undefined) => (n == null ? "—" : `${Number(n).toLocaleString("fa-IR")} تومان`);
export const ORDER_LABEL: Record<string, [string, Tone]> = {
  PENDING_PAYMENT: ["در انتظار پرداخت", "warn"], PAYMENT_REVIEW: ["بررسی پرداخت", "info"], PAID: ["پرداخت شد", "ok"], PROCESSING: ["در حال پردازش", "info"], PREPARING: ["آماده‌سازی", "info"],
  READY_TO_SHIP: ["آماده ارسال", "info"], SHIPPED: ["تحویل به ارسال", "info"], IN_TRANSIT: ["در مسیر", "info"], DELIVERED: ["تحویل شد", "ok"], CANCELLED: ["لغو شد", "bad"], REFUNDED: ["مرجوع شد", "bad"],
};
export const PAY_LABEL: Record<string, [string, Tone]> = { PENDING: ["پرداخت نشده", "warn"], REVIEW: ["در حال بررسی", "info"], PAID: ["پرداخت شده", "ok"], REJECTED: ["رد شده", "bad"], REFUNDED: ["بازگشت وجه", "bad"] };
