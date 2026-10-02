import type { Coupon, Order, PointTx, Review, WalletTx } from '@/types';

export const orders: Order[] = [
  { id: 'CL-10482', date: '2026-09-28', items: [{ productId: 'p1', quantity: 1 }, { productId: 'p9', quantity: 1 }], total: 1_125_000, paymentStatus: 'paid', status: 'shipped', customer: 'علی رضایی', phone: '09121234567', address: 'تهران، ولیعصر، پلاک ۱۲' },
  { id: 'CL-10391', date: '2026-09-12', items: [{ productId: 'p14', quantity: 1 }], total: 1_395_000, paymentStatus: 'paid', status: 'delivered', customer: 'سارا محمدی', phone: '09351112233', address: 'اصفهان، چهارباغ، پلاک ۴' },
  { id: 'CL-10277', date: '2026-08-30', items: [{ productId: 'p7', quantity: 2 }, { productId: 'p18', quantity: 1 }], total: 595_000, paymentStatus: 'paid', status: 'delivered', customer: 'علی رضایی', phone: '09121234567', address: 'تهران، ولیعصر، پلاک ۱۲' },
  { id: 'CL-10501', date: '2026-10-01', items: [{ productId: 'p3', quantity: 1 }], total: 1_295_000, paymentStatus: 'pending', status: 'registered', customer: 'مینا کریمی', phone: '09191231234', address: 'شیراز، زند، پلاک ۸۰' },
  { id: 'CL-10495', date: '2026-09-30', items: [{ productId: 'p5', quantity: 1 }, { productId: 'p12', quantity: 2 }], total: 1_485_000, paymentStatus: 'paid', status: 'preparing', customer: 'رضا نادری', phone: '09361239876', address: 'مشهد، احمدآباد، پلاک ۲۲' },
];

export const walletTxs: WalletTx[] = [
  { id: 'w1', date: '2026-09-28', title: 'پرداخت سفارش CL-10482', amount: -150_000 },
  { id: 'w2', date: '2026-09-20', title: 'شارژ کیف پول', amount: 500_000 },
  { id: 'w3', date: '2026-09-05', title: 'اعتبار برگشتی سفارش CL-10190', amount: 190_000 },
];

export const pointTxs: PointTx[] = [
  { id: 'l1', date: '2026-09-28', title: 'خرید سفارش CL-10482', points: 112 },
  { id: 'l2', date: '2026-09-15', title: 'استفاده در خرید', points: -200 },
  { id: 'l3', date: '2026-09-12', title: 'خرید سفارش CL-10391', points: 139 },
  { id: 'l4', date: '2026-09-01', title: 'ثبت نظر', points: 20 },
];

export const reviews: Review[] = [
  { id: 'r1', productId: 'p1', customer: 'علی رضایی', rating: 5, text: 'کیفیت عالی و مگ‌سیف خیلی قوی می‌چسبه.', date: '2026-09-29', status: 'approved' },
  { id: 'r2', productId: 'p5', customer: 'سارا محمدی', rating: 4, text: 'محکم و شیک؛ فقط کمی سنگینه.', date: '2026-09-27', status: 'pending' },
  { id: 'r3', productId: 'p9', customer: 'رضا نادری', rating: 2, text: 'شارژر داغ می‌کنه.', date: '2026-09-25', status: 'rejected' },
  { id: 'r4', productId: 'p14', customer: 'مینا کریمی', rating: 5, text: 'برای سفر عالیه.', date: '2026-09-22', status: 'approved' },
  { id: 'r5', productId: 'p3', customer: 'پویا احمدی', rating: 5, text: 'چرمش واقعاً لوکسه.', date: '2026-09-30', status: 'pending' },
];

export const coupons: Coupon[] = [
  { code: 'WELCOME10', kind: 'percent', value: 10, start: '2026-09-01', end: '2026-12-30', minOrder: 300_000, usageLimit: 500, used: 187, scope: 'همه محصولات' },
  { code: 'CASE20', kind: 'percent', value: 20, start: '2026-10-01', end: '2026-10-31', minOrder: 500_000, usageLimit: 200, used: 41, scope: 'قاب گوشی' },
  { code: 'FREESHIP', kind: 'free-shipping', value: 0, start: '2026-09-15', end: '2026-11-15', minOrder: 200_000, usageLimit: 1000, used: 322, scope: 'همه محصولات' },
  { code: 'SAVE100', kind: 'fixed', value: 100_000, start: '2026-10-01', end: '2026-10-15', minOrder: 900_000, usageLimit: 100, used: 12, scope: 'لوازم جانبی' },
];

export const orderStatusSteps: { key: Order['status']; label: string }[] = [
  { key: 'registered', label: 'ثبت سفارش' },
  { key: 'paid', label: 'پرداخت' },
  { key: 'preparing', label: 'در حال آماده‌سازی' },
  { key: 'shipped', label: 'ارسال شد' },
  { key: 'delivered', label: 'تحویل داده شد' },
];
export const paymentLabel = { paid: 'پرداخت شده', pending: 'در انتظار پرداخت', failed: 'ناموفق', refunded: 'برگشت داده شد' } as const;

export const provinces = ['تهران', 'اصفهان', 'فارس', 'خراسان رضوی', 'آذربایجان شرقی', 'البرز', 'گیلان', 'مازندران', 'خوزستان', 'کرمان'];
export const faqs = [
  { q: 'ارسال سفارش چقدر طول می‌کشد؟', a: 'سفارش‌های تهران ۱ تا ۲ روز کاری و سایر شهرها ۲ تا ۵ روز کاری ارسال می‌شود.' },
  { q: 'آیا محصولات اصل هستند؟', a: 'بله، تمام محصولات CaseLine با ضمانت اصالت و کیفیت عرضه می‌شوند.' },
  { q: 'چگونه می‌توانم کالا را بازگردانم؟', a: 'تا ۷ روز پس از تحویل، در صورت سالم بودن بسته‌بندی می‌توانید کالا را بازگردانید.' },
  { q: 'چه روش‌های پرداختی دارید؟', a: 'پرداخت آنلاین، کیف پول CaseLine و در آینده خرید اعتباری.' },
  { q: 'کیف پول و امتیازات چه فرقی دارند؟', a: 'کیف پول اعتبار ریالی است؛ امتیاز وفاداری جداگانه جمع و در خرید مصرف می‌شود.' },
];
