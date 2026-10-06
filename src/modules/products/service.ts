import { Protocol } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { audit } from '../admin/audit';
import { vpnFor } from '../../providers/vpn';
import { assertPanel } from '../panels/service';

const F = {
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500),
  durationDays: z.number().int().min(1).max(3650),
  trafficGB: z.number().int().min(1).max(100000),
  price: z.number().int().min(0).max(2_000_000_000),
  currency: z.string(),
  xuiProviderId: z.string(),
  xuiInboundId: z.number().int().min(1),
  protocol: z.nativeEnum(Protocol),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  categoryId: z.string().min(1).nullable(),
};
export const productInput = z.object({
  ...F,
  description: F.description.optional(),
  currency: F.currency.default('IRT'),
  xuiProviderId: F.xuiProviderId.default('default'),
  protocol: F.protocol.default('VLESS'),
  isActive: F.isActive.default(true),
  sortOrder: F.sortOrder.default(0),
  categoryId: F.categoryId.optional(),
});
/** Update patch: same validators, but NO defaults — an edit must only touch the fields that were sent. */
export const productPatch = z.object(F).partial();
export type ProductInput = z.input<typeof productInput>;

export const listActiveProducts = () => prisma.product.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });
export const listAllProducts = () => prisma.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });

export async function getProduct(id: string) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new NotFoundError('product');
  return p;
}

/**
 * The inbound must exist (and be enabled) on the real panel — a typo here is what makes every paid order fail provisioning.
 * If the panel itself is unreachable we do not block the admin (provisioning retries/alerts cover that case).
 */
export async function assertInbound(panel: string, id: number) {
  let info;
  try { info = await (await vpnFor(panel)).getInbound(id); } catch { return; }
  if (!info) throw new ValidationError(`inbound شماره ${id} در پنل «${panel}» پیدا نشد. شماره را از لیست inboundهای همان پنل بردارید.`);
  if (!info.enable) throw new ValidationError(`inbound شماره ${id} در پنل «${panel}» غیرفعال است. اول آن را در پنل فعال کنید.`);
}

async function assertCategory(id: string) {
  if (!(await prisma.category.findUnique({ where: { id }, select: { id: true } }))) throw new ValidationError('دسته‌بندی انتخاب‌شده وجود ندارد');
}

export async function createProduct(actor: string, input: ProductInput, opts: { verifyInbound?: boolean } = {}) {
  const data = productInput.parse(input);
  if (opts.verifyInbound !== false) { await assertPanel(data.xuiProviderId); await assertInbound(data.xuiProviderId, data.xuiInboundId); }
  if (data.categoryId) await assertCategory(data.categoryId);
  const p = await prisma.product.create({ data });
  await audit({ actor, action: 'product.create', target: 'Product', targetId: p.id, metadata: data });
  return p;
}

export async function updateProduct(actor: string, id: string, patch: Partial<ProductInput>, opts: { verifyInbound?: boolean } = {}) {
  const before = await getProduct(id);
  const data = productPatch.parse(patch);
  if ((data.xuiInboundId !== undefined || data.xuiProviderId !== undefined) && opts.verifyInbound !== false) {
    const panel = data.xuiProviderId ?? before.xuiProviderId, inbound = data.xuiInboundId ?? before.xuiInboundId;
    if (panel !== before.xuiProviderId || inbound !== before.xuiInboundId) {
      if (panel !== before.xuiProviderId) await assertPanel(panel);
      await assertInbound(panel, inbound);
    }
  }
  if (data.categoryId) await assertCategory(data.categoryId);
  const p = await prisma.product.update({ where: { id }, data });
  await audit({
    actor,
    action: data.price !== undefined && data.price !== before.price ? 'product.price_change' : 'product.update',
    target: 'Product', targetId: id, metadata: { before: { price: before.price, isActive: before.isActive }, patch: data },
  });
  return p;
}

