import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { decryptSecret, encryptSecret } from '../../utils/secrets';
import { audit } from '../admin/audit';
import { DEFAULT_PANEL, PanelConfig, envPanelConfig, providerFromConfig, usesFixedProvider, vpnFor } from '../../providers/vpn';
import { InboundInfo } from '../../providers/vpn/types';
import { PanelProfile } from '../../providers/vpn';
import { DEFAULT_PROFILES } from '../../providers/vpn/vpnpanel/provider';
import { VpnPanelClient, VpnPanelNode, VpnPanelProtocol } from '../../providers/vpn/vpnpanel/client';
import { xuiFetch } from '../../providers/vpn/xui/net';

const url = z.string().trim().min(1).transform((v) => v.replace(/\/+$/, '')).refine((v) => {
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}, 'آدرس باید با http:// یا https:// شروع شود');
const optUrl = z.string().trim().transform((v) => v.replace(/\/+$/, '')).refine((v) => {
  if (!v) return true;
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}, 'آدرس نامعتبر است');

export const CODE_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

export const profileSchema = z.object({
  id: z.number().int().min(1).max(999),
  name: z.string().trim().min(1, 'نام پروفایل خالی است').max(60),
  protos: z.array(z.string().regex(/^[a-z0-9_]{1,20}$/, 'شناسه‌ی پروتکل نامعتبر است')).min(1, 'هر پروفایل حداقل یک پروتکل لازم دارد').max(20),
  nodeIds: z.array(z.number().int().min(1)).max(200),
});

export const panelInput = z.object({
  kind: z.enum(['xui', 'vpnpanel']).optional(),
  profiles: z.array(profileSchema).max(30).optional(),
  code: z.string().trim().toLowerCase().regex(CODE_RE, 'کد پنل: فقط حروف کوچک انگلیسی، عدد و -  (۲ تا ۳۲ کاراکتر)').optional(),
  name: z.string().trim().min(1, 'نام پنل خالی است').max(60),
  baseUrl: url,
  username: z.string().trim().max(120).optional(),
  password: z.string().max(200).optional(),
  apiToken: z.string().trim().max(400).optional(),
  subBaseUrl: optUrl.optional(),
  publicHost: z.string().trim().max(200).optional(),
  tlsInsecure: z.boolean().optional(),
});
export type PanelInput = z.input<typeof panelInput>;
export const panelPatch = panelInput.partial();

export interface PanelView {
  id: string; code: string; name: string; baseUrl: string; kind: 'xui' | 'vpnpanel'; profiles: PanelProfile[]; auth: 'token' | 'password' | 'none';
  subBaseUrl: string | null; publicHost: string | null; tlsInsecure: boolean; isActive: boolean;
  source: 'db' | 'env'; products: number; services: number;
}

/** Last known health per panel code (filled by the health job and by manual tests). */
export const panelHealth = new Map<string, { ok: boolean; detail: string; at: number; ms: number }>();

export const profilesOf = (r: { kind: string; options: unknown }): PanelProfile[] => (r.kind === 'vpnpanel' ? ((r.options as { profiles?: PanelProfile[] } | null)?.profiles ?? DEFAULT_PROFILES) : []);
const authOf = (r: { apiTokenEnc?: string | null; passwordEnc?: string | null }) => (r.apiTokenEnc ? 'token' : r.passwordEnc ? 'password' : 'none') as PanelView['auth'];

export async function listPanels(): Promise<PanelView[]> {
  const rows = await prisma.panel.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  const [pc, sc] = await Promise.all([
    prisma.product.groupBy({ by: ['xuiProviderId'], _count: true }),
    prisma.vpnService.groupBy({ by: ['provider'], _count: true }),
  ]);
  const prodBy = new Map(pc.map((r) => [r.xuiProviderId, r._count]));
  const svcBy = new Map(sc.map((r) => [r.provider, r._count]));
  const count = (code: string) => ({ products: prodBy.get(code) ?? 0, services: svcBy.get(code) ?? 0 });
  const out: PanelView[] = [];
  const env = envPanelConfig();
  if (env && !rows.some((r) => r.code === DEFAULT_PANEL)) {
    out.push({
      id: 'env', code: DEFAULT_PANEL, name: 'پنل اصلی (از تنظیمات سرور)', baseUrl: env.baseUrl, kind: 'xui', profiles: [], auth: env.apiToken ? 'token' : env.username ? 'password' : 'none',
      subBaseUrl: env.subBaseUrl ?? null, publicHost: env.publicHost ?? null, tlsInsecure: !!env.tlsInsecure, isActive: true, source: 'env', ...count(DEFAULT_PANEL),
    });
  }
  for (const r of rows) {
    out.push({
      id: r.id, code: r.code, name: r.name, baseUrl: r.baseUrl, kind: (r.kind === 'vpnpanel' ? 'vpnpanel' : 'xui'), profiles: profilesOf(r), auth: authOf(r), subBaseUrl: r.subBaseUrl, publicHost: r.publicHost,
      tlsInsecure: r.tlsInsecure, isActive: r.isActive, source: 'db', ...count(r.code),
    });
  }
  return out;
}

