import { Context, InlineKeyboard, SessionFlavor } from 'grammy';
import { User } from '@prisma/client';
import { Button } from '../modules/notifications/service';
import type { Texts } from '../modules/texts/service';

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

/** `isAdmin` adds the management entry — it is only ever rendered for Telegram admins. */
export const mainMenuRows = (isAdmin = false, t?: Texts, partner = false): Button[][] => [
  [{ text: t?.plain('btn.buy') ?? '🛒 خرید VPN', data: 'menu:buy' }],
  [{ text: t?.plain('btn.services') ?? '📦 سرویس‌های من', data: 'menu:services' }, { text: t?.plain('btn.orders') ?? '💳 سفارش‌های من', data: 'menu:orders' }],
  [{ text: t?.plain('btn.account') ?? '👤 حساب من', data: 'menu:account' }, { text: t?.plain('btn.coupon') ?? '🎁 کد تخفیف', data: 'menu:coupon' }],
  [{ text: t?.plain('btn.support') ?? '🎫 پشتیبانی', data: 'menu:support' }, { text: t?.plain('btn.rules') ?? '📜 قوانین', data: 'menu:rules' }],
  ...(partner ? [[{ text: t?.plain('btn.partner') ?? '🤝 همکاری', data: 'menu:partner' }]] : []),
  ...(isAdmin ? [[{ text: '🛠 پنل مدیریت', data: 'adm:home' }]] : []),
];
export const back = (to = 'menu:main'): Button[] => [{ text: BACK, data: to }];
/** Navigation row for dead-end screens: back + home. */
export const nav = (to = 'menu:main'): Button[] => (to === 'menu:main' ? [{ text: '🏠 منوی اصلی', data: 'menu:main' }] : [{ text: BACK, data: to }, { text: '🏠 منو', data: 'menu:main' }]);
