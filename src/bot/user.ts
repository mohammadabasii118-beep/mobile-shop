import { Composer, InputFile } from 'grammy';
import QRCode from 'qrcode';
import { AppError } from '../utils/errors';
import { formatMoney, toPersianDigits } from '../utils/misc';
import { listActiveProducts, getProduct } from '../modules/products/service';
import { cancelOrder, createOrder, getOrderForUser, listUserOrders } from '../modules/orders/service';
import { startPayment, submitReceipt } from '../modules/payments/service';
import { accountSummary } from '../modules/users/service';
import { getServiceForUser, listUserServices } from '../modules/vpn/service';
import { serviceSummary } from '../modules/vpn/messages';
import { createTicket, getTicketForUser, listUserTickets, userReply } from '../modules/support/service';
import { validateCoupon } from '../modules/coupons/service';
import { Button } from '../modules/notifications/service';
import { Ctx, RULES_TEXT, back, mainMenuRows, show } from './ui';
import { logger } from '../utils/logger';

export type FileFetcher = (ctx: Ctx, fileId: string) => Promise<Buffer>;
export const telegramFileFetcher = (token: string): FileFetcher => async (ctx, fileId) => {
  const f = await ctx.api.getFile(fileId);
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`);
  if (!res.ok) throw new Error('file download failed');
  return Buffer.from(await res.arrayBuffer());
};

export const orderStatusFa: Record<string, string> = {
  PENDING_PAYMENT: '⏳ در انتظار پرداخت', PAYMENT_SUBMITTED: '📤 رسید ارسال شد', PAYMENT_REVIEW: '🔎 در حال بررسی',
  PAID: '✅ پرداخت شد', PROVISIONING: '⚙️ در حال راه‌اندازی', FULFILLED: '🎉 تحویل شد', CANCELLED: '❌ لغو شده', REFUNDED: '↩️ بازگشت وجه',
};
const catFa = { VPN_ISSUE: 'مشکل VPN', PAYMENT_ISSUE: 'مشکل پرداخت', RENEWAL: 'تمدید', OTHER: 'سایر' } as const;

export function userHandlers(fetchFile: FileFetcher) {
  const c = new Composer<Ctx>();

  const mainMenu = (ctx: Ctx) => { ctx.session.step = undefined; return show(ctx, '👋 به ربات فروش VPN خوش آمدید.\nیکی از گزینه‌ها را انتخاب کنید:', mainMenuRows()); };

  c.command('start', mainMenu);
  c.command('help', (ctx) => show(ctx, 'دستورات: /start /services /orders /account /support', mainMenuRows()));
  c.command('support', (ctx) => supportMenu(ctx));
  c.command('services', (ctx) => servicesList(ctx));
  c.command('orders', (ctx) => ordersList(ctx));
  c.command('account', (ctx) => account(ctx));

  async function account(ctx: Ctx) {
    const s = await accountSummary(ctx.dbUser.id);
    await show(ctx, `👤 حساب من\n\nشناسه: ${s.user.telegramId}\nنام: ${s.user.firstName ?? '-'}\nتعداد سفارش‌ها: ${toPersianDigits(s.orders)}\nسرویس‌های فعال/ثبت‌شده: ${toPersianDigits(s.services)}`, [back()]);
  }

  async function buyMenu(ctx: Ctx) {
    const ps = await listActiveProducts();
    if (!ps.length) return show(ctx, 'در حال حاضر پلنی موجود نیست.', [back()]);
    await show(ctx, '🛒 یکی از پلن‌ها را انتخاب کنید:', [
      ...ps.map((p): Button[] => [{ text: `${p.name} — ${formatMoney(p.price, p.currency)}`, data: `buy:${p.id}` }]),
      back(),
    ]);
  }

  async function servicesList(ctx: Ctx) {
    const list = await listUserServices(ctx.dbUser.id);
    if (!list.length) return show(ctx, 'هنوز سرویسی ندارید.', [[{ text: '🛒 خرید VPN', data: 'menu:buy' }], back()]);
    await show(ctx, '📦 سرویس‌های من', [...list.map((s): Button[] => [{ text: `${s.product.name} · ${s.status === 'ACTIVE' ? '🟢' : '🔴'}`, data: `sv:v:${s.id}` }]), back()]);
  }

  async function ordersList(ctx: Ctx) {
    const list = await listUserOrders(ctx.dbUser.id);
    if (!list.length) return show(ctx, 'هنوز سفارشی ثبت نکرده‌اید.', [back()]);
    await show(ctx, '💳 سفارش‌های من', [...list.map((o): Button[] => [{ text: `${o.orderNumber} · ${orderStatusFa[o.status]}`, data: `ov:${o.id}` }]), back()]);
  }

  async function supportMenu(ctx: Ctx) {
    const ts = await listUserTickets(ctx.dbUser.id);
    await show(ctx, '🎫 پشتیبانی', [
      [{ text: '➕ تیکت جدید', data: 'tk:new' }],
      ...ts.map((t): Button[] => [{ text: `#${t.id.slice(-6)} ${t.subject.slice(0, 20)} · ${t.status}`, data: `tk:v:${t.id}` }]),
      back(),
    ]);
  }

  function orderActions(o: { id: string; status: string }): Button[][] {
    const rows: Button[][] = [];
    if (o.status === 'PENDING_PAYMENT') rows.push([{ text: '📤 ارسال رسید', data: `rc:${o.id}` }], [{ text: '❌ لغو سفارش', data: `oc:${o.id}` }]);
    rows.push(back('menu:orders'));
    return rows;
  }

  async function showPaymentInstructions(ctx: Ctx, orderId: string) {
    const { instructions } = await startPayment(ctx.dbUser.id, orderId);
    const o = await getOrderForUser(ctx.dbUser.id, orderId);
    await show(ctx, `🧾 سفارش ${o.orderNumber}\nپلن: ${o.product.name}\n\n${instructions.text}\n\nپس از پرداخت، دکمه «ارسال رسید» را بزنید.\n⚠️ مبلغ باید دقیقاً برابر مبلغ بالا باشد.`, orderActions(o));
  }

  c.on('callback_query:data', async (ctx, next) => {
    const d = ctx.callbackQuery.data;
    const [ns, a, b] = d.split(':');
    try {
      if (ns === 'menu') {
        ctx.session.step = undefined;
        switch (a) {
          case 'main': return mainMenu(ctx);
          case 'buy': return buyMenu(ctx);
          case 'services': return servicesList(ctx);
          case 'orders': return ordersList(ctx);
          case 'account': return account(ctx);
          case 'support': return supportMenu(ctx);
          case 'rules': return show(ctx, RULES_TEXT, [back()]);
          case 'coupon':
            ctx.session.step = 'coupon';
            return show(ctx, '🎁 کد تخفیف را ارسال کنید (روی سفارش بعدی شما اعمال می‌شود):', [back()]);
        }
      }
      if (ns === 'buy') {
        const p = await getProduct(a);
        if (!p.isActive) return show(ctx, 'این پلن در دسترس نیست.', [back('menu:buy')]);
        const cp = ctx.session.coupon ? `\n🎁 کد تخفیف: ${ctx.session.coupon}` : '';
        return show(ctx, `📦 ${p.name}\n${p.description ?? ''}\n\n📊 حجم: ${toPersianDigits(p.trafficGB)} GB\n📅 مدت: ${toPersianDigits(p.durationDays)} روز\n💰 قیمت: ${formatMoney(p.price, p.currency)}${cp}`, [
          [{ text: '💳 پرداخت کارت‌به‌کارت', data: `bo:${p.id}` }], back('menu:buy'),
        ]);
      }
      if (ns === 'bo') {
        const { order } = await createOrder({ userId: ctx.dbUser.id, productId: a, paymentMethod: 'CARD_TO_CARD', couponCode: ctx.session.coupon }).catch(async (e) => {
          if (ctx.session.coupon && e instanceof AppError) { ctx.session.coupon = undefined; }
          throw e;
        });
        ctx.session.coupon = undefined;
        return showPaymentInstructions(ctx, order.id);
      }
      if (ns === 'ov') {
        const o = await getOrderForUser(ctx.dbUser.id, a);
        const lines = [`🧾 ${o.orderNumber}`, `پلن: ${o.product.name}`, `مبلغ: ${formatMoney(o.finalAmount, o.currency)}`, o.discountAmount ? `تخفیف: ${formatMoney(o.discountAmount, o.currency)}` : '', `وضعیت: ${orderStatusFa[o.status]}`].filter(Boolean);
        if (o.status === 'PENDING_PAYMENT') return showPaymentInstructions(ctx, o.id);
        return show(ctx, lines.join('\n'), orderActions(o));
      }
      if (ns === 'oc') {
        await cancelOrder(ctx.dbUser.id, a);
        return show(ctx, '✅ سفارش لغو شد.', [back('menu:orders')]);
      }
      if (ns === 'rc') {
        const o = await getOrderForUser(ctx.dbUser.id, a);
        if (o.status !== 'PENDING_PAYMENT') return show(ctx, 'برای این سفارش رسیدی قابل ثبت نیست.', [back('menu:orders')]);
        ctx.session.step = 'receipt';
        ctx.session.data = { orderId: a };
        return show(ctx, '📤 تصویر رسید را ارسال کنید (ترجیحاً با کد پیگیری در کپشن)،\nیا فقط کد پیگیری را به‌صورت متن بفرستید.', [back(`ov:${a}`)]);
      }
      if (ns === 'rs') { // submit pending photo without tracking code
        const { orderId, fileId } = ctx.session.data ?? {};
        if (ctx.session.step !== 'receipt_track' || orderId !== a) return;
        return doSubmit(ctx, orderId, { fileId });
      }
      if (ns === 'sv') {
        if (a === 'v') {
          const s = await getServiceForUser(ctx.dbUser.id, b);
          return show(ctx, serviceSummary(s), [
            [{ text: '🔗 لینک', data: `sv:link:${s.id}` }, { text: '📱 QR', data: `sv:qr:${s.id}` }],
            [{ text: '📋 Config', data: `sv:cfg:${s.id}` }, { text: '🔄 تمدید', data: `sv:renew:${s.id}` }],
            back('menu:services'),
          ]);
        }
        const s = await getServiceForUser(ctx.dbUser.id, b); // ownership enforced for every action
        if (a === 'link' || a === 'cfg') {
          if (s.subscriptionUrl && a === 'link') return ctx.reply(`📡 لینک اشتراک:\n${s.subscriptionUrl}`);
          if (!s.config) return ctx.reply('کانفیگ هنوز آماده نیست.');
          return ctx.reply(a === 'link' ? `🔗 لینک اتصال:\n${s.config}` : `📋 کانفیگ:\n${s.config}`);
        }
        if (a === 'qr') {
          if (!s.config) return ctx.reply('کانفیگ هنوز آماده نیست.');
          const png = await QRCode.toBuffer(s.config, { width: 512, margin: 2 });
          return ctx.replyWithPhoto(new InputFile(png, 'qr.png'), { caption: `📱 QR سرویس ${s.product.name}` });
        }
        if (a === 'renew') {
          const ps = (await listActiveProducts()).filter((p) => p.xuiInboundId === s.inboundId && p.xuiProviderId === s.provider);
          if (!ps.length) return show(ctx, 'پلن تمدید مناسبی موجود نیست.', [back(`sv:v:${s.id}`)]);
          return show(ctx, '🔄 پلن تمدید را انتخاب کنید:', [...ps.map((p): Button[] => [{ text: `${p.name} — ${formatMoney(p.price, p.currency)}`, data: `rn:${s.id}:${p.id}` }]), back(`sv:v:${s.id}`)]);
        }
      }
      if (ns === 'rn') {
        const { order } = await createOrder({ userId: ctx.dbUser.id, productId: b, paymentMethod: 'CARD_TO_CARD', renewalOfServiceId: a, couponCode: ctx.session.coupon });
        ctx.session.coupon = undefined;
        return showPaymentInstructions(ctx, order.id);
      }
      if (ns === 'tk') {
        if (a === 'new') return show(ctx, 'موضوع تیکت:', [[{ text: 'مشکل VPN', data: 'tk:c:VPN_ISSUE' }, { text: 'مشکل پرداخت', data: 'tk:c:PAYMENT_ISSUE' }], [{ text: 'تمدید', data: 'tk:c:RENEWAL' }, { text: 'سایر', data: 'tk:c:OTHER' }], back('menu:support')]);
        if (a === 'c') { ctx.session.step = 'ticket'; ctx.session.data = { category: b }; return show(ctx, `📝 پیام خود را بنویسید (دسته: ${catFa[b as keyof typeof catFa] ?? 'سایر'}). خط اول به‌عنوان موضوع ثبت می‌شود.`, [back('menu:support')]); }
        if (a === 'v') {
          const t = await getTicketForUser(ctx.dbUser.id, b);
          const txt = t.messages.map((m) => `${m.fromAdmin ? '🧑‍💼 پشتیبان' : '👤 شما'}: ${m.text}`).join('\n\n');
          return show(ctx, `🎫 #${t.id.slice(-6)} · ${t.subject}\nوضعیت: ${t.status}\n\n${txt}`, [t.status !== 'CLOSED' ? [{ text: '💬 پاسخ', data: `tk:r:${t.id}` }] : [], back('menu:support')].filter((r) => r.length));
        }
        if (a === 'r') { await getTicketForUser(ctx.dbUser.id, b); ctx.session.step = 'ticket_reply'; ctx.session.data = { ticketId: b }; return show(ctx, 'پاسخ خود را بنویسید:', [back(`tk:v:${b}`)]); }
      }
    } catch (e) {
      return handleError(ctx, e);
    }
    return next();
  });

  async function doSubmit(ctx: Ctx, orderId: string, input: { fileId?: string; caption?: string; trackingCode?: string }) {
    try {
      const image = input.fileId ? await fetchFile(ctx, input.fileId) : undefined;
      await submitReceipt({ userId: ctx.dbUser.id, orderId, fileId: input.fileId, image, caption: input.caption, trackingCode: input.trackingCode });
      ctx.session.step = undefined; ctx.session.data = undefined;
      await show(ctx, 'منوی اصلی', mainMenuRows());
    } catch (e) {
      await handleError(ctx, e);
    }
  }

  c.on('message:photo', async (ctx, next) => {
    if (ctx.session.step !== 'receipt' && ctx.session.step !== 'receipt_track') return next();
    const orderId = ctx.session.data?.orderId as string;
    const photo = ctx.message.photo.at(-1)!;
    const caption = ctx.message.caption;
    if (caption) return doSubmit(ctx, orderId, { fileId: photo.file_id, caption, trackingCode: caption });
    ctx.session.step = 'receipt_track';
    ctx.session.data = { orderId, fileId: photo.file_id };
    await ctx.reply('📎 تصویر دریافت شد. کد پیگیری را به‌صورت متن بفرستید (بدون کد پیگیری بررسی طولانی‌تر می‌شود).', {
      reply_markup: { inline_keyboard: [[{ text: '⏭ ارسال بدون کد پیگیری', callback_data: `rs:${orderId}` }]] },
    });
  });

  c.on('message:text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return next();
    const step = ctx.session.step;
    try {
      if (step === 'receipt') return doSubmit(ctx, ctx.session.data!.orderId, { trackingCode: text, caption: text });
      if (step === 'receipt_track') return doSubmit(ctx, ctx.session.data!.orderId, { fileId: ctx.session.data!.fileId, trackingCode: text, caption: text });
      if (step === 'coupon') {
        const v = await validateCoupon(text, ctx.dbUser.id, 1_000_000).catch((e) => { throw e; });
        ctx.session.coupon = v.coupon.code; ctx.session.step = undefined;
        return show(ctx, `✅ کد «${v.coupon.code}» ثبت شد و روی سفارش بعدی اعمال می‌شود.`, mainMenuRows());
      }
      if (step === 'ticket') {
        const [first] = text.split('\n');
        const t = await createTicket(ctx.dbUser.id, ctx.session.data!.category, first, text);
        ctx.session.step = undefined;
        return show(ctx, `✅ تیکت #${t.id.slice(-6)} ثبت شد.`, [back('menu:support')]);
      }
      if (step === 'ticket_reply') {
        await userReply(ctx.dbUser.id, ctx.session.data!.ticketId, text);
        ctx.session.step = undefined;
        return show(ctx, '✅ پاسخ شما ثبت شد.', [back('menu:support')]);
      }
    } catch (e) {
      return handleError(ctx, e);
    }
    return next();
  });

  return c;
}

export async function handleError(ctx: Ctx, e: unknown) {
  if (e instanceof AppError) {
    const msg = e.code === 'FORBIDDEN' ? '⛔ دسترسی غیرمجاز.' : e.code === 'NOT_FOUND' ? 'موردی یافت نشد.' : e.message;
    await ctx.reply(msg).catch(() => undefined);
    return;
  }
  logger.error({ err: String((e as any)?.message ?? e) }, 'bot handler error');
  await ctx.reply('⚠️ خطای داخلی. لطفاً دوباره تلاش کنید.').catch(() => undefined);
}
