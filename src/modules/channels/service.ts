import { RequiredChannel } from '@prisma/client';
import { prisma } from '../../db/client';
import { env } from '../../config/env';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { audit } from '../admin/audit';
import { telegramApiRoot, telegramGet } from '../../bot/telegramNet';
import { notifyAdmins } from '../notifications/service';

export const MAX_CHANNELS = 10;

/** Minimal Telegram Bot API caller (GET). Replaceable in tests. Works through TELEGRAM_PROXY_URL / TELEGRAM_API_ROOT. */
export type TgCaller = (method: string, params?: Record<string, string | number>) => Promise<any>;
let caller: TgCaller = async (method, params = {}) => {
  const token = env().BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN is not configured');
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const res = await telegramGet(`${telegramApiRoot()}/bot${token}/${method}${qs ? `?${qs}` : ''}`, 10_000);
  const json = JSON.parse(res.body.toString('utf8')) as { ok: boolean; result?: any; description?: string };
  if (!json.ok) throw Object.assign(new Error(json.description ?? 'telegram error'), { tg: true });
  return json.result;
};
export const setTgCaller = (c: TgCaller | undefined) => { caller = c ?? caller; };

let botId: number | undefined;
async function getBotId() { return (botId ??= (await caller('getMe')).id as number); }
export const resetChannelCaches = () => { botId = undefined; memberCache.clear(); lastAlert.clear(); };

/** "@name", "t.me/name", "https://t.me/name" or a numeric id (-100…). Invite links (t.me/+…) cannot be resolved. */
export function parseChannelRef(raw: string): { ref: string; username?: string } {
  const t = raw.trim();
  if (/^-?\d{5,}$/.test(t)) return { ref: t };
  if (/(?:t\.me|telegram\.me)\/(?:\+|joinchat\/)/i.test(t)) throw new ValidationError('لینک دعوت خصوصی قابل شناسایی نیست. شناسه‌ی عددی کانال (مثل -100123456789) را بفرستید و لینک دعوت را در خط بعد بنویسید.');
  const m = t.match(/^(?:https?:\/\/)?(?:t(?:elegram)?\.me\/)?@?([A-Za-z][A-Za-z0-9_]{3,31})\/?$/);
  if (!m) throw new ValidationError('آدرس کانال نامعتبر است. مثال: @mychannel یا https://t.me/mychannel');
  return { ref: `@${m[1]}`, username: m[1] };
}

const tgErr = (e: any) => String(e?.message ?? e).replace(/^Bad Request: /, '');