export async function getPanel(idOrCode: string): Promise<PanelView> {
  const p = (await listPanels()).find((x) => x.id === idOrCode || x.code === idOrCode);
  if (!p) throw new NotFoundError('panel');
  return p;
}

/** A product/service may only point at an existing, active panel. */
export async function assertPanel(code: string) {
  if (usesFixedProvider()) return;
  const p = (await listPanels()).find((x) => x.code === code);
  if (!p) throw new ValidationError(`پنل «${code}» وجود ندارد. ابتدا از بخش «پنل‌های X-UI» آن را اضافه کنید.`);
  if (!p.isActive) throw new ValidationError(`پنل «${p.name}» غیرفعال است.`);
}

function slug(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  return s.length >= 2 ? s : 'panel';
}
async function freeCode(name: string): Promise<string> {
  const base = slug(name);
  for (let n = 1; n < 100; n++) {
    const c = n === 1 ? base : `${base}-${n}`;
    if (c !== DEFAULT_PANEL && !(await prisma.panel.findUnique({ where: { code: c }, select: { id: true } }))) return c;
  }
  throw new ConflictError('could not allocate a panel code');
}

export interface TestResult { ok: boolean; detail: string; ms: number; inbounds: number }

/** Try login + list inbounds with a candidate config (nothing is stored). */
export async function testConfig(cfg: PanelConfig): Promise<TestResult> {
  const t0 = Date.now();
  const p = providerFromConfig(cfg);
  const h = await p.healthCheck();
  const n = h.ok ? Number(/(\d+) (?:inbound|node)/.exec(h.detail)?.[1] ?? 0) : 0;
  return { ok: h.ok, detail: h.detail, ms: Date.now() - t0, inbounds: n };
}

export async function testPanel(code: string): Promise<TestResult> {
  const t0 = Date.now();
  let r: TestResult;
  try {
    const h = await (await vpnFor(code)).healthCheck();
    r = { ok: h.ok, detail: h.detail, ms: Date.now() - t0, inbounds: h.ok ? Number(/(\d+) (?:inbound|node)/.exec(h.detail)?.[1] ?? 0) : 0 };
  } catch (e: any) {
    r = { ok: false, detail: String(e?.message ?? e), ms: Date.now() - t0, inbounds: 0 };
  }
  panelHealth.set(code, { ok: r.ok, detail: r.detail, at: Date.now(), ms: r.ms });
  return r;
}

export async function listPanelInbounds(code: string): Promise<InboundInfo[]> {
  return (await vpnFor(code)).listInbounds();
}

const SUPPORTED = new Set(['vless', 'vmess', 'trojan', 'shadowsocks']);
export const isSupportedProtocol = (p: string) => SUPPORTED.has(p.toLowerCase()) || p === 'profile';

/** What the panel really offers (for the admin forms and for validating profiles). */
export async function probePanel(cfg: { baseUrl: string; apiToken: string; tlsInsecure?: boolean }): Promise<{ nodes: VpnPanelNode[]; protocols: VpnPanelProtocol[] }> {
  const parsed = z.object({ baseUrl: url, apiToken: z.string().trim().min(8) }).safeParse(cfg);
  if (!parsed.success) throw new ValidationError('آدرس پنل و توکن API را درست وارد کنید');
  const c = new VpnPanelClient({ baseUrl: parsed.data.baseUrl, apiKey: parsed.data.apiToken, fetchImpl: xuiFetch(!!cfg.tlsInsecure) });
  try {
    const [protocols, nodes] = await Promise.all([c.protocols(), c.nodes()]);
    return { nodes, protocols };
  } catch (e: any) { throw new ValidationError(`اتصال به پنل برقرار نشد:\n${String(e?.message ?? e)}`); }
}

