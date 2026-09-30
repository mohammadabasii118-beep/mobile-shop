import "server-only";
import { db } from "@/lib/db";
import type { Discount, Prisma } from "@/lib/generated/prisma/client";
import { lineCtx } from "@/lib/server/price-engine/line";
import { loadActiveDiscounts, resolveUnitDiscount } from "@/lib/server/price-engine/discounts";
import { cachedPublic } from "@/lib/server/public-cache";
import type { CardProduct, MenuCategory, SiteInfo } from "@/lib/types";

const cardInclude = {
  category: { select: { id: true, parentId: true, slug: true, name: true, parent: { select: { slug: true } } } },
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
  phoneModels: { include: { phoneModel: { select: { name: true } } }, take: 1 },
  variants: { include: { inventory: { select: { quantity: true } }, phoneModel: { select: { brandId: true } } } },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

/**
 * Retail card view model. The shown price is the cheapest active variant after the best single discount
 * (legacy product discount or a matching promotion). Wholesale pricing is applied elsewhere, on the server, for the signed-in partner.
 */
export function toCard(p: Omit<CardRow, "variants"> & { variants: (Omit<CardRow["variants"][number], "phoneModel"> & { phoneModel?: { brandId: string } | null })[] }, discounts: Discount[] = []): CardProduct {
  const active = p.variants.filter((v) => v.isActive);
  const options = (active.length ? active : []).map((v) => {
    const base = v.retailPrice ?? p.retailPrice;
    const d = resolveUnitDiscount(discounts, lineCtx({ ...p, category: p.category }, v), base, p.retailDiscount);
    return { price: Math.max(0, base - d.amount), base, off: d.amount };
  });
  const best = options.length ? options.reduce((a, b) => (b.price < a.price ? b : a)) : (() => { const d = resolveUnitDiscount(discounts, lineCtx({ ...p, category: p.category }, { id: "", retailPrice: null, wholesalePrice: null }), p.retailPrice, p.retailDiscount); return { price: Math.max(0, p.retailPrice - d.amount), base: p.retailPrice, off: d.amount }; })();
  return {
    id: p.id, slug: p.slug, name: p.name, brand: null, kind: p.visualKind ?? "case", hue: p.visualHue ?? 210,
    price: best.price, oldPrice: best.off > 0 ? best.base : undefined,
    rating: p.ratingAvg, reviews: p.ratingCount, badge: p.badge ?? undefined,
    compat: p.phoneModels[0]?.phoneModel.name, img: p.images[0]?.url,
    categorySlug: p.category.parent?.slug ?? p.category.slug, categoryLabel: p.category.name,
    inStock: p.variants.some((v) => (v.inventory?.quantity ?? 0) > 0),
  };
}

async function withBrand(rows: (CardRow & { brand: { name: string } | null })[]): Promise<CardProduct[]> {
  const discounts = await loadActiveDiscounts();
  return rows.map((r) => ({ ...toCard(r, discounts), brand: r.brand?.name ?? null }));
}

const activeWhere = { isActive: true } satisfies Prisma.ProductWhereInput;
const cardArgs = { include: { ...cardInclude, brand: { select: { name: true } } } } as const;

export async function getProducts(where: Prisma.ProductWhereInput = {}, opts: { take?: number; orderBy?: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] } = {}) {
  const rows = await db.product.findMany({ relationLoadStrategy: "join", where: { ...activeWhere, ...where }, ...cardArgs, take: opts.take, orderBy: opts.orderBy ?? { createdAt: "asc" } });
  return withBrand(rows);
}

/** Products of a top-level category (including its sub-categories). */
// Home-page rails: identical for everyone, so cached briefly (admin edits invalidate immediately; stock badges may lag ≤60 s,
// while checkout always re-validates stock on the server).
export const getProductsByCategory = cachedPublic("rail-category", async (slug: string, take: number) =>
  getProducts({ OR: [{ category: { slug } }, { category: { parent: { slug } } }] }, { take, orderBy: [{ soldCount: "desc" }, { createdAt: "asc" }] }), 60);

