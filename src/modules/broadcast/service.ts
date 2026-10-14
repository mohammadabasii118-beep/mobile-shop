import { Broadcast, Prisma } from '@prisma/client';
import { prisma } from '../../db/client';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { esc } from '../../bot/format';
import { audit } from '../admin/audit';
import { notify } from '../notifications/service';

/* ------------------------------- audiences ------------------------------- */

export type AudienceKey = 'ALL' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'NO_PURCHASE' | 'PARTNERS';
export const AUDIENCES: Record<AudienceKey, { label: string; hint: string }> = {
  ALL: { label: '👥 همه‌ی کاربران', hint: 'هر کسی که ربات را استارت کرده' },
  ACTIVE: { label: '🟢 دارای سرویس فعال', hint: 'حداقل یک سرویس فعال دارند' },
  EXPIRING: { label: '⏳ رو به پایان (۳ روز)', hint: 'سرویس فعالشان تا ۳ روز دیگر تمام می‌شود' },
  EXPIRED: { label: '🔴 سرویس منقضی', hint: 'سرویس منقضی دارند و سرویس فعالی ندارند' },
  NO_PURCHASE: { label: '🛒 هنوز نخریده‌اند', hint: 'هیچ سرویسی ندارند' },
  PARTNERS: { label: '🤝 همکاران', hint: 'همکاران تأییدشده' },
};
export const isAudience = (k: string): k is AudienceKey => Object.hasOwn(AUDIENCES, k);

/** Never message people an admin blocked, or who blocked the bot / deleted their account (until they write again). */
const REACHABLE: Prisma.UserWhereInput = { isBlocked: false, botBlockedAt: null };
const OK_SERVICE = { provisioningStatus: 'SUCCESS' as const };

function audienceWhere(key: AudienceKey): Prisma.UserWhereInput {
  switch (key) {
    case 'ALL': return REACHABLE;
    case 'ACTIVE': return { ...REACHABLE, services: { some: { ...OK_SERVICE, status: 'ACTIVE' } } };
    case 'EXPIRING': return { ...REACHABLE, services: { some: { ...OK_SERVICE, status: 'ACTIVE', expiresAt: { lte: new Date(Date.now() + 3 * 86_400_000) } } } };
    case 'EXPIRED': return { ...REACHABLE, AND: [{ services: { some: { ...OK_SERVICE, status: 'EXPIRED' } } }, { services: { none: { ...OK_SERVICE, status: 'ACTIVE' } } }] };
    case 'NO_PURCHASE': return { ...REACHABLE, services: { none: OK_SERVICE } };
    case 'PARTNERS': return { ...REACHABLE, partner: { is: { status: 'APPROVED' } } };
  }
}

export async function audienceCounts(): Promise<Record<AudienceKey, number>> {
  const keys = Object.keys(AUDIENCES) as AudienceKey[];
  const counts = await Promise.all(keys.map((k) => prisma.user.count({ where: audienceWhere(k) })));
  return Object.fromEntries(keys.map((k, i) => [k, counts[i]])) as Record<AudienceKey, number>;
}

/* --------------------------------- draft --------------------------------- */

export interface Draft { text: string; photoFileId?: string | null; buttonText?: string | null; buttonUrl?: string | null }
const MAX_TEXT = 3500, MAX_CAPTION = 1000;

