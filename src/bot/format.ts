/** Presentation helpers shared by the Telegram UI and notification templates (HTML parse mode). */
import { bytesToGB, formatBytes, formatMoney, toPersianDigits } from '../utils/misc';

export const esc = (s: unknown): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const b = (s: unknown) => `<b>${esc(s)}</b>`;
export const code = (s: unknown) => `<code>${esc(s)}</code>`;
export const i = (s: unknown) => `<i>${esc(s)}</i>`;
export const RULE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
export const fa = toPersianDigits;
export const money = formatMoney;

/** Page header: icon + bold title, then a quiet divider. */
export const header = (icon: string, title: string, sub?: string) => `${icon} ${b(title)}${sub ? `\n${i(sub)}` : ''}\n${RULE}`;

/** `label: value` row with a fixed icon column. */
export const row = (icon: string, label: string, value: string) => `${icon} ${label}: ${value}`;

export const jdate = (d: Date) =>
  fa(new Intl.DateTimeFormat('fa-IR-u-nu-latn', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(d));
export const jdatetime = (d: Date) =>
  fa(new Intl.DateTimeFormat('fa-IR-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(d));

export const daysLeft = (d: Date, now = new Date()) => Math.ceil((d.getTime() - now.getTime()) / 86_400_000);

export function bar(used: bigint, total: bigint, width = 10): string {
  if (total <= 0n) return '';
  const pct = Math.min(100, Math.max(0, Number((used * 100n) / total)));
  const filled = Math.round((pct / 100) * width);
  return `${'▰'.repeat(filled)}${'▱'.repeat(width - filled)} ${fa(pct)}٪`;
}

export const gb = (v: bigint | number) => (Number(v) === 0 ? `${fa(0)} GB` : `${fa(bytesToGB(v).toFixed(bytesToGB(v) >= 10 ? 0 : 1))} GB`);
export { formatBytes };

/** Customer-facing order status (no technical words). */
export const ORDER_STATUS: Record<string, { label: string; hint: string }> = {
  PENDING_PAYMENT: { label: '⏳ در انتظار پرداخت', hint: 'پس از پرداخت، رسید را ارسال کنید.' },
  PAYMENT_SUBMITTED: { label: '📤 رسید دریافت شد', hint: 'رسید شما در حال بررسی اولیه است.' },
  PAYMENT_REVIEW: { label: '🔎 در حال بررسی پرداخت', hint: 'همکاران ما پرداخت را بررسی می‌کنند؛ معمولاً چند دقیقه طول می‌کشد.' },
  PAID: { label: '✅ پرداخت تأیید شد', hint: 'در حال شروع آماده‌سازی سرویس...' },
  PROVISIONING: { label: '⏳ سرویس شما در حال آماده‌سازی است...', hint: 'به‌محض آماده شدن برای شما ارسال می‌شود؛ نیازی به اقدام نیست.' },
  FULFILLED: { label: '🎉 سرویس تحویل داده شد', hint: 'از «سرویس‌های من» می‌توانید لینک و QR را دریافت کنید.' },
  CANCELLED: { label: '❌ لغو شده', hint: '' },
  REFUNDED: { label: '↩️ بازگشت وجه', hint: '' },
};

/** 4-step progress strip: سفارش → پرداخت → بررسی → تحویل */
export function timeline(status: string): string {
  const stage: Record<string, number> = { PENDING_PAYMENT: 1, PAYMENT_SUBMITTED: 2, PAYMENT_REVIEW: 2, PAID: 3, PROVISIONING: 3, FULFILLED: 4 };
  const at = stage[status] ?? 0;
  if (!at) return '';
  const names = ['سفارش', 'پرداخت', 'بررسی', 'تحویل'];
  return names.map((n, idx) => `${idx + 1 < at || at === 4 ? '✅' : idx + 1 === at ? '🔸' : '▫️'} ${n}`).join('  ');
}

export const SERVICE_STATUS: Record<string, string> = { ACTIVE: '🟢 فعال', EXPIRED: '🔴 منقضی', SUSPENDED: '⏸ معلق', CANCELLED: '⚫ لغو شده' };
export const TICKET_STATUS: Record<string, string> = { OPEN: '🟡 باز', ANSWERED: '🟢 پاسخ داده شد', CLOSED: '⚪ بسته' };
export const CATEGORY_FA: Record<string, string> = { VPN_ISSUE: 'مشکل VPN', PAYMENT_ISSUE: 'مشکل پرداخت', RENEWAL: 'تمدید', OTHER: 'سایر' };

export const ok = (t: string) => `✅ ${b(t)}`;
export const fail = (t: string, hint?: string) => `❌ ${b(t)}${hint ? `\n${esc(hint)}` : ''}`;
export const wait = (t: string, hint?: string) => `⏳ ${b(t)}${hint ? `\n${esc(hint)}` : ''}`;