/** Resolve + verify (the bot must be an admin of the channel, otherwise membership cannot be checked). */
export async function addChannel(actor: string, input: string, inviteUrl?: string) {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const { ref, username } = parseChannelRef(lines[0] ?? '');
  const invite = (inviteUrl ?? lines[1] ?? '').trim();
  if (invite && !/^https:\/\/t\.me\/\S+$/i.test(invite)) throw new ValidationError('لینک دعوت باید با https://t.me/ شروع شود');
  if ((await prisma.requiredChannel.count()) >= MAX_CHANNELS) throw new ValidationError(`حداکثر ${MAX_CHANNELS} کانال مجاز است`);
  let chat: any;
  try { chat = await caller('getChat', { chat_id: ref }); } catch (e) { throw new ValidationError(`کانال پیدا نشد (${tgErr(e)}). نام را درست بنویسید و ربات را ادمین کانال کنید.`); }
  if (chat.type !== 'channel' && chat.type !== 'supergroup') throw new ValidationError('فقط کانال یا سوپرگروه مجاز است');
  let me: any;
  try { me = await caller('getChatMember', { chat_id: chat.id, user_id: await getBotId() }); } catch (e) { throw new ValidationError(`ربات به کانال دسترسی ندارد (${tgErr(e)}). ربات را ادمین کانال کنید.`); }
  if (me.status !== 'administrator' && me.status !== 'creator') throw new ValidationError('ربات باید «ادمین» کانال باشد تا بتواند عضویت کاربران را بررسی کند.');
  const uname: string | undefined = chat.username ?? username;
  const url = invite || (uname ? `https://t.me/${uname}` : '');
  if (!url) throw new ValidationError('این کانال خصوصی است؛ لینک دعوت (https://t.me/+…) را هم بفرستید.');
  if (await prisma.requiredChannel.findUnique({ where: { chatId: BigInt(chat.id) } })) throw new ConflictError('این کانال قبلاً اضافه شده است');
  const top = (await prisma.requiredChannel.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
  const c = await prisma.requiredChannel.create({ data: { chatId: BigInt(chat.id), title: String(chat.title ?? uname ?? chat.id).slice(0, 80), username: uname ?? null, inviteUrl: url, sortOrder: top + 1 } });
  memberCache.clear();
  await audit({ actor, action: 'channel.add', target: 'RequiredChannel', targetId: c.id, metadata: { title: c.title, chatId: String(c.chatId) } });
  return c;
}

export const listChannels = (onlyActive = false) => prisma.requiredChannel.findMany({ where: onlyActive ? { isActive: true } : {}, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });

export async function setChannelActive(actor: string, id: string, isActive: boolean) {
  const c = await prisma.requiredChannel.update({ where: { id }, data: { isActive } }).catch(() => { throw new NotFoundError('channel'); });
  memberCache.clear();
  await audit({ actor, action: isActive ? 'channel.enable' : 'channel.disable', target: 'RequiredChannel', targetId: id });
  return c;
}

export async function deleteChannel(actor: string, id: string) {
  const c = await prisma.requiredChannel.delete({ where: { id } }).catch(() => { throw new NotFoundError('channel'); });
  memberCache.clear();
  await audit({ actor, action: 'channel.delete', target: 'RequiredChannel', targetId: id, metadata: { title: c.title } });
}

/** Admin "test" button: can the bot still read members of this channel? */
export async function testChannel(id: string): Promise<{ ok: boolean; detail: string }> {
  const c = await prisma.requiredChannel.findUnique({ where: { id } });
  if (!c) throw new NotFoundError('channel');
  try {
    const me = await caller('getChatMember', { chat_id: String(c.chatId), user_id: await getBotId() });
    return me.status === 'administrator' || me.status === 'creator' ? { ok: true, detail: 'ربات ادمین است و عضویت را بررسی می‌کند' } : { ok: false, detail: 'ربات دیگر ادمین کانال نیست' };
  } catch (e) { return { ok: false, detail: tgErr(e) }; }
}

/* ------------------------------ membership gate ------------------------------ */
const MEMBER_TTL_MS = 120_000;
const memberCache = new Map<string, number>(); // `${chatId}:${userId}` -> verified-at
const lastAlert = new Map<string, number>();
const IS_MEMBER = new Set(['member', 'administrator', 'creator']);

export async function checkMembership(telegramUserId: bigint): Promise<{ ok: boolean; missing: RequiredChannel[] }> {
  const channels = await listChannels(true);
  const missing: RequiredChannel[] = [];
  for (const ch of channels) {
    const key = `${ch.chatId}:${telegramUserId}`;
    const at = memberCache.get(key);
    if (at && Date.now() - at < MEMBER_TTL_MS) continue;
    try {
      const m = await caller('getChatMember', { chat_id: String(ch.chatId), user_id: String(telegramUserId) });
      if (IS_MEMBER.has(m.status) || (m.status === 'restricted' && m.is_member)) memberCache.set(key, Date.now());
      else missing.push(ch);
    } catch (e) {
      // The bot lost access (removed / not admin / channel deleted): never lock every customer out — fail open and alert admins.
      logger.warn({ channel: ch.title, err: tgErr(e) }, 'membership check failed (failing open)');
      const la = lastAlert.get(ch.id) ?? 0;
      if (Date.now() - la > 3_600_000) {
        lastAlert.set(ch.id, Date.now());
        void notifyAdmins('channel_check_failed', `⚠️ بررسی عضویت کانال «${ch.title}» ناموفق بود (${tgErr(e)}).\nتا رفع مشکل، این کانال اجباری اعمال نمی‌شود. مطمئن شوید ربات هنوز ادمین کانال است.`, { roles: [] });
      }
    }
  }
  return { ok: missing.length === 0, missing };
}
