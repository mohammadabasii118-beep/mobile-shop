import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { prisma } from '../db/client';
import { env } from '../config/env';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { AdminRole, Protocol } from '@prisma/client';
import { Permission, ROLE_PERMISSIONS, adminActor, requirePermission } from '../modules/admin/rbac';
import { audit } from '../modules/admin/audit';
import { approvePayment, rejectPayment, requestReview } from '../modules/payments/service';
import { createProduct, createProductsBulk, deleteProduct, listAllProducts, updateProduct } from '../modules/products/service';
import { createCoupon, listCoupons, setCouponActive } from '../modules/coupons/service';
import { adminRenew, deleteService, resumeService, suspendService, syncService } from '../modules/vpn/service';
import { adminRetry } from '../modules/vpn/provisioning';
import { adminReply, closeTicket } from '../modules/support/service';
import { SETTING_DEFAULTS, SettingKey, allSettings, setSetting } from '../modules/settings/service';
import { flushPending } from '../modules/notifications/service';
import { PartnerFilter, approvePartner, getPartnerById, listPartners, partnerCounts, partnerStats, rejectPartner, setPartnerPercent, setPartnerSuspended } from '../modules/partners/service';
import { PanelView, createPanel, deletePanel, listPanelInbounds, listPanels, panelHealth, setPanelActive, testPanel, updatePanel } from '../modules/panels/service';
import { categoryTree, createCategory, deleteCategory, moveCategory, updateCategory } from '../modules/categories/service';
import { isTextKey, listTexts, previewText, resetText, setText } from '../modules/texts/service';
import { addChannel, deleteChannel, listChannels, setChannelActive, testChannel } from '../modules/channels/service';
import * as Q from './queries';

export interface ApiCtx {
  admin: { telegramId: bigint; role: AdminRole };
  params: string[];
  query: URLSearchParams;
  body: any;
  ip: string;
}
export type ApiResult = unknown | { raw: Buffer; contentType: string };
interface Route { method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'; re: RegExp; perm: Permission | null; run: (c: ApiCtx) => Promise<ApiResult> }

const actor = (c: ApiCtx) => adminActor(c.admin.telegramId);
const page = (c: ApiCtx) => Math.max(1, Math.min(10_000, Number(c.query.get('page')) || 1));
const str = (c: ApiCtx, k: string, max = 80) => (c.query.get(k) ?? '').trim().slice(0, max);

/* ------------------------------ settings ------------------------------ */
const bool = z.enum(['true', 'false']);
const int = (min: number, max: number) => z.string().regex(/^\d+$/).refine((v) => Number(v) >= min && Number(v) <= max, `must be ${min}..${max}`);
const csvInts = z.string().regex(/^\d+(,\d+)*$/).max(60);
export const SETTING_RULES: Partial<Record<SettingKey, z.ZodType<string>>> = {
  'card.enabled': bool,
  'card.holder': z.string().trim().max(60),
  'card.number': z.string().transform((v) => v.replace(/[\s-]/g, '')).pipe(z.string().regex(/^\d{16}$/, 'شماره کارت باید ۱۶ رقم باشد')),
  'card.bank': z.string().trim().max(40),
  'card.instructions': z.string().trim().max(300),
  'verification.mode': z.enum(['AUTO_VERIFICATION', 'MANUAL_REVIEW']),
  'verification.provider': z.enum(['ledger', 'none']),
  'verification.allowReceiptOnlyAutoApprove': bool,
  'verification.timeWindowMinutes': int(5, 10080),
  'risk.mediumAt': int(1, 99),
  'risk.highAt': int(2, 100),
  'risk.highAction': z.enum(['MANUAL_REVIEW', 'REJECT']),
  'risk.maxSubmissions24h': int(1, 100),
  'provisioning.maxRetries': int(0, 20),
  'provisioning.backoffSeconds': csvInts,
  'notify.expiryDays': csvInts,
  'orders.expireMinutes': int(10, 10080),
  'notify.newUser': bool,
};

async function putSetting(c: ApiCtx) {
  const { key, value } = z.object({ key: z.string(), value: z.string() }).parse(c.body);
  const rule = SETTING_RULES[key as SettingKey];
  if (!rule) throw new ValidationError('این تنظیم از پنل قابل تغییر نیست');
  const parsed = rule.safeParse(value);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'مقدار نامعتبر');
  const cur = await allSettings();
  if (key === 'risk.highAt' && Number(parsed.data) <= Number(cur['risk.mediumAt'])) throw new ValidationError('آستانه ریسک بالا باید از متوسط بیشتر باشد');
  if (key === 'risk.mediumAt' && Number(parsed.data) >= Number(cur['risk.highAt'])) throw new ValidationError('آستانه ریسک متوسط باید از بالا کمتر باشد');
  await setSetting(key as SettingKey, parsed.data);
  await audit({ actor: actor(c), action: 'setting.change', target: 'Setting', targetId: key, metadata: { value: key === 'card.number' ? '[card]' : parsed.data }, ip: c.ip });
  return { ok: true };
}

