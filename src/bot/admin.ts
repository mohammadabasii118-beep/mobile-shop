import { Composer } from 'grammy';
import { prisma } from '../db/client';
import { AppError, ForbiddenError } from '../utils/errors';
import { formatMoney, formatBytes } from '../utils/misc';
import { Permission, adminActor, getAdmin, hasPermission, requirePermission } from '../modules/admin/rbac';
import { dashboardStats } from '../modules/admin/stats';
import { PaymentFilter, approvePayment, getPaymentDetail, listPayments, rejectPayment, requestReview } from '../modules/payments/service';
import { createProduct, getProduct, listAllProducts, updateProduct } from '../modules/products/service';
import { createCoupon, listCoupons } from '../modules/coupons/service';
import { adminRenew, deleteService, getServiceAdmin, listServicesAdmin, resumeService, suspendService, syncService } from '../modules/vpn/service';
import { adminRetry } from '../modules/vpn/provisioning';
import { adminReply, closeTicket, listOpenTickets } from '../modules/support/service';
import { SETTING_DEFAULTS, SettingKey, allSettings, getSetting, setSetting } from '../modules/settings/service';
import { audit } from '../modules/admin/audit';
import { getVpnProvider } from '../providers/vpn';
import { serviceSummary } from '../modules/vpn/messages';
import { Button } from '../modules/notifications/service';
import { Ctx, back, show } from './ui';
import { handleError } from './user';
import { createLoginToken, loginUrl, panelEnabled } from '../admin-web/auth';

const actor = (ctx: Ctx) => adminActor(BigInt(ctx.from!.id));
async function need(ctx: Ctx, perm: Permission) {
  return requirePermission(BigInt(ctx.from!.id), perm);
}
const fmtDt = (d?: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) + 'Z' : '-');
const PAGE = 8;

