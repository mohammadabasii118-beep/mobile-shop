import { Partner, PartnerStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/client';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { audit } from '../admin/audit';
import { getBool, getNumber } from '../settings/service';
import { notifyAdmins, notifyUser } from '../notifications/service';
import { loadTexts } from '../texts/service';

type Db = Prisma.TransactionClient | typeof prisma;

export const partnerEnabled = () => getBool('partner.enabled');

/** Discount % an approved partner really gets (their own rate, capped by the global maximum). */
export async function effectivePercent(p: Pick<Partner, 'discountPercent'>) {
  return Math.max(0, Math.min(p.discountPercent, await getNumber('partner.maxDiscount')));
}

/** The partner discount for one order amount. 0 unless the programme is on and the user is an APPROVED partner. */
export async function partnerDiscountFor(userId: string, amount: number, db: Db = prisma): Promise<{ percent: number; amount: number }> {
  if (!(await partnerEnabled())) return { percent: 0, amount: 0 };
  const p = await db.partner.findUnique({ where: { userId } });
  if (!p || p.status !== 'APPROVED') return { percent: 0, amount: 0 };
  const percent = await effectivePercent(p);
  return { percent, amount: Math.min(amount, Math.floor((amount * percent) / 100)) };
}

/** Cross-field check for the partner settings (used by the bot and the web panel). Returns the normalised value. */
export async function validatePartnerSetting(key: string, raw: string): Promise<string> {
  const n = Number(raw);
  if (key === 'partner.enabled' || key === 'partner.autoApprove' || key === 'partner.stackCoupons') {
    if (raw !== 'true' && raw !== 'false') throw new ValidationError('مقدار باید true یا false باشد');
    return raw;
  }
  const max = key === 'partner.reapplyDays' ? 365 : 100;
  if (!['partner.defaultDiscount', 'partner.maxDiscount', 'partner.reapplyDays'].includes(key)) throw new ValidationError('تنظیم نامعتبر');
  if (!/^\d+$/.test(raw) || n > max) throw new ValidationError(`عدد صحیح بین ۰ تا ${max} وارد کنید`);
  if (key === 'partner.defaultDiscount' && n > (await getNumber('partner.maxDiscount'))) throw new ValidationError('درصد پیش‌فرض نمی‌تواند از «سقف تخفیف» بیشتر باشد');
  if (key === 'partner.maxDiscount' && n < (await getNumber('partner.defaultDiscount'))) throw new ValidationError('سقف تخفیف نمی‌تواند از «درصد پیش‌فرض» کمتر باشد؛ اول درصد پیش‌فرض را کم کنید');
  return String(n);
}

export const getPartner = (userId: string) => prisma.partner.findUnique({ where: { userId } });

export async function partnerStats(userId: string) {
  const paid = { userId, status: { in: ['PAID', 'PROVISIONING', 'FULFILLED'] as ('PAID' | 'PROVISIONING' | 'FULFILLED')[] } };
  const a = await prisma.order.aggregate({ where: paid, _count: true, _sum: { finalAmount: true, partnerDiscountAmount: true } });
  return { orders: a._count, spent: a._sum.finalAmount ?? 0, saved: a._sum.partnerDiscountAmount ?? 0 };
}

const NOTE_MAX = 400;

/** Why this user cannot (re)apply right now, or null when they can. */
export async function applyBlockReason(existing: Pick<Partner, 'status' | 'decidedAt'> | null): Promise<string | null> {
  if (!existing) return null;
  if (existing.status === 'PENDING') return 'درخواست قبلی شما در حال بررسی است';
  if (existing.status === 'APPROVED') return 'شما همکار هستید';
  if (existing.status === 'SUSPENDED') return 'همکاری شما معلق است؛ با پشتیبانی تماس بگیرید';
  const wait = (await getNumber('partner.reapplyDays')) * 86_400_000;
  const left = (existing.decidedAt?.getTime() ?? 0) + wait - Date.now();
  return left > 0 ? `برای درخواست دوباره باید ${Math.ceil(left / 86_400_000)} روز دیگر صبر کنید` : null;
}

/** A user asks to become a partner. Re-applying is allowed after a rejection once the waiting period passed. */
export async function applyForPartner(userId: string, note?: string) {
  if (!(await partnerEnabled())) throw new ValidationError('برنامه‌ی همکاری فعلاً فعال نیست');
  const clean = (note ?? '').replace(/\0/g, '').trim().slice(0, NOTE_MAX) || null;
  const existing = await getPartner(userId);
  const block = await applyBlockReason(existing);
  if (block) throw new ConflictError(block);
  let row: Partner;
  if (existing) {
    // only a REJECTED row may be re-opened; a concurrent double-tap loses the conditional write
    const r = await prisma.partner.updateMany({ where: { userId, status: 'REJECTED' }, data: { status: 'PENDING', note: clean, adminNote: null, requestedAt: new Date(), decidedAt: null, decidedBy: null, discountPercent: 0 } });
    if (r.count !== 1) throw new ConflictError('درخواست شما قبلاً ثبت شده است');
    row = await prisma.partner.findUniqueOrThrow({ where: { userId } });
  } else {
    try { row = await prisma.partner.create({ data: { userId, note: clean } }); }
    catch (e: any) { if (e?.code === 'P2002') throw new ConflictError('درخواست شما قبلاً ثبت شده است'); throw e; }
  }
  await audit({ actor: `user:${userId}`, action: 'partner.apply', target: 'Partner', targetId: row.id });
  if (await getBool('partner.autoApprove')) {
    return { partner: await approvePartner('system', row.id), auto: true };
  }
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await notifyAdmins('partner_request', [
    '🤝 درخواست همکاری جدید',
    `👤 ${[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}${u.username ? ` @${u.username}` : ''}`,
    `🪪 ${u.telegramId}`,
    clean ? `📝 ${clean}` : '📝 بدون توضیح',
  ].join('\n'), {
    roles: ['PAYMENT_ADMIN'],
    buttons: [[{ text: '✅ تأیید', data: `pa:ok:${row.id}` }, { text: '❌ رد', data: `pa:no:${row.id}` }], [{ text: '🔎 جزئیات', data: `pa:v:${row.id}` }]],
    dedupeKey: `partner_request:${row.id}:${row.requestedAt.getTime()}`,
  });
  return { partner: row, auto: false };
}

export async function getPartnerById(id: string) {
  const p = await prisma.partner.findUnique({ where: { id }, include: { user: true } });
  if (!p) throw new NotFoundError('partner');
  return p;
}

const pctOk = async (n: number) => {
  const max = await getNumber('partner.maxDiscount');
  if (!Number.isInteger(n) || n < 0 || n > 100) throw new ValidationError('درصد تخفیف باید عدد صحیح بین ۰ تا ۱۰۰ باشد');
  if (n > max) throw new ValidationError(`حداکثر تخفیف مجاز ${max}٪ است (از تنظیمات همکاری قابل تغییر است)`);
  return n;
};

/** Approve (or re-activate) with a percentage — defaults to the global default. Idempotent for an already approved partner. */
export async function approvePartner(actor: string, id: string, percent?: number) {
  const before = await getPartnerById(id);
  // A stale button (another admin already decided) must not override the current state.
  if (before.status === 'SUSPENDED') throw new ConflictError('این همکار معلق است؛ از «فعال‌سازی دوباره» استفاده کنید');
  if (before.status === 'APPROVED' && percent === undefined) return before; // "approve with the default" never resets a custom %
  const fallback = Math.min(await getNumber('partner.defaultDiscount'), await getNumber('partner.maxDiscount'));
  const pct = await pctOk(percent ?? fallback);
  if (before.status === 'APPROVED' && before.discountPercent === pct) return before;
  // conditional write: loses cleanly if someone changed the status in between
  const done = await prisma.partner.updateMany({ where: { id, status: before.status }, data: { status: 'APPROVED', discountPercent: pct, adminNote: null, decidedAt: new Date(), decidedBy: actor } });
  if (done.count !== 1) throw new ConflictError('وضعیت این درخواست همین الان تغییر کرد؛ صفحه را دوباره باز کنید');
  const row = await getPartnerById(id);
  await audit({ actor, action: 'partner.approve', target: 'Partner', targetId: id, metadata: { percent: pct } });
  if (before.status !== 'APPROVED') {
    const T = await loadTexts();
    await notifyUser(before.userId, 'partner_approved', T.html('partner.approved', { name: before.user.firstName ?? '', percent: String(pct) }), {
      html: true, buttons: [[{ text: '🛒 خرید با تخفیف', data: 'menu:buy' }]], dedupeKey: `partner_ok:${id}:${row.decidedAt!.getTime()}`,
    });
  }
  return row;
}

export async function rejectPartner(actor: string, id: string, reason: string) {
  const before = await getPartnerById(id);
  const why = reason.trim().slice(0, 300) || 'نامشخص';
  if (before.status === 'REJECTED') return before;
  if (before.status !== 'PENDING') throw new ConflictError('این درخواست قبلاً بررسی شده است؛ برای همکار فعلی از «تعلیق» استفاده کنید');
  const done = await prisma.partner.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', discountPercent: 0, adminNote: why, decidedAt: new Date(), decidedBy: actor } });
  if (done.count !== 1) throw new ConflictError('وضعیت این درخواست همین الان تغییر کرد؛ صفحه را دوباره باز کنید');
  const row = await getPartnerById(id);
  await audit({ actor, action: 'partner.reject', target: 'Partner', targetId: id, metadata: { reason: why } });
  await notifyUser(before.userId, 'partner_rejected', (await loadTexts()).html('partner.rejected', { reason: why }), { html: true, dedupeKey: `partner_no:${id}:${row.decidedAt!.getTime()}` });
  return row;
}

export async function setPartnerPercent(actor: string, id: string, percent: number) {
  const before = await getPartnerById(id);
  if (before.status !== 'APPROVED') throw new ConflictError('فقط برای همکار تأییدشده قابل تغییر است');
  const pct = await pctOk(percent);
  const row = await prisma.partner.update({ where: { id }, data: { discountPercent: pct } });
  await audit({ actor, action: 'partner.percent', target: 'Partner', targetId: id, metadata: { from: before.discountPercent, to: pct } });
  return row;
}

export async function setPartnerSuspended(actor: string, id: string, suspended: boolean) {
  const before = await getPartnerById(id);
  if (suspended && before.status !== 'APPROVED') throw new ConflictError('فقط همکار تأییدشده را می‌توان معلق کرد');
  if (!suspended && before.status !== 'SUSPENDED') throw new ConflictError('این همکار معلق نیست');
  const row = await prisma.partner.update({ where: { id }, data: { status: suspended ? 'SUSPENDED' : 'APPROVED' } });
  await audit({ actor, action: suspended ? 'partner.suspend' : 'partner.resume', target: 'Partner', targetId: id });
  return row;
}

export type PartnerFilter = PartnerStatus | 'ALL';
export async function listPartners(filter: PartnerFilter, skip: number, take: number) {
  return prisma.partner.findMany({
    where: filter === 'ALL' ? {} : { status: filter },
    orderBy: [{ requestedAt: 'desc' }], skip, take, include: { user: true },
  });
}

export async function partnerCounts() {
  const rows = await prisma.partner.groupBy({ by: ['status'], _count: true });
  const m = Object.fromEntries(rows.map((r) => [r.status, r._count])) as Partial<Record<PartnerStatus, number>>;
  return { PENDING: m.PENDING ?? 0, APPROVED: m.APPROVED ?? 0, REJECTED: m.REJECTED ?? 0, SUSPENDED: m.SUSPENDED ?? 0 };
}

export const PARTNER_STATUS_FA: Record<PartnerStatus, string> = { PENDING: '⏳ در انتظار', APPROVED: '✅ تأییدشده', REJECTED: '❌ ردشده', SUSPENDED: '⛔ معلق' };
export const partnerLabel = (u: { firstName: string | null; lastName: string | null; username: string | null; telegramId: bigint }) =>
  `${[u.firstName, u.lastName].filter(Boolean).join(' ') || (u.username ? '@' + u.username : String(u.telegramId))}`;