/* ------------------------------- helpers ------------------------------- */
const receiptType = (b: Buffer) => (b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : 'application/octet-stream');

const productBody = z.object({
  name: z.string().trim().min(1).max(80), description: z.string().trim().max(500).optional().nullable(),
  durationDays: z.number().int(), trafficGB: z.number().int(), price: z.number().int(), xuiInboundId: z.number().int(), xuiProviderId: z.string().max(40).optional(),
  protocol: z.nativeEnum(Protocol), isActive: z.boolean().optional(), sortOrder: z.number().int().optional(),
  categoryId: z.string().nullable().optional(),
});

const panelBody = z.object({
  code: z.string().max(40).optional(), name: z.string().min(1).max(60), baseUrl: z.string().min(1).max(300),
  username: z.string().max(120).optional(), password: z.string().max(200).optional(), apiToken: z.string().max(400).optional(),
  subBaseUrl: z.string().max(300).optional(), publicHost: z.string().max(200).optional(), tlsInsecure: z.boolean().optional(),
});

const PARTNER_RULES: Record<string, z.ZodType<string>> = {
  'partner.enabled': bool, 'partner.autoApprove': bool, 'partner.stackCoupons': bool,
  'partner.defaultDiscount': int(0, 100), 'partner.maxDiscount': int(0, 100), 'partner.reapplyDays': int(0, 365),
};
const PARTNER_KEYS = Object.keys(PARTNER_RULES) as SettingKey[];

const confirmFor = (externalId: string) => `DELETE ${externalId.slice(-6)}`;