/** A profile may only use protocols and locations that exist on the panel, and never a protocol that does not count traffic. */
export async function validateProfiles(cfg: { baseUrl: string; apiToken: string; tlsInsecure?: boolean }, profiles: PanelProfile[]) {
  const ids = profiles.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new ValidationError('شماره‌ی پروفایل‌ها باید یکتا باشد');
  const { nodes, protocols } = await probePanel(cfg);
  for (const p of profiles) {
    for (const id of p.protos) {
      const proto = protocols.find((x) => x.id === id);
      if (!proto) throw new ValidationError(`پروفایل ${p.id}: پروتکل «${id}» در پنل وجود ندارد`);
      if (!proto.counted) throw new ValidationError(`پروفایل ${p.id}: پروتکل «${id}» حجم مصرفی را نمی‌شمارد و برای فروش حجمی مناسب نیست (کاربر می‌تواند بدون محدودیت حجم مصرف کند)`);
    }
    for (const n of p.nodeIds) if (!nodes.some((x) => x.id === n)) throw new ValidationError(`پروفایل ${p.id}: لوکیشن شماره‌ی ${n} در پنل وجود ندارد`);
  }
}

export async function createPanel(actor: string, input: PanelInput, opts: { test?: boolean } = {}) {
  const d = panelInput.parse(input);
  const kind = d.kind ?? 'xui';
  if (kind === 'vpnpanel') { if (!d.apiToken) throw new ValidationError('برای پنل اختصاصی «توکن» (همان PANEL_API_KEY در .env پنل) لازم است.'); }
  else if (!d.apiToken && !(d.username && d.password)) throw new ValidationError('یا «کاربر + رمز» پنل را بدهید یا «توکن API».');
  if (kind === 'xui' && d.profiles?.length) throw new ValidationError('«پروفایل» فقط برای پنل اختصاصی است.');
  const profiles = kind === 'vpnpanel' ? (d.profiles?.length ? d.profiles : DEFAULT_PROFILES) : undefined;
  const code = d.code ?? (await freeCode(d.name));
  if (code === DEFAULT_PANEL) throw new ValidationError('کد «default» برای پنل تنظیمات سرور رزرو است.');
  if (await prisma.panel.findUnique({ where: { code }, select: { id: true } })) throw new ConflictError(`کد «${code}» قبلاً استفاده شده است.`);
  if (await prisma.panel.findFirst({ where: { baseUrl: d.baseUrl, kind, username: d.username ?? null } })) throw new ConflictError('این پنل (همین آدرس و کاربر) قبلاً اضافه شده است.');
  if (opts.test !== false) {
    const t = await testConfig({ ...d, kind, profiles, subBaseUrl: d.subBaseUrl || null });
    if (!t.ok) throw new ValidationError(`اتصال به پنل برقرار نشد، ذخیره نشد:\n${t.detail}`);
    if (kind === 'vpnpanel') await validateProfiles({ baseUrl: d.baseUrl, apiToken: d.apiToken!, tlsInsecure: d.tlsInsecure }, profiles!);
  }
  const row = await prisma.panel.create({
    data: {
      code, name: d.name, baseUrl: d.baseUrl, username: d.username || null, passwordEnc: d.password ? encryptSecret(d.password) : null,
      apiTokenEnc: d.apiToken ? encryptSecret(d.apiToken) : null, subBaseUrl: d.subBaseUrl || null, publicHost: d.publicHost || null, tlsInsecure: d.tlsInsecure ?? false,
      kind, ...(profiles ? { options: { profiles } as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  await audit({ actor, action: 'panel.create', target: 'Panel', targetId: row.id, metadata: { code, name: d.name, baseUrl: d.baseUrl, kind, auth: authOf(row), profiles: profiles?.length } });
  return row;
}

export async function updatePanel(actor: string, id: string, patch: PanelInput | Partial<PanelInput>, opts: { test?: boolean } = {}) {
  const row = await prisma.panel.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('panel');
  const d = panelPatch.parse(patch);
  if (d.code && d.code !== row.code) throw new ValidationError('کد پنل بعد از ساخت قابل تغییر نیست.');
  if (d.kind && d.kind !== row.kind) throw new ValidationError('نوع پنل بعد از ساخت قابل تغییر نیست.');
  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.baseUrl !== undefined) data.baseUrl = d.baseUrl;
  if (d.username !== undefined) data.username = d.username || null;
  if (d.password) data.passwordEnc = encryptSecret(d.password);
  if (d.apiToken !== undefined) data.apiTokenEnc = d.apiToken ? encryptSecret(d.apiToken) : null;
  if (d.subBaseUrl !== undefined) data.subBaseUrl = d.subBaseUrl || null;
  if (d.publicHost !== undefined) data.publicHost = d.publicHost || null;
  if (d.tlsInsecure !== undefined) data.tlsInsecure = d.tlsInsecure;
  let profiles: PanelProfile[] | undefined;
  if (d.profiles) {
    if (row.kind !== 'vpnpanel') throw new ValidationError('«پروفایل» فقط برای پنل اختصاصی است.');
    if (!d.profiles.length) throw new ValidationError('حداقل یک پروفایل لازم است');
    profiles = d.profiles;
    const removed = profilesOf(row).map((p) => p.id).filter((x) => !profiles!.some((p) => p.id === x));
    if (removed.length) {
      const used = await prisma.product.count({ where: { xuiProviderId: row.code, xuiInboundId: { in: removed } } });
      if (used) throw new ValidationError(`پروفایل ${removed.join('، ')} هنوز روی ${used} محصول استفاده می‌شود؛ اول محصول را به پروفایل دیگری ببرید.`);
    }
    data.options = { profiles } as unknown as Prisma.InputJsonValue;
  }
  if (!Object.keys(data).length) return row;
  const connection = ['baseUrl', 'username', 'passwordEnc', 'apiTokenEnc', 'tlsInsecure'].some((k) => k in data);
  if ((connection || profiles) && opts.test !== false && row.isActive) {
    const merged = {
      kind: row.kind, profiles: profiles ?? profilesOf(row),
      baseUrl: (data.baseUrl as string) ?? row.baseUrl,
      username: ('username' in data ? (data.username as string | null) : row.username),
      password: d.password ?? (row.passwordEnc ? decryptSecret(row.passwordEnc) : null),
      apiToken: 'apiTokenEnc' in data ? (d.apiToken || null) : (row.apiTokenEnc ? decryptSecret(row.apiTokenEnc) : null),
      subBaseUrl: 'subBaseUrl' in data ? (data.subBaseUrl as string | null) : row.subBaseUrl,
      publicHost: 'publicHost' in data ? (data.publicHost as string | null) : row.publicHost,
      tlsInsecure: ('tlsInsecure' in data ? (data.tlsInsecure as boolean) : row.tlsInsecure),
    };
    const t = await testConfig(merged);
    if (!t.ok) throw new ValidationError(`اتصال با مشخصات جدید برقرار نشد، تغییری ذخیره نشد:\n${t.detail}`);
    if (row.kind === 'vpnpanel' && merged.apiToken) await validateProfiles({ baseUrl: merged.baseUrl, apiToken: merged.apiToken, tlsInsecure: merged.tlsInsecure }, merged.profiles);
  }
  const updated = await prisma.panel.update({ where: { id }, data });
  panelHealth.delete(row.code);
  await audit({ actor, action: 'panel.update', target: 'Panel', targetId: id, metadata: { code: row.code, fields: Object.keys(data).map((k) => k.replace(/Enc$/, '')) } });
  return updated;
}

export async function setPanelActive(actor: string, id: string, isActive: boolean) {
  const row = await prisma.panel.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('panel');
  const u = await prisma.panel.update({ where: { id }, data: { isActive } });
  await audit({ actor, action: isActive ? 'panel.enable' : 'panel.disable', target: 'Panel', targetId: id, metadata: { code: row.code } });
  return u;
}

export async function deletePanel(actor: string, id: string) {
  const row = await prisma.panel.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('panel');
  const products = await prisma.product.count({ where: { xuiProviderId: row.code } });
  const services = await prisma.vpnService.count({ where: { provider: row.code } });
  if (products || services) throw new ValidationError(`این پنل هنوز ${products} محصول و ${services} سرویس دارد؛ حذفش ممکن نیست. به‌جایش غیرفعالش کنید.`);
  await prisma.panel.delete({ where: { id } });
  panelHealth.delete(row.code);
  await audit({ actor, action: 'panel.delete', target: 'Panel', targetId: id, metadata: { code: row.code, name: row.name } });
}

/** Codes of every panel the health job should watch. */
export async function activePanelCodes(): Promise<string[]> {
  return (await listPanels()).filter((p) => p.isActive).map((p) => p.code);
}

/* --------------------------- "key: value" message parser --------------------------- */

const KEYS: Record<string, keyof PanelInput> = {
  name: 'name', 'نام': 'name',
  url: 'baseUrl', address: 'baseUrl', 'آدرس': 'baseUrl', 'ادرس': 'baseUrl',
  user: 'username', username: 'username', 'کاربر': 'username', 'یوزر': 'username',
  pass: 'password', password: 'password', 'رمز': 'password', 'پسورد': 'password',
  token: 'apiToken', 'توکن': 'apiToken',
  sub: 'subBaseUrl', 'ساب': 'subBaseUrl', 'اشتراک': 'subBaseUrl',
  host: 'publicHost', 'هاست': 'publicHost', 'دامنه': 'publicHost',
  code: 'code', 'کد': 'code',
  tls: 'tlsInsecure', 'گواهی': 'tlsInsecure',
  type: 'kind', kind: 'kind', 'نوع': 'kind',
  profile: 'profiles', 'پروفایل': 'profiles',
};
const FA = '۰۱۲۳۴۵۶۷۸۹';
const latin = (s: string) => s.replace(/[۰-۹]/g, (c) => String(FA.indexOf(c)));

/** `id | name | protocols | locations`  e.g.  `1 | اصلی | vless,trojan | همه`  or  `2 | آلمان | vless | 1,3`. */
export function parseProfileLine(raw: string): PanelProfile {
  const parts = raw.split('|').map((x) => x.trim());
  if (parts.length < 3 || parts.length > 4) throw new ValidationError(`پروفایل «${raw.slice(0, 40)}» باید این شکل باشد:  شماره | نام | پروتکل‌ها | لوکیشن‌ها`);
  const id = Number(latin(parts[0]));
  const protos = latin(parts[2]).toLowerCase().split(/[,،\s]+/).filter(Boolean);
  const where = latin(parts[3] ?? '').trim().toLowerCase();
  const nodeIds = !where || ['همه', 'all', '*'].includes(where) ? [] : where.split(/[,،\s]+/).filter(Boolean).map(Number);
  if (!Number.isInteger(id) || nodeIds.some((n) => !Number.isInteger(n))) throw new ValidationError(`شماره‌ی پروفایل/لوکیشن در «${raw.slice(0, 40)}» عدد نیست`);
  return profileSchema.parse({ id, name: parts[1], protos, nodeIds });
}
const YES = /^(insecure|self-?signed|yes|true|1|بله|آره|ارہ|خودامضا|خودامضاء|نامعتبر|بپذیر)$/i;

/**
 * Parse an admin message like
 *   نام: آلمان
 *   آدرس: https://1.2.3.4:2053/path
 *   کاربر: admin
 *   رمز: secret
 * (English keys work too). `partial` allows an edit message with only the changed lines.
 */
export function parsePanelText(text: string): Record<string, string | boolean | PanelProfile[]> {
  const out: Record<string, string | boolean | PanelProfile[]> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([^:：]+)[:：]\s*(.*)$/.exec(line);
    if (!m) throw new ValidationError(`خط «${line.slice(0, 40)}» فرمت «کلید: مقدار» ندارد`);
    const k = m[1].trim().toLowerCase();
    const key = Object.hasOwn(KEYS, k) ? KEYS[k] : undefined;
    if (!key) throw new ValidationError(`کلید «${m[1].trim()}» شناخته نشد. کلیدهای مجاز: نام، نوع، آدرس، کاربر، رمز، توکن، ساب، هاست، کد، tls، پروفایل`);
    const v = m[2].trim();
    if (key === 'profiles') { ((out.profiles ??= []) as PanelProfile[]).push(parseProfileLine(v)); continue; }
    if (key === 'kind') {
      const kv = v.toLowerCase();
      out.kind = /panel|اختصاصی|پنل/.test(kv) ? 'vpnpanel' : /x-?ui|3x|سنایی/.test(kv) ? 'xui' : (() => { throw new ValidationError('نوع پنل: «panel» (پنل اختصاصی) یا «xui»'); })();
      continue;
    }
    out[key] = key === 'tlsInsecure' ? YES.test(v) : v === '-' ? '' : v;
  }
  if (!Object.keys(out).length) throw new ValidationError('هیچ مقداری پیدا نشد');
  return out;
}
