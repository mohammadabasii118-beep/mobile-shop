/** دادهٔ mock پنل مدیریت (جایگزین API در فاز بعد) */
export const BASE_DATE = new Date("2026-10-03T12:00:00Z");

export interface DayStat { date: string; revenue: number; orders: number; visits: number }

/** ۶۰ روز، قدیمی‌ترین اول؛ ساخت قطعی (بدون Math.random) تا SSR/Client یکسان باشد */
export const dailyStats: DayStat[] = Array.from({ length: 60 }, (_, i) => {
  const d = new Date(BASE_DATE);
  d.setUTCDate(d.getUTCDate() - (59 - i));
  const weekly = 1 + 0.22 * Math.sin((i / 7) * Math.PI * 2 - 1);
  const trend = 0.75 + (i / 59) * 0.45;
  const noise = 1 + 0.09 * Math.sin(i * 2.3) + 0.06 * Math.cos(i * 0.9);
  const orders = Math.round(34 * weekly * trend * noise);
  const revenue = Math.round((orders * (1_850_000 + 220_000 * Math.sin(i * 0.7))) / 1000) * 1000;
  const visits = Math.round(orders * (31 + 3 * Math.sin(i * 1.3)));
  return { date: d.toISOString(), revenue, orders, visits };
});

export type OrderStatus = "paid" | "processing" | "shipped" | "pending" | "cancelled";
export const orderStatusLabel: Record<OrderStatus, string> = {
  paid: "پرداخت‌شده", processing: "در حال آماده‌سازی", shipped: "ارسال‌شده", pending: "در انتظار پرداخت", cancelled: "لغو شده",
};

export const recentOrders = [
  { id: "VT-48213", customer: "سارا احمدی", item: "قاب Aura مگنتی + شارژر Halo", total: 2_740_000, status: "paid" as OrderStatus, time: "۵ دقیقه پیش" },
  { id: "VT-48212", customer: "امیر رضایی", item: "ایربادز Pulse ANC", total: 4_900_000, status: "processing" as OrderStatus, time: "۱۸ دقیقه پیش" },
  { id: "VT-48211", customer: "نگار موسوی", item: "قاب چرمی Atelier", total: 1_890_000, status: "shipped" as OrderStatus, time: "۴۱ دقیقه پیش" },
  { id: "VT-48210", customer: "کیان محمدی", item: "پاوربانک Slate ×۲", total: 3_580_000, status: "pending" as OrderStatus, time: "۱ ساعت پیش" },
  { id: "VT-48209", customer: "مریم صادقی", item: "آداپتور GaN ۶۵ وات", total: 1_150_000, status: "paid" as OrderStatus, time: "۲ ساعت پیش" },
  { id: "VT-48208", customer: "پارسا کریمی", item: "قاب سفارشی iPhone 17 Pro", total: 2_190_000, status: "cancelled" as OrderStatus, time: "۳ ساعت پیش" },
];

export const lowStock = [
  { name: "ایربادز Pulse — سفید", stock: 6, threshold: 30 },
  { name: "قاب Atelier — کنیاکی", stock: 9, threshold: 30 },
  { name: "محافظ سرامیکی S26 Ultra", stock: 0, threshold: 40 },
  { name: "شارژر Halo — نقره‌ای", stock: 14, threshold: 40 },
];

export const topCategories = [
  { name: "قاب و کاور", share: 42 },
  { name: "شارژر و کابل", share: 27 },
  { name: "هدفون و ایربادز", share: 17 },
  { name: "پاوربانک", share: 9 },
  { name: "محافظ صفحه", share: 5 },
];
