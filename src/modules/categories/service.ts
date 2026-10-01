import { Category, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { audit } from '../admin/audit';

export const MAX_DEPTH = 3; // e.g. ماهانه ▸ حجمی ▸ خانواده

const nameSchema = z.string().trim().min(1).max(40);
const iconSchema = z.string().trim().max(8).optional().nullable();
const EMOJI_START = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u;

/** "🗓 ماهانه" → { icon: "🗓", name: "ماهانه" } */
export function splitIconName(raw: string): { icon: string | null; name: string } {
  const t = raw.trim();
  const m = t.match(EMOJI_START);
  return m ? { icon: m[1], name: t.slice(m[0].length).trim() } : { icon: null, name: t };
}

export interface CategoryNode extends Category {
  depth: number;
  path: string; // "ماهانه ▸ حجمی"
  productCount: number; // direct products
  activeProductCount: number; // active products in this branch (recursive, only counting active branches)
}

/** Whole tree flattened depth-first, ordered by sortOrder then name. The tree is small, so it is loaded in one go. */
export async function categoryTree(): Promise<CategoryNode[]> {
  const [cats, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.product.groupBy({ by: ['categoryId', 'isActive'], _count: true, where: { categoryId: { not: null } } }),
  ]);
  const direct = new Map<string, { all: number; active: number }>();
  for (const c of counts) {
    const e = direct.get(c.categoryId!) ?? { all: 0, active: 0 };
    e.all += c._count; if (c.isActive) e.active += c._count;
    direct.set(c.categoryId!, e);
  }
  const kids = new Map<string | null, Category[]>();
  for (const c of cats) kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c]);
  const out: CategoryNode[] = [];
  const walk = (parent: string | null, depth: number, path: string[], branchActive: boolean): number => {
    let total = 0;
    for (const c of kids.get(parent) ?? []) {
      const here: CategoryNode = { ...c, depth, path: [...path, c.name].join(' ▸ '), productCount: direct.get(c.id)?.all ?? 0, activeProductCount: 0 };
      out.push(here);
      const sub = walk(c.id, depth + 1, [...path, c.name], branchActive && c.isActive);
      here.activeProductCount = c.isActive && branchActive ? (direct.get(c.id)?.active ?? 0) + sub : 0;
      total += here.activeProductCount;
    }
    return total;
  };
  walk(null, 0, [], true);
  return out;
}

export async function getCategory(id: string) {
  const c = await prisma.category.findUnique({ where: { id } });
  if (!c) throw new NotFoundError('category');
  return c;
}

async function depthOf(id: string | null): Promise<number> {
  let d = 0;
  let cur = id;
  while (cur) {
    const c = await prisma.category.findUnique({ where: { id: cur }, select: { parentId: true } });
    if (!c) break;
    d++; cur = c.parentId;
    if (d > 10) break;
  }
  return d;
}

