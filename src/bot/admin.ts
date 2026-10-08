import { Composer } from 'grammy';
import { prisma } from '../db/client';
import { AppError, ForbiddenError } from '../utils/errors';
import { formatMoney, formatBytes } from '../utils/misc';
import { Permission, adminActor, getAdmin, hasPermission, requirePermission } from '../modules/admin/rbac';
import { dashboardStats } from '../modules/admin/stats';
import { PaymentFilter, approvePayment, getPaymentDetail, listPayments, rejectPayment, requestReview } from '../modules/payments/service';
import { PRODUCT_FIELDS, createProduct, createProductsBulk, deleteProduct, getProduct, isProductField, listAllProducts, parseProductField, updateProduct } from '../modules/products/service';
import { createCoupon, listCoupons } from '../modules/coupons/service';
import { adminRenew, deleteService, getServiceAdmin, listServicesAdmin, resumeService, suspendService, syncService } from '../modules/vpn/service';
import { adminRetry } from '../modules/vpn/provisioning';
import { adminReply, closeTicket, listOpenTickets } from '../modules/support/service';
import { SETTING_DEFAULTS, SettingKey, allSettings, getSetting, setSetting } from '../modules/settings/service';
import { audit } from '../modules/admin/audit';
import { PARTNER_STATUS_FA, PartnerFilter, validatePartnerSetting, approvePartner, getPartnerById, listPartners, partnerCounts, partnerLabel, partnerStats, rejectPartner, setPartnerPercent, setPartnerSuspended } from '../modules/partners/service';
import { addChannel, deleteChannel, listChannels, setChannelActive, testChannel } from '../modules/channels/service';
import { isTextKey, listTexts, previewText, resetText, setText, textDef } from '../modules/texts/service';
import { categoryTree, createCategory, deleteCategory, getCategory, moveCategory, setProductCategory, splitIconName, updateCategory } from '../modules/categories/service';
import { PanelView, createPanel, deletePanel, getPanel, isSupportedProtocol, listPanelInbounds, listPanels, panelHealth, parsePanelText, setPanelActive, testPanel, updatePanel } from '../modules/panels/service';
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

  /** The admin menu is grouped: related tools live together; groups/items the admin has no permission for are hidden. */
  const GROUPS: { id: string; title: string; hint: string; items: [Permission, string, string][] }[] = [
    { id: 'fin', title: '💰 فروش و مالی', hint: 'پرداخت‌ها، سفارش‌ها، کدهای تخفیف و همکاران', items: [['payments.view', '💳 پرداخت‌ها', 'adm:pays'], ['users.view', '🧾 سفارش‌ها و کاربران', 'adm:orders'], ['coupons.manage', '🎁 کدهای تخفیف', 'adm:coupons'], ['partners.manage', '🤝 همکاری‌ها', 'pa:h']] },
    { id: 'cat', title: '📦 محصولات و منوی خرید', hint: 'پلن‌های قابل فروش و دسته‌بندی منو', items: [['products.manage', '📦 محصولات', 'adm:products'], ['products.manage', '🗂 دسته‌بندی منوی خرید', 'ct:l:root']] },
    { id: 'srv', title: '🛰 سرویس‌ها و سرورها', hint: 'سرویس‌های مشتریان و پنل‌های X-UI', items: [['vpn.view', '🛰 سرویس‌های VPN', 'vl:0'], ['panels.manage', '🖥 پنل‌ها و inboundها', 'pn:l']] },
    { id: 'set', title: '⚙️ تنظیمات و ابزارها', hint: 'متن‌ها، کانال‌های اجباری، تنظیمات و گزارش تغییرات', items: [['texts.manage', '✏️ ویرایش متن‌های ربات', 'tx:l'], ['settings.manage', '📢 کانال‌های اجباری', 'ch:l'], ['settings.manage', '⚙️ تنظیمات', 'adm:settings'], ['audit.view', '🧾 Audit Log', 'adm:audit']] },
  ];

  async function visibleItems(ctx: Ctx, g: (typeof GROUPS)[number]) {
    const out: Button[][] = [];
    for (const [perm, text, data] of g.items) if (await hasPermission(BigInt(ctx.from!.id), perm)) out.push([{ text, data }]);
    return out;
  }

  async function groupView(ctx: Ctx, id: string) {
    const g = GROUPS.find((x) => x.id === id);
    if (!g) throw new AppError('VALIDATION', 'بخش نامعتبر');
    const rows = await visibleItems(ctx, g);
    if (!rows.length) throw new ForbiddenError();
    ctx.session.step = undefined;
    await show(ctx, `${g.title}\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n${g.hint}`, [...rows, back('adm:home')]);
  }

  async function panel(ctx: Ctx) {
    const a = await getAdmin(BigInt(ctx.from!.id));
    if (!a) throw new ForbiddenError();
    ctx.session.step = undefined;
    const rows: Button[][] = [];
    if (await hasPermission(BigInt(ctx.from!.id), 'stats.view')) rows.push([{ text: '📊 داشبورد', data: 'adm:dash' }]);
    for (const g of GROUPS) if ((await visibleItems(ctx, g)).length) rows.push([{ text: g.title, data: `adm:g:${g.id}` }]);
    if (await hasPermission(BigInt(ctx.from!.id), 'support.reply')) rows.push([{ text: '🎫 پشتیبانی', data: 'adm:tickets' }]);
    if (panelEnabled()) rows.push([{ text: '🖥 ورود به پنل وب', data: 'adm:web' }]);
    rows.push([{ text: '🏠 منوی کاربر', data: 'menu:main' }]);
    await show(ctx, `🛠 پنل مدیریت (${a.role})\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\nیک بخش را انتخاب کنید:`, rows);
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

  const PROTO_ENUM: Record<string, string> = { vless: 'VLESS', vmess: 'VMESS', trojan: 'TROJAN', shadowsocks: 'SHADOWSOCKS' };
  const ibLabel = (i: { id: number; remark?: string; protocol: string; port: number; enable: boolean }) => `${i.enable ? '' : '⛔ '}#${i.id} ${i.remark || '—'} · ${i.protocol}:${i.port}`;

  async function panelsList(ctx: Ctx) {
    const ps = await listPanels();
    const rows = ps.map((p): Button[] => {
      const h = panelHealth.get(p.code);
      return [{ text: `${!p.isActive ? '⚪' : h ? (h.ok ? '🟢' : '🔴') : '🖥'} ${p.name} · ${p.code}`, data: `pn:v:${p.code}` }];
    });
    await show(ctx, `🖥 پنل‌های X-UI\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\nهر محصول به یک پنل و یک inbound وصل می‌شود؛ پس می‌توانید چند سرور داشته باشید و روی هر کدام محصول جدا بفروشید.${ps.length ? '' : '\n\nهنوز پنلی ثبت نشده است.'}`, [...rows, [{ text: '➕ افزودن پنل', data: 'pn:new' }], back('adm:g:srv')]);
  }

  function panelText(p: PanelView) {
    const h = panelHealth.get(p.code);
    return [
      `🖥 ${p.name}  (${p.code})`, '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
      `🌐 ${p.baseUrl}`,
      `🔐 ورود: ${p.auth === 'token' ? 'توکن API' : p.auth === 'password' ? 'کاربر و رمز' : 'تنظیم نشده'}${p.tlsInsecure ? ' · گواهی خودامضا مجاز' : ''}`,
      p.subBaseUrl ? `📡 ساب: ${p.subBaseUrl}` : '📡 ساب: —  (مشتری کانفیگ مستقیم می‌گیرد)',
      p.publicHost ? `🏷 هاست لینک‌ها: ${p.publicHost}` : '',
      `وضعیت: ${!p.isActive ? '⚪ غیرفعال' : h ? (h.ok ? `🟢 متصل (${h.ms}ms)` : `🔴 ${h.detail}`) : '— (تست نشده)'}`,
      `📦 محصول: ${p.products} · 🛰 سرویس: ${p.services}`,
      p.source === 'env' ? '\nℹ️ این پنل از تنظیمات سرور (.env) خوانده می‌شود و از اینجا قابل ویرایش/حذف نیست.' : '',
    ].filter(Boolean).join('\n');
  }

  async function panelView(ctx: Ctx, code: string) {
    const p = await getPanel(code);
    const rows: Button[][] = [[{ text: '🔌 تست اتصال', data: `pn:t:${code}` }, { text: '📋 inboundها', data: `pn:i:${code}` }]];
    if (p.source === 'db') rows.push([{ text: '✏️ ویرایش', data: `pn:e:${code}` }, { text: p.isActive ? '⏸ غیرفعال' : '▶️ فعال', data: `pn:tg:${code}` }], [{ text: '🗑 حذف', data: `pn:d:${code}` }]);
    rows.push(back('pn:l'));
    await show(ctx, panelText(p), rows);
  }

  /* ------------------------------ partners ------------------------------ */
  const PCFG_TOGGLE: Record<string, string> = { 'partner.enabled': 'برنامه‌ی همکاری فعال', 'partner.autoApprove': 'تأیید خودکار درخواست‌ها', 'partner.stackCoupons': 'جمع شدن کد تخفیف با تخفیف همکار', 'partner.autoApproveOrders': '⚡ تأیید خودکار پرداخت همکاران' };
  const PCFG_EDIT: Record<string, string> = { 'partner.defaultDiscount': 'درصد تخفیف پیش‌فرض (هنگام تأیید)', 'partner.maxDiscount': 'سقف تخفیف هر همکار', 'partner.reapplyDays': 'روز انتظار بعد از رد شدن', 'partner.autoApproveMinOrders': 'حداقل پرداخت تأییدشده‌ی قبلی برای تأیید خودکار', 'partner.autoApproveDailyMax': 'سقف تأیید خودکار در ۲۴ ساعت (برای هر همکار)', 'partner.autoApproveMaxAmount': 'سقف مبلغ تأیید خودکار (تومان؛ ۰ = بدون سقف)' };
  const PCFG_UNIT: Record<string, string> = { 'partner.defaultDiscount': '٪', 'partner.maxDiscount': '٪', 'partner.reapplyDays': ' روز', 'partner.autoApproveMinOrders': ' پرداخت', 'partner.autoApproveDailyMax': ' مورد', 'partner.autoApproveMaxAmount': ' تومان' };
  const PCFG_KEYS = [...Object.keys(PCFG_TOGGLE), ...Object.keys(PCFG_EDIT)] as SettingKey[];

  async function partnersHome(ctx: Ctx) {
    ctx.session.step = undefined;
    const n = await partnerCounts();
    await show(ctx, `🤝 همکاری‌ها\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\nدرخواست‌ها را تأیید یا رد کنید و درصد تخفیف هر همکار را تعیین کنید.${n.PENDING ? `\n\n⏳ ${n.PENDING} درخواست منتظر بررسی شماست.` : ''}`, [
      [{ text: `⏳ در انتظار (${n.PENDING})`, data: 'pa:l:PENDING:0' }, { text: `✅ همکاران (${n.APPROVED})`, data: 'pa:l:APPROVED:0' }],
      [{ text: `⛔ معلق (${n.SUSPENDED})`, data: 'pa:l:SUSPENDED:0' }, { text: `❌ ردشده (${n.REJECTED})`, data: 'pa:l:REJECTED:0' }],
      [{ text: '⚙️ تنظیمات همکاری', data: 'pa:cfg' }],
      back('adm:g:fin'),
    ]);
  }

  async function partnersList(ctx: Ctx, f: PartnerFilter, page: number) {
    const list = await listPartners(f, page * PAGE, PAGE + 1);
    const rows: Button[][] = list.slice(0, PAGE).map((p) => [{ text: `${partnerLabel(p.user)}${p.status === 'APPROVED' ? ` · ${p.discountPercent}٪` : ''}`, data: `pa:v:${p.id}` }]);
    const nav: Button[] = [];
    if (page > 0) nav.push({ text: '◀️', data: `pa:l:${f}:${page - 1}` });
    if (list.length > PAGE) nav.push({ text: '▶️', data: `pa:l:${f}:${page + 1}` });
    if (nav.length) rows.push(nav);
    rows.push(back('pa:h'));
    await show(ctx, `🤝 ${f === 'ALL' ? 'همه' : PARTNER_STATUS_FA[f]}${list.length ? '' : '\n\nموردی نیست.'}`, rows);
  }

  async function partnerView(ctx: Ctx, id: string) {
    const p = await getPartnerById(id);
    const st = await partnerStats(p.userId);
    const text = [
      `🤝 ${partnerLabel(p.user)}${p.user.username ? ` (@${p.user.username})` : ''}`, '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
      `🪪 ${p.user.telegramId}`,
      `وضعیت: ${PARTNER_STATUS_FA[p.status]}`,
      p.status === 'APPROVED' || p.status === 'SUSPENDED' ? `💸 تخفیف: ${p.discountPercent}٪` : '',
      p.note ? `📝 توضیح متقاضی: ${p.note}` : '📝 بدون توضیح',
      p.adminNote ? `📌 دلیل/یادداشت ادمین: ${p.adminNote}` : '',
      `📅 درخواست: ${fmtDt(p.requestedAt)}${p.decidedAt ? `\n🕒 تصمیم: ${fmtDt(p.decidedAt)} (${p.decidedBy ?? '-'})` : ''}`,
      `🧾 خرید: ${st.orders} · 💰 ${formatMoney(st.spent)} · 🎉 صرفه‌جویی ${formatMoney(st.saved)}`,
    ].filter(Boolean).join('\n');
    const rows: Button[][] = [];
    if (p.status === 'PENDING' || p.status === 'REJECTED') rows.push([{ text: '✅ تأیید', data: `pa:ok:${id}` }, ...(p.status === 'PENDING' ? [{ text: '❌ رد', data: `pa:no:${id}` }] : [])], [{ text: '✏️ تأیید با درصد دلخواه', data: `pa:pc:${id}` }]);
    if (p.status === 'APPROVED') rows.push([{ text: '✏️ تغییر درصد', data: `pa:pc:${id}` }, { text: '⛔ تعلیق', data: `pa:su:${id}` }]);
    if (p.status === 'SUSPENDED') rows.push([{ text: '▶️ فعال‌سازی دوباره', data: `pa:re:${id}` }]);
    rows.push(back(`pa:l:${p.status}:0`));
    await show(ctx, text, rows);
  }

  async function partnerCfg(ctx: Ctx) {
    ctx.session.step = undefined;
    const s = await allSettings();
    await show(ctx, `⚙️ تنظیمات همکاری\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n${Object.entries(PCFG_EDIT).map(([k, l]) => `${l}: ${s[k as SettingKey]}${PCFG_UNIT[k] ?? ''}`).join('\n')}${s['partner.autoApproveOrders'] === 'true' ? '\n\n⚠️ تأیید خودکار روشن است: پرداخت همکاران معتمد بدون تأیید بانکی پذیرفته می‌شود (پرریسک‌ها و موارد مشکوک همچنان بررسی دستی می‌شوند).' : ''}`, [
      ...Object.entries(PCFG_TOGGLE).map(([k, l]): Button[] => [{ text: `${s[k as SettingKey] === 'true' ? '🟢' : '⚪'} ${l}`, data: `pa:t:${k}` }]),
      ...Object.entries(PCFG_EDIT).map(([k, l]): Button[] => [{ text: `✏️ ${l}`, data: `pa:e:${k}` }]),
      back('pa:h'),
    ]);
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
    rows.push(back('adm:g:srv'));
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
      back('adm:g:set'),
    ]);
  }

  c.on('callback_query:data', async (ctx, next) => {
    const d = ctx.callbackQuery.data;
    const [ns, a, b] = d.split(':');
    const adminNs = ['adm', 'pl', 'ap', 'av', 'vl', 'pr', 'cp', 'st', 'at', 'ao', 'ct', 'tx', 'ch', 'pn', 'pa'];
    if (!adminNs.includes(ns)) return next();
    try {
      // every admin callback re-checks authorization server-side (callback data is untrusted)
      if (!(await getAdmin(BigInt(ctx.from!.id)))) throw new ForbiddenError();
      if (ns === 'adm') {
        switch (a) {
          case 'home': return panel(ctx);
          case 'g': return await groupView(ctx, b);
          case 'web': {
            if (!panelEnabled()) throw new AppError('VALIDATION', 'پنل وب پیکربندی نشده است');
            const url = loginUrl(createLoginToken(BigInt(ctx.from!.id)));
            await audit({ actor: actor(ctx), action: 'admin.panel_link' });
            return ctx.reply(`🖥 ورود به پنل مدیریت\n\nاین لینک یک‌بارمصرف است و ۵ دقیقه اعتبار دارد:\n${url}`, { link_preview_options: { is_disabled: true } });
          }
          case 'dash': return dashboard(ctx);
          case 'pays': await need(ctx, 'payments.view'); return show(ctx, '💳 پرداخت‌ها', [...FILTERS.map(([f, t]): Button[] => [{ text: t, data: `pl:${f}:0` }]), back('adm:g:fin')]);
          case 'products': {
            await need(ctx, 'products.manage');
            const ps = await listAllProducts();
            return show(ctx, `📦 محصولات (${ps.length})`, [[{ text: '➕ محصول جدید', data: 'pr:new' }, { text: '📥 افزودن گروهی', data: 'pr:bulk' }], ...ps.map((p): Button[] => [{ text: `${p.isActive ? '🟢' : '⚪'} ${p.name} · ${p.price}`, data: `pr:v:${p.id}` }]), back('adm:g:cat')]);
          }
          case 'coupons': {
            await need(ctx, 'coupons.manage');
            const cs = await listCoupons();
            return show(ctx, `🎁 کدهای تخفیف\n\n${cs.map((x) => `${x.code} ${x.type === 'PERCENT' ? x.value + '%' : x.value} (${x.usedCount}/${x.maxUses ?? '∞'})`).join('\n') || '—'}`, [[{ text: '➕ کد جدید', data: 'cp:new' }], back('adm:g:fin')]);
          }
          case 'orders': {
            await need(ctx, 'users.view');
            const os = await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 12, include: { user: true } });
            return show(ctx, `🧾 آخرین سفارش‌ها\n\n${os.map((o) => `${o.orderNumber} · ${o.user.telegramId} · ${o.finalAmount} · ${o.status}`).join('\n') || '—'}`, [back('adm:g:fin')]);
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
            return show(ctx, `🧾 Audit Log\n\n${logs.map((l) => `${fmtDt(l.createdAt)} ${l.actor} ${l.action} ${l.targetId?.slice(-6) ?? ''}`).join('\n')}`, [back('adm:g:set')]);
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
        if (a === 'c') {
          await getProduct(b);
          const tree = await categoryTree();
          return show(ctx, tree.length ? '🗂 این محصول در کدام دسته نمایش داده شود؟' : '🗂 هنوز دسته‌ای نساخته‌اید. ابتدا از «🗂 دسته‌بندی منوی خرید» دسته بسازید.', [
            [{ text: '🏠 بدون دسته (صفحه‌ی اول)', data: `pr:cs:${b}:none` }],
            ...tree.slice(0, 40).map((t): Button[] => [{ text: `${'· '.repeat(t.depth)}${t.icon ?? '📁'} ${t.name}`, data: `pr:cs:${b}:${t.id}` }]),
            back(`pr:v:${b}`),
          ]);
        }
        if (a === 'cs') {
          const cid = d.split(':')[3];
          await setProductCategory(actor(ctx), b, cid === 'none' ? null : cid);
          return show(ctx, '✅ دسته‌ی محصول تغییر کرد.', [[{ text: '📦 مشاهده محصول', data: `pr:v:${b}` }], back('adm:products')]);
        }
        if (a === 'bulk') {
          ctx.session.step = 'a_bulk';
          return show(ctx, [
            '📥 افزودن گروهی محصولات', '',
            'همه‌ی محصولات را در «یک پیام» بفرستید؛ هر محصول یک خط:',
            'نام | روز | حجم GB | قیمت تومان | [inbound] | [پروتکل] | [توضیح]', '',
            'اگر inbound یکی است، یک‌بار بالای لیست بنویسید:', 'inbound=23', 'برای پنل غیر از پنل اصلی (کد پنل را از «🖥 پنل‌ها» ببینید):', 'panel=germany', 'برای قرار دادن در دسته (اگر نبود ساخته می‌شود):', 'category=ماهانه ▸ حجمی', '',
            'مثال:', 'inbound=23', 'اقتصادی ۵۰ گیگ | 30 | 50 | 250000', 'ویژه ۱۰۰ گیگ | 60 | 100 | 450,000', 'ویژه ۲۰۰ گیگ | 90 | 200 | 800000 | 25 | VLESS | مناسب خانواده', '',
            '• ارقام فارسی و جداکننده هزارگان مجازند.', '• اگر حتی یک خط خطا داشته باشد هیچ‌کدام ثبت نمی‌شود.', '• محصول کاملاً تکراری رد می‌شود (برای جلوگیری از ارسال دوباره).',
          ].join('\n'), [back('adm:products')]);
        }
        if (a === 'v') {
          const p = await getProduct(b);
          return show(ctx, `📦 ${p.name}\n${p.description ? p.description + '\n' : ''}⏱ ${p.durationDays} روز · 📊 ${p.trafficGB} GB\n💰 قیمت: ${formatMoney(p.price)}\n🖥 پنل: ${p.xuiProviderId} · 🔌 inbound: ${p.xuiInboundId} · ${p.protocol}\n🔢 ترتیب: ${p.sortOrder}\nوضعیت: ${p.isActive ? '🟢 فعال' : '⚪ غیرفعال'}`, [
            [{ text: '✏️ ویرایش', data: `pr:e:${p.id}` }, { text: '🗑 حذف', data: `pr:d:${p.id}` }],
            [{ text: '🗂 دسته‌بندی', data: `pr:c:${p.id}` }, { text: p.isActive ? '⏸ غیرفعال‌سازی' : '▶️ فعال‌سازی', data: `pr:tg:${p.id}` }],
            back('adm:products'),
          ]);
        }
        if (a === 'e') {
          await getProduct(b);
          return show(ctx, '✏️ کدام بخش را ویرایش کنیم؟', [
            ...Object.entries(PRODUCT_FIELDS).reduce<Button[][]>((rows, [f, label], n) => { if (n % 2 === 0) rows.push([]); rows[rows.length - 1].push({ text: label, data: `pr:f:${b}:${f}` }); return rows; }, []),
            [{ text: '🖥 پنل و inbound', data: `pr:pi:${b}` }, { text: '🔌 پروتکل', data: `pr:pt:${b}` }],
            back(`pr:v:${b}`),
          ]);
        }
        if (a === 'f') {
          const field = d.split(':')[3];
          if (!isProductField(field)) throw new AppError('VALIDATION', 'بخش نامعتبر');
          const p = await getProduct(b);
          ctx.session.step = 'a_pfield'; ctx.session.data = { id: b, field };
          const cur = String((p as unknown as Record<string, unknown>)[field] ?? '');
          return show(ctx, `✏️ ${PRODUCT_FIELDS[field]}\nمقدار فعلی: ${cur || '—'}\n\nمقدار جدید را بفرستید${field === 'description' ? ' (برای پاک کردن: -)' : ''}:`, [back(`pr:e:${b}`)]);
        }
        if (a === 'pi') {
          const cur = await getProduct(b);
          const ps = (await listPanels()).filter((x) => x.isActive);
          return show(ctx, `🖥 این محصول روی کدام پنل ساخته شود؟\nفعلی: ${cur.xuiProviderId} · inbound ${cur.xuiInboundId}`, [...ps.map((x, n): Button[] => [{ text: `${x.code === cur.xuiProviderId ? '✅ ' : ''}${x.name} (${x.code})`, data: `pr:pj:${b}:${n}` }]), back(`pr:e:${b}`)]);
        }
        if (a === 'pj') {
          const x = (await listPanels()).filter((y) => y.isActive)[Number(d.split(':')[3])];
          if (!x) throw new AppError('VALIDATION', 'پنل پیدا نشد؛ دوباره انتخاب کنید');
          let ibs;
          try { ibs = await listPanelInbounds(x.code); } catch (e: any) { throw new AppError('VALIDATION', `ارتباط با پنل «${x.name}» برقرار نشد:\n${String(e?.message ?? e)}`); }
          ctx.session.data = { pickPanel: x.code };
          const ok = ibs.filter((i) => i.enable && isSupportedProtocol(i.protocol));
          return show(ctx, `🔌 inbound را از پنل «${x.name}» انتخاب کنید:${ok.length ? '' : '\n\nهیچ inbound فعال و پشتیبانی‌شده‌ای پیدا نشد.'}${ibs.length !== ok.length ? '\n(inboundهای غیرفعال یا پشتیبانی‌نشده مثل mixed/http نمایش داده نمی‌شوند)' : ''}`, [...ok.slice(0, 40).map((i): Button[] => [{ text: ibLabel(i), data: `pr:pk:${b}:${i.id}` }]), back(`pr:pi:${b}`)]);
        }
        if (a === 'pk') {
          const code = ctx.session.data?.pickPanel as string | undefined;
          if (!code) throw new AppError('VALIDATION', 'انتخاب منقضی شد؛ دوباره از «پنل و inbound» شروع کنید');
          const id = Number(d.split(':')[3]);
          const info = (await listPanelInbounds(code)).find((i) => i.id === id);
          if (!info) throw new AppError('VALIDATION', 'این inbound دیگر در پنل نیست');
          await updateProduct(actor(ctx), b, { xuiProviderId: code, xuiInboundId: id, ...(PROTO_ENUM[info.protocol] ? { protocol: PROTO_ENUM[info.protocol] as never } : {}) });
          ctx.session.data = undefined;
          return show(ctx, `✅ محصول روی پنل «${code}» ، inbound ${id} (${info.protocol}) تنظیم شد.`, [[{ text: '📦 مشاهده محصول', data: `pr:v:${b}` }]]);
        }
        if (a === 'pt') {
          await getProduct(b);
          return show(ctx, 'پروتکل را انتخاب کنید (باید با inbound سازگار باشد):', [['VLESS', 'VMESS'].map((x) => ({ text: x, data: `pr:ps:${b}:${x}` })), ['TROJAN', 'SHADOWSOCKS'].map((x) => ({ text: x, data: `pr:ps:${b}:${x}` })), back(`pr:e:${b}`)]);
        }
        if (a === 'ps') {
          const proto = d.split(':')[3];
          if (!['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(proto)) throw new AppError('VALIDATION', 'پروتکل نامعتبر');
          await updateProduct(actor(ctx), b, { protocol: proto as never });
          await ctx.reply('✅ پروتکل تغییر کرد.');
          return show(ctx, '✅ انجام شد', [back(`pr:v:${b}`)]);
        }
        if (a === 'd') {
          const p = await getProduct(b);
          return show(ctx, `⚠️ حذف محصول «${p.name}»؟\nاگر در سفارشی استفاده شده باشد حذف نمی‌شود (به‌جایش غیرفعالش کنید).`, [[{ text: '🗑 بله، حذف شود', data: `pr:d2:${b}` }, { text: '↩️ انصراف', data: `pr:v:${b}` }]]);
        }
        if (a === 'd2') {
          await deleteProduct(actor(ctx), b);
          return show(ctx, '🗑 محصول حذف شد.', [back('adm:products')]);
        }
        if (a === 'tg') { const p = await getProduct(b); await updateProduct(actor(ctx), b, { isActive: !p.isActive }); return ctx.reply(p.isActive ? '⏸ غیرفعال شد.' : '▶️ فعال شد.'); }
        if (a === 'pc') { ctx.session.step = 'a_price'; ctx.session.data = { id: b }; return show(ctx, 'قیمت جدید (عدد):', [back(`pr:v:${b}`)]); }
      }
      if (ns === 'pn') {
        await need(ctx, 'panels.manage');
        if (a === 'l') return panelsList(ctx);
        if (a === 'v') return panelView(ctx, b);
        if (a === 'new') {
          ctx.session.step = 'a_panel_add'; ctx.session.data = undefined;
          return show(ctx, [
            '🖥 افزودن پنل X-UI', '',
            'یک پیام با این قالب بفرستید (هر خط یک مورد):', '',
            'نام: آلمان',
            'آدرس: https://1.2.3.4:2053/مسیر-پنل',
            'کاربر: admin',
            'رمز: ********',
            'ساب: https://sub.example.com:2096/sub   (اختیاری)',
            'هاست: example.com   (اختیاری؛ دامنه‌ی داخل لینک مشتری)',
            'tls: نامعتبر   (اختیاری؛ اگر گواهی پنل خودامضاست)', '',
            '• به‌جای کاربر/رمز می‌توانید «توکن: ...» بدهید.',
            '• قبل از ذخیره، اتصال تست می‌شود؛ اگر وصل نشد ذخیره نمی‌شود و می‌توانید اصلاح‌شده دوباره بفرستید.',
            '• پیام شما (که رمز دارد) بعد از خواندن از چت پاک می‌شود.',
          ].join('\n'), [back('pn:l')]);
        }
        if (a === 't') {
          const r = await testPanel(b);
          await ctx.reply(r.ok ? `🟢 اتصال برقرار است (${r.ms}ms)\n${r.detail}` : `🔴 اتصال ناموفق (${r.ms}ms)\n${r.detail}`);
          return panelView(ctx, b);
        }
        if (a === 'i') {
          const p = await getPanel(b);
          let ibs;
          try { ibs = await listPanelInbounds(b); } catch (e: any) { throw new AppError('VALIDATION', `ارتباط با پنل «${p.name}» برقرار نشد:\n${String(e?.message ?? e)}`); }
          return show(ctx, `📋 inboundهای «${p.name}» (${ibs.length})\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\nروی هر کدام بزنید تا برایش محصول بسازید.\n⛔ = غیرفعال${ibs.some((i) => !isSupportedProtocol(i.protocol)) ? '\n(پروتکل‌های mixed/http/socks پشتیبانی نمی‌شوند)' : ''}`, [...ibs.slice(0, 40).map((i): Button[] => [{ text: ibLabel(i), data: `pn:ib:${b}:${i.id}` }]), back(`pn:v:${b}`)]);
        }
        if (a === 'ib') {
          const id = Number(d.split(':')[3]);
          const i = (await listPanelInbounds(b)).find((x) => x.id === id);
          if (!i) throw new AppError('VALIDATION', 'این inbound دیگر در پنل نیست');
          const prods = (await listAllProducts()).filter((x) => x.xuiProviderId === b && x.xuiInboundId === id);
          const okProto = isSupportedProtocol(i.protocol) && i.enable;
          return show(ctx, `🔌 inbound #${i.id}\nنام: ${i.remark || '—'}\nپروتکل: ${i.protocol} · پورت ${i.port}\nوضعیت: ${i.enable ? '🟢 فعال' : '⛔ غیرفعال'}\n📦 محصولات روی آن: ${prods.length}${prods.length ? '\n' + prods.slice(0, 8).map((x) => `• ${x.name}`).join('\n') : ''}${okProto ? '' : '\n\n⚠️ برای فروش باید inbound فعال و از نوع vless/vmess/trojan/shadowsocks باشد.'}`, [...(okProto ? [[{ text: '➕ افزودن محصول روی این inbound', data: `pn:np:${b}:${id}` }]] : []), back(`pn:i:${b}`)]);
        }
        if (a === 'np') {
          const id = Number(d.split(':')[3]);
          const i = (await listPanelInbounds(b)).find((x) => x.id === id);
          if (!i || !isSupportedProtocol(i.protocol)) throw new AppError('VALIDATION', 'این inbound قابل فروش نیست');
          ctx.session.step = 'a_bulk'; ctx.session.data = { defaults: { panel: b, inbound: id, protocol: PROTO_ENUM[i.protocol] } };
          return show(ctx, [
            `📥 افزودن محصول روی «${b}» · inbound ${id}`, '',
            'پنل و inbound از قبل تنظیم شده‌اند. هر محصول یک خط:', 'نام | روز | حجم GB | قیمت تومان', '',
            'مثال:', 'اقتصادی ۵۰ گیگ | 30 | 50 | 250000', 'ویژه ۱۰۰ گیگ | 60 | 100 | 450,000', '',
            'برای قرار دادن در دسته: خط اول  category=ماهانه ▸ حجمی',
          ].join('\n'), [back(`pn:ib:${b}:${id}`)]);
        }
        const p = await getPanel(b);
        if (p.source === 'env') throw new AppError('VALIDATION', 'این پنل از .env خوانده می‌شود؛ برای تغییر آن فایل .env را ویرایش کنید.');
        if (a === 'e') {
          ctx.session.step = 'a_panel_edit'; ctx.session.data = { id: p.id, code: b };
          return show(ctx, `✏️ ویرایش «${p.name}»\n\nفقط خطوطی را بفرستید که می‌خواهید عوض شوند، مثلاً:\nآدرس: https://...\nرمز: ...\nنام: ...\nساب: -   (برای پاک کردن مقدار، «-» بگذارید)\n\nکلیدها: نام، آدرس، کاربر، رمز، توکن، ساب، هاست، tls`, [back(`pn:v:${b}`)]);
        }
        if (a === 'tg') { await setPanelActive(actor(ctx), p.id, !p.isActive); return panelView(ctx, b); }
        if (a === 'd') return show(ctx, `⚠️ حذف پنل «${p.name}»؟\nفقط وقتی هیچ محصول و سرویسی روی آن نباشد حذف می‌شود.`, [[{ text: '🗑 بله، حذف شود', data: `pn:d2:${b}` }, { text: '↩️ انصراف', data: `pn:v:${b}` }]]);
        if (a === 'd2') { await deletePanel(actor(ctx), p.id); return show(ctx, '🗑 پنل حذف شد.', [back('pn:l')]); }
      }
      if (ns === 'pa') {
        await need(ctx, 'partners.manage');
        if (a === 'h') return partnersHome(ctx);
        if (a === 'cfg') return partnerCfg(ctx);
        if (a === 'l') return partnersList(ctx, b as PartnerFilter, Number(d.split(':')[3] ?? 0));
        if (a === 'v') return partnerView(ctx, b);
        if (a === 'ok') { await approvePartner(actor(ctx), b); return partnerView(ctx, b); }
        if (a === 'no') { ctx.session.step = 'a_partner_reject'; ctx.session.data = { id: b }; return show(ctx, 'دلیل رد درخواست را بنویسید (به کاربر نمایش داده می‌شود):', [back(`pa:v:${b}`)]); }
        if (a === 'pc') { ctx.session.step = 'a_partner_pct'; ctx.session.data = { id: b }; return show(ctx, `درصد تخفیف این همکار را بفرستید (عدد ۰ تا ۱۰۰؛ حداکثر مجاز ${await getSetting('partner.maxDiscount')}):`, [back(`pa:v:${b}`)]); }
        if (a === 'su') { await setPartnerSuspended(actor(ctx), b, true); return partnerView(ctx, b); }
        if (a === 're') { await setPartnerSuspended(actor(ctx), b, false); return partnerView(ctx, b); }
        if (a === 't') {
          if (!(b in PCFG_TOGGLE)) throw new AppError('VALIDATION', 'کلید نامعتبر');
          const next = String((await getSetting(b as SettingKey)) !== 'true');
          await setSetting(b as SettingKey, next);
          await audit({ actor: actor(ctx), action: 'setting.change', target: 'Setting', targetId: b, metadata: { value: next } });
          return partnerCfg(ctx);
        }
        if (a === 'e') {
          if (!(b in PCFG_EDIT)) throw new AppError('VALIDATION', 'کلید نامعتبر');
          ctx.session.step = 'a_partner_cfg'; ctx.session.data = { key: b };
          return show(ctx, `${PCFG_EDIT[b]}\nمقدار فعلی: ${await getSetting(b as SettingKey)}\n\nعدد جدید را بفرستید:`, [back('pa:cfg')]);
        }
      }
      if (ns === 'ch') {
        await need(ctx, 'settings.manage');
        if (a === 'l') {
          const chans = await listChannels();
          return show(ctx, `📢 کانال‌های اجباری\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\nتا کاربر عضو «همه‌ی کانال‌های فعال» نشود نمی‌تواند از ربات استفاده کند (ادمین‌ها معاف‌اند).\nربات باید در هر کانال «ادمین» باشد.${chans.length ? '' : '\n\nهنوز کانالی اضافه نشده؛ پس عضویت اجباری خاموش است.'}`, [
            ...chans.map((c): Button[] => [{ text: `${c.isActive ? '🟢' : '⚪'} ${c.title}${c.username ? ` (@${c.username})` : ''}`, data: `ch:v:${c.id}` }]),
            [{ text: '➕ افزودن کانال', data: 'ch:n' }],
            back('adm:g:set'),
          ]);
        }
        if (a === 'n') {
          ctx.session.step = 'a_chan_add';
          return show(ctx, '➕ آدرس کانال را بفرستید:\n\n• کانال عمومی: @mychannel یا https://t.me/mychannel\n• کانال خصوصی: خط اول شناسه عددی (مثل -1001234567890) و خط دوم لینک دعوت (https://t.me/+…)\n\n⚠️ قبل از افزودن، ربات را «ادمین» کانال کنید.', [back('ch:l')]);
        }
        const chan = (await listChannels()).find((x) => x.id === b);
        if (!chan) throw new AppError('NOT_FOUND', 'کانال یافت نشد');
        if (a === 'v') return show(ctx, `📢 ${chan.title}${chan.username ? `\n@${chan.username}` : ''}\n${chan.inviteUrl}\nوضعیت: ${chan.isActive ? '🟢 اجباری (فعال)' : '⚪ غیرفعال'}`, [
          [{ text: '🧪 تست دسترسی ربات', data: `ch:t:${chan.id}` }, { text: chan.isActive ? '⏸ غیرفعال' : '▶️ فعال', data: `ch:tg:${chan.id}` }],
          [{ text: '🗑 حذف', data: `ch:d:${chan.id}` }], back('ch:l'),
        ]);
        if (a === 't') { const r = await testChannel(chan.id); return show(ctx, `${r.ok ? '✅' : '❌'} ${r.detail}`, [back(`ch:v:${chan.id}`)]); }
        if (a === 'tg') { await setChannelActive(actor(ctx), chan.id, !chan.isActive); return show(ctx, chan.isActive ? '⏸ غیرفعال شد (دیگر اجباری نیست).' : '▶️ فعال شد.', [back(`ch:v:${chan.id}`)]); }
        if (a === 'd') return show(ctx, `⚠️ کانال «${chan.title}» از لیست اجباری حذف شود؟`, [[{ text: '🗑 بله، حذف', data: `ch:d2:${chan.id}` }, { text: '↩️ انصراف', data: `ch:v:${chan.id}` }]]);
        if (a === 'd2') { await deleteChannel(actor(ctx), chan.id); return show(ctx, '🗑 حذف شد.', [back('ch:l')]); }
      }
      if (ns === 'tx') {
        await need(ctx, 'texts.manage');
        const items = await listTexts();
        const groups = [...new Set(items.map((x) => x.group))];
        if (a === 'l') return show(ctx, '✏️ ویرایش متن‌های ربات\nکدام بخش؟', [...groups.map((g, n): Button[] => [{ text: g, data: `tx:g:${n}` }]), back('adm:g:set')]);
        if (a === 'g') {
          const g = groups[Number(b)];
          if (!g) throw new AppError('NOT_FOUND', 'بخش یافت نشد');
          return show(ctx, `✏️ ${g}`, [...items.filter((x) => x.group === g).map((x): Button[] => [{ text: `${x.isDefault ? '' : '✅ '}${x.label}`, data: `tx:v:${x.key}` }]), back('tx:l')]);
        }
        if (!isTextKey(b)) throw new AppError('NOT_FOUND', 'متن یافت نشد');
        const it = items.find((x) => x.key === b)!;
        if (a === 'v') {
          const vars = it.vars.length ? `\n\nمتغیرها (جایگزین می‌شوند):\n${it.vars.map((v) => `{${v.name}} = ${v.label}`).join('\n')}` : '';
          return show(ctx, `✏️ ${it.label}\n${it.isDefault ? '(متن پیش‌فرض)' : '(متن سفارشی)'}\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n${it.value || '— خالی —'}\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈${vars}\n\nقالب‌بندی: *متن* = پررنگ. حداکثر ${it.max} حرف.`, [
            [{ text: '✏️ ویرایش', data: `tx:e:${b}` }, ...(it.isDefault ? [] : [{ text: '↩️ بازگشت به پیش‌فرض', data: `tx:r:${b}` }])],
            back(`tx:g:${groups.indexOf(it.group)}`),
          ]);
        }
        if (a === 'e') { ctx.session.step = 'a_text'; ctx.session.data = { key: b }; return show(ctx, `✏️ متن جدید «${it.label}» را بفرستید.${it.vars.length ? `\nمتغیرها: ${it.vars.map((v) => `{${v.name}}`).join(' ')}` : ''}${it.optional ? '\nبرای خالی کردن: -' : ''}\n(*متن* = پررنگ)`, [back(`tx:v:${b}`)]); }
        if (a === 'r') { await resetText(actor(ctx), b); return show(ctx, '↩️ به متن پیش‌فرض برگشت.', [back(`tx:v:${b}`)]); }
      }
      if (ns === 'ct') {
        await need(ctx, 'products.manage');
        const tree = await categoryTree();
        const rootKey = (id: string | null) => id ?? 'root';
        const label = (t: { icon: string | null; name: string; isActive: boolean }) => `${t.isActive ? '' : '⚪ '}${t.icon ?? '📁'} ${t.name}`;
        if (a === 'l') {
          const pid = b === 'root' ? null : b;
          const here = pid ? tree.find((t) => t.id === pid) : undefined;
          if (pid && !here) throw new AppError('NOT_FOUND', 'دسته یافت نشد');
          const kids = tree.filter((t) => t.parentId === pid);
          return show(ctx, `🗂 ${here ? here.path : 'دسته‌بندی منوی خرید'}\n${kids.length ? '' : '\nهنوز زیرمجموعه‌ای نیست.'}\nمحصولات داخل هر دسته در منوی خرید به مشتری نمایش داده می‌شوند. دسته‌ی بدون محصول فعال برای مشتری پنهان است.`, [
            ...kids.map((t): Button[] => [{ text: `${label(t)} (${t.activeProductCount}/${t.productCount})`, data: `ct:v:${t.id}` }]),
            [{ text: '➕ دسته‌ی جدید', data: `ct:n:${rootKey(pid)}` }],
            ...(here ? [[{ text: '⚙️ تنظیمات این دسته', data: `ct:v:${here.id}` }]] : []),
            back(here ? `ct:l:${rootKey(here.parentId)}` : 'adm:g:cat'),
          ]);
        }
        if (a === 'n') {
          const pid = b === 'root' ? null : b;
          if (pid) await getCategory(pid);
          ctx.session.step = 'a_cat_new'; ctx.session.data = { parentId: pid };
          return show(ctx, '➕ نام دسته (یا چند دسته، هر کدام یک خط) را بفرستید.\nمی‌توانید اول نام یک ایموجی بگذارید:\n\n🗓 ماهانه\n📦 حجمی\n👨‍👩‍👧 خانوادگی', [back(`ct:l:${b}`)]);
        }
        const t = tree.find((x) => x.id === b);
        if (!t) throw new AppError('NOT_FOUND', 'دسته یافت نشد');
        if (a === 'v') {
          const kids = tree.filter((x) => x.parentId === t.id).length;
          return show(ctx, `🗂 ${t.path}\n${t.description ? t.description + '\n' : ''}\nوضعیت: ${t.isActive ? '🟢 فعال' : '⚪ غیرفعال (برای مشتری پنهان)'}\nمحصولات این دسته: ${t.productCount} (فعال در کل شاخه: ${t.activeProductCount})\nزیرمجموعه‌ها: ${kids}`, [
            [{ text: '📂 زیرمجموعه‌ها', data: `ct:l:${t.id}` }, { text: '➕ زیرمجموعه', data: `ct:n:${t.id}` }],
            [{ text: '✏️ نام / آیکون', data: `ct:rn:${t.id}` }, { text: '📝 توضیح', data: `ct:ds:${t.id}` }],
            [{ text: '🔼 بالا', data: `ct:mu:${t.id}` }, { text: '🔽 پایین', data: `ct:md:${t.id}` }, { text: '↪️ انتقال', data: `ct:mv:${t.id}` }],
            [{ text: t.isActive ? '⏸ غیرفعال' : '▶️ فعال', data: `ct:tg:${t.id}` }, { text: '📦 محصولات', data: `ct:p:${t.id}` }],
            [{ text: '🗑 حذف', data: `ct:d:${t.id}` }],
            back(`ct:l:${rootKey(t.parentId)}`),
          ]);
        }
        if (a === 'rn') { ctx.session.step = 'a_cat_rename'; ctx.session.data = { id: t.id }; return show(ctx, `✏️ نام فعلی: ${label(t)}\nنام جدید را بفرستید (می‌توانید اول ایموجی بگذارید):`, [back(`ct:v:${t.id}`)]); }
        if (a === 'ds') { ctx.session.step = 'a_cat_desc'; ctx.session.data = { id: t.id }; return show(ctx, '📝 توضیح کوتاه دسته (زیر عنوان به مشتری نمایش داده می‌شود). برای پاک کردن: -', [back(`ct:v:${t.id}`)]); }
        if (a === 'mu' || a === 'md') { await moveCategory(actor(ctx), t.id, a === 'mu' ? 'up' : 'down'); return show(ctx, '✅ ترتیب تغییر کرد.', [[{ text: '🗂 بازگشت به لیست', data: `ct:l:${rootKey(t.parentId)}` }]]); }
        if (a === 'tg') { await updateCategory(actor(ctx), t.id, { isActive: !t.isActive }); return show(ctx, t.isActive ? '⏸ دسته غیرفعال شد (برای مشتری پنهان است).' : '▶️ دسته فعال شد.', [back(`ct:v:${t.id}`)]); }
        if (a === 'p') {
          const ps = await prisma.product.findMany({ where: { categoryId: t.id }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }], take: 30 });
          return show(ctx, `📦 محصولات «${t.path}»${ps.length ? '' : '\n\nمحصولی ندارد. از صفحه‌ی هر محصول «🗂 دسته‌بندی» را بزنید یا در افزودن گروهی از category= استفاده کنید.'}`, [...ps.map((p): Button[] => [{ text: `${p.isActive ? '🟢' : '⚪'} ${p.name}`, data: `pr:v:${p.id}` }]), back(`ct:v:${t.id}`)]);
        }
        if (a === 'mv') {
          const bad = new Set<string>([t.id]);
          const collect = (pid: string) => tree.filter((x) => x.parentId === pid).forEach((x) => { bad.add(x.id); collect(x.id); });
          collect(t.id);
          return show(ctx, `↪️ «${t.name}» به کجا منتقل شود؟`, [
            [{ text: '🏠 سطح اول (ریشه)', data: `ct:mv2:${t.id}:root` }],
            ...tree.filter((x) => !bad.has(x.id)).slice(0, 40).map((x): Button[] => [{ text: `${'· '.repeat(x.depth)}${label(x)}`, data: `ct:mv2:${t.id}:${x.id}` }]),
            back(`ct:v:${t.id}`),
          ]);
        }
        if (a === 'mv2') {
          const np = d.split(':')[3];
          await updateCategory(actor(ctx), t.id, { parentId: np === 'root' ? null : np });
          return show(ctx, '✅ منتقل شد.', [back(`ct:v:${t.id}`)]);
        }
        if (a === 'd') return show(ctx, `⚠️ حذف دسته «${t.path}»؟\nمحصولات داخلش به دسته‌ی بالاتر (یا صفحه‌ی اول) منتقل می‌شوند و حذف نمی‌شوند. اگر زیرمجموعه دارد حذف نمی‌شود.`, [[{ text: '🗑 بله، حذف شود', data: `ct:d2:${t.id}` }, { text: '↩️ انصراف', data: `ct:v:${t.id}` }]]);
        if (a === 'd2') {
          const r = await deleteCategory(actor(ctx), t.id);
          return show(ctx, `🗑 دسته حذف شد.${r.movedProducts ? `\n${r.movedProducts} محصول به دسته‌ی بالاتر منتقل شد.` : ''}`, [[{ text: '🗂 بازگشت به لیست', data: `ct:l:${rootKey(t.parentId)}` }]]);
        }
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
          const lines: string[] = [];
          for (const p of (await listPanels()).filter((x) => x.isActive)) { const h = await testPanel(p.code); lines.push(`${h.ok ? '🟢' : '🔴'} ${p.name} (${p.code}) — ${h.detail}`); }
          return show(ctx, `🔌 وضعیت پنل‌های X-UI\n\n${lines.join('\n') || 'هیچ پنلی تنظیم نشده'}`, [back('adm:settings')]);
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
      if (step === 'a_panel_add' || step === 'a_panel_edit') {
        await need(ctx, 'panels.manage');
        await ctx.deleteMessage().catch(() => undefined); // the message contains the panel password
        const fields = parsePanelText(text);
        if (step === 'a_panel_add') {
          const row = await createPanel(actor(ctx), fields as never);
          ctx.session.step = undefined;
          return void (await ctx.reply(`✅ پنل «${row.name}» (کد: ${row.code}) اضافه شد و اتصال تست شد.`, { reply_markup: { inline_keyboard: [[{ text: '📋 inboundها', callback_data: `pn:i:${row.code}` }, { text: '🖥 مشاهده', callback_data: `pn:v:${row.code}` }]] } }));
        }
        await updatePanel(actor(ctx), data.id, fields as never);
        ctx.session.step = undefined;
        return void (await ctx.reply('✅ ذخیره شد و اتصال با مشخصات جدید تست شد.', { reply_markup: { inline_keyboard: [[{ text: '🖥 مشاهده پنل', callback_data: `pn:v:${data.code}` }]] } }));
      }
      if (step === 'a_partner_reject') {
        await need(ctx, 'partners.manage');
        await rejectPartner(actor(ctx), data.id, text);
        ctx.session.step = undefined;
        await ctx.reply('✅ رد شد و به کاربر اطلاع داده شد.');
        return partnerView(ctx, data.id);
      }
      if (step === 'a_partner_pct') {
        await need(ctx, 'partners.manage');
        const n = Number(text.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[%٪\s]/g, ''));
        const p = await getPartnerById(data.id);
        if (p.status === 'APPROVED') await setPartnerPercent(actor(ctx), data.id, n); else await approvePartner(actor(ctx), data.id, n);
        ctx.session.step = undefined;
        await ctx.reply('✅ ذخیره شد.');
        return partnerView(ctx, data.id);
      }
      if (step === 'a_partner_cfg') {
        await need(ctx, 'partners.manage');
        if (!PCFG_KEYS.includes(data.key)) throw new AppError('VALIDATION', 'کلید نامعتبر');
        const n = text.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[%٪,٬،\s]/g, '');
        const v = await validatePartnerSetting(data.key, n);
        await setSetting(data.key, v);
        await audit({ actor: actor(ctx), action: 'setting.change', target: 'Setting', targetId: data.key, metadata: { value: v } });
        ctx.session.step = undefined;
        await ctx.reply('✅ ذخیره شد.');
        return partnerCfg(ctx);
      }
      if (step === 'a_chan_add') {
        await need(ctx, 'settings.manage');
        const c = await addChannel(actor(ctx), text);
        ctx.session.step = undefined;
        return void (await ctx.reply(`✅ کانال «${c.title}» اضافه شد. از این لحظه عضویت در آن اجباری است.`, { reply_markup: { inline_keyboard: [[{ text: '📢 کانال‌ها', callback_data: 'ch:l' }]] } }));
      }
      if (step === 'a_text') {
        await need(ctx, 'texts.manage');
        if (!isTextKey(data.key)) throw new AppError('VALIDATION', 'متن نامعتبر');
        await setText(actor(ctx), data.key, text === '-' && textDef(data.key).optional ? '' : text);
        ctx.session.step = undefined;
        await ctx.reply('✅ ذخیره شد. پیش‌نمایش:');
        const pv = previewText(data.key, text === '-' ? '' : text.trim());
        if (pv) await ctx.reply(pv, { parse_mode: textDef(data.key).plain ? undefined : 'HTML' });
        return void (await ctx.reply('بازگشت:', { reply_markup: { inline_keyboard: [[{ text: '✏️ مشاهده متن', callback_data: `tx:v:${data.key}` }]] } }));
      }
      if (step === 'a_cat_new') {
        await need(ctx, 'products.manage');
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20);
        const made: string[] = [];
        for (const line of lines) { const { icon, name } = splitIconName(line); const c = await createCategory(actor(ctx), { name, icon, parentId: data.parentId ?? null }); made.push(`${c.icon ?? '📁'} ${c.name}`); }
        ctx.session.step = undefined;
        return void (await ctx.reply(`✅ ${made.length} دسته ساخته شد:\n${made.join('\n')}`, { reply_markup: { inline_keyboard: [[{ text: '🗂 مشاهده', callback_data: `ct:l:${data.parentId ?? 'root'}` }]] } }));
      }
      if (step === 'a_cat_rename') {
        await need(ctx, 'products.manage');
        const { icon, name } = splitIconName(text);
        await updateCategory(actor(ctx), data.id, { name, ...(icon ? { icon } : {}) });
        ctx.session.step = undefined;
        return void (await ctx.reply('✅ ذخیره شد.', { reply_markup: { inline_keyboard: [[{ text: '🗂 مشاهده دسته', callback_data: `ct:v:${data.id}` }]] } }));
      }
      if (step === 'a_cat_desc') {
        await need(ctx, 'products.manage');
        await updateCategory(actor(ctx), data.id, { description: text === '-' ? null : text });
        ctx.session.step = undefined;
        return void (await ctx.reply('✅ ذخیره شد.', { reply_markup: { inline_keyboard: [[{ text: '🗂 مشاهده دسته', callback_data: `ct:v:${data.id}` }]] } }));
      }
      if (step === 'a_bulk') {
        await need(ctx, 'products.manage');
        const created = await createProductsBulk(actor(ctx), text, data.defaults ?? {});
        ctx.session.step = undefined;
        return void (await ctx.reply(`✅ ${created.length} محصول ثبت شد:\n${created.map((c) => `• ${c.name} — ${formatMoney(c.price)}`).join('\n')}`));
      }
      if (step === 'a_pfield') {
        await need(ctx, 'products.manage');
        if (!isProductField(data.field)) throw new AppError('VALIDATION', 'بخش نامعتبر');
        await updateProduct(actor(ctx), data.id, parseProductField(data.field, text));
        ctx.session.step = undefined;
        await ctx.reply('✅ ذخیره شد.');
        return void (await ctx.reply('بازگشت به محصول:', { reply_markup: { inline_keyboard: [[{ text: '📦 مشاهده محصول', callback_data: `pr:v:${data.id}` }]] } }));
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
      // validation errors on multi-line / field edits keep the step, so the admin can just resend a corrected text
      const retry = e instanceof AppError && (e.code === 'VALIDATION' || e.code === 'CONFLICT') && ['a_bulk', 'a_pfield', 'a_cat_new', 'a_cat_rename', 'a_text', 'a_chan_add', 'a_panel_add', 'a_panel_edit', 'a_partner_reject', 'a_partner_pct', 'a_partner_cfg'].includes(step ?? '');
      if (!retry) ctx.session.step = undefined;
      return handleError(ctx, e, step === 'a_bulk' ? 'adm:products' : 'adm:home');
    }
    return next();
  });

  return c;
}
