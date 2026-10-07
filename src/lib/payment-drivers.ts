/**
 * درایورهای پرداخت.
 *
 * هر «روش پرداخت» در جدول payment_methods به یک درایور وصل است. درایور تعیین می‌کند
 *  - نوع جریان:  cod (پرداخت در محل) · manual (واریز دستی، تأیید توسط مدیر) · online (انتقال به درگاه)
 *  - فیلدهای تنظیمات که مدیر در پنل پر می‌کند
 *  - implemented: اگر false باشد روش در پنل دیده می‌شود ولی روشن‌شدنش مسدود است.
 *
 * افزودن درگاه تازه:
 *  1. یک ورودی به DRIVERS اضافه کنید (implemented: true وقتی جریانش کامل شد).
 *  2. برای نوع online، در submitOrder (src/lib/actions/shop.ts) پس از ساخت سفارش درخواست پرداخت را به API درگاه بفرستید،
 *     کاربر را به آدرس درگاه ببرید، و یک Route Handler برای callback بسازید که با API verify تأیید کند و
 *     payments.status و orders.payment_status را به‌روز کند (مثل finishPayment).
 *  3. مدیر در /admin/payment-methods اطلاعات حساب (کلیدها) را وارد و روش را روشن می‌کند.
 */
export type DriverField = { key: string; label: string; type?: 'text' | 'textarea' | 'password' | 'card'; placeholder?: string; help?: string; required?: boolean; ltr?: boolean };
export type Driver = {
  label: string;
  kind: 'cod' | 'manual' | 'online';
  implemented: boolean;
  /** مدیر بتواند از این درایور روش تازه بسازد */
  multiple?: boolean;
  summary: string;
  fields: DriverField[];
};

export const DRIVERS: Record<string, Driver> = {
  cod: { label: 'پرداخت در محل', kind: 'cod', implemented: true, summary: 'پرداخت هنگام تحویل؛ مدیر پس از دریافت وجه «ثبت موفق» می‌زند.', fields: [] },
  card: {
    label: 'کارت به کارت', kind: 'manual', implemented: true, multiple: true,
    summary: 'مشتری به کارت شما واریز می‌کند و کد پیگیری را ثبت می‌کند؛ مدیر پس از بررسی تأیید می‌کند.',
    fields: [
      { key: 'card_number', label: 'شماره کارت', type: 'card', placeholder: '6037 9900 0000 0000', required: true, ltr: true },
      { key: 'owner', label: 'نام صاحب حساب', required: true },
      { key: 'bank', label: 'نام بانک' },
      { key: 'sheba', label: 'شماره شبا (اختیاری)', placeholder: 'IR000000000000000000000000', ltr: true },
      { key: 'instructions', label: 'توضیح برای مشتری', type: 'textarea', placeholder: 'مثلاً: پس از واریز، کد پیگیری را در همین صفحه ثبت کنید. سفارش تا ۲ ساعت کاری تأیید می‌شود.' },
    ],
  },
  test: { label: 'درگاه آزمایشی', kind: 'online', implemented: true, summary: 'شبیه‌ساز درگاه برای تست؛ در محیط واقعی فقط با PAYMENT_MODE=test دیده می‌شود.', fields: [] },
  snapp: {
    label: 'اسنپ‌پی', kind: 'online', implemented: false,
    summary: 'پرداخت اقساطی اسنپ‌پی. اتصال به API نیازمند قرارداد پذیرنده و مستندات رسمی است.',
    fields: [
      { key: 'base_url', label: 'آدرس API', ltr: true }, { key: 'client_id', label: 'Client ID', ltr: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', ltr: true }, { key: 'username', label: 'نام کاربری', ltr: true }, { key: 'password', label: 'رمز', type: 'password', ltr: true },
    ],
  },
  torob: {
    label: 'ترب‌پی', kind: 'online', implemented: false,
    summary: 'پرداخت اقساطی ترب‌پی. اتصال به API نیازمند قرارداد پذیرنده و مستندات رسمی است.',
    fields: [{ key: 'base_url', label: 'آدرس API', ltr: true }, { key: 'username', label: 'نام کاربری', ltr: true }, { key: 'password', label: 'رمز', type: 'password', ltr: true }, { key: 'client_id', label: 'Client ID', ltr: true }, { key: 'client_secret', label: 'Client Secret', type: 'password', ltr: true }],
  },
  bale: {
    label: 'بله‌پی', kind: 'online', implemented: false,
    summary: 'پرداخت با کیف پول بله. اتصال به API نیازمند قرارداد پذیرنده و مستندات رسمی است.',
    fields: [{ key: 'base_url', label: 'آدرس API', ltr: true }, { key: 'merchant_id', label: 'شناسه‌ی پذیرنده', ltr: true }, { key: 'api_key', label: 'کلید API', type: 'password', ltr: true }],
  },
};

export const MANUAL_NOTE = 'روش‌های «نیازمند اتصال API» تا پیاده‌سازی درایورشان قابل روشن‌شدن نیستند.';