export function adminHandlers() {
  const c = new Composer<Ctx>();

  async function panel(ctx: Ctx) {
    const a = await getAdmin(BigInt(ctx.from!.id));
    if (!a) throw new ForbiddenError();
    ctx.session.step = undefined;
    const rows: Button[][] = [];
    const add = async (perm: Permission, btn: Button) => { if (await hasPermission(BigInt(ctx.from!.id), perm)) rows.push([btn]); };
    await add('stats.view', { text: '📊 داشبورد', data: 'adm:dash' });
    await add('payments.view', { text: '💳 پرداخت‌ها', data: 'adm:pays' });
    await add('vpn.view', { text: '🛰 سرویس‌های VPN', data: 'vl:0' });
    await add('products.manage', { text: '📦 محصولات', data: 'adm:products' });
    await add('products.manage', { text: '🎁 کدهای تخفیف', data: 'adm:coupons' });
    await add('users.view', { text: '👥 کاربران / سفارش‌ها', data: 'adm:orders' });
    await add('support.reply', { text: '🎫 پشتیبانی', data: 'adm:tickets' });
    await add('settings.manage', { text: '⚙️ تنظیمات', data: 'adm:settings' });
    await add('audit.view', { text: '🧾 Audit Log', data: 'adm:audit' });
    rows.push([{ text: '🏠 منوی کاربر', data: 'menu:main' }]);
    await show(ctx, `🛠 پنل مدیریت (${a.role})`, rows);
  }

  async function dashboard(ctx: Ctx) {
    await need(ctx, 'stats.view');
    const s = await dashboardStats();
    await show(ctx, [
      '📊 داشبورد', '',
      `👥 کاربران: ${s.users}`, `🧾 سفارش‌ها: ${s.orders}`, `💰 درآمد: ${formatMoney(s.revenue)}`,
      `⏳ پرداخت‌های در انتظار: ${s.pendingPayments}`, `🤖 تأیید خودکار: ${s.autoApproved}`, `🔎 صف بررسی دستی: ${s.needsReview}`,
      `🟢 VPN فعال: ${s.activeVpn}`, `🔴 VPN منقضی: ${s.expiredVpn}`, `⚠️ خطای provisioning: ${s.provisioningErrors}`, `🎫 تیکت باز: ${s.openTickets}`,
    ].join('\n'), [back('adm:home')]);
  }

  const FILTERS: [PaymentFilter, string][] = [['review', '🔎 نیازمند بررسی'], ['submitted', '📤 ارسال‌شده'], ['auto', '🤖 تأیید خودکار'], ['approved', '✅ تأییدشده'], ['rejected', '❌ ردشده'], ['pending', '⏳ در انتظار']];

  async function paymentList(ctx: Ctx, f: PaymentFilter, page: number) {
    await need(ctx, 'payments.view');
    const list = await listPayments(f, page * PAGE, PAGE + 1);
    const rows: Button[][] = list.slice(0, PAGE).map((p) => [{ text: `${p.order.orderNumber} · ${formatMoney(p.amount)} · ${p.riskLevel ?? '-'}`, data: `ap:v:${p.id}` }]);
    const nav: Button[] = [];
    if (page > 0) nav.push({ text: '◀️', data: `pl:${f}:${page - 1}` });
    if (list.length > PAGE) nav.push({ text: '▶️', data: `pl:${f}:${page + 1}` });
    if (nav.length) rows.push(nav);
    rows.push(back('adm:pays'));
    await show(ctx, `💳 پرداخت‌ها — ${FILTERS.find((x) => x[0] === f)![1]}${list.length ? '' : '\n\nموردی نیست.'}`, rows);
  }

  async function paymentView(ctx: Ctx, id: string) {
    await need(ctx, 'payments.view');
    const p = await getPaymentDetail(id);
    const rd = (p.receiptData ?? {}) as any;
    const risk = ((p.riskFactors ?? []) as any[]).map((f) => `${f.code}(${f.points})`).join(', ') || '-';
    const text = [
      `💳 پرداخت ${p.id.slice(-8)}`,
      `کاربر: ${p.user.firstName ?? ''} @${p.user.username ?? '-'} (${p.user.telegramId})`,
      `سفارش: ${p.order.orderNumber} — ${p.order.product.name}`,
      `مبلغ سفارش: ${formatMoney(p.amount)}`,
      `کد پیگیری: ${p.trackingCode ?? '-'}`,
      `OCR: مبلغ=${rd.amount ?? '-'} پیگیری=${rd.trackingCode ?? '-'} تاریخ=${rd.date ?? '-'} ${rd.time ?? ''} بانک=${rd.bank ?? '-'} اطمینان=${rd.confidence ?? '-'} (${rd.source ?? 'none'})`,
      `نتیجه تأیید: ${p.verificationStatus ?? '-'}${p.verifications.at(-1)?.reason ? ` — ${p.verifications.at(-1)!.reason}` : ''}`,
      `ریسک: ${p.riskLevel ?? '-'} (${p.riskScore ?? '-'}) ${risk}`,
      `وضعیت: ${p.status}${p.autoApproved ? ' (🤖 خودکار)' : ''}`,
      `تاریخ ارسال: ${fmtDt(p.submittedAt)}`,
      p.reviewedBy ? `بررسی‌کننده: ${p.reviewedBy} — ${fmtDt(p.reviewedAt)}` : '',
      p.rejectionReason ? `دلیل رد: ${p.rejectionReason}` : '',
      p.bankTx ? `تراکنش بانکی: ${p.bankTx.trackingCode ?? '-'} / ${p.bankTx.amount}` : '',
      p.order.service ? `سرویس VPN: ${p.order.service.provisioningStatus} / ${p.order.service.status}` : '',
    ].filter(Boolean).join('\n');
    const rows: Button[][] = [];
    if (p.receiptFileId) rows.push([{ text: '🖼 مشاهده رسید', data: `ap:img:${id}` }]);
    if ((p.status === 'SUBMITTED' || p.status === 'NEEDS_REVIEW') && (await hasPermission(BigInt(ctx.from!.id), 'payments.review'))) {
      rows.push([{ text: '✅ تأیید', data: `ap:ok:${id}` }, { text: '❌ رد', data: `ap:no:${id}` }]);
      if (p.status === 'SUBMITTED') rows.push([{ text: '🔎 درخواست بررسی', data: `ap:rv:${id}` }]);
    }
    rows.push(back('adm:pays'));
    await show(ctx, text, rows);
  }

  async function serviceView(ctx: Ctx, id: string) {
    await need(ctx, 'vpn.view');
    const s = await getServiceAdmin(id);
    const t = await prisma.provisioningTask.findUnique({ where: { orderId: s.orderId } });
    const text = `${serviceSummary(s)}\n\nکاربر: ${s.user.telegramId}\nclient: ${s.externalId}\ninbound: ${s.inboundId}\nprovisioning: ${s.provisioningStatus}${t?.lastError ? `\nخطا: ${t.lastError}` : ''}\nآخرین sync: ${fmtDt(s.lastSyncAt)}`;
    const rows: Button[][] = [[{ text: '🔄 Sync', data: `av:sync:${id}` }, { text: '🔁 Retry', data: `av:retry:${s.orderId}` }]];
    if (await hasPermission(BigInt(ctx.from!.id), 'vpn.manage')) rows.push([{ text: '⏸ Suspend', data: `av:sus:${id}` }, { text: '▶️ Resume', data: `av:res:${id}` }], [{ text: '➕ تمدید (ادمین)', data: `av:rn:${id}` }]);
    if (await hasPermission(BigInt(ctx.from!.id), 'vpn.delete')) rows.push([{ text: '🗑 حذف', data: `av:del:${id}` }]);
    rows.push(back('vl:0'));
    await show(ctx, text, rows);
  }

  c.command('admin', async (ctx) => { try { await panel(ctx); } catch (e) { await handleError(ctx, e); } });
  c.command('panel', async (ctx) => {
    try {
      if (!(await getAdmin(BigInt(ctx.from!.id)))) throw new ForbiddenError();
      if (!panelEnabled()) return void (await ctx.reply('پنل وب پیکربندی نشده است (PANEL_SESSION_SECRET).'));
      const url = loginUrl(createLoginToken(BigInt(ctx.from!.id)));
      await audit({ actor: actor(ctx), action: 'admin.panel_link' });
      await ctx.reply(`🖥 ورود به پنل مدیریت\n\nاین لینک یک‌بارمصرف است و ۵ دقیقه اعتبار دارد:\n${url}`, { link_preview_options: { is_disabled: true } });
    } catch (e) { await handleError(ctx, e); }
  });
  c.command('stats', async (ctx) => { try { await dashboard(ctx); } catch (e) { await handleError(ctx, e); } });
  c.command('payments', async (ctx) => { try { await paymentList(ctx, 'review', 0); } catch (e) { await handleError(ctx, e); } });
  c.command('services', async (ctx, next) => {
    if (!(await getAdmin(BigInt(ctx.from!.id)))) return next(); // regular users: user /services handler
    try { await need(ctx, 'vpn.view'); await adminServiceList(ctx, 0); } catch (e) { await handleError(ctx, e); }
  });

  async function adminServiceList(ctx: Ctx, page: number) {
    const list = await listServicesAdmin(page * PAGE, PAGE + 1);
    const rows: Button[][] = list.slice(0, PAGE).map((s) => [{ text: `${s.user.telegramId} · ${s.product.name} · ${s.provisioningStatus === 'SUCCESS' ? s.status : '⚠️' + s.provisioningStatus}`, data: `av:v:${s.id}` }]);
    const nav: Button[] = [];
    if (page > 0) nav.push({ text: '◀️', data: `vl:${page - 1}` });
    if (list.length > PAGE) nav.push({ text: '▶️', data: `vl:${page + 1}` });
    if (nav.length) rows.push(nav);
    rows.push(back('adm:home'));
    await show(ctx, '🛰 سرویس‌های VPN', rows);
  }

  const toggleKeys: SettingKey[] = ['card.enabled', 'verification.mode', 'verification.allowReceiptOnlyAutoApprove', 'risk.highAction'];
  const editKeys: SettingKey[] = ['card.holder', 'card.number', 'card.bank', 'card.instructions', 'risk.mediumAt', 'risk.highAt', 'provisioning.maxRetries', 'notify.expiryDays', 'verification.provider'];
  const TOGGLE: Record<string, [string, string]> = { 'verification.mode': ['AUTO_VERIFICATION', 'MANUAL_REVIEW'], 'risk.highAction': ['MANUAL_REVIEW', 'REJECT'] };

  async function settingsView(ctx: Ctx) {
    await need(ctx, 'settings.manage');
    const s = await allSettings();
    const mask = (k: string, v: string) => (k === 'card.number' && v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-4)}` : v || '-');
    const text = ['⚙️ تنظیمات', '', ...Object.entries(s).filter(([k]) => [...toggleKeys, ...editKeys].includes(k as SettingKey)).map(([k, v]) => `${k} = ${mask(k, v)}`), '', 'اعتبارنامه‌های X-UI فقط در env سرور نگه‌داری می‌شوند.'].join('\n');
    await show(ctx, text, [
      ...toggleKeys.map((k): Button[] => [{ text: `🔀 ${k}`, data: `st:t:${k}` }]),
      ...editKeys.map((k): Button[] => [{ text: `✏️ ${k}`, data: `st:e:${k}` }]),
      [{ text: '🔌 تست اتصال X-UI', data: 'st:xui' }],
      back('adm:home'),
    ]);
  }

  c.on('callback_query:data', async (ctx, next) => {
    const d = ctx.callbackQuery.data;
    const [ns, a, b] = d.split(':');
    const adminNs = ['adm', 'pl', 'ap', 'av', 'vl', 'pr', 'cp', 'st', 'at', 'ao'];
    if (!adminNs.includes(ns)) return next();
    try {
      // every admin callback re-checks authorization server-side (callback data is untrusted)
      if (!(await getAdmin(BigInt(ctx.from!.id)))) throw new ForbiddenError();
      if (ns === 'adm') {
        switch (a) {
          case 'home': return panel(ctx);
          case 'dash': return dashboard(ctx);
          case 'pays': await need(ctx, 'payments.view'); return show(ctx, '💳 پرداخت‌ها', [...FILTERS.map(([f, t]): Button[] => [{ text: t, data: `pl:${f}:0` }]), back('adm:home')]);
          case 'products': {
            await need(ctx, 'products.manage');
            const ps = await listAllProducts();
            return show(ctx, '📦 محصولات', [[{ text: '➕ محصول جدید', data: 'pr:new' }], ...ps.map((p): Button[] => [{ text: `${p.isActive ? '🟢' : '⚪'} ${p.name} · ${p.price}`, data: `pr:v:${p.id}` }]), back('adm:home')]);
          }
          case 'coupons': {
            await need(ctx, 'coupons.manage');
            const cs = await listCoupons();
            return show(ctx, `🎁 کدهای تخفیف\n\n${cs.map((x) => `${x.code} ${x.type === 'PERCENT' ? x.value + '%' : x.value} (${x.usedCount}/${x.maxUses ?? '∞'})`).join('\n') || '—'}`, [[{ text: '➕ کد جدید', data: 'cp:new' }], back('adm:home')]);
          }
          case 'orders': {
            await need(ctx, 'users.view');
            const os = await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 12, include: { user: true } });
            return show(ctx, `🧾 آخرین سفارش‌ها\n\n${os.map((o) => `${o.orderNumber} · ${o.user.telegramId} · ${o.finalAmount} · ${o.status}`).join('\n') || '—'}`, [back('adm:home')]);
          }
          case 'tickets': {
            await need(ctx, 'support.reply');
            const ts = await listOpenTickets();
            return show(ctx, '🎫 تیکت‌های باز', [...ts.map((t): Button[] => [{ text: `#${t.id.slice(-6)} ${t.subject.slice(0, 24)} · ${t.status}`, data: `at:v:${t.id}` }]), back('adm:home')]);
          }
          case 'settings': return settingsView(ctx);
          case 'audit': {
            await need(ctx, 'audit.view');
            const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 15 });
            return show(ctx, `🧾 Audit Log\n\n${logs.map((l) => `${fmtDt(l.createdAt)} ${l.actor} ${l.action} ${l.targetId?.slice(-6) ?? ''}`).join('\n')}`, [back('adm:home')]);
          }
        }
      }
      if (ns === 'pl') return paymentList(ctx, a as PaymentFilter, Number(b ?? 0));
      if (ns === 'ap') {
        const id = b;
        if (a === 'v') return paymentView(ctx, id);
        if (a === 'img') {
          await need(ctx, 'payments.view');
          const p = await prisma.payment.findUniqueOrThrow({ where: { id } });
          if (!p.receiptFileId) return;
          return ctx.replyWithPhoto(p.receiptFileId);
        }
        await need(ctx, 'payments.review');
        if (a === 'ok') return show(ctx, '⚠️ تأیید این پرداخت و ساخت سرویس؟', [[{ text: '✅ بله، تأیید', data: `ap:ok2:${id}` }], back(`ap:v:${id}`)]);
        if (a === 'ok2') {
          const r = await approvePayment(id, { actor: actor(ctx) });
          await ctx.reply(r.changed ? '✅ تأیید شد.' : 'ℹ️ این پرداخت قبلاً پردازش شده است (تغییری اعمال نشد).');
          return paymentView(ctx, id);
        }
        if (a === 'no') { ctx.session.step = 'a_reject'; ctx.session.data = { id }; return show(ctx, 'دلیل رد پرداخت را بنویسید:', [back(`ap:v:${id}`)]); }
        if (a === 'rv') { await requestReview(id, actor(ctx)); return paymentView(ctx, id); }
      }
      if (ns === 'vl') { await need(ctx, 'vpn.view'); return adminServiceList(ctx, Number(a)); }
      if (ns === 'av') {
        if (a === 'v') return serviceView(ctx, b);
        if (a === 'retry') {
          await need(ctx, 'vpn.manage');
          const r = await adminRetry(b, actor(ctx));
          return ctx.reply(r === 'done' ? '✅ سرویس ساخته شد.' : r === 'failed' ? '⚠️ تلاش مجدد ناموفق بود (جزئیات در لاگ/Audit).' : 'ℹ️ در حال پردازش یا قبلاً انجام شده.');
        }
        if (a === 'sync') { await need(ctx, 'vpn.view'); const s = await syncService(b); await ctx.reply(s ? `🔄 sync شد. مصرف: ${formatBytes(s.trafficUsed)}` : '⚠️ سرویس در پنل پیدا نشد.'); return serviceView(ctx, b); }
        await need(ctx, 'vpn.manage');
        if (a === 'sus') { await suspendService(b, actor(ctx)); return serviceView(ctx, b); }
        if (a === 'res') { await resumeService(b, actor(ctx)); return serviceView(ctx, b); }
        if (a === 'rn') {
          const s = await getServiceAdmin(b);
          const ps = (await listAllProducts()).filter((p) => p.xuiInboundId === s.inboundId && p.xuiProviderId === s.provider);
          return show(ctx, 'پلن تمدید (رایگان، توسط ادمین):', [...ps.map((p): Button[] => [{ text: p.name, data: `av:rn2:${b}:${p.id}` }]), back(`av:v:${b}`)]);
        }
        if (a === 'rn2') { await adminRenew(b, d.split(':')[3], actor(ctx)); return serviceView(ctx, b); }
        if (a === 'del') {
          await need(ctx, 'vpn.delete');
          const s = await getServiceAdmin(b);
          ctx.session.step = 'a_delete'; ctx.session.data = { id: b, code: s.externalId.slice(-6) };
          return show(ctx, `🗑 حذف دائمی Client از X-UI\n${s.externalId}\n\nبرای تأیید، عبارت زیر را دقیقاً تایپ کنید:\nDELETE ${s.externalId.slice(-6)}`, [back(`av:v:${b}`)]);
        }
      }
      if (ns === 'pr') {
        await need(ctx, 'products.manage');
        if (a === 'new') { ctx.session.step = 'a_product'; return show(ctx, 'فرمت: نام|روز|حجم GB|قیمت|inboundId|پروتکل(VLESS/VMESS/TROJAN)\nمثال:\n50GB یک‌ماهه|30|50|250000|1|VLESS', [back('adm:products')]); }
        if (a === 'v') {
          const p = await getProduct(b);
          return show(ctx, `📦 ${p.name}\n${p.durationDays} روز / ${p.trafficGB}GB\nقیمت: ${p.price}\ninbound: ${p.xuiInboundId} ${p.protocol}\nفعال: ${p.isActive}`, [[{ text: p.isActive ? '⏸ غیرفعال' : '▶️ فعال', data: `pr:tg:${p.id}` }, { text: '💰 تغییر قیمت', data: `pr:pc:${p.id}` }], back('adm:products')]);
        }
        if (a === 'tg') { const p = await getProduct(b); await updateProduct(actor(ctx), b, { isActive: !p.isActive }); return ctx.reply('✅ انجام شد.'); }
        if (a === 'pc') { ctx.session.step = 'a_price'; ctx.session.data = { id: b }; return show(ctx, 'قیمت جدید (عدد):', [back(`pr:v:${b}`)]); }
      }
      if (ns === 'cp') {
        await need(ctx, 'coupons.manage');
        ctx.session.step = 'a_coupon';
        return show(ctx, 'فرمت: کد|PERCENT یا FIXED|مقدار|حداکثر استفاده|روز اعتبار\nمثال: OFF10|PERCENT|10|100|30', [back('adm:coupons')]);
      }
      if (ns === 'st') {
        await need(ctx, 'settings.manage');
        if (a === 't') {
          const k = b as SettingKey;
          if (!toggleKeys.includes(k)) throw new AppError('VALIDATION', 'invalid key');
          const cur = await getSetting(k);
          const nextV = TOGGLE[k] ? (cur === TOGGLE[k][0] ? TOGGLE[k][1] : TOGGLE[k][0]) : String(cur !== 'true');
          await setSetting(k, nextV);
          await audit({ actor: actor(ctx), action: 'setting.change', target: 'Setting', targetId: k, metadata: { value: nextV } });
          return settingsView(ctx);
        }
        if (a === 'e') {
          if (!editKeys.includes(b as SettingKey)) throw new AppError('VALIDATION', 'invalid key');
          ctx.session.step = 'a_setting'; ctx.session.data = { key: b };
          return show(ctx, `مقدار جدید برای ${b}:`, [back('adm:settings')]);
        }
        if (a === 'xui') {
          const h = await getVpnProvider().healthCheck();
          return show(ctx, `🔌 X-UI\nProvider: ${getVpnProvider().name}\nوضعیت: ${h.ok ? '🟢 متصل' : '🔴 خطا'}\n${h.detail}\nDefault inbound: ${(await getSetting('xui.defaultInboundId')) || '-'}`, [back('adm:settings')]);
        }
      }
      if (ns === 'at') {
        await need(ctx, 'support.reply');
        if (a === 'v') {
          const t = await prisma.ticket.findUniqueOrThrow({ where: { id: b }, include: { messages: { orderBy: { createdAt: 'asc' } }, user: true } });
          return show(ctx, `🎫 #${t.id.slice(-6)} ${t.subject}\nکاربر: ${t.user.telegramId}\n\n${t.messages.map((m) => `${m.fromAdmin ? '🧑‍💼' : '👤'} ${m.text}`).join('\n\n')}`, [[{ text: '💬 پاسخ', data: `at:r:${b}` }, { text: '🔒 بستن', data: `at:c:${b}` }], back('adm:tickets')]);
        }
        if (a === 'r') { ctx.session.step = 'a_ticket'; ctx.session.data = { id: b }; return show(ctx, 'متن پاسخ:', [back(`at:v:${b}`)]); }
        if (a === 'c') { await closeTicket(actor(ctx), b); return ctx.reply('🔒 بسته شد.'); }
      }
    } catch (e) {
      return handleError(ctx, e);
    }
    return next();
  });

  // Admin text-input steps (wizard). Step names are admin-only; each re-checks permission.
  c.on('message:text', async (ctx, next) => {
    const step = ctx.session.step;
    if (!step?.startsWith('a_')) return next();
    const text = ctx.message.text.trim();
    const data = ctx.session.data ?? {};
    try {
      if (!(await getAdmin(BigInt(ctx.from.id)))) throw new ForbiddenError();
      if (step === 'a_reject') {
        await need(ctx, 'payments.review');
        const r = await rejectPayment(data.id, { actor: actor(ctx), reason: text });
        ctx.session.step = undefined;
        await ctx.reply(r.changed ? '✅ رد شد.' : 'ℹ️ قبلاً پردازش شده است.');
        return paymentView(ctx, data.id);
      }
      if (step === 'a_delete') {
        await need(ctx, 'vpn.delete');
        ctx.session.step = undefined;
        if (text !== `DELETE ${data.code}`) return void (await ctx.reply('❌ عبارت تأیید اشتباه بود؛ حذف انجام نشد.'));
        await deleteService(data.id, actor(ctx));
        return void (await ctx.reply('🗑 حذف شد.'));
      }
      if (step === 'a_product') {
        await need(ctx, 'products.manage');
        const [name, days, gb, price, inbound, proto] = text.split('|').map((x) => x.trim());
        const p = await createProduct(actor(ctx), { name, durationDays: Number(days), trafficGB: Number(gb), price: Number(price), xuiInboundId: Number(inbound), protocol: (proto || 'VLESS').toUpperCase() as any });
        ctx.session.step = undefined;
        return void (await ctx.reply(`✅ محصول «${p.name}» ساخته شد.`));
      }
      if (step === 'a_price') {
        await need(ctx, 'products.manage');
        await updateProduct(actor(ctx), data.id, { price: Number(text) });
        ctx.session.step = undefined;
        return void (await ctx.reply('✅ قیمت تغییر کرد.'));
      }
      if (step === 'a_coupon') {
        await need(ctx, 'coupons.manage');
        const [code, type, value, max, days] = text.split('|').map((x) => x.trim());
        await createCoupon(actor(ctx), { code, type: type.toUpperCase() as any, value: Number(value), maxUses: max ? Number(max) : undefined, expiresAt: days ? new Date(Date.now() + Number(days) * 86_400_000) : undefined });
        ctx.session.step = undefined;
        return void (await ctx.reply('✅ کد ساخته شد.'));
      }
      if (step === 'a_setting') {
        await need(ctx, 'settings.manage');
        if (!(data.key in SETTING_DEFAULTS)) throw new AppError('VALIDATION', 'invalid key');
        await setSetting(data.key, text);
        await audit({ actor: actor(ctx), action: 'setting.change', target: 'Setting', targetId: data.key, metadata: { value: data.key === 'card.number' ? '[card]' : text } });
        ctx.session.step = undefined;
        return void (await ctx.reply('✅ ذخیره شد.'));
      }
      if (step === 'a_ticket') {
        await need(ctx, 'support.reply');
        await adminReply(BigInt(ctx.from.id), data.id, text);
        ctx.session.step = undefined;
        return void (await ctx.reply('✅ ارسال شد.'));
      }
    } catch (e) {
      ctx.session.step = undefined;
      return handleError(ctx, e);
    }
    return next();
  });

  return c;
}