/** Hand-picked products (admin homepage section), kept in the order the admin chose. */
export const getProductsByIds = cachedPublic("rail-ids", async (ids: string[]) => {
  const rows = await getProducts({ id: { in: ids } }, {});
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
}, 60);

export const getNewestProducts = cachedPublic("rail-newest", async (take: number) => getProducts({}, { take, orderBy: { createdAt: "desc" } }), 60);

export const getCategoryTree = cachedPublic("category-tree", async (): Promise<(MenuCategory & { id: string; productCount: number; sampleKinds: string[] })[]> => {
  const tops = await db.category.findMany({
    where: { parentId: null, isActive: true }, orderBy: { sortOrder: "asc" },
    include: { children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  // Categories are independent, so their two small queries each run in parallel (no sequential N+1).
  return Promise.all(tops.map(async (t) => {
    const ids = [t.id, ...t.children.map((c) => c.id)];
    const [productCount, sample] = await Promise.all([
      db.product.count({ where: { isActive: true, categoryId: { in: ids } } }),
      db.product.findMany({ where: { isActive: true, categoryId: { in: ids } }, select: { visualKind: true }, take: 3, orderBy: { soldCount: "desc" } }),
    ]);
    return { id: t.id, slug: t.slug, label: t.name, subs: t.children.map((c) => ({ slug: c.slug, label: c.name })), productCount, sampleKinds: sample.map((x) => x.visualKind ?? "case") };
  }));
});

export const getMenu = cachedPublic("menu", async (menu: string) =>
  db.menuItem.findMany({ where: { menu, isActive: true, parentId: null }, orderBy: { sortOrder: "asc" } }));

const DEFAULT_SITE: SiteInfo = { name: "CaseLine", phone: "", email: "", address: "", hours: "", telegram: "#", instagram: "#", topBar: "", footerText: "" };
export const getSiteInfo = cachedPublic("site-info", async (): Promise<SiteInfo> => {
  const row = await db.siteSetting.findUnique({ where: { key: "site" } });
  return { ...DEFAULT_SITE, ...((row?.value as Partial<SiteInfo>) ?? {}) };
});
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.siteSetting.findUnique({ where: { key } });
  return (row?.value as T) ?? fallback;
}

export const getHomeSections = cachedPublic("home-sections", async () =>
  db.homepageSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }));
// Banner windows are time based, so these use a short TTL on top of admin-triggered invalidation.
export const getBanner = cachedPublic("banner", async (placement: string) => {
  const now = new Date();
  return db.banner.findFirst({ where: { placement, isActive: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, orderBy: { sortOrder: "asc" } });
}, 60);
export const getBanners = cachedPublic("banners", async (placement: string) => {
  const now = new Date();
  return db.banner.findMany({ where: { placement, isActive: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, orderBy: { sortOrder: "asc" }, take: 6 });
}, 60);
export async function getBlogPost(slug: string) {
  return db.blogPost.findFirst({ where: { slug, isPublished: true, publishedAt: { lte: new Date() } }, include: { category: true } });
}
export const getBrandNames = cachedPublic("brand-names", async () =>
  (await db.brand.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { name: true } })).map((b) => b.name));
export const getPhoneModels = cachedPublic("phone-models", async () =>
  db.phoneModel.findMany({ where: { isActive: true }, orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }], include: { brand: { select: { name: true } } } }));

export async function getProductBySlug(slug: string) {
  return db.product.findFirst({
    relationLoadStrategy: "join",
    where: { slug, isActive: true },
    include: {
      brand: true, category: { include: { parent: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      phoneModels: { include: { phoneModel: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { inventory: true, colorRef: true, phoneModel: { include: { brand: { select: { name: true } } } } } },
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
export const getBlogCategories = cachedPublic("blog-categories", async () =>
  db.blogCategory.findMany({ include: { _count: { select: { posts: { where: { isPublished: true, publishedAt: { lte: new Date() } } } } } } }), 60);
export async function getCatalogIndex() {
  const rows = await db.product.findMany({ where: activeWhere, ...cardArgs });
  const cards = await withBrand(rows);
  return cards;
}
