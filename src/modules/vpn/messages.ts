import { Product, VpnService } from '@prisma/client';
import { formatBytes, toPersianDigits } from '../../utils/misc';

const fmtDate = (d: Date) =>
  toPersianDigits(new Intl.DateTimeFormat('fa-IR-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(d));

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