export async function createCategory(actor: string, input: { name: string; icon?: string | null; parentId?: string | null; description?: string | null }) {
  const name = nameSchema.parse(input.name);
  const icon = iconSchema.parse(input.icon) || null;
  const parentId = input.parentId || null;
  if (parentId) await getCategory(parentId);
  if ((await depthOf(parentId)) >= MAX_DEPTH) throw new ValidationError(`حداکثر ${MAX_DEPTH} سطح دسته‌بندی مجاز است`);
  const dup = await prisma.category.findFirst({ where: { parentId, name: { equals: name, mode: 'insensitive' } } });
  if (dup) throw new ConflictError('در همین سطح دسته‌ای با این نام وجود دارد');
  const top = (await prisma.category.aggregate({ where: { parentId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0;
  const c = await prisma.category.create({ data: { name, icon, parentId, description: input.description?.trim().slice(0, 300) || null, sortOrder: top + 1 } });
  await audit({ actor, action: 'category.create', target: 'Category', targetId: c.id, metadata: { name, parentId } });
  return c;
}

export async function updateCategory(actor: string, id: string, patch: { name?: string; icon?: string | null; description?: string | null; isActive?: boolean; parentId?: string | null }) {
  const cur = await getCategory(id);
  const data: Prisma.CategoryUncheckedUpdateInput = {};
  if (patch.name !== undefined) data.name = nameSchema.parse(patch.name);
  if (patch.icon !== undefined) data.icon = iconSchema.parse(patch.icon) || null;
  if (patch.description !== undefined) data.description = patch.description?.trim().slice(0, 300) || null;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  if (patch.parentId !== undefined && patch.parentId !== cur.parentId) {
    const np = patch.parentId || null;
    if (np === id) throw new ValidationError('یک دسته نمی‌تواند زیرمجموعه‌ی خودش باشد');
    if (np) {
      // no cycles: the new parent must not be a descendant of this category
      const tree = await categoryTree();
      const desc = new Set<string>();
      const collect = (pid: string) => tree.filter((t) => t.parentId === pid).forEach((t) => { desc.add(t.id); collect(t.id); });
      collect(id);
      if (desc.has(np)) throw new ValidationError('انتقال به زیرمجموعه‌ی خودِ دسته ممکن نیست');
      const subtreeDepth = Math.max(0, ...tree.filter((t) => desc.has(t.id)).map((t) => t.depth - (tree.find((x) => x.id === id)?.depth ?? 0))) + 1;
      if ((await depthOf(np)) + subtreeDepth > MAX_DEPTH) throw new ValidationError(`حداکثر ${MAX_DEPTH} سطح دسته‌بندی مجاز است`);
    }
    data.parentId = np;
  }
  const next = data.name !== undefined ? String(data.name) : cur.name;
  const nextParent = data.parentId !== undefined ? (data.parentId as string | null) : cur.parentId;
  if (data.name !== undefined || data.parentId !== undefined) {
    const dup = await prisma.category.findFirst({ where: { id: { not: id }, parentId: nextParent, name: { equals: next, mode: 'insensitive' } } });
    if (dup) throw new ConflictError('در همین سطح دسته‌ای با این نام وجود دارد');
  }
  const c = await prisma.category.update({ where: { id }, data });
  await audit({ actor, action: 'category.update', target: 'Category', targetId: id, metadata: patch });
  return c;
}

/** Swap sortOrder with the neighbour (same parent). */
export async function moveCategory(actor: string, id: string, dir: 'up' | 'down') {
  const c = await getCategory(id);
  const sibs = await prisma.category.findMany({ where: { parentId: c.parentId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  const i = sibs.findIndex((s) => s.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= sibs.length) return false;
  const order = sibs.map((s) => s.id);
  [order[i], order[j]] = [order[j], order[i]];
  await prisma.$transaction(order.map((sid, n) => prisma.category.update({ where: { id: sid }, data: { sortOrder: n + 1 } })));
  await audit({ actor, action: 'category.move', target: 'Category', targetId: id, metadata: { dir } });
  return true;
}

/** Deleting is refused while sub-categories exist; its products move up to the parent (or the root). */
export async function deleteCategory(actor: string, id: string) {
  const c = await getCategory(id);
  const kids = await prisma.category.count({ where: { parentId: id } });
  if (kids > 0) throw new ValidationError('این دسته زیرمجموعه دارد؛ ابتدا زیرمجموعه‌ها را حذف یا منتقل کنید');
  const moved = await prisma.$transaction(async (tx) => {
    const r = await tx.product.updateMany({ where: { categoryId: id }, data: { categoryId: c.parentId } });
    await tx.category.delete({ where: { id } });
    return r.count;
  });
  await audit({ actor, action: 'category.delete', target: 'Category', targetId: id, metadata: { name: c.name, productsMovedUp: moved } });
  return { movedProducts: moved };
}

export async function setProductCategory(actor: string, productId: string, categoryId: string | null) {
  if (categoryId) await getCategory(categoryId);
  const p = await prisma.product.update({ where: { id: productId }, data: { categoryId } });
  await audit({ actor, action: 'product.set_category', target: 'Product', targetId: productId, metadata: { categoryId } });
  return p;
}

/** Find-or-create "A ▸ B" / "A/B" path (used by bulk product import). Returns the leaf id. */
export async function ensureCategoryPath(actor: string, path: string): Promise<string> {
  const parts = path.split(/\s*(?:▸|>|\/)\s*/).map((x) => x.trim()).filter(Boolean);
  if (!parts.length) throw new ValidationError('مسیر دسته‌بندی خالی است');
  let parentId: string | null = null;
  for (const raw of parts) {
    const { icon, name } = splitIconName(raw);
    const existing: Category | null = await prisma.category.findFirst({ where: { parentId, name: { equals: name, mode: 'insensitive' } } });
    parentId = (existing ?? (await createCategory(actor, { name, icon, parentId }))).id;
  }
  return parentId!;
}

/** What a customer sees at one level of the buy menu. Empty/inactive branches are hidden. */
export async function menuLevel(parentId: string | null) {
  const tree = await categoryTree();
  const here = parentId ? tree.find((t) => t.id === parentId) : undefined;
  if (parentId && (!here || !here.isActive)) throw new NotFoundError('category');
  const visible = (t: CategoryNode) => t.isActive && t.activeProductCount > 0;
  // a branch is reachable only if every ancestor is active (activeProductCount already encodes that)
  const children = tree.filter((t) => t.parentId === parentId && visible(t));
  const products = await prisma.product.findMany({ where: { isActive: true, categoryId: parentId }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });
  const crumbs: CategoryNode[] = [];
  for (let cur = here; cur; cur = cur.parentId ? tree.find((t) => t.id === cur!.parentId) : undefined) crumbs.unshift(cur);
  return { here, crumbs, children, products, hasAnyCategory: tree.some(visible) };
}
