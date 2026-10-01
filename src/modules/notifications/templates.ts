/** Customer notification templates (Telegram HTML). Every dynamic value is escaped. */
import { Product, VpnService } from '@prisma/client';
import { RULE, b, bar, code, daysLeft, esc, fa, gb, header, i, jdatetime } from '../../bot/format';
import { serviceLabel } from '../../utils/names';
import { loadTexts } from '../texts/service';

export const paymentSubmitted = async (orderNumber: string) => (await loadTexts()).html('msg.submitted', { order: orderNumber });
export const paymentReview = async (orderNumber: string) => (await loadTexts()).html('msg.review', { order: orderNumber });
export const paymentVerified = async (orderNumber: string) => (await loadTexts()).html('msg.verified', { order: orderNumber });
export const paymentRejected = async (orderNumber: string, reason: string) => (await loadTexts()).html('msg.rejected', { order: orderNumber, reason });

export async function delivery(s: VpnService, p: Product, kind: 'created' | 'renewed'): Promise<string> {
  const X = await loadTexts();
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
    lines.push(RULE, `📡 ${b('لینک اشتراک (Subscription) — پیشنهادی')}`, code(s.subscriptionUrl), ...(X.plain('delivery.sub_hint') ? [i(X.plain('delivery.sub_hint'))] : []));
    if (s.config) lines.push('', `⚙️ ${b('کانفیگ مستقیم (جایگزین)')}`, code(s.config));
  } else if (s.config) {
    lines.push(RULE, `🔗 ${b('لینک اتصال')} ${esc('(برای کپی، روی لینک بزنید)')}`, code(s.config));
  }
  if (X.plain('delivery.tips')) lines.push(RULE, X.html('delivery.tips'));
  return lines.join('\n');
}

export const expiring = async (name: string, days: number, expiresAt: Date) =>
  (await loadTexts()).html('msg.expiring', { service: name, days: fa(days), date: jdatetime(expiresAt) });

export const expired = async (name: string) => (await loadTexts()).html('msg.expired', { service: name });

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
