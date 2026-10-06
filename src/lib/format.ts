const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** اعداد فارسی/عربی → لاتین */
export function normDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/** نرمال‌سازی متن فارسی برای ذخیره و جستجو */
export function normText(s: string): string {
  return normDigits(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‏|‎/g, '').trim();
}

export function toInt(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(normDigits(String(v)).replace(/[,٬\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = toInt(v, NaN);
  return Number.isFinite(n) ? n : null;
}

/** ۱۲۳٬۴۵۶ */
export function fa(n: number | string): string {
  return Number(n).toLocaleString('fa-IR');
}

/** قیمت به تومان بدون واحد */
export function toman(n: number): string {
  return Math.round(n).toLocaleString('fa-IR');
}

export function pct(n: number): string {
  return `${Math.round(n).toLocaleString('fa-IR')}٪`;
}

const dateFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran',
});
const shortFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'short', day: 'numeric', timeZone: 'Asia/Tehran' });

/** SQLite CURRENT_TIMESTAMP (UTC) → Date */
export function parseDbDate(s: string): Date {
  return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
}
export function jdate(s: string | null | undefined): string {
  return s ? dateFmt.format(parseDbDate(s)) : '—';
}
export function jdatetime(s: string | null | undefined): string {
  return s ? dateTimeFmt.format(parseDbDate(s)) : '—';
}
export function jshort(d: Date): string {
  return shortFmt.format(d);
}

export function slugify(input: string): string {
  const s = normText(input)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'item';
}

export function decodeSlug(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function isValidIranMobile(s: string): boolean {
  return /^09\d{9}$/.test(normDigits(s).replace(/\s/g, ''));
}

export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'در انتظار پردازش', tone: 'warning' },
  processing: { label: 'در حال آماده‌سازی', tone: 'info' },
  shipped: { label: 'ارسال شد', tone: 'action' },
  delivered: { label: 'تحویل شد', tone: 'success' },
  cancelled: { label: 'لغو شد', tone: 'danger' },
  returned: { label: 'مرجوع شد', tone: 'muted' },
};
export const PAY_STATUS: Record<string, { label: string; tone: string }> = {
  unpaid: { label: 'پرداخت‌نشده', tone: 'warning' },
  paid: { label: 'پرداخت‌شده', tone: 'success' },
  failed: { label: 'ناموفق', tone: 'danger' },
  refunded: { label: 'بازگشت وجه', tone: 'muted' },
};
export const PAY_METHOD: Record<string, string> = { cod: 'پرداخت در محل', online: 'پرداخت آنلاین' };
