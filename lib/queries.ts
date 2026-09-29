import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { CardProduct, MenuCategory, SiteInfo } from "@/lib/types";

const cardInclude = {
  category: { select: { slug: true, name: true, parent: { select: { slug: true } } } },
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
  phoneModels: { include: { phoneModel: { select: { name: true } } }, take: 1 },
  variants: { include: { inventory: { select: { quantity: true } } } },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

/** Retail card view model. Wholesale pricing is applied server-side in a later phase (never in the browser). */
export function toCard(p: CardRow): CardProduct {
  const price = p.retailPrice - p.retailDiscount;
  return {
    id: p.id, slug: p.slug, name: p.name, brand: null, kind: p.visualKind ?? "case", hue: p.visualHue ?? 210,
    price, oldPrice: p.retailDiscount > 0 ? p.retailPrice : undefined,
    rating: p.ratingAvg, reviews: p.ratingCount, badge: p.badge ?? undefined,
    compat: p.phoneModels[0]?.phoneModel.name, img: p.images[0]?.url,
    categorySlug: p.category.parent?.slug ?? p.category.slug, categoryLabel: p.category.name,
    inStock: p.variants.some((v) => (v.inventory?.quantity ?? 0) > 0),
  };
}

async function withBrand(rows: (CardRow & { brand: { name: string } | null })[]): Promise<CardProduct[]> {
  return rows.map((r) => ({ ...toCard(r), brand: r.brand?.name ?? null }));
}

const activeWhere = { isActive: true } satisfies Prisma.ProductWhereInput;
const cardArgs = { include: { ...cardInclude, brand: { select: { name: true } } } } as const;

export async function getProducts(where: Prisma.ProductWhereInput = {}, opts: { take?: number; orderBy?: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] } = {}) {
  const rows = await db.product.findMany({ where: { ...activeWhere, ...where }, ...cardArgs, take: opts.take, orderBy: opts.orderBy ?? { createdAt: "asc" } });
  return withBrand(rows);
}

/** Products of a top-level category (including its sub-categories). */
export async function getProductsByCategory(slug: string, take = 5) {
  return getProducts({ OR: [{ category: { slug } }, { category: { parent: { slug } } }] }, { take, orderBy: [{ soldCount: "desc" }, { createdAt: "asc" }] });
}

/** Hand-picked products (admin homepage section), kept in the order the admin chose. */
export async function getProductsByIds(ids: string[]) {
  const rows = await getProducts({ id: { in: ids } }, {});
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
}

export async function getNewestProducts(take = 5) {
  return getProducts({}, { take, orderBy: { createdAt: "desc" } });
}

export async function getShopProducts() {
  const rows = await db.product.findMany({ where: activeWhere, ...cardArgs, orderBy: { createdAt: "asc" } });
  const cards = await withBrand(rows);
  return cards.map((c, i) => ({
    card: c,
    sub: rows[i].category.parent ? rows[i].category.slug : "",
    createdAt: rows[i].createdAt.getTime(),
    soldCount: rows[i].soldCount,
  }));
}

export async function getCategoryTree(): Promise<(MenuCategory & { id: string; productCount: number; sampleKinds: string[] })[]> {
  const tops = await db.category.findMany({
    where: { parentId: null, isActive: true }, orderBy: { sortOrder: "asc" },
    include: { children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  const out = [];
  for (const t of tops) {
    const ids = [t.id, ...t.children.map((c) => c.id)];
    const [productCount, sample] = await Promise.all([
      db.product.count({ where: { isActive: true, categoryId: { in: ids } } }),
      db.product.findMany({ where: { isActive: true, categoryId: { in: ids } }, select: { visualKind: true }, take: 3, orderBy: { soldCount: "desc" } }),
    ]);
    out.push({ id: t.id, slug: t.slug, label: t.name, subs: t.children.map((c) => ({ slug: c.slug, label: c.name })), productCount, sampleKinds: sample.map((s) => s.visualKind ?? "case") });
  }
  return out;
}

export async function getMenu(menu: string) {
  return db.menuItem.findMany({ where: { menu, isActive: true, parentId: null }, orderBy: { sortOrder: "asc" } });
}

const DEFAULT_SITE: SiteInfo = { name: "CaseLine", phone: "", email: "", address: "", hours: "", telegram: "#", instagram: "#", topBar: "", footerText: "" };
export async function getSiteInfo(): Promise<SiteInfo> {
  const row = await db.siteSetting.findUnique({ where: { key: "site" } });
  return { ...DEFAULT_SITE, ...((row?.value as Partial<SiteInfo>) ?? {}) };
}
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.siteSetting.findUnique({ where: { key } });
  return (row?.value as T) ?? fallback;
}

export async function getHomeSections() {
  return db.homepageSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
}
export async function getBanner(placement: string) {
  const now = new Date();
  return db.banner.findFirst({ where: { placement, isActive: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, orderBy: { sortOrder: "asc" } });
}
export async function getBrandNames() {
  return (await db.brand.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { name: true } })).map((b) => b.name);
}
export async function getPhoneModels() {
  return db.phoneModel.findMany({ where: { isActive: true }, orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }], include: { brand: { select: { name: true } } } });
}

export async function getProductBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, isActive: true },
    include: {
      brand: true, category: { include: { parent: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      phoneModels: { include: { phoneModel: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { inventory: true } },
      reviews: { where: { status: "approved" }, orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { displayName: true, firstName: true } } } },
      questions: { where: { isPublished: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
}

export async function getRelatedProducts(productId: string, categoryId: string, take = 3) {
  return getProducts({ categoryId, id: { not: productId } }, { take, orderBy: { soldCount: "desc" } });
}
export async function getSidebarProducts(exceptId: string, take = 7) {
  return getProducts({ id: { not: exceptId } }, { take, orderBy: { soldCount: "desc" } });
}

export async function getBlogPosts(take?: number) {
  return db.blogPost.findMany({ where: { isPublished: true, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" }, take, include: { category: true } });
}
export async function getBlogCategories() {
  return db.blogCategory.findMany({ include: { _count: { select: { posts: { where: { isPublished: true } } } } } });
}
export async function getCatalogIndex() {
  const rows = await db.product.findMany({ where: activeWhere, ...cardArgs });
  const cards = await withBrand(rows);
  return cards;
}