/** Hard delete is only allowed when nothing references the product (keeps order history intact). */
export async function deleteProduct(actor: string, id: string) {
  const p = await getProduct(id);
  const used = (await prisma.order.count({ where: { productId: id } })) + (await prisma.vpnService.count({ where: { productId: id } }));
  if (used > 0) throw new ValidationError('این محصول در سفارش‌ها استفاده شده است؛ به‌جای حذف، آن را غیرفعال کنید.');
  await prisma.product.delete({ where: { id } });
  await audit({ actor, action: 'product.delete', target: 'Product', targetId: id, metadata: { name: p.name } });
}

/* ------------------------- bulk add + single-field edit ------------------------- */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const num = (s: string) =>
  Number(s.replace(/[۰-۹]/g, (c) => String(FA_DIGITS.indexOf(c))).replace(/[٠-٩]/g, (c) => String(AR_DIGITS.indexOf(c))).replace(/[,٬،\s]/g, ''));

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'] as const;
export interface BulkDefaults { inbound?: number; protocol?: Protocol; category?: string; panel?: string }
type ParsedProduct = ProductInput & { categoryPath?: string };

/**
 * One product per line:  name | days | GB | price | [inbound] | [protocol] | [description]
 * Directive lines (`panel=germany inbound=23 protocol=VLESS`, `category=ماهانه ▸ حجمی`) set defaults for the lines below.
 * `category=` creates the menu path if it does not exist; `category=-` goes back to the root.
 * Persian digits and thousands separators are accepted. Lines starting with # are comments.
 */
export function parseProductLines(text: string, defaults: BulkDefaults = {}) {
  const items: ParsedProduct[] = [];
  const errors: string[] = [];
  const def: BulkDefaults = { ...defaults };
  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    const at = `خط ${idx + 1}`;
    if (!line || line.startsWith('#')) return;
    const cat = line.match(/^(?:category|دسته)\s*=\s*(.*)$/i);
    if (cat) { def.category = cat[1].trim() === '-' ? undefined : cat[1].trim() || undefined; return; }
    if (/^(inbound|protocol|panel)\s*=/i.test(line)) {
      for (const m of line.matchAll(/(inbound|protocol|panel)\s*=\s*(\S+)/gi)) {
        if (m[1].toLowerCase() === 'panel') def.panel = m[2].toLowerCase();
        else if (m[1].toLowerCase() === 'inbound') {
          const n = num(m[2]);
          if (!Number.isInteger(n) || n < 1) errors.push(`${at}: شماره inbound نامعتبر است`); else def.inbound = n;
        } else if ((PROTOCOLS as readonly string[]).includes(m[2].toUpperCase())) def.protocol = m[2].toUpperCase() as Protocol;
        else errors.push(`${at}: پروتکل باید یکی از ${PROTOCOLS.join('/')} باشد`);
      }
      return;
    }
    const f = line.split(/\s*[|\t]\s*/).map((x) => x.trim());
    if (f.length < 4) return void errors.push(`${at}: حداقل ۴ بخش لازم است (نام | روز | حجم | قیمت)`);
    if (f.length > 7) return void errors.push(`${at}: بیش از ۷ بخش دارد`);
    const [name, days, gb, price, inbound, protocol, description] = f;
    const proto = (protocol || def.protocol || 'VLESS').toUpperCase();
    if (!(PROTOCOLS as readonly string[]).includes(proto)) return void errors.push(`${at}: پروتکل «${protocol}» نامعتبر است`);
    const inboundId = inbound ? num(inbound) : def.inbound;
    if (inboundId === undefined) return void errors.push(`${at}: inbound مشخص نشده (در خط یا با inbound=شماره بالای لیست)`);
    const parsed = productInput.safeParse({
      name, description: description || undefined, durationDays: num(days), trafficGB: num(gb), price: num(price),
      xuiInboundId: inboundId, protocol: proto, ...(def.panel ? { xuiProviderId: def.panel } : {}),
    });
    if (!parsed.success) {
      const labels: Record<string, string> = { name: 'نام', durationDays: 'روز', trafficGB: 'حجم', price: 'قیمت', xuiInboundId: 'inbound' };
      const i = parsed.error.issues[0];
      return void errors.push(`${at}: ${labels[String(i.path[0])] ?? i.path[0]} نامعتبر است`);
    }
    items.push({ ...(parsed.data as ProductInput), ...(def.category ? { categoryPath: def.category } : {}) });
  });
  return { items, errors };
}