export function validateDraft(d: Draft): Required<Pick<Draft, 'text'>> & Draft {
  const text = (d.text ?? '').replace(/\r\n/g, '\n').replace(/\0/g, '').trim();
  const photo = d.photoFileId?.trim() || null;
  if (!text && !photo) throw new ValidationError('متن پیام خالی است');
  const max = photo ? MAX_CAPTION : MAX_TEXT;
  if (text.length > max) throw new ValidationError(`متن بیش از حد طولانی است (${text.length} از ${max} حرف${photo ? '؛ کپشن عکس محدودتر است' : ''})`);
  const bt = d.buttonText?.trim() || null, bu = d.buttonUrl?.trim() || null;
  if ((bt && !bu) || (!bt && bu)) throw new ValidationError('برای دکمه هم «متن» و هم «لینک» لازم است');
  if (bt && bt.length > 40) throw new ValidationError('متن دکمه حداکثر ۴۰ حرف است');
  if (bu) {
    let u: URL;
    try { u = new URL(bu); } catch { throw new ValidationError('لینک دکمه نامعتبر است (باید با https:// شروع شود)'); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new ValidationError('لینک دکمه باید با https:// یا http:// شروع شود');
  }
  return { text, photoFileId: photo, buttonText: bt, buttonUrl: bu };
}

/** Admin text → Telegram HTML: escaped, `*bold*`, and `{name}` = the recipient's first name. */
export function renderBroadcast(text: string, name?: string | null): string {
  const who = esc((name ?? '').replace(/[*<>&]/g, '').trim() || 'دوست عزیز');
  return text.split('{name}').map((p) => esc(p).replace(/\*([^*\n]+)\*/g, '<b>$1</b>')).join(who);
}

/* --------------------------------- sending -------------------------------- */

export interface BroadcastMessage { chatId: bigint; html: string; photoFileId?: string | null; button?: { text: string; url: string } | null }
export type BroadcastSender = (m: BroadcastMessage) => Promise<void>;
let bsender: BroadcastSender | undefined;
export const setBroadcastSender = (s: BroadcastSender | undefined) => { bsender = s; };

const messageFor = (b: Pick<Broadcast, 'text' | 'photoFileId' | 'buttonText' | 'buttonUrl'>, chatId: bigint, name?: string | null): BroadcastMessage => ({
  chatId, html: renderBroadcast(b.text, name), photoFileId: b.photoFileId, button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null,
});

/** One preview message to the admin themself (nothing is stored). */
export async function sendTestBroadcast(chatId: bigint, draft: Draft, name?: string | null) {
  const d = validateDraft(draft);
  if (!bsender) throw new ValidationError('ارسال‌کننده‌ی ربات آماده نیست');
  await bsender(messageFor({ text: d.text, photoFileId: d.photoFileId ?? null, buttonText: d.buttonText ?? null, buttonUrl: d.buttonUrl ?? null }, chatId, name));
}

/* --------------------------------- lifecycle ------------------------------ */

export async function createBroadcast(actor: string, draft: Draft, audience: string): Promise<Broadcast> {
  if (!isAudience(audience)) throw new ValidationError('مخاطب نامعتبر است');
  const d = validateDraft(draft);
  const dup = await prisma.broadcast.findFirst({ where: { createdBy: actor, audience, text: d.text, status: { not: 'CANCELLED' }, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } }, select: { id: true } });
  if (dup) throw new ConflictError('همین پیام برای همین مخاطبان همین چند دقیقه پیش ارسال شده است؛ برای جلوگیری از ارسال دوباره، رد شد.');
  const targets = await prisma.user.findMany({ where: audienceWhere(audience), select: { id: true, telegramId: true } });
  if (!targets.length) throw new ValidationError('این گروه هیچ مخاطبی ندارد');
  const b = await prisma.broadcast.create({ data: { createdBy: actor, audience, text: d.text, photoFileId: d.photoFileId, buttonText: d.buttonText, buttonUrl: d.buttonUrl, total: targets.length } });
  for (let i = 0; i < targets.length; i += 5000) {
    await prisma.broadcastRecipient.createMany({ data: targets.slice(i, i + 5000).map((t) => ({ broadcastId: b.id, userId: t.id, chatId: t.telegramId })), skipDuplicates: true });
  }
  await audit({ actor, action: 'broadcast.create', target: 'Broadcast', targetId: b.id, metadata: { audience, total: targets.length, length: d.text.length, photo: !!d.photoFileId, button: !!d.buttonText } });
  return b;
}

