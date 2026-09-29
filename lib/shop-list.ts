import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { getProducts } from "@/lib/queries";
import type { CardProduct } from "@/lib/types";

export const SHOP_PAGE_SIZE = 12;
export const SORTS = ["default", "popular", "rating", "newest", "asc", "desc"] as const;
export type ShopSort = (typeof SORTS)[number];
// Whitelisted ORDER BY fragments (never built from user input).
const ORDER: Record<ShopSort, Prisma.Sql> = {
  default: Prisma.sql`p."createdAt" ASC`,
  popular: Prisma.sql`p."ratingCount" DESC, p."soldCount" DESC`,
  rating: Prisma.sql`p."ratingAvg" DESC, p."ratingCount" DESC`,
  newest: Prisma.sql`p."createdAt" DESC`,
  asc: Prisma.sql`(p."retailPrice" - p."retailDiscount") ASC`,
  desc: Prisma.sql`(p."retailPrice" - p."retailDiscount") DESC`,
};

export interface ShopQuery { cat?: string; sub?: string; model?: string; brandSlug?: string; modelSlug?: string; q?: string; sort?: ShopSort; page?: number; size?: number }

/** Server-side product listing (filters, sorting and pagination happen in SQL, so the page size stays small at any catalog size). */
export async function queryShop(input: ShopQuery): Promise<{ items: CardProduct[]; subs: string[]; total: number; page: number; pages: number }> {
  const size = input.size ?? SHOP_PAGE_SIZE;
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const sort = input.sort && SORTS.includes(input.sort) ? input.sort : "default";
  const conds: Prisma.Sql[] = [Prisma.sql`p."isActive" = true`];
  if (input.sub || input.cat) {
    const cats = await db.category.findMany({
      where: input.sub ? { slug: input.sub, isActive: true } : { isActive: true, OR: [{ slug: input.cat }, { parent: { slug: input.cat } }] },
      select: { id: true },
    });
    conds.push(Prisma.sql`p."categoryId" IN (${cats.length ? Prisma.join(cats.map((c) => c.id)) : Prisma.sql`NULL`})`);
  }
  if (input.model) conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "ProductPhoneModel" x JOIN "PhoneModel" m ON m."id" = x."phoneModelId" WHERE x."productId" = p."id" AND m."name" = ${input.model})`);
  if (input.brandSlug) conds.push(Prisma.sql`p."brandId" IN (SELECT b."id" FROM "Brand" b WHERE b."slug" = ${input.brandSlug} AND b."isActive" = true)`);
  if (input.modelSlug) conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "ProductPhoneModel" x JOIN "PhoneModel" m ON m."id" = x."phoneModelId" WHERE x."productId" = p."id" AND m."slug" = ${input.modelSlug} AND m."isActive" = true)`);
  if (input.q) conds.push(Prisma.sql`p."name" ILIKE ${"%" + input.q.replace(/[%_\\]/g, "\\$&") + "%"}`);
  const where = Prisma.join(conds, " AND ");
  const [rows, count] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`SELECT p."id" FROM "Product" p WHERE ${where} ORDER BY ${ORDER[sort]}, p."id" LIMIT ${size} OFFSET ${(page - 1) * size}`,
    db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "Product" p WHERE ${where}`,
  ]);
  const ids = rows.map((r) => r.id);
  const cards = ids.length ? await getProducts({ id: { in: ids } }) : [];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const total = Number(count[0]?.n ?? 0);
  const subRows = ids.length ? await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, category: { select: { slug: true, parentId: true } } } }) : [];
  const subOf = new Map(subRows.map((r) => [r.id, r.category.parentId ? r.category.slug : ""]));
  return { items: ids.map((id) => byId.get(id)).filter((c): c is CardProduct => !!c), subs: ids.map((id) => subOf.get(id) ?? ""), total, page, pages: Math.max(1, Math.ceil(total / size)) };
}
