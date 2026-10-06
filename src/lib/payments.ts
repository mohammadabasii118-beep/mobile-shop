/**
 * درگاه پرداخت
 *
 * پیاده‌سازی فعلی «درگاه آزمایشی» است (صفحه‌ی /pay/[number]) و پولی کسر نمی‌کند.
 * به همین دلیل در حالت production فقط وقتی فعال است که صراحتاً PAYMENT_MODE=test تنظیم شده باشد؛
 * وگرنه گزینه‌ی «پرداخت آنلاین» در تسویه نمایش داده نمی‌شود و فقط «پرداخت در محل» کار می‌کند.
 *
 * اتصال به درگاه واقعی (مثلاً زرین‌پال) سه گام دارد:
 *  1. در submitOrder (src/lib/actions/shop.ts) پس از ساخت سفارش، به‌جای redirect به /pay/[number]،
 *     درخواست پرداخت را به API درگاه بفرستید و کاربر را به آدرس بانک هدایت کنید (Authority را در payments.ref ذخیره کنید).
 *  2. یک Route Handler مثل /api/payment/callback بسازید که پارامترهای بازگشت را بگیرد،
 *     با API verify درگاه تأیید کند و سپس payments.status و orders.payment_status را به‌روز کند
 *     (همان کاری که finishPayment انجام می‌دهد).
 *  3. PAYMENT_MODE را برای production روی چیزی غیر از test بگذارید و گزینه‌ی online را با onlineGatewayEnabled() فعال کنید.
 */
export function onlineGatewayEnabled(): boolean {
  return process.env.PAYMENT_MODE === 'test' || process.env.NODE_ENV !== 'production';
}
