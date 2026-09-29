import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function getCategoryBySlug(slug: string) {
  return db.category.findUnique({
    where: { slug },
    include: { children: { where: { isActive: true }, orderBy: { order: "asc" } }, parent: true },
  });
}

export type ProductFilters = {
  sort?: string; // "cheap" | "expensive" | "default"
  onlyDiscount?: boolean;
  categoryIds?: string[];
  // "گوشی من": matches a simple product whose own phoneModelId is this, OR
  // a variable product that has at least one active variant for this model
  // — real compatibility, derived from actual product/variant data, never
  // a manually-curated "compatible list".
  phoneModelId?: string;
};

function compatibilityFilter(phoneModelId?: string): Prisma.ProductWhereInput {
  if (!phoneModelId) return {};
  return {
    OR: [
      { phoneModelId },
      { variants: { some: { phoneModelId, isActive: true } } },
    ],
  };
}

export async function getFilteredProducts(baseCategoryIds: string[], filters: ProductFilters) {
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    categoryId: { in: filters.categoryIds?.length ? filters.categoryIds : baseCategoryIds },
    ...(filters.onlyDiscount ? { oldPrice: { not: null } } : {}),
    ...compatibilityFilter(filters.phoneModelId),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    filters.sort === "cheap" ? { price: "asc" } : filters.sort === "expensive" ? { price: "desc" } : { createdAt: "desc" };

  return db.product.findMany({ where, orderBy });
}

/**
 * A typo-tolerant fallback for when the plain substring search below finds
 * nothing — uses Postgres' pg_trgm `similarity()` so "ایرپاد" still finds
 * "ایرباد" (or a Latin "ayrpad" typo) instead of returning empty. Requires
 * the pg_trgm extension (see the note near the top of schema.prisma); if
 * it isn't installed, the raw query throws and this simply returns an
 * empty array — normal substring search elsewhere is unaffected either way.
 */
async function fuzzyProductSearch(q: string, extraWhere: Prisma.ProductWhereInput): Promise<{ id: string }[]> {
  try {
    // categoryIds/phoneModelId filters aren't practical to express safely
    // inside this raw query, so the fuzzy fallback only applies when no
    // other filter narrows the result — the common case for a search box.
    if (Object.keys(extraWhere).length > 0) return [];
    const rows = await db.$queryRaw<{ id: string; sim: number }[]>`
      SELECT id, similarity(name, ${q}) AS sim
      FROM "Product"
      WHERE "isActive" = true AND similarity(name, ${q}) > 0.25
      ORDER BY sim DESC
      LIMIT 30
    `;
    return rows;
  } catch {
    return [];
  }
}

export async function searchProducts(q: string, filters: ProductFilters) {
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(filters.categoryIds?.length ? { categoryId: { in: filters.categoryIds } } : {}),
    ...(filters.onlyDiscount ? { oldPrice: { not: null } } : {}),
    ...compatibilityFilter(filters.phoneModelId),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    filters.sort === "cheap" ? { price: "asc" } : filters.sort === "expensive" ? { price: "desc" } : { createdAt: "desc" };
  const results = await db.product.findMany({ where, orderBy });

  // Only reached for a real, non-empty search query that found literally
  // nothing by exact substring — e.g. a typo. Order is preserved from the
  // similarity ranking (best match first), not re-sorted by the `sort`
  // filter, since the whole point here is "closest match", not price order.
  if (results.length === 0 && q) {
    const otherFilters: Prisma.ProductWhereInput = {
      ...(filters.categoryIds?.length ? { categoryId: { in: filters.categoryIds } } : {}),
      ...(filters.onlyDiscount ? { oldPrice: { not: null } } : {}),
      ...compatibilityFilter(filters.phoneModelId),
    };
    const fuzzy = await fuzzyProductSearch(q, otherFilters);
    if (fuzzy.length > 0) {
      const products = await db.product.findMany({ where: { id: { in: fuzzy.map((f) => f.id) }, isActive: true } });
      const byId = new Map(products.map((p) => [p.id, p]));
      return fuzzy.map((f) => byId.get(f.id)).filter((p): p is (typeof products)[number] => !!p);
    }
  }

  return results;
}

export async function getProductBySlug(slug: string) {
  return db.product.findUnique({ where: { slug }, include: { category: true, brand: true, phoneModel: true } });
}

export async function getActiveVariants(productId: string) {
  return db.productVariant.findMany({
    where: { productId, isActive: true },
    include: { brand: true, phoneModel: true, color: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getRelatedProducts(categoryId: string, excludeId: string) {
  return db.product.findMany({ where: { categoryId, isActive: true, id: { not: excludeId } }, take: 8 });
}

export async function getAllActiveCategoriesFlat() {
  return db.category.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
}
