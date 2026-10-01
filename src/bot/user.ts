import { Composer, InputFile } from 'grammy';
import QRCode from 'qrcode';
import { AppError } from '../utils/errors';
import { listActiveProducts, getProduct } from '../modules/products/service';
import { cancelOrder, createOrder, getOrderForUser, listUserOrders, setOrderServiceName } from '../modules/orders/service';
import { isPaymentMethodEnabled, startPayment, submitReceipt } from '../modules/payments/service';
import { accountSummary } from '../modules/users/service';
import { getServiceForUser, listUserServices, renameService } from '../modules/vpn/service';
import { serviceLabel } from '../utils/names';
import { createTicket, getTicketForUser, listUserTickets, userReply } from '../modules/support/service';
import { validateCoupon } from '../modules/coupons/service';
import { getSetting } from '../modules/settings/service';
import { serviceCard } from '../modules/notifications/templates';
import { Button } from '../modules/notifications/service';
import { Ctx, RULES_HTML, back, mainMenuRows, nav, show } from './ui';
import { CATEGORY_FA, ORDER_STATUS, RULE, SERVICE_STATUS, TICKET_STATUS, b, bar, code, daysLeft, esc, fa, fail, header, i, jdate, jdatetime, money, ok, timeline, wait } from './format';
import { logger } from '../utils/logger';
import { getAdmin } from '../modules/admin/rbac';
import { telegramApiRoot, telegramGet } from './telegramNet';

export type FileFetcher = (ctx: Ctx, fileId: string) => Promise<Buffer>;
export const telegramFileFetcher = (token: string): FileFetcher => async (ctx, fileId) => {
  const f = await ctx.api.getFile(fileId);
  const res = await telegramGet(`${telegramApiRoot()}/file/bot${token}/${f.file_path}`);
  if (res.status !== 200) throw new Error('file download failed');
  return res.body;
};

/** Short status used on list buttons. */
export const orderStatusFa: Record<string, string> = Object.fromEntries(Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label]));
const H = { html: true } as const;