export const routes: Route[] = [
  { method: 'GET', re: /^\/me$/, perm: null, run: async (c) => ({ telegramId: String(c.admin.telegramId), role: c.admin.role, permissions: ROLE_PERMISSIONS[c.admin.role] }) },
  { method: 'GET', re: /^\/dashboard$/, perm: 'stats.view', run: () => Q.dashboard(30) },

  { method: 'GET', re: /^\/users$/, perm: 'users.view', run: (c) => Q.listUsers(str(c, 'q'), str(c, 'status'), page(c)) },
  { method: 'GET', re: /^\/users\/([\w-]+)$/, perm: 'users.view', run: async (c) => (await Q.getUserDetail(c.params[0])) ?? Promise.reject(new NotFoundError('user')) },

  { method: 'GET', re: /^\/products$/, perm: 'products.manage', run: async () => ({ items: await listAllProducts() }) },
  { method: 'POST', re: /^\/products$/, perm: 'products.manage', run: async (c) => createProduct(actor(c), productBody.parse(c.body) as any) },
  {
    method: 'POST', re: /^\/products\/bulk$/, perm: 'products.manage',
    run: async (c) => {
      const b = z.object({ text: z.string().min(1).max(20_000), panel: z.string().max(40).optional().nullable(), inbound: z.number().int().min(1).optional().nullable(), protocol: z.nativeEnum(Protocol).optional().nullable(), category: z.string().max(120).optional().nullable() }).parse(c.body);
      const created = await createProductsBulk(actor(c), b.text, { panel: b.panel?.trim().toLowerCase() || undefined, inbound: b.inbound ?? undefined, protocol: b.protocol ?? undefined, category: b.category?.trim() || undefined });
      return { created: created.length, items: created };
    },
  },
  { method: 'PATCH', re: /^\/products\/([\w-]+)$/, perm: 'products.manage', run: async (c) => updateProduct(actor(c), c.params[0], productBody.partial().parse(c.body) as any) },
  { method: 'DELETE', re: /^\/products\/([\w-]+)$/, perm: 'products.manage', run: async (c) => { await deleteProduct(actor(c), c.params[0]); return { ok: true }; } },

  { method: 'GET', re: /^\/categories$/, perm: 'products.manage', run: async () => ({ items: await categoryTree() }) },
  {
    method: 'POST', re: /^\/categories$/, perm: 'products.manage',
    run: async (c) => createCategory(actor(c), z.object({ name: z.string(), icon: z.string().max(8).nullable().optional(), description: z.string().max(300).nullable().optional(), parentId: z.string().nullable().optional() }).parse(c.body)),
  },
  {
    method: 'PATCH', re: /^\/categories\/([\w-]+)$/, perm: 'products.manage',
    run: async (c) => updateCategory(actor(c), c.params[0], z.object({ name: z.string().optional(), icon: z.string().max(8).nullable().optional(), description: z.string().max(300).nullable().optional(), isActive: z.boolean().optional(), parentId: z.string().nullable().optional() }).parse(c.body)),
  },
  { method: 'POST', re: /^\/categories\/([\w-]+)\/move$/, perm: 'products.manage', run: async (c) => ({ moved: await moveCategory(actor(c), c.params[0], z.object({ dir: z.enum(['up', 'down']) }).parse(c.body).dir) }) },
  { method: 'DELETE', re: /^\/categories\/([\w-]+)$/, perm: 'products.manage', run: async (c) => deleteCategory(actor(c), c.params[0]) },

  { method: 'GET', re: /^\/texts$/, perm: 'texts.manage', run: async () => ({ items: (await listTexts()).map((t) => ({ ...t, preview: previewText(t.key, t.value) })) }) },
  {
    method: 'PUT', re: /^\/texts$/, perm: 'texts.manage',
    run: async (c) => {
      const b = z.object({ key: z.string(), value: z.string().max(5000) }).parse(c.body);
      if (!isTextKey(b.key)) throw new NotFoundError('text');
      await setText(actor(c), b.key, b.value);
      return { ok: true };
    },
  },
  { method: 'DELETE', re: /^\/texts\/([\w.]+)$/, perm: 'texts.manage', run: async (c) => { if (!isTextKey(c.params[0])) throw new NotFoundError('text'); await resetText(actor(c), c.params[0]); return { ok: true }; } },

  { method: 'GET', re: /^\/channels$/, perm: 'settings.manage', run: async () => ({ items: (await listChannels()).map((c) => ({ ...c, chatId: String(c.chatId) })) }) },
  {
    method: 'POST', re: /^\/channels$/, perm: 'settings.manage',
    run: async (c) => { const b = z.object({ ref: z.string().min(2).max(200), inviteUrl: z.string().max(200).nullable().optional() }).parse(c.body); const ch = await addChannel(actor(c), b.ref, b.inviteUrl ?? undefined); return { ...ch, chatId: String(ch.chatId) }; },
  },
  { method: 'PATCH', re: /^\/channels\/([\w-]+)$/, perm: 'settings.manage', run: async (c) => { const ch = await setChannelActive(actor(c), c.params[0], z.object({ isActive: z.boolean() }).parse(c.body).isActive); return { ...ch, chatId: String(ch.chatId) }; } },
  { method: 'POST', re: /^\/channels\/([\w-]+)\/test$/, perm: 'settings.manage', run: (c) => testChannel(c.params[0]) },
  { method: 'DELETE', re: /^\/channels\/([\w-]+)$/, perm: 'settings.manage', run: async (c) => { await deleteChannel(actor(c), c.params[0]); return { ok: true }; } },

  { method: 'GET', re: /^\/orders$/, perm: 'users.view', run: (c) => Q.listOrders(str(c, 'q'), str(c, 'status'), page(c)) },

  { method: 'GET', re: /^\/payments$/, perm: 'payments.view', run: (c) => Q.listPayments(str(c, 'filter'), str(c, 'q'), page(c)) },
  { method: 'GET', re: /^\/payments\/([\w-]+)$/, perm: 'payments.view', run: async (c) => (await Q.getPaymentDetail(c.params[0])) ?? Promise.reject(new NotFoundError('payment')) },
  {
    method: 'GET', re: /^\/payments\/([\w-]+)\/receipt$/, perm: 'payments.view',
    run: async (c) => {
      const p = await prisma.payment.findUnique({ where: { id: c.params[0] } });
      if (!p?.receiptPath) throw new NotFoundError('receipt');
      const buf = await readFile(p.receiptPath).catch(() => { throw new NotFoundError('receipt file'); });
      return { raw: buf, contentType: receiptType(buf) };
    },
  },
  { method: 'POST', re: /^\/payments\/([\w-]+)\/approve$/, perm: 'payments.review', run: async (c) => ({ changed: (await approvePayment(c.params[0], { actor: actor(c) })).changed }) },
  { method: 'POST', re: /^\/payments\/([\w-]+)\/reject$/, perm: 'payments.review', run: async (c) => ({ changed: (await rejectPayment(c.params[0], { actor: actor(c), reason: z.object({ reason: z.string().trim().min(2).max(300) }).parse(c.body).reason })).changed }) },
  { method: 'POST', re: /^\/payments\/([\w-]+)\/review$/, perm: 'payments.review', run: async (c) => ({ changed: await requestReview(c.params[0], actor(c), typeof c.body?.note === 'string' ? c.body.note.slice(0, 200) : undefined) }) },

  { method: 'GET', re: /^\/services$/, perm: 'vpn.view', run: (c) => Q.listServices(str(c, 'q'), str(c, 'status'), page(c)) },
  { method: 'GET', re: /^\/services\/([\w-]+)$/, perm: 'vpn.view', run: async (c) => { const d = await Q.getServiceDetail(c.params[0]); if (!d) throw new NotFoundError('service'); const { config: _c, subscriptionUrl: _s, ...svc } = d.service; return { ...d, service: svc }; } },
  { method: 'POST', re: /^\/services\/([\w-]+)\/sync$/, perm: 'vpn.view', run: async (c) => ({ synced: !!(await syncService(c.params[0])) }) },
  { method: 'POST', re: /^\/services\/([\w-]+)\/retry$/, perm: 'vpn.manage', run: async (c) => { const s = await prisma.vpnService.findUniqueOrThrow({ where: { id: c.params[0] } }); return { result: await adminRetry(s.orderId, actor(c)) }; } },
  { method: 'POST', re: /^\/services\/([\w-]+)\/suspend$/, perm: 'vpn.manage', run: async (c) => { await suspendService(c.params[0], actor(c)); return { ok: true }; } },
  { method: 'POST', re: /^\/services\/([\w-]+)\/resume$/, perm: 'vpn.manage', run: async (c) => { await resumeService(c.params[0], actor(c)); return { ok: true }; } },
  { method: 'POST', re: /^\/services\/([\w-]+)\/renew$/, perm: 'vpn.manage', run: async (c) => { await adminRenew(c.params[0], z.object({ productId: z.string() }).parse(c.body).productId, actor(c)); return { ok: true }; } },
  {
    method: 'POST', re: /^\/services\/([\w-]+)\/delete$/, perm: 'vpn.delete',
    run: async (c) => {
      const s = await prisma.vpnService.findUnique({ where: { id: c.params[0] } });
      if (!s) throw new NotFoundError('service');
      if (c.body?.confirm !== confirmFor(s.externalId)) throw new ValidationError('عبارت تأیید اشتباه است؛ حذف انجام نشد');
      await deleteService(s.id, actor(c));
      return { ok: true };
    },
  },

  { method: 'GET', re: /^\/coupons$/, perm: 'coupons.manage', run: async () => ({ items: await listCoupons() }) },
  {
    method: 'POST', re: /^\/coupons$/, perm: 'coupons.manage',
    run: async (c) => {
      const b = z.object({ code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/), type: z.enum(['PERCENT', 'FIXED']), value: z.number().int().positive(), maxUses: z.number().int().positive().optional().nullable(), expiresAt: z.string().datetime().optional().nullable() }).parse(c.body);
      return createCoupon(actor(c), { code: b.code, type: b.type, value: b.value, maxUses: b.maxUses ?? undefined, expiresAt: b.expiresAt ? new Date(b.expiresAt) : undefined });
    },
  },
  { method: 'POST', re: /^\/coupons\/([\w-]+)\/toggle$/, perm: 'coupons.manage', run: async (c) => setCouponActive(actor(c), c.params[0], z.object({ isActive: z.boolean() }).parse(c.body).isActive) },

  { method: 'GET', re: /^\/tickets$/, perm: 'support.reply', run: (c) => Q.listTickets(str(c, 'q'), str(c, 'status'), page(c)) },
  { method: 'GET', re: /^\/tickets\/([\w-]+)$/, perm: 'support.reply', run: async (c) => (await Q.getTicketDetail(c.params[0])) ?? Promise.reject(new NotFoundError('ticket')) },
  { method: 'POST', re: /^\/tickets\/([\w-]+)\/reply$/, perm: 'support.reply', run: async (c) => { await adminReply(c.admin.telegramId, c.params[0], z.object({ text: z.string().trim().min(1).max(3000) }).parse(c.body).text); return { ok: true }; } },
  { method: 'POST', re: /^\/tickets\/([\w-]+)\/close$/, perm: 'support.reply', run: async (c) => { await closeTicket(actor(c), c.params[0]); return { ok: true }; } },

  { method: 'GET', re: /^\/notifications$/, perm: 'stats.view', run: (c) => Q.listNotifications(str(c, 'status'), str(c, 'audience'), page(c)) },
  { method: 'POST', re: /^\/notifications\/flush$/, perm: 'stats.view', run: async () => ({ attempted: await flushPending(100) }) },

  {
    method: 'GET', re: /^\/settings$/, perm: 'settings.manage',
    run: async () => {
      const s = await allSettings();
      const editable = Object.fromEntries(Object.keys(SETTING_RULES).map((k) => [k, s[k as SettingKey]]));
      const e = env();
      return { settings: editable, defaults: Object.keys(SETTING_DEFAULTS).length, runtime: { vpnProvider: e.VPN_PROVIDER, panels: (await listPanels()).length, bankWebhook: !!e.BANK_WEBHOOK_SECRET, cryptoEnabled: false, nodeEnv: e.NODE_ENV } };
    },
  },
  { method: 'PUT', re: /^\/settings$/, perm: 'settings.manage', run: putSetting },
  // Partner (reseller) programme
  {
    method: 'GET', re: /^\/partners$/, perm: 'partners.manage',
    run: async (c) => {
      const status = str(c, 'status', 12).toUpperCase() as PartnerFilter;
      const f: PartnerFilter = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(status) ? status : 'ALL';
      const pg = page(c); const size = 25;
      const rows = await listPartners(f, (pg - 1) * size, size + 1);
      const items = await Promise.all(rows.slice(0, size).map(async (p) => ({
        id: p.id, status: p.status, discountPercent: p.discountPercent, note: p.note, adminNote: p.adminNote, requestedAt: p.requestedAt, decidedAt: p.decidedAt, decidedBy: p.decidedBy,
        user: { id: p.user.id, telegramId: String(p.user.telegramId), username: p.user.username, name: [p.user.firstName, p.user.lastName].filter(Boolean).join(' ') },
        stats: await partnerStats(p.userId),
      })));
      const counts = await partnerCounts();
      return { items, counts, page: pg, pageSize: size, total: f === 'ALL' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[f] };
    },
  },
  { method: 'POST', re: /^\/partners\/([\w-]+)\/approve$/, perm: 'partners.manage', run: async (c) => { const b = z.object({ percent: z.number().int().optional().nullable() }).parse(c.body ?? {}); const p = await getPartnerById(c.params[0]); if (p.status === 'APPROVED' && b.percent != null) await setPartnerPercent(actor(c), p.id, b.percent); else await approvePartner(actor(c), p.id, b.percent ?? undefined); return { ok: true }; } },
  { method: 'POST', re: /^\/partners\/([\w-]+)\/reject$/, perm: 'partners.manage', run: async (c) => { await rejectPartner(actor(c), c.params[0], z.object({ reason: z.string().min(1).max(300) }).parse(c.body).reason); return { ok: true }; } },
  { method: 'POST', re: /^\/partners\/([\w-]+)\/suspend$/, perm: 'partners.manage', run: async (c) => { await setPartnerSuspended(actor(c), c.params[0], z.object({ suspended: z.boolean() }).parse(c.body).suspended); return { ok: true }; } },
  { method: 'GET', re: /^\/partners\/settings$/, perm: 'partners.manage', run: async () => { const s = await allSettings(); return Object.fromEntries(PARTNER_KEYS.map((k) => [k, s[k]])); } },
  {
    method: 'PUT', re: /^\/partners\/settings$/, perm: 'partners.manage',
    run: async (c) => {
      const b = z.object({ key: z.enum(PARTNER_KEYS as [SettingKey, ...SettingKey[]]), value: z.string() }).parse(c.body);
      const v = PARTNER_RULES[b.key].parse(b.value.trim());
      await setSetting(b.key, v);
      await audit({ actor: actor(c), action: 'setting.change', target: 'Setting', targetId: b.key, metadata: { value: v } });
      return { ok: true };
    },
  },

  { method: 'GET', re: /^\/xui\/status$/, perm: 'settings.manage', run: async () => ({ panels: await Promise.all((await listPanels()).filter((p) => p.isActive).map(async (p) => ({ code: p.code, name: p.name, ...(await testPanel(p.code)) }))) }) },

  // Multi-panel management. Secrets are write-only: they are never returned.
  { method: 'GET', re: /^\/panels$/, perm: 'panels.manage', run: async () => ({ items: (await listPanels()).map((p) => ({ ...p, health: panelHealth.get(p.code) ?? null })) }) },
  { method: 'GET', re: /^\/panels\/options$/, perm: 'products.manage', run: async () => ({ items: (await listPanels()).filter((p) => p.isActive).map((p: PanelView) => ({ code: p.code, name: p.name })) }) },
  { method: 'POST', re: /^\/panels$/, perm: 'panels.manage', run: async (c) => { const r = await createPanel(actor(c), panelBody.parse(c.body) as any); return { id: r.id, code: r.code }; } },
  { method: 'PATCH', re: /^\/panels\/([\w-]+)$/, perm: 'panels.manage', run: async (c) => { await updatePanel(actor(c), c.params[0], panelBody.partial().parse(c.body) as any); return { ok: true }; } },
  { method: 'POST', re: /^\/panels\/([\w-]+)\/active$/, perm: 'panels.manage', run: async (c) => { await setPanelActive(actor(c), c.params[0], z.object({ isActive: z.boolean() }).parse(c.body).isActive); return { ok: true }; } },
  { method: 'DELETE', re: /^\/panels\/([\w-]+)$/, perm: 'panels.manage', run: async (c) => { await deletePanel(actor(c), c.params[0]); return { ok: true }; } },
  { method: 'POST', re: /^\/panels\/([\w-]+)\/test$/, perm: 'panels.manage', run: (c) => testPanel(c.params[0]) },
  { method: 'GET', re: /^\/panels\/([\w-]+)\/inbounds$/, perm: 'products.manage', run: async (c) => ({ items: await listPanelInbounds(c.params[0]) }) },

  { method: 'GET', re: /^\/audit$/, perm: 'audit.view', run: (c) => Q.listAudit(str(c, 'q'), str(c, 'action'), page(c)) },
];

