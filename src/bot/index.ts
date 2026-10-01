import { Bot, session } from 'grammy';
import { prisma } from '../db/client';
import { RateLimiter } from '../utils/ratelimit';
import { logger } from '../utils/logger';
import { registerUser } from '../modules/users/service';
import { checkMembership } from '../modules/channels/service';
import { getAdmin } from '../modules/admin/rbac';
import { loadTexts } from '../modules/texts/service';
import { getBool } from '../modules/settings/service';
import { notifyAdmins } from '../modules/notifications/service';
import { setSender } from '../modules/notifications/service';
import { Ctx, Session, toKb } from './ui';
import type { Button } from '../modules/notifications/service';
import { adminHandlers } from './admin';
import { FileFetcher, telegramFileFetcher, userHandlers } from './user';
import { telegramClientOptions } from './telegramNet';

const storage = {
  async read(key: string): Promise<Session | undefined> {
    const row = await prisma.botSession.findUnique({ where: { key } });
    return row ? (JSON.parse(row.data) as Session) : undefined;
  },
  async write(key: string, value: Session) {
    await prisma.botSession.upsert({ where: { key }, create: { key, data: JSON.stringify(value) }, update: { data: JSON.stringify(value) } });
  },
  async delete(key: string) {
    await prisma.botSession.deleteMany({ where: { key } });
  },
};

export function createBot(token: string, opts: { fetchFile?: FileFetcher; botInfo?: any; limiter?: RateLimiter } = {}) {
  const bot = new Bot<Ctx>(token, { client: telegramClientOptions(), ...(opts.botInfo ? { botInfo: opts.botInfo } : {}) });
  const limiter = opts.limiter ?? new RateLimiter(25, 10_000);

  bot.catch((err) => logger.error({ err: String(err.error) }, 'unhandled bot error'));

  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== 'private') return; // bot works in private chats only
    if (!ctx.from || ctx.from.is_bot) return;
    if (!limiter.allow(String(ctx.from.id))) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'لطفاً کمی آهسته‌تر.' }).catch(() => undefined);
      return;
    }
    if (ctx.callbackQuery && ctx.callbackQuery.data !== 'chk:join') await ctx.answerCallbackQuery().catch(() => undefined); // chk:join answers itself (alert)
    const { user, isNew } = await registerUser(ctx.from);
    if (isNew) await announceNewUser(user).catch((e) => logger.warn({ err: String(e?.message) }, 'new-user notification failed'));
    if (user.isBlocked) return;
    (ctx as Ctx).dbUser = user;

    // ---- mandatory channel membership (admins are exempt) ----
    const gate = await membershipGate(ctx as Ctx);
    if (gate === 'blocked') return;
    return next();
  });
  bot.use(session<Session, Ctx>({ initial: () => ({}), storage, getSessionKey: (ctx) => (ctx.from ? String(ctx.from.id) : undefined) }));
  bot.use(adminHandlers()); // admin first: its /services only applies to admins
  bot.use(userHandlers(opts.fetchFile ?? telegramFileFetcher(token)));

  setSender(async (m) => {
    await bot.api.sendMessage(Number(m.chatId), m.text.slice(0, 4000), {
      reply_markup: m.buttons ? toKb(m.buttons) : undefined,
      link_preview_options: { is_disabled: true },
      ...(m.html ? { parse_mode: 'HTML' as const } : {}),
    });
  });
  return bot;
}

async function announceNewUser(user: { id: string; telegramId: bigint; username: string | null; firstName: string | null; lastName: string | null }) {
  if (!(await getBool('notify.newUser'))) return;
  const total = await prisma.user.count();
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  await notifyAdmins('new_user', `🆕 کاربر جدید وارد ربات شد\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n👤 نام: ${name}\n🔗 یوزرنیم: ${user.username ? '@' + user.username : '—'}\n🪪 آیدی: ${user.telegramId}\n👥 تعداد کل کاربران: ${total}`, { roles: [], dedupeKey: `new_user:${user.id}` });
}

/**
 * Users must be members of every active required channel. Returns 'blocked' after showing the join screen.
 * `chk:join` ("I joined") re-checks and, on success, continues as a "menu:main" tap.
 */
async function membershipGate(ctx: Ctx): Promise<'ok' | 'blocked'> {
  if (await getAdmin(BigInt(ctx.from!.id))) return 'ok';
  const { ok, missing } = await checkMembership(BigInt(ctx.from!.id));
  const isCheck = ctx.callbackQuery?.data === 'chk:join';
  if (ok) {
    if (isCheck) { (ctx.update.callback_query as { data?: string }).data = 'menu:main'; await ctx.answerCallbackQuery().catch(() => undefined); }
    return 'ok';
  }
  const T = await loadTexts();
  if (isCheck) await ctx.answerCallbackQuery({ text: T.plain('join.still'), show_alert: true }).catch(() => undefined);
  const rows: Button[][] = [...missing.map((c): Button[] => [{ text: `📢 ${c.title}`, url: c.inviteUrl }]), [{ text: T.plain('btn.joined'), data: 'chk:join' }]];
  const text = T.html('join.required');
  if (isCheck && ctx.callbackQuery?.message) await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: toKb(rows) }).catch(() => undefined);
  else await ctx.reply(text, { parse_mode: 'HTML', reply_markup: toKb(rows) }).catch(() => undefined);
  return 'blocked';
}

export const USER_COMMANDS = [
  { command: 'start', description: 'منوی اصلی' },
  { command: 'services', description: 'سرویس‌های من' },
  { command: 'orders', description: 'سفارش‌های من' },
  { command: 'account', description: 'حساب من' },
  { command: 'support', description: 'پشتیبانی' },
  { command: 'help', description: 'راهنما' },
];
