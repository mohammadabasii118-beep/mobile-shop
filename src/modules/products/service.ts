import { Protocol } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { NotFoundError } from '../../utils/errors';
import { audit } from '../admin/audit';

export const productInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  durationDays: z.number().int().min(1).max(3650),
  trafficGB: z.number().int().min(1).max(100000),
  price: z.number().int().min(0).max(2_000_000_000),
  currency: z.string().default('IRT'),
  xuiProviderId: z.string().default('default'),
  xuiInboundId: z.number().int().min(1),
  protocol: z.nativeEnum(Protocol).default('VLESS'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type ProductInput = z.input<typeof productInput>;

export const listActiveProducts = () => prisma.product.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });
export const listAllProducts = () => prisma.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });

export async function getProduct(id: string) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new NotFoundError('product');
  return p;
}

export async function createProduct(actor: string, input: ProductInput) {
  const data = productInput.parse(input);
  const p = await prisma.product.create({ data });
  await audit({ actor, action: 'product.create', target: 'Product', targetId: p.id, metadata: data });
  return p;
}

export async function updateProduct(actor: string, id: string, patch: Partial<ProductInput>) {
  const before = await getProduct(id);
  const data = productInput.partial().parse(patch);
  const p = await prisma.product.update({ where: { id }, data });
  await audit({
    actor,
    action: data.price !== undefined && data.price !== before.price ? 'product.price_change' : 'product.update',
    target: 'Product', targetId: id, metadata: { before: { price: before.price, isActive: before.isActive }, patch: data },
  });
  return p;
}