export async function dispatch(method: string, path: string, c: Omit<ApiCtx, 'params'>): Promise<{ status: number; body: unknown }> {
  try {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(path);
      if (!m) continue;
      if (r.perm) await requirePermission(c.admin.telegramId, r.perm);
      return { status: 200, body: await r.run({ ...c, params: m.slice(1) }) };
    }
    return { status: 404, body: { error: 'not_found', message: 'مسیر یافت نشد' } };
  } catch (e: any) {
    if (e instanceof z.ZodError) return { status: 400, body: { error: 'validation', message: e.issues[0] ? `${e.issues[0].path.join('.') || 'ورودی'}: ${e.issues[0].message}` : 'ورودی نامعتبر' } };
    if (e instanceof ForbiddenError) return { status: 403, body: { error: 'forbidden', message: 'دسترسی غیرمجاز' } };
    if (e instanceof AppError) return { status: e.code === 'NOT_FOUND' ? 404 : e.code === 'CONFLICT' ? 409 : 400, body: { error: e.code.toLowerCase(), message: e.message } };
    if (e?.code === 'P2025') return { status: 404, body: { error: 'not_found', message: 'یافت نشد' } };
    if (e?.code === 'P2002') return { status: 409, body: { error: 'conflict', message: 'مقدار تکراری است' } };
    return { status: 500, body: { error: 'internal', message: 'خطای داخلی سرور' } };
  }
}
