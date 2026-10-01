import { Context, InlineKeyboard, SessionFlavor } from 'grammy';
import { User } from '@prisma/client';
import { Button } from '../modules/notifications/service';

export interface Session {
  step?: string;
  data?: Record<string, any>;
  coupon?: string;
}
export type Ctx = Context & SessionFlavor<Session> & { dbUser: User };

export const BACK = '⬅️ بازگشت';

export function toKb(rows: Button[][]): InlineKeyboard {
  const kb = new InlineKeyboard();
  rows.forEach((row, i) => {
    row.forEach((b) => (b.url ? kb.url(b.text, b.url) : kb.text(b.text, b.data ?? 'noop')));
    if (i < rows.length - 1) kb.row();
  });
  return kb;
}

/** Edit the current message when called from a button, otherwise send a new one. */
export async function show(ctx: Ctx, text: string, rows: Button[][] = [], opts: { html?: boolean } = {}) {
  const reply_markup = rows.length ? toKb(rows) : undefined;
  const parse_mode = opts.html ? ('HTML' as const) : undefined;
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, { reply_markup, parse_mode, link_preview_options: { is_disabled: true } });
      return;
    } catch (e: any) {
      if (String(e?.description ?? e?.message).includes('not modified')) return;
    }
  }
  await ctx.reply(text, { reply_markup, parse_mode, link_preview_options: { is_disabled: true } });
}

export const mainMenuRows = (): Button[][] => [
  [{ text: '🛒 خرید VPN', data: 'menu:buy' }],
  [{ text: '📦 سرویس‌های من', data: 'menu:services' }, { text: '💳 سفارش‌های من', data: 'menu:orders' }],
  [{ text: '👤 حساب من', data: 'menu:account' }, { text: '🎁 کد تخفیف', data: 'menu:coupon' }],
  [{ text: '🎫 پشتیبانی', data: 'menu:support' }, { text: '📜 قوانین', data: 'menu:rules' }],
];
export const back = (to = 'menu:main'): Button[] => [{ text: BACK, data: to }];
/** Navigation row for dead-end screens: back + home. */
export const nav = (to = 'menu:main'): Button[] => (to === 'menu:main' ? [{ text: '🏠 منوی اصلی', data: 'menu:main' }] : [{ text: BACK, data: to }, { text: '🏠 منو', data: 'menu:main' }]);

export const RULES_HTML = [
  `📜 <b>قوانین استفاده</b>`,
  '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
  '1️⃣ سرویس‌ها فقط برای استفاده شخصی هستند.',
  '2️⃣ فروش مجدد یا اشتراک‌گذاری لینک مجاز نیست.',
  '3️⃣ بازگشت وجه فقط در صورت عدم‌ارائه خدمات امکان‌پذیر است.',
  '4️⃣ پرداخت را با <b>مبلغ دقیق</b> سفارش و به کارت اعلام‌شده انجام دهید.',
  '5️⃣ ارسال رسید جعلی یا تکراری منجر به مسدود شدن حساب می‌شود.',
].join('\n');
