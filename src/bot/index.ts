import { Bot, session } from 'grammy';
import { prisma } from '../db/client';
import { RateLimiter } from '../utils/ratelimit';
import { logger } from '../utils/logger';
import { upsertUser } from '../modules/users/service';
import { setSender } from '../modules/notifications/service';
import { Ctx, Session, toKb } from './ui';
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
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => undefined);
    const user = await upsertUser(ctx.from);
    if (user.isBlocked) return;
    (ctx as Ctx).dbUser = user;
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

export const USER_COMMANDS = [
  { command: 'start', description: 'منوی اصلی' },
  { command: 'services', description: 'سرویس‌های من' },
  { command: 'orders', description: 'سفارش‌های من' },
  { command: 'account', description: 'حساب من' },
  { command: 'support', description: 'پشتیبانی' },
  { command: 'help', description: 'راهنما' },
];
