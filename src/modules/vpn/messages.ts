import { Product, VpnService } from '@prisma/client';
import { bytesToGB, formatBytes, toPersianDigits } from '../../utils/misc';

const fmtDate = (d: Date) =>
  toPersianDigits(new Intl.DateTimeFormat('fa-IR-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(d));

export function deliveryMessage(s: VpnService, p: Product, kind: 'created' | 'renewed'): string {
  const head = kind === 'created' ? '✅ پرداخت شما تأیید شد' : '✅ تمدید سرویس با موفقیت انجام شد';
  const lines = [
    head, '',
    `📦 سرویس:\n${p.name}`, '',
    `📊 حجم:\n${toPersianDigits(bytesToGB(s.trafficLimit).toFixed(0))} GB`, '',
    `📅 اعتبار:\n${toPersianDigits(p.durationDays)} روز`, '',
    `⏰ انقضا:\n${fmtDate(s.expiresAt)}`,
  ];
  if (s.config) lines.push('', `🔗 لینک اتصال:\n${s.config}`);
  if (s.subscriptionUrl) lines.push('', `📡 لینک اشتراک (Subscription):\n${s.subscriptionUrl}`);
  return lines.join('\n');
}

export function serviceSummary(s: VpnService & { product?: Product }): string {
  const remaining = s.trafficLimit > 0n ? (s.trafficLimit > s.trafficUsed ? s.trafficLimit - s.trafficUsed : 0n) : null;
  return [
    `📦 ${s.product?.name ?? s.externalId}`,
    `وضعیت: ${statusFa[s.status]}${s.provisioningStatus !== 'SUCCESS' ? ` (راه‌اندازی: ${s.provisioningStatus === 'FAILED' ? 'در حال تلاش مجدد' : 'در حال انجام'})` : ''}`,
    `حجم کل: ${s.trafficLimit > 0n ? formatBytes(s.trafficLimit) : 'نامحدود'}`,
    s.lastSyncAt ? `مصرف‌شده: ${formatBytes(s.trafficUsed)}` : 'مصرف‌شده: هنوز همگام‌سازی نشده',
    s.lastSyncAt && remaining !== null ? `باقی‌مانده: ${formatBytes(remaining)}` : '',
    `انقضا: ${fmtDate(s.expiresAt)}`,
  ].filter(Boolean).join('\n');
}

export const statusFa = { ACTIVE: '🟢 فعال', EXPIRED: '🔴 منقضی', SUSPENDED: '⏸ معلق', CANCELLED: '⚫ لغو شده' } as const;