export function userHandlers(fetchFile: FileFetcher) {
  const c = new Composer<Ctx>();

  /** Main menu rows; the management button is rendered ONLY for admins (authorisation is re-checked on every admin callback). */
  const menuRows = async (ctx: Ctx) => mainMenuRows(!!(await getAdmin(BigInt(ctx.from!.id))));

  const mainMenu = async (ctx: Ctx) => {
    ctx.session.step = undefined;
    const name = ctx.dbUser.firstName ? ` ${esc(ctx.dbUser.firstName)}` : '';
    return show(ctx, `👋 سلام${name}، خوش آمدید!\n${RULE}\n🔒 اینترنت آزاد، سریع و امن\n⚡️ تحویل خودکار سرویس بعد از پرداخت\n🎧 پشتیبانی همراه شما\n${RULE}\nیکی از گزینه‌ها را انتخاب کنید 👇`, await menuRows(ctx), H);
  };

  c.command('start', mainMenu);
  c.command('help', async (ctx) => show(ctx, `ℹ️ ${b('راهنما')}\n${RULE}\n/start منوی اصلی\n/services سرویس‌های من\n/orders سفارش‌های من\n/account حساب من\n/support پشتیبانی`, await menuRows(ctx), H));
  c.command('support', (ctx) => supportMenu(ctx));
  c.command('services', (ctx) => servicesList(ctx));
  c.command('orders', (ctx) => ordersList(ctx));
  c.command('account', (ctx) => account(ctx));

  async function account(ctx: Ctx) {
    const s = await accountSummary(ctx.dbUser.id);
    const active = (await listUserServices(ctx.dbUser.id)).filter((x) => x.status === 'ACTIVE').length;
    await show(ctx, [
      header('👤', 'حساب من'),
      `🪪 شناسه: ${code(s.user.telegramId)}`,
      s.user.username ? `🔗 نام کاربری: @${esc(s.user.username)}` : '',
      `📅 عضویت: ${jdate(s.user.createdAt)}`,
      RULE,
      `💳 سفارش‌ها: ${b(fa(s.orders))}`,
      `🟢 سرویس‌های فعال: ${b(fa(active))} از ${fa(s.services)}`,
    ].filter(Boolean).join('\n'), [[{ text: '📦 سرویس‌های من', data: 'menu:services' }, { text: '💳 سفارش‌ها', data: 'menu:orders' }], nav()], H);
  }

  /* ----------------------------- buy flow ----------------------------- */

  async function buyMenu(ctx: Ctx) {
    const ps = await listActiveProducts();
    if (!ps.length) return show(ctx, `${header('🛒', 'خرید VPN')}\n😕 در حال حاضر پلنی برای فروش موجود نیست.\nلطفاً بعداً سر بزنید.`, [nav()], H);
    const cards = ps.map((p, n) => [
      `${fa(n + 1)}️⃣ ${b(p.name)}  ✅ موجود`,
      `   ⏱ ${fa(p.durationDays)} روز  ·  📊 ${fa(p.trafficGB)} GB`,
      `   💰 ${b(money(p.price, p.currency))}`,
      p.description ? `   ${i(p.description)}` : '',
    ].filter(Boolean).join('\n'));
    await show(ctx, `${header('🛒', 'خرید VPN', 'یکی از پلن‌ها را انتخاب کنید')}\n\n${cards.join('\n\n')}`, [
      ...ps.map((p, n): Button[] => [{ text: `🛒 ${fa(n + 1)}) ${p.name} · ${money(p.price, p.currency)}`, data: `buy:${p.id}` }]),
      nav(),
    ], H);
  }

  async function orderSummary(ctx: Ctx, productId: string) {
    const p = await getProduct(productId);
    if (!p.isActive) return show(ctx, fail('این پلن در دسترس نیست', 'لطفاً پلن دیگری انتخاب کنید.'), [back('menu:buy')], H);
    let discount = 0;
    let couponNote = '';
    if (ctx.session.coupon) {
      try {
        discount = (await validateCoupon(ctx.session.coupon, ctx.dbUser.id, p.price)).discount;
        couponNote = `🎁 کد تخفیف ${code(ctx.session.coupon)} اعمال می‌شود`;
      } catch (e) {
        couponNote = `⚠️ ${esc(e instanceof AppError ? e.message : 'کد تخفیف معتبر نیست')} — اعمال نشد`;
        ctx.session.coupon = undefined;
      }
    }
    const methods: Button[][] = (await isPaymentMethodEnabled('CARD_TO_CARD')) ? [[{ text: '💳 پرداخت کارت‌به‌کارت', data: `bo:${p.id}` }]] : [];
    const text = [
      header('🧾', 'خلاصه سفارش', 'مرحله ۱ از ۳ · بررسی'),
      `📦 محصول: ${b(p.name)}`,
      `⏱ مدت: ${fa(p.durationDays)} روز`,
      `📊 حجم: ${fa(p.trafficGB)} GB`,
      RULE,
      `💰 قیمت اصلی: ${money(p.price, p.currency)}`,
      `🎁 تخفیف: ${discount ? money(discount, p.currency) : '—'}`,
      `✅ مبلغ نهایی: ${b(money(p.price - discount, p.currency))}`,
      couponNote ? `\n${couponNote}` : '',
      '',
      methods.length ? `${b('روش پرداخت را انتخاب کنید')} 👇` : fail('در حال حاضر روش پرداختی فعال نیست', 'لطفاً بعداً تلاش کنید یا با پشتیبانی در ارتباط باشید.'),
    ].join('\n');
    await show(ctx, text, [...methods, [{ text: '🎁 ثبت کد تخفیف', data: `uc:${p.id}` }], back('menu:buy')], H);
  }

  async function showPaymentInstructions(ctx: Ctx, orderId: string) {
    const { instructions } = await startPayment(ctx.dbUser.id, orderId);
    const o = await getOrderForUser(ctx.dbUser.id, orderId);
    const extra = (await getSetting('card.instructions')).trim();
    const L = (label: string) => instructions.lines.find((l) => l.label === label)?.value;
    const text = [
      header('💳', 'پرداخت کارت‌به‌کارت', `مرحله ۲ از ۳ · سفارش ${o.orderNumber}`),
      `📦 ${esc(o.product.name)}`,
      `📛 نام سرویس: ${o.serviceName ? b(o.serviceName) : i('خودکار — می‌توانید نام دلخواه بگذارید')}`,
      o.discountAmount ? `🎁 تخفیف: ${money(o.discountAmount, o.currency)}` : '',
      `💰 مبلغ قابل پرداخت: ${b(money(o.finalAmount, o.currency))}`,
      RULE,
      `💳 شماره کارت (برای کپی لمس کنید):\n${code(L('شماره کارت') ?? '')}`,
      L('به نام') ? `👤 به نام: ${b(L('به نام'))}` : '',
      L('بانک') ? `🏦 بانک: ${esc(L('بانک'))}` : '',
      extra ? `\nℹ️ ${esc(extra)}` : '',
      RULE,
      `⚠️ مبلغ را ${b('دقیقاً')} برابر عدد بالا واریز کنید.`,
      `بعد از پرداخت، دکمه «📤 ارسال رسید» را بزنید.`,
    ].filter(Boolean).join('\n');
    await show(ctx, text, orderActions(o), H);
  }

  function orderActions(o: { id: string; status: string }): Button[][] {
    const rows: Button[][] = [];
    if (o.status === 'PENDING_PAYMENT') rows.push([{ text: '📤 ارسال رسید', data: `rc:${o.id}` }], [{ text: '❌ لغو سفارش', data: `oc:${o.id}` }]);
    else if (o.status !== 'CANCELLED' && o.status !== 'REFUNDED') rows.push([{ text: '🔄 به‌روزرسانی وضعیت', data: `ov:${o.id}` }]);
    if (['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_REVIEW', 'PAID'].includes(o.status)) rows.push([{ text: '✏️ نام دلخواه سرویس', data: `nm:o:${o.id}` }]);
    if (o.status === 'FULFILLED') rows.push([{ text: '📦 سرویس‌های من', data: 'menu:services' }]);
    rows.push(nav('menu:orders'));
    return rows;
  }

  /* --------------------------- orders / services --------------------------- */

  async function ordersList(ctx: Ctx) {
    const list = await listUserOrders(ctx.dbUser.id);
    if (!list.length) return show(ctx, `${header('💳', 'سفارش‌های من')}\n📭 هنوز سفارشی ثبت نکرده‌اید.`, [[{ text: '🛒 خرید VPN', data: 'menu:buy' }], nav()], H);
    await show(ctx, `${header('💳', 'سفارش‌های من', 'برای مشاهده جزئیات روی سفارش بزنید')}\n\n` + list.map((o) => `${orderStatusFa[o.status].split(' ')[0]} ${code(o.orderNumber)} · ${esc(o.product.name)}\n    ${money(o.finalAmount, o.currency)} · ${jdate(o.createdAt)}`).join('\n\n'), [
      ...list.map((o): Button[] => [{ text: `${orderStatusFa[o.status].split(' ')[0]} ${o.orderNumber}`, data: `ov:${o.id}` }]),
      nav(),
    ], H);
  }

  async function orderDetail(ctx: Ctx, id: string) {
    const o = await getOrderForUser(ctx.dbUser.id, id);
    if (o.status === 'PENDING_PAYMENT') return await showPaymentInstructions(ctx, o.id);
    const st = ORDER_STATUS[o.status];
    await show(ctx, [
      header('🧾', `سفارش ${o.orderNumber}`),
      timeline(o.status),
      '',
      `${b(st.label)}`,
      st.hint ? i(st.hint) : '',
      RULE,
      `📦 ${esc(o.product.name)}`,
      `💰 مبلغ: ${money(o.finalAmount, o.currency)}${o.discountAmount ? ` (تخفیف ${money(o.discountAmount, o.currency)})` : ''}`,
      `📅 ثبت: ${jdatetime(o.createdAt)}`,
    ].filter((x) => x !== '').join('\n'), orderActions(o), H);
  }

  async function servicesList(ctx: Ctx) {
    const list = await listUserServices(ctx.dbUser.id);
    if (!list.length) return show(ctx, `${header('📦', 'سرویس‌های من')}\n📭 هنوز سرویسی ندارید.\nبا خرید اولین پلن، سرویس شما همین‌جا نمایش داده می‌شود.`, [[{ text: '🛒 خرید VPN', data: 'menu:buy' }], nav()], H);
    const cards = list.map((s) => {
      const left = daysLeft(s.expiresAt);
      const line2 = s.status === 'ACTIVE' ? `${SERVICE_STATUS.ACTIVE} · ${fa(Math.max(left, 0))} روز مانده` : SERVICE_STATUS[s.status];
      const usage = s.lastSyncAt && s.trafficLimit > 0n ? `\n   ${bar(s.trafficUsed, s.trafficLimit)}` : '';
      return `${b(serviceLabel(s.displayName, s.externalId))}\n   ${i(s.product.name)}\n   ${line2} · 📅 ${jdate(s.expiresAt)}${usage}`;
    });
    await show(ctx, `${header('📦', 'سرویس‌های من', `${fa(list.length)} سرویس`)}\n\n${cards.join('\n\n')}`, [
      ...list.map((s): Button[] => [{ text: `${s.status === 'ACTIVE' ? '🟢' : s.status === 'EXPIRED' ? '🔴' : '⏸'} ${serviceLabel(s.displayName, s.externalId)}`, data: `sv:v:${s.id}` }]),
      nav(),
    ], H);
  }

  async function supportMenu(ctx: Ctx) {
    const ts = await listUserTickets(ctx.dbUser.id);
    await show(ctx, `${header('🎫', 'پشتیبانی', 'ما کنار شما هستیم')}\n${ts.length ? `\n${b('تیکت‌های شما')}\n` + ts.map((t) => `${TICKET_STATUS[t.status].split(' ')[0]} ${code('#' + t.id.slice(-6))} ${esc(t.subject.slice(0, 28))}`).join('\n') : '\n📭 هنوز تیکتی ندارید.'}`, [
      [{ text: '➕ تیکت جدید', data: 'tk:new' }],
      ...ts.map((t): Button[] => [{ text: `${TICKET_STATUS[t.status].split(' ')[0]} #${t.id.slice(-6)} ${t.subject.slice(0, 22)}`, data: `tk:v:${t.id}` }]),
      nav(),
    ], H);
  }

  /* ------------------------------- callbacks ------------------------------- */

  c.on('callback_query:data', async (ctx, next) => {
    const d = ctx.callbackQuery.data;
    const [ns, a, b2] = d.split(':');
    try {
      if (ns === 'menu') {
        ctx.session.step = undefined;
        switch (a) {
          case 'main': return await mainMenu(ctx);
          case 'buy': return await buyMenu(ctx);
          case 'services': return await servicesList(ctx);
          case 'orders': return await ordersList(ctx);
          case 'account': return await account(ctx);
          case 'support': return await supportMenu(ctx);
          case 'rules': return show(ctx, RULES_HTML, [nav()], H);
          case 'coupon':
            ctx.session.step = 'coupon';
            return show(ctx, `${header('🎁', 'کد تخفیف')}\nکد تخفیف خود را ارسال کنید.\n${i('کد روی سفارش بعدی شما اعمال می‌شود.')}`, [nav()], H);
        }
      }
      if (ns === 'buy') return await orderSummary(ctx, a);
      if (ns === 'uc') { // coupon entry from the order summary, returns to it afterwards
        ctx.session.step = 'coupon'; ctx.session.data = { returnTo: a };
        return show(ctx, `${header('🎁', 'کد تخفیف')}\nکد تخفیف را ارسال کنید:`, [back(`buy:${a}`)], H);
      }
      if (ns === 'bo') {
        const { order } = await createOrder({ userId: ctx.dbUser.id, productId: a, paymentMethod: 'CARD_TO_CARD', couponCode: ctx.session.coupon }).catch(async (e) => {
          if (ctx.session.coupon && e instanceof AppError) ctx.session.coupon = undefined;
          throw e;
        });
        ctx.session.coupon = undefined;
        return await showPaymentInstructions(ctx, order.id);
      }
      if (ns === 'ov') return await orderDetail(ctx, a);
      if (ns === 'oc') {
        const o = await getOrderForUser(ctx.dbUser.id, a);
        return show(ctx, `⚠️ ${b('لغو سفارش')}\n${RULE}\nسفارش ${code(o.orderNumber)} لغو شود؟\n${i('این کار قابل بازگشت نیست.')}`, [[{ text: '✅ بله، لغو شود', data: `oc2:${a}` }, { text: '↩️ خیر، بازگشت', data: `ov:${a}` }]], H);
      }
      if (ns === 'oc2') {
        await cancelOrder(ctx.dbUser.id, a);
        return show(ctx, `${ok('سفارش لغو شد')}\nهر زمان خواستید می‌توانید دوباره خرید کنید.`, [[{ text: '🛒 خرید VPN', data: 'menu:buy' }], nav('menu:orders')], H);
      }
      if (ns === 'rc') {
        const o = await getOrderForUser(ctx.dbUser.id, a);
        if (o.status !== 'PENDING_PAYMENT') return show(ctx, `${fail('برای این سفارش رسیدی قابل ثبت نیست', 'وضعیت سفارش را بررسی کنید.')}`, [[{ text: '📍 وضعیت سفارش', data: `ov:${a}` }], nav('menu:orders')], H);
        ctx.session.step = 'receipt';
        ctx.session.data = { orderId: a };
        return show(ctx, [header('📤', 'ارسال رسید', 'مرحله ۳ از ۳ · تأیید'), '📸 عکس رسید را ارسال کنید', `${i('بهتر است کد پیگیری را در کپشن بنویسید.')}`, '', 'یا فقط ✍️ کد پیگیری را به‌صورت متن بفرستید.'].join('\n'), [back(`ov:${a}`)], H);
      }
      if (ns === 'rs') { // submit pending photo without tracking code
        const { orderId, fileId } = ctx.session.data ?? {};
        if (ctx.session.step !== 'receipt_track' || orderId !== a) return show(ctx, `${wait('این دکمه منقضی شده است')}`, [nav()], H);
        return await doSubmit(ctx, orderId, { fileId });
      }
      if (ns === 'nm') return await nameCallbacks(ctx, a, b2);
      if (ns === 'sv') return await serviceCallbacks(ctx, a, b2);
      if (ns === 'rn') {
        const { order } = await createOrder({ userId: ctx.dbUser.id, productId: b2, paymentMethod: 'CARD_TO_CARD', renewalOfServiceId: a, couponCode: ctx.session.coupon });
        ctx.session.coupon = undefined;
        return await showPaymentInstructions(ctx, order.id);
      }
      if (ns === 'tk') return await ticketCallbacks(ctx, a, b2);
    } catch (e) {
      return handleError(ctx, e);
    }
    return next();
  });

  async function serviceCallbacks(ctx: Ctx, a: string, id: string) {
    const s = await getServiceForUser(ctx.dbUser.id, id); // ownership enforced for every action
    if (a === 'v') {
      const rows: Button[][] = [];
      let note = '';
      if (s.status === 'ACTIVE') {
        rows.push(
          s.subscriptionUrl
            ? [{ text: '📡 لینک اشتراک', data: `sv:link:${s.id}` }, { text: '⚙️ کانفیگ مستقیم', data: `sv:cfg:${s.id}` }]
            : [{ text: '🔗 لینک', data: `sv:link:${s.id}` }, { text: '⚙️ Config', data: `sv:cfg:${s.id}` }],
          [{ text: '📱 QR', data: `sv:qr:${s.id}` }, { text: '🔄 تمدید', data: `sv:renew:${s.id}` }],
        );
      } else if (s.status === 'EXPIRED') {
        note = `\n${RULE}\n⛔ ${b('این سرویس منقضی شده است')}\nبا تمدید، همان لینک قبلی دوباره فعال می‌شود.`;
        rows.push([{ text: '🔄 تمدید سرویس', data: `sv:renew:${s.id}` }]);
      } else if (s.status === 'SUSPENDED') {
        note = `\n${RULE}\n⏸ ${b('این سرویس موقتاً معلق شده است')}\nبرای اطلاع از دلیل و رفع مشکل با پشتیبانی در ارتباط باشید.`;
        rows.push([{ text: '🎫 تماس با پشتیبانی', data: 'menu:support' }]);
      } else note = `\n${RULE}\n⚫ این سرویس لغو شده است.`;
      if (s.status !== 'CANCELLED') rows.push([{ text: '✏️ نام سرویس', data: `nm:s:${s.id}` }]);
      rows.push(nav('menu:services'));
      return show(ctx, serviceCard(s) + note, rows, H);
    }
    if (a === 'link' || a === 'cfg') {
      if (s.subscriptionUrl && a === 'link') return ctx.reply(`📡 ${b('لینک اشتراک')}\n${code(s.subscriptionUrl)}\n${i('برای کپی روی لینک بزنید.')}`, { parse_mode: 'HTML' });
      if (!s.config) return ctx.reply('⏳ کانفیگ هنوز آماده نیست؛ کمی بعد دوباره تلاش کنید.');
      return ctx.reply(`${a === 'link' ? '🔗' : '⚙️'} ${b(a === 'link' ? 'لینک اتصال' : 'کانفیگ')}\n${code(s.config)}\n${i('برای کپی روی متن بزنید.')}`, { parse_mode: 'HTML' });
    }
    if (a === 'qr') {
      if (!s.config) return ctx.reply('⏳ کانفیگ هنوز آماده نیست؛ کمی بعد دوباره تلاش کنید.');
      const payload = s.subscriptionUrl ?? s.config; // the subscription link is preferred; falls back to the direct config
      const png = await QRCode.toBuffer(payload, { width: 512, margin: 2 });
      return ctx.replyWithPhoto(new InputFile(png, 'qr.png'), { caption: `📱 QR ${s.subscriptionUrl ? 'لینک اشتراک' : 'کانفیگ'} · ${serviceLabel(s.displayName, s.externalId)}\nبا برنامه V2Ray/Hiddify اسکن کنید.` });
    }
    if (a === 'renew') {
      const ps = (await listActiveProducts()).filter((p) => p.xuiInboundId === s.inboundId && p.xuiProviderId === s.provider);
      if (!ps.length) return show(ctx, `${fail('پلن تمدید مناسبی موجود نیست', 'لطفاً با پشتیبانی در ارتباط باشید.')}`, [[{ text: '🎫 پشتیبانی', data: 'menu:support' }], back(`sv:v:${s.id}`)], H);
      return show(ctx, `${header('🔄', 'تمدید سرویس', s.product.name)}\nپلن تمدید را انتخاب کنید:\n${i('زمان و حجم به سرویس فعلی اضافه می‌شود.')}`, [...ps.map((p): Button[] => [{ text: `${p.name} · ${money(p.price, p.currency)}`, data: `rn:${s.id}:${p.id}` }]), back(`sv:v:${s.id}`)], H);
    }
    return undefined;
  }

  const NAME_HINT = `${i('۲ تا ۳۲ حرف؛ فارسی یا انگلیسی، عدد، فاصله و - _ . ( )')}`;
  async function nameCallbacks(ctx: Ctx, a: string, id: string) {
    if (a === 'o' || a === 'oa') { // naming an order's future service
      const o = await getOrderForUser(ctx.dbUser.id, id);
      if (a === 'oa') { await setOrderServiceName(ctx.dbUser.id, id, null); return await orderDetail(ctx, id); }
      ctx.session.step = 'name_order'; ctx.session.data = { orderId: o.id };
      return show(ctx, `${header('✏️', 'نام سرویس')}\nیک نام دلخواه برای سرویس بفرستید تا راحت‌تر پیدایش کنید.\n${NAME_HINT}\n\n📌 یک کد خودکار هم کنار نام شما ثبت می‌شود.`, [[{ text: '⏭ نام خودکار', data: `nm:oa:${o.id}` }], back(`ov:${o.id}`)], H);
    }
    const s = await getServiceForUser(ctx.dbUser.id, id); // ownership
    if (a === 'sa') { await renameService(ctx.dbUser.id, id, null); return await serviceCallbacks(ctx, 'v', id); }
    if (a === 's') {
      ctx.session.step = 'name_service'; ctx.session.data = { serviceId: s.id };
      return show(ctx, `${header('✏️', 'تغییر نام سرویس', serviceLabel(s.displayName, s.externalId))}\nنام جدید را بفرستید.\n${NAME_HINT}\n\n📌 کد خودکار سرویس تغییر نمی‌کند.`, [[{ text: '↩️ بازگشت به نام خودکار', data: `nm:sa:${s.id}` }], back(`sv:v:${s.id}`)], H);
    }
    return undefined;
  }

  async function ticketCallbacks(ctx: Ctx, a: string, id: string) {
    if (a === 'new') return show(ctx, `${header('➕', 'تیکت جدید', 'موضوع را انتخاب کنید')}`, [[{ text: '🛠 مشکل VPN', data: 'tk:c:VPN_ISSUE' }, { text: '💳 مشکل پرداخت', data: 'tk:c:PAYMENT_ISSUE' }], [{ text: '🔄 تمدید', data: 'tk:c:RENEWAL' }, { text: '💬 سایر', data: 'tk:c:OTHER' }], back('menu:support')], H);
    if (a === 'c') {
      ctx.session.step = 'ticket'; ctx.session.data = { category: id };
      return show(ctx, `${header('📝', 'پیام شما', CATEGORY_FA[id] ?? 'سایر')}\nمشکل را کوتاه و واضح بنویسید.\n${i('خط اول به‌عنوان عنوان تیکت ثبت می‌شود.')}`, [back('menu:support')], H);
    }
    if (a === 'v') {
      const t = await getTicketForUser(ctx.dbUser.id, id);
      const chat = t.messages.map((m) => `${m.fromAdmin ? '🧑‍💼 پشتیبان' : '👤 شما'} · ${i(jdatetime(m.createdAt))}\n${esc(m.text)}`).join('\n\n');
      return show(ctx, `${header('🎫', `تیکت #${t.id.slice(-6)}`, `${esc(CATEGORY_FA[t.category])} · ${TICKET_STATUS[t.status]}`)}\n\n${chat}`, [...(t.status !== 'CLOSED' ? [[{ text: '💬 پاسخ', data: `tk:r:${t.id}` }]] : []), nav('menu:support')], H);
    }
    if (a === 'r') {
      await getTicketForUser(ctx.dbUser.id, id);
      ctx.session.step = 'ticket_reply'; ctx.session.data = { ticketId: id };
      return show(ctx, `${header('💬', 'پاسخ به تیکت')}\nپاسخ خود را بنویسید:`, [back(`tk:v:${id}`)], H);
    }
    return undefined;
  }

  async function doSubmit(ctx: Ctx, orderId: string, input: { fileId?: string; caption?: string; trackingCode?: string }) {
    try {
      const image = input.fileId ? await fetchFile(ctx, input.fileId) : undefined;
      await submitReceipt({ userId: ctx.dbUser.id, orderId, fileId: input.fileId, image, caption: input.caption, trackingCode: input.trackingCode });
      ctx.session.step = undefined; ctx.session.data = undefined;
      // the status card (+ delivery when verified) is sent by the notification service
    } catch (e) {
      await handleError(ctx, e, `ov:${orderId}`);
    }
  }

  c.on('message:photo', async (ctx, next) => {
    if (ctx.session.step !== 'receipt' && ctx.session.step !== 'receipt_track') return next();
    const orderId = ctx.session.data?.orderId as string;
    const photo = ctx.message.photo.at(-1)!;
    const caption = ctx.message.caption;
    if (caption) return await doSubmit(ctx, orderId, { fileId: photo.file_id, caption, trackingCode: caption });
    ctx.session.step = 'receipt_track';
    ctx.session.data = { orderId, fileId: photo.file_id };
    await ctx.reply(`📎 ${b('تصویر دریافت شد')}\n${RULE}\n✍️ حالا ${b('کد پیگیری')} را به‌صورت متن بفرستید.\n${i('با کد پیگیری، تأیید سریع‌تر انجام می‌شود.')}`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '⏭ ارسال بدون کد پیگیری', callback_data: `rs:${orderId}` }], [{ text: '⬅️ بازگشت', callback_data: `ov:${orderId}` }]] },
    });
  });

  c.on('message:text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return next();
    const step = ctx.session.step;
    try {
      if (step === 'receipt') return await doSubmit(ctx, ctx.session.data!.orderId, { trackingCode: text, caption: text });
      if (step === 'receipt_track') return await doSubmit(ctx, ctx.session.data!.orderId, { fileId: ctx.session.data!.fileId, trackingCode: text, caption: text });
      if (step === 'name_order') {
        const orderId = ctx.session.data!.orderId as string;
        const name = await setOrderServiceName(ctx.dbUser.id, orderId, text);
        ctx.session.step = undefined; ctx.session.data = undefined;
        await ctx.reply(`${ok('نام سرویس ثبت شد')}\n📛 ${b(name)}`, { parse_mode: 'HTML' });
        return await orderDetail(ctx, orderId);
      }
      if (step === 'name_service') {
        const sid = ctx.session.data!.serviceId as string;
        const svc = await renameService(ctx.dbUser.id, sid, text);
        ctx.session.step = undefined; ctx.session.data = undefined;
        await ctx.reply(`${ok('نام سرویس تغییر کرد')}\n📛 ${b(serviceLabel(svc.displayName, svc.externalId))}`, { parse_mode: 'HTML' });
        return await serviceCallbacks(ctx, 'v', sid);
      }
      if (step === 'coupon') {
        const v = await validateCoupon(text, ctx.dbUser.id, 1_000_000);
        const returnTo = ctx.session.data?.returnTo as string | undefined;
        ctx.session.coupon = v.coupon.code; ctx.session.step = undefined; ctx.session.data = undefined;
        await ctx.reply(`${ok('کد تخفیف ثبت شد')}\n🎁 ${code(v.coupon.code)} روی سفارش بعدی اعمال می‌شود.`, { parse_mode: 'HTML' });
        return returnTo ? orderSummary(ctx, returnTo) : show(ctx, 'ادامه دهید 👇', await menuRows(ctx));
      }
      if (step === 'ticket') {
        const [first] = text.split('\n');
        const t = await createTicket(ctx.dbUser.id, ctx.session.data!.category, first, text);
        ctx.session.step = undefined;
        return show(ctx, `${ok('تیکت شما ثبت شد')}\n🎫 ${code('#' + t.id.slice(-6))}\nپاسخ پشتیبانی همین‌جا برای شما ارسال می‌شود.`, [[{ text: '🎫 تیکت‌های من', data: 'menu:support' }], nav()], H);
      }
      if (step === 'ticket_reply') {
        await userReply(ctx.dbUser.id, ctx.session.data!.ticketId, text);
        ctx.session.step = undefined;
        return show(ctx, `${ok('پاسخ شما ثبت شد')}`, [nav('menu:support')], H);
      }
    } catch (e) {
      return handleError(ctx, e, step === 'coupon' ? 'menu:main' : 'menu:main');
    }
    return next();
  });

  // Fallbacks: the user is never left in a silent dead end.
  c.on('callback_query:data', async (ctx) => show(ctx, `${wait('این دکمه دیگر معتبر نیست', 'منوی اصلی را باز می‌کنیم.')}`, await menuRows(ctx), H));
  c.on('message', async (ctx) => {
    if (ctx.session.step === 'receipt' || ctx.session.step === 'receipt_track') {
      return void (await ctx.reply('📸 لطفاً «عکس رسید» یا «کد پیگیری» را ارسال کنید.'));
    }
    await show(ctx, `🤔 متوجه نشدم.\nلطفاً از منوی زیر استفاده کنید 👇`, await menuRows(ctx));
  });

  return c;
}

export async function handleError(ctx: Ctx, e: unknown, backTo = 'menu:main') {
  const rows = [nav(backTo)];
  const send = (t: string) => ctx.reply(t, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows.map((r) => r.map((b) => ({ text: b.text, callback_data: b.data! }))) } }).catch(() => undefined);
  if (e instanceof AppError) {
    if (e.code === 'FORBIDDEN') return void (await send(fail('دسترسی غیرمجاز')));
    if (e.code === 'NOT_FOUND') return void (await send(fail('موردی یافت نشد')));
    return void (await send(fail(e.message)));
  }
  logger.error({ err: String((e as any)?.message ?? e) }, 'bot handler error');
  await send(fail('خطای موقت', 'لطفاً چند لحظه بعد دوباره تلاش کنید.'));
}