export async function cancelBroadcast(actor: string, id: string) {
  const r = await prisma.broadcast.updateMany({ where: { id, status: 'RUNNING' }, data: { status: 'CANCELLED', finishedAt: new Date() } });
  if (r.count !== 1) {
    if (!(await prisma.broadcast.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundError('broadcast');
    throw new ConflictError('این ارسال دیگر در حال اجرا نیست');
  }
  await audit({ actor, action: 'broadcast.cancel', target: 'Broadcast', targetId: id });
}

export interface BroadcastProgress { id: string; status: Broadcast['status']; audience: string; total: number; sent: number; blocked: number; failed: number; pending: number; createdAt: Date; finishedAt: Date | null; createdBy: string; text: string; hasPhoto: boolean }

const progressOf = (b: Broadcast, g: { status: string; _count: number }[]): BroadcastProgress => {
  const n = (s: string) => g.find((x) => x.status === s)?._count ?? 0;
  return { id: b.id, status: b.status, audience: b.audience, total: b.total, sent: n('SENT'), blocked: n('BLOCKED'), failed: n('FAILED'), pending: n('PENDING'), createdAt: b.createdAt, finishedAt: b.finishedAt, createdBy: b.createdBy, text: b.text, hasPhoto: !!b.photoFileId };
};

export async function getBroadcast(id: string): Promise<BroadcastProgress> {
  const b = await prisma.broadcast.findUnique({ where: { id } });
  if (!b) throw new NotFoundError('broadcast');
  const g = await prisma.broadcastRecipient.groupBy({ by: ['status'], where: { broadcastId: id }, _count: true });
  return progressOf(b, g);
}

export async function listBroadcasts(limit = 15): Promise<BroadcastProgress[]> {
  const rows = await prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  const g = await prisma.broadcastRecipient.groupBy({ by: ['broadcastId', 'status'], where: { broadcastId: { in: rows.map((r) => r.id) } }, _count: true });
  return rows.map((b) => progressOf(b, g.filter((x) => x.broadcastId === b.id)));
}

/* ---------------------------------- worker -------------------------------- */

export function classifySendError(e: any): { kind: 'retry'; afterS: number } | { kind: 'blocked' } | { kind: 'error'; msg: string } {
  const code = Number(e?.error_code ?? e?.statusCode ?? 0);
  const desc = String(e?.description ?? e?.message ?? e);
  if (code === 429) return { kind: 'retry', afterS: Math.min(300, Math.max(1, Number(e?.parameters?.retry_after) || 5)) };
  if (code === 403 || /bot was blocked|user is deactivated|chat not found|can't initiate|bot was kicked/i.test(desc)) return { kind: 'blocked' };
  return { kind: 'error', msg: desc.slice(0, 200) };
}

let pausedUntil = 0; // Telegram flood control: nothing is sent until then
let ticking = false;
export const resetBroadcastWorker = () => { pausedUntil = 0; ticking = false; };
const MAX_ATTEMPTS = 3;

/**
 * Sends the next batch of the oldest RUNNING broadcast (called by the scheduler every couple of seconds).
 * ~30 messages per tick stays well under Telegram's bulk limit; a 429 pauses the worker for the time Telegram asks.
 */
export async function runBroadcastTick(opts: { batch?: number; gapMs?: number } = {}): Promise<{ sent: number; paused?: boolean }> {
  if (!bsender || ticking || Date.now() < pausedUntil) return { sent: 0, paused: Date.now() < pausedUntil };
  ticking = true;
  try {
    const b = await prisma.broadcast.findFirst({ where: { status: 'RUNNING' }, orderBy: { createdAt: 'asc' } });
    if (!b) return { sent: 0 };
    const rows = await prisma.broadcastRecipient.findMany({ where: { broadcastId: b.id, status: 'PENDING' }, orderBy: { id: 'asc' }, take: opts.batch ?? 30 });
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId).filter((x): x is string => !!x) } }, select: { id: true, firstName: true } });
    const names = new Map(users.map((u) => [u.id, u.firstName]));
    let sent = 0;
    for (const [i, r] of rows.entries()) {
      if (i > 0 && i % 10 === 0 && (await prisma.broadcast.findUnique({ where: { id: b.id }, select: { status: true } }))?.status !== 'RUNNING') break; // cancelled meanwhile
      try {
        await bsender(messageFor(b, r.chatId, r.userId ? names.get(r.userId) : null));
        await prisma.broadcastRecipient.update({ where: { id: r.id }, data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } } });
        sent++;
      } catch (e) {
        const c = classifySendError(e);
        if (c.kind === 'retry') { pausedUntil = Date.now() + (c.afterS + 1) * 1000; logger.warn({ afterS: c.afterS }, 'broadcast paused by Telegram flood control'); return { sent, paused: true }; }
        if (c.kind === 'blocked') {
          await prisma.broadcastRecipient.update({ where: { id: r.id }, data: { status: 'BLOCKED', attempts: { increment: 1 } } });
          if (r.userId) await prisma.user.update({ where: { id: r.userId }, data: { botBlockedAt: new Date() } }).catch(() => undefined);
        } else {
          const failed = r.attempts + 1 >= MAX_ATTEMPTS;
          await prisma.broadcastRecipient.update({ where: { id: r.id }, data: { status: failed ? 'FAILED' : 'PENDING', attempts: { increment: 1 }, error: c.msg } });
        }
      }
      if (opts.gapMs !== 0) await new Promise((res) => setTimeout(res, opts.gapMs ?? 35));
    }
    if ((await prisma.broadcastRecipient.count({ where: { broadcastId: b.id, status: 'PENDING' } })) === 0) await finish(b.id);
    return { sent };
  } finally { ticking = false; }
}

async function finish(id: string) {
  const done = await prisma.broadcast.updateMany({ where: { id, status: 'RUNNING' }, data: { status: 'DONE', finishedAt: new Date() } });
  if (done.count !== 1) return;
  const p = await getBroadcast(id);
  await audit({ actor: 'system', action: 'broadcast.done', target: 'Broadcast', targetId: id, metadata: { sent: p.sent, blocked: p.blocked, failed: p.failed } });
  const m = /^admin:(\d+)$/.exec(p.createdBy);
  if (m) {
    await notify({
      chatId: BigInt(m[1]), type: 'broadcast_done', audience: 'ADMIN', dedupeKey: `broadcast_done:${id}`,
      text: `📣 پیام همگانی تمام شد\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\nمخاطب: ${p.total}\n✅ ارسال‌شده: ${p.sent}\n🚫 ربات را بلاک کرده‌اند: ${p.blocked}\n⚠️ ناموفق: ${p.failed}`,
    }).catch(() => undefined);
  }
}
