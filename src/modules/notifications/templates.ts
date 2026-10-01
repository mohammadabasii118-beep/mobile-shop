/** Customer notification templates (Telegram HTML). Every dynamic value is escaped. */
import { Product, VpnService } from '@prisma/client';
import { RULE, b, bar, code, daysLeft, esc, fa, gb, header, i, jdatetime } from '../../bot/format';
import { serviceLabel } from '../../utils/names';

export const paymentSubmitted = (orderNumber: string) =>
  `📤 ${b('رسید شما ثبت شد')}\n${RULE}\nسفارش ${code(orderNumber)}\nپرداخت شما در حال بررسی است. نتیجه همین‌جا به شما اعلام می‌شود.`;

export const paymentReview = (orderNumber: string) =>
  `🔎 ${b('پرداخت در صف بررسی است')}\n${RULE}\nسفارش ${code(orderNumber)}\nپس از تأیید، سرویس به‌صورت خودکار ساخته و ارسال می‌شود. نیازی به اقدام دیگری نیست.`;

export const paymentVerified = (orderNumber: string) =>
  `✅ ${b('پرداخت شما تأیید شد')}\n${RULE}\nسفارش ${code(orderNumber)}\n⏳ سرویس شما در حال آماده‌سازی است...`;

export const paymentRejected = (orderNumber: string, reason: string) =>
  `❌ ${b('پرداخت شما تأیید نشد')}\n${RULE}\nسفارش ${code(orderNumber)}\nدلیل: ${esc(reason)}\n\nاگر پرداخت انجام داده‌اید، رسید درست را دوباره ارسال کنید یا با پشتیبانی در ارتباط باشید.`;

export function delivery(s: VpnService, p: Product, kind: 'created' | 'renewed'): string {
  const lines = [
    kind === 'created' ? `🎉 ${b('سرویس شما آماده است')}` : `🔄 ${b('تمدید سرویس با موفقیت انجام شد')}`,
    kind === 'created' ? `از همین‌جا لینک، کانفیگ و QR را دریافت کنید.` : `سرویس شما تمدید شد و همان لینک قبلی فعال است.`,
    RULE,
    `📛 ${b('نام')}: ${esc(serviceLabel(s.displayName, s.externalId))}`,
    `📦 ${b('سرویس')}: ${esc(p.name)}`,
    `📊 ${b('حجم')}: ${gb(s.trafficLimit)}`,
    `📅 ${b('اعتبار')}: ${fa(p.durationDays)} روز`,
    `⏰ ${b('انقضا')}: ${jdatetime(s.expiresAt)}`,
  ];
  if (s.subscriptionUrl) {
    lines.push(RULE, `📡 ${b('لینک اشتراک (Subscription) — پیشنهادی')}`, code(s.subscriptionUrl), i('این لینک را در برنامه وارد کنید؛ با تمدید یا تغییر سرور خودکار به‌روز می‌شود.'));
    if (s.config) lines.push('', `⚙️ ${b('کانفیگ مستقیم (جایگزین)')}`, code(s.config));
  } else if (s.config) {
    lines.push(RULE, `🔗 ${b('لینک اتصال')} ${esc('(برای کپی، روی لینک بزنید)')}`, code(s.config));
  }
  lines.push(RULE, '💡 لینک را در برنامه‌ی V2Ray/Hiddify/Streisand وارد کنید یا QR را اسکن کنید.');
  return lines.join('\n');
}

export const expiring = (name: string, days: number, expiresAt: Date) =>
  `⏳ ${b('سرویس شما رو به پایان است')}\n${RULE}\n📦 ${esc(name)}\nحدود ${fa(days)} روز دیگر (${jdatetime(expiresAt)}) منقضی می‌شود.\nبرای جلوگیری از قطعی، همین حالا تمدید کنید.`;

export const expired = (name: string) =>
  `⛔ ${b('سرویس شما منقضی شد')}\n${RULE}\n📦 ${esc(name)} منقضی شده است.\nبا تمدید، همان لینک قبلی دوباره فعال می‌شود.`;

export const ticketAnswer = (id: string, text: string) =>
  `📩 ${b('پاسخ پشتیبانی')} ${code('#' + id.slice(-6))}\n${RULE}\n${esc(text)}`;

export const serviceCard = (s: VpnService & { product?: Product }, now = new Date()): string => {
  const left = daysLeft(s.expiresAt, now);
  const st = s.status === 'ACTIVE' ? '🟢 فعال' : s.status === 'EXPIRED' ? '🔴 منقضی' : s.status === 'SUSPENDED' ? '⏸ معلق' : '⚫ لغو شده';
  const lines = [header('📦', serviceLabel(s.displayName, s.externalId), s.product?.name), `${st}${s.status === 'ACTIVE' ? ` · ${fa(Math.max(left, 0))} روز مانده` : ''}`, `📅 انقضا: ${jdatetime(s.expiresAt)}`];
  if (s.lastSyncAt && s.trafficLimit > 0n) {
    const rem = s.trafficLimit > s.trafficUsed ? s.trafficLimit - s.trafficUsed : 0n;
    lines.push(`📊 مصرف‌شده: ${gb(s.trafficUsed)} از ${gb(s.trafficLimit)}`, bar(s.trafficUsed, s.trafficLimit), `📦 باقی‌مانده: ${gb(rem)}`);
  } else {
    lines.push(`📊 حجم کل: ${s.trafficLimit > 0n ? gb(s.trafficLimit) : 'نامحدود'}`, `${esc('مصرف‌شده: به‌زودی به‌روزرسانی می‌شود')}`);
  }
  return lines.join('\n');
};