/** All-or-nothing bulk create. Exact duplicates (same name/days/GB/price/inbound) are rejected to guard against double paste. */
export async function createProductsBulk(actor: string, text: string, defaults: BulkDefaults = {}) {
  const { items, errors } = parseProductLines(text, defaults);
  if (!items.length && !errors.length) throw new ValidationError('هیچ محصولی در متن پیدا نشد');
  const existing = await prisma.product.findMany({ select: { name: true, durationDays: true, trafficGB: true, price: true, xuiInboundId: true, xuiProviderId: true } });
  const key = (p: { name: string; durationDays: number; trafficGB: number; price: number; xuiInboundId: number; xuiProviderId?: string }) => `${p.name}|${p.durationDays}|${p.trafficGB}|${p.price}|${p.xuiProviderId ?? 'default'}|${p.xuiInboundId}`;
  const seen = new Set(existing.map(key));
  const out = [...errors];
  items.forEach((p, n) => { if (seen.has(key(p as any))) out.push(`محصول ${n + 1} («${p.name}»): تکراری است`); seen.add(key(p as any)); });
  if (out.length) throw new ValidationError(`هیچ محصولی ثبت نشد:\n${out.slice(0, 10).join('\n')}${out.length > 10 ? `\n… و ${out.length - 10} خطای دیگر` : ''}`);
  for (const code of new Set(items.map((p) => p.xuiProviderId ?? 'default'))) await assertPanel(code);
  for (const pair of new Set(items.map((p) => `${p.xuiProviderId ?? 'default'}|${p.xuiInboundId}`))) { const [code, id] = pair.split('|'); await assertInbound(code, Number(id)); }
  const top = (await prisma.product.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
  const { ensureCategoryPath } = await import('../categories/service');
  const catIds = new Map<string, string>();
  for (const p of items) if (p.categoryPath && !catIds.has(p.categoryPath)) catIds.set(p.categoryPath, await ensureCategoryPath(actor, p.categoryPath));
  const created = await prisma.$transaction(items.map((p, n) => {
    const { categoryPath, ...rest } = p;
    return prisma.product.create({ data: { ...productInput.parse(rest), categoryId: categoryPath ? catIds.get(categoryPath) : null, sortOrder: p.sortOrder || top + n + 1 } });
  }));
  await audit({ actor, action: 'product.bulk_create', target: 'Product', metadata: { count: created.length, names: created.map((c) => c.name).slice(0, 30), categories: [...catIds.keys()] } });
  return created;
}

export const PRODUCT_FIELDS = {
  name: 'نام', description: 'توضیح', price: 'قیمت (تومان)', trafficGB: 'حجم (GB)', durationDays: 'مدت (روز)', xuiInboundId: 'Inbound ID', sortOrder: 'ترتیب نمایش',
} as const;
export type ProductField = keyof typeof PRODUCT_FIELDS;
export const isProductField = (f: string): f is ProductField => f in PRODUCT_FIELDS;

/** Parse one edited field from user text into an update patch (validated by the same schema as create). */
export function parseProductField(field: ProductField, raw: string): Partial<ProductInput> {
  const text = raw.trim();
  const patch: Record<string, unknown> =
    field === 'name' ? { name: text } :
    field === 'description' ? { description: text === '-' ? '' : text } :
    { [field]: num(text) };
  const r = productPatch.safeParse(patch);
  if (!r.success || (field !== 'name' && field !== 'description' && !Number.isFinite(patch[field] as number))) throw new ValidationError(`مقدار «${PRODUCT_FIELDS[field]}» نامعتبر است`);
  return r.data as Partial<ProductInput>;
}
