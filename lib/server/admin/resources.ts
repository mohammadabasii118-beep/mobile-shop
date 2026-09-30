import { z } from "zod";
import { conflict } from "@/lib/server/errors";
import type { Db } from "@/lib/server/admin/core";

/* ───────── field helpers (undefined = "leave unchanged" on updates; null/"" = clear) ───────── */
export const slug = z.string().trim().toLowerCase().min(1, "اسلاگ لازم است.").max(120).regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "اسلاگ فقط شامل حرف، عدد و خط تیره باشد.");
const req = (max = 200, msg = "این فیلد لازم است.") => z.string().trim().min(1, msg).max(max);
const opt = (max = 500) => z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();
const int = (min = 0, max = 2_000_000_000) => z.coerce.number().int("عدد صحیح وارد کنید.").min(min, `حداقل ${min}`).max(max);
const optInt = (min = 0) => z.union([z.null(), z.literal("").transform(() => null), int(min)]).optional();
const dateOpt = z.union([z.null(), z.literal("").transform(() => null), z.string().min(1).transform((s, ctx) => { const d = new Date(s); if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: "custom", message: "تاریخ نامعتبر است." }); return z.NEVER; } return d; })]).optional();
const bool = z.boolean();
const image = z.string().trim().max(400).refine((v) => v === "" || /^(\/(?!\/)|https:\/\/)/.test(v), "آدرس تصویر نامعتبر است.").transform((v) => (v === "" ? null : v)).nullable().optional();
const link = z.string().trim().max(400).refine((v) => v === "" || /^(\/(?!\/)|https?:\/\/|#|tel:|mailto:)/.test(v), "لینک نامعتبر است.").transform((v) => (v === "" ? null : v)).nullable().optional();
const keyish = z.string().trim().toLowerCase().min(1).max(40).regex(/^[a-z0-9_:.-]+$/, "فقط حروف انگلیسی، عدد و _ . : -");

export interface Resource {
  model: string;
  perm: string;
  label: string;
  create: z.ZodObject;
  orderBy: object;
  search: string[];
  filters?: string[];
  hasSort?: boolean;
  include?: object;
  /** Extra cross-field validation / guards, run inside the write transaction. */
  guard?: (tx: Db, data: Record<string, unknown>, existing: Record<string, unknown> | null) => Promise<void>;
  beforeDelete?: (tx: Db, id: string) => Promise<void>;
  /** Fields the API may never change once created. */
  immutable?: string[];
  auditName: string;
  /** When set, changing `slug` records a permanent redirect from the old URL. */
  slugKind?: "category" | "brand" | "model" | "post";
}

const noSelfParent = async (tx: Db, model: "category" | "menuItem", data: Record<string, unknown>, existing: Record<string, unknown> | null) => {
  const parentId = data.parentId as string | null | undefined;
  if (!parentId) return;
  if (existing && parentId === existing.id) throw conflict("یک مورد نمی‌تواند والد خودش باشد.");
  // No cycles: walk up from the proposed parent.
  let cur: string | null = parentId;
  for (let i = 0; cur && i < 10; i++) {
    if (existing && cur === existing.id) throw conflict("این والد باعث ایجاد حلقه در ساختار می‌شود.");
    const row: { parentId: string | null } | null = await (tx[model] as unknown as { findUnique: (a: object) => Promise<{ parentId: string | null } | null> }).findUnique({ where: { id: cur }, select: { parentId: true } });
    cur = row?.parentId ?? null;
  }
};

export const RESOURCES: Record<string, Resource> = {
  categories: {
    model: "category", perm: "category.write", label: "دسته‌بندی", auditName: "category", slugKind: "category", hasSort: true, immutable: [],
    create: z.object({ name: req(80), slug, parentId: z.string().max(40).nullable().optional().transform((v) => v || null), description: opt(600), image, sortOrder: int(0, 100000).optional(), isActive: bool.optional(), seoTitle: opt(120), seoDescription: opt(300), seoContent: opt(20000), canonical: link }),
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }], search: ["name", "slug"], filters: ["isActive"],
    include: { parent: { select: { name: true } }, _count: { select: { products: true, children: true } } },
    guard: (tx, d, ex) => noSelfParent(tx, "category", d, ex),
    beforeDelete: async (tx, id) => {
      if (await tx.product.count({ where: { categoryId: id } })) throw conflict("این دسته محصول دارد؛ ابتدا محصولات را جابه‌جا کنید یا دسته را غیرفعال کنید.");
      if (await tx.category.count({ where: { parentId: id } })) throw conflict("این دسته زیرمجموعه دارد.");
    },
  },
  brands: {
    model: "brand", perm: "brand.write", label: "برند", auditName: "brand", slugKind: "brand", hasSort: true,
    create: z.object({ name: req(80), slug, logo: image, description: opt(1000), isActive: bool.optional(), sortOrder: int(0, 100000).optional(), seoTitle: opt(120), seoDescription: opt(300) }),
    orderBy: [{ sortOrder: "asc" }], search: ["name", "slug"], filters: ["isActive"], include: { _count: { select: { products: true, phoneModels: true } } },
    beforeDelete: async (tx, id) => {
      if (await tx.phoneModel.count({ where: { brandId: id } })) throw conflict("این برند مدل گوشی دارد؛ ابتدا آن‌ها را حذف کنید.");
    },
  },
  "phone-models": {
    model: "phoneModel", perm: "phone.write", label: "مدل گوشی", auditName: "phone_model", slugKind: "model", hasSort: true,
    create: z.object({ name: req(80), slug, brandId: req(40), seriesId: z.string().trim().max(40).transform((v) => v || null).nullable().optional(), image, description: opt(1000), isActive: bool.optional(), sortOrder: int(0, 100000).optional(), seoTitle: opt(120), seoDescription: opt(300) }),
    orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }], search: ["name", "slug"], filters: ["isActive", "brandId", "seriesId"], include: { brand: { select: { name: true } }, series: { select: { name: true } }, _count: { select: { products: true } } },
    guard: async (tx, data, existing) => {
      const seriesId = (data.seriesId !== undefined ? data.seriesId : existing?.seriesId) as string | null | undefined;
      if (!seriesId) return;
      const brandId = (data.brandId as string | undefined) ?? (existing?.brandId as string | undefined);
      const sr = await tx.phoneSeries.findUnique({ where: { id: seriesId }, select: { brandId: true } });
      if (!sr) throw conflict("سری انتخاب‌شده وجود ندارد.");
      if (brandId && sr.brandId !== brandId) throw conflict("سری باید متعلق به همان برند مدل باشد.");
    },
  },
  "phone-series": {
    model: "phoneSeries", perm: "phone.write", label: "سری گوشی", auditName: "phone_series", hasSort: true,
    create: z.object({ name: req(80), slug, brandId: req(40), isActive: bool.optional(), sortOrder: int(0, 100000).optional() }),
    orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }], search: ["name", "slug"], filters: ["isActive", "brandId"], include: { brand: { select: { name: true } }, _count: { select: { models: true } } },
    beforeDelete: async (tx, id) => {
      if (await tx.phoneModel.count({ where: { seriesId: id } })) throw conflict("این سری مدل دارد؛ ابتدا مدل‌ها را به سری دیگری ببرید (یا سری را غیرفعال کنید).");
    },
  },
  attributes: {
    model: "attribute", perm: "product.write", label: "Attribute", auditName: "attribute", hasSort: true,
    create: z.object({ name: req(60), slug, isActive: bool.optional(), sortOrder: int(0, 100000).optional() }),
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }], search: ["name", "slug"], filters: ["isActive"], include: { _count: { select: { values: true } } },
    guard: async (_tx, data, existing) => {
      if (existing?.isSystem && data.slug !== undefined && data.slug !== existing.slug) throw conflict("اسلاگ Attribute سیستمی قابل تغییر نیست.");
    },
    beforeDelete: async (tx, id) => {
      const a = await tx.attribute.findUnique({ where: { id }, select: { isSystem: true } });
      if (a?.isSystem) throw conflict("Attributeهای سیستمی (مدل گوشی و رنگ) قابل حذف نیستند.");
    },
  },
  "attribute-values": {
    model: "attributeValue", perm: "product.write", label: "مقدار Attribute", auditName: "attribute_value", hasSort: true,
    create: z.object({ attributeId: req(40), value: req(80), hex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "کد رنگ نامعتبر است.").nullable().optional().or(z.literal("").transform(() => null)), isActive: bool.optional(), sortOrder: int(0, 100000).optional() }),
    orderBy: [{ attribute: { sortOrder: "asc" } }, { sortOrder: "asc" }, { value: "asc" }], search: ["value"], filters: ["isActive", "attributeId"], immutable: ["attributeId"],
    include: { attribute: { select: { name: true } }, _count: { select: { products: true } } },
    guard: async (tx, data, existing) => {
      const attributeId = (data.attributeId as string | undefined) ?? (existing?.attributeId as string | undefined);
      const a = attributeId ? await tx.attribute.findUnique({ where: { id: attributeId }, select: { isSystem: true } }) : null;
      if (!a) throw conflict("Attribute انتخاب‌شده وجود ندارد.");
      if (a.isSystem) throw conflict("مقادیر مدل گوشی و رنگ از بخش «مدل‌های گوشی» و «رنگ‌ها» مدیریت می‌شوند.");
    },
  },
  coupons: {
    model: "coupon", perm: "coupon.write", label: "کوپن", auditName: "coupon", immutable: ["code"],
    create: z.object({
      code: z.string().trim().toUpperCase().min(3, "حداقل ۳ کاراکتر.").max(32).regex(/^[A-Z0-9_-]+$/, "فقط حروف انگلیسی، عدد و - _"),
      type: z.enum(["percent", "fixed"]), value: int(1, 2_000_000_000), minOrder: int(0).optional(), maxDiscount: optInt(1),
      startsAt: dateOpt, endsAt: dateOpt, usageLimit: optInt(1), perUserLimit: optInt(1), isActive: bool.optional(),
    }),
    orderBy: [{ createdAt: "desc" }], search: ["code"], filters: ["isActive"],
    guard: async (_tx, d, ex) => {
      const type = (d.type ?? ex?.type) as string, value = (d.value ?? ex?.value) as number;
      if (type === "percent" && value > 100) throw conflict("درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.", "validation");
      const s = (d.startsAt === undefined ? ex?.startsAt : d.startsAt) as Date | null, e = (d.endsAt === undefined ? ex?.endsAt : d.endsAt) as Date | null;
      if (s && e && e <= s) throw conflict("تاریخ پایان باید بعد از شروع باشد.", "validation");
    },
    beforeDelete: async (tx, id) => {
      if (await tx.couponUsage.count({ where: { couponId: id } })) throw conflict("این کوپن استفاده شده است؛ به‌جای حذف آن را غیرفعال کنید.");
    },
  },
  colors: {
    model: "color", perm: "product.write", label: "رنگ", auditName: "color", hasSort: true,
    create: z.object({ name: req(40), hex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "کد رنگ مثل #FFFFFF وارد کنید.").nullable().optional().or(z.literal("").transform(() => null)), isActive: bool.optional(), sortOrder: int(0, 100000).optional() }),
    orderBy: [{ sortOrder: "asc" }], search: ["name"], filters: ["isActive"], include: { _count: { select: { variants: true } } },
    beforeDelete: async (tx, id) => {
      if (await tx.productVariant.count({ where: { colorId: id } })) throw conflict("این رنگ در تنوع محصولات استفاده شده است؛ آن را غیرفعال کنید.");
    },
  },
  discounts: {
    model: "discount", perm: "discount.write", label: "تخفیف", auditName: "discount",
    create: z.object({
      name: req(80), type: z.enum(["PERCENT", "FIXED"]), value: int(1, 2_000_000_000),
      scope: z.enum(["ALL", "PRODUCT", "CATEGORY", "VARIANT", "PRODUCT_BRAND", "PHONE_BRAND", "MODEL"]), targetId: z.string().trim().max(40).optional(),
      startsAt: dateOpt, endsAt: dateOpt, minOrder: int(0).optional(), usageLimit: optInt(1), perUserLimit: optInt(1), isActive: bool.optional(),
    }),
    orderBy: [{ createdAt: "desc" }], search: ["name"], filters: ["isActive", "scope"],
    guard: async (tx, d, ex) => {
      const type = (d.type ?? ex?.type) as string, value = (d.value ?? ex?.value) as number;
      if (type === "PERCENT" && value > 100) throw conflict("درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.", "validation");
      const scope = (d.scope ?? ex?.scope) as string;
      // Re-targeting between brand kinds keeps the chosen brand; any other change of scope needs a new target.
      const brandLike = (x: unknown) => x === "BRAND" || x === "PRODUCT_BRAND" || x === "PHONE_BRAND";
      const keep = d.scope === undefined || (brandLike(ex?.scope) && brandLike(d.scope));
      const targetId = ((d.targetId ?? (keep ? ex?.targetId : "")) ?? "") as string;
      if (scope === "ALL") d.targetId = "";
      else {
        if (!targetId) throw conflict("برای این نوع تخفیف باید هدف (محصول، دسته، تنوع، برند یا مدل) انتخاب شود.", "validation");
        const found = scope === "PRODUCT" ? await tx.product.count({ where: { id: targetId } }) : scope === "CATEGORY" ? await tx.category.count({ where: { id: targetId } }) : scope === "VARIANT" ? await tx.productVariant.count({ where: { id: targetId } }) : scope === "PRODUCT_BRAND" || scope === "PHONE_BRAND" || scope === "BRAND" ? await tx.brand.count({ where: { id: targetId } }) : await tx.phoneModel.count({ where: { id: targetId } });
        if (!found) throw conflict("هدف انتخاب‌شده پیدا نشد.", "validation");
        d.targetId = targetId;
      }
      const s = (d.startsAt === undefined ? ex?.startsAt : d.startsAt) as Date | null, e = (d.endsAt === undefined ? ex?.endsAt : d.endsAt) as Date | null;
      if (s && e && e <= s) throw conflict("تاریخ پایان باید بعد از شروع باشد.", "validation");
    },
    beforeDelete: async (tx, id) => {
      if (await tx.discountUsage.count({ where: { discountId: id } })) throw conflict("این تخفیف در سفارش‌ها استفاده شده است؛ به‌جای حذف آن را غیرفعال کنید.");
    },
  },
  shipping: {
    model: "shippingMethod", perm: "shipping.write", label: "روش ارسال", auditName: "shipping_method", hasSort: true,
    create: z.object({ key: keyish, name: req(80), description: opt(300), cost: int(0), freeThreshold: optInt(0), isActive: bool.optional(), sortOrder: int(0, 100000).optional() }),
    orderBy: [{ sortOrder: "asc" }], search: ["name", "key"], filters: ["isActive"], immutable: ["key"],
    beforeDelete: async (tx, id) => {
      if (await tx.order.count({ where: { shippingMethodId: id } })) throw conflict("این روش در سفارش‌ها استفاده شده؛ آن را غیرفعال کنید.");
    },
  },
  banners: {
    model: "banner", perm: "banner.write", label: "بنر", auditName: "banner", hasSort: true,
    create: z.object({ title: req(120), subtitle: opt(200), description: opt(600), desktopImage: image, mobileImage: image, buttonText: opt(40), buttonLink: link, placement: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,39}$/, "کلید محل نمایش: حروف کوچک انگلیسی، عدد و _ -").optional(), startsAt: dateOpt, endsAt: dateOpt, isActive: bool.optional(), sortOrder: int(0, 100000).optional() }),
    orderBy: [{ placement: "asc" }, { sortOrder: "asc" }], search: ["title"], filters: ["isActive", "placement"],
  },
  homepage: {
    model: "homepageSection", perm: "homepage.write", label: "بخش صفحه اصلی", auditName: "homepage_section", hasSort: true, immutable: ["key", "type"],
    create: z.object({
      key: keyish, type: z.enum(["hero", "marquee", "product_rail", "categories", "newest", "banner", "blog"]), title: opt(120), subtitle: opt(200), link,
      config: z.object({ categorySlug: z.string().trim().max(120).optional(), placement: z.string().trim().max(40).regex(/^([a-z][a-z0-9_-]{1,39})?$/).optional(), productIds: z.array(z.string().max(40)).max(24).optional(), limit: z.coerce.number().int().min(1).max(24).optional() }).nullable().optional(),
      isActive: bool.optional(), sortOrder: int(0, 100000).optional(),
    }),
    orderBy: [{ sortOrder: "asc" }], search: ["title", "key"], filters: ["isActive"],
  },
  menus: {
    model: "menuItem", perm: "menu.write", label: "آیتم منو", auditName: "menu_item", hasSort: true,
    create: z.object({ menu: z.enum(["main", "footer", "mobile"]), label: req(60), link, parentId: z.string().max(40).nullable().optional().transform((v) => v || null), isActive: bool.optional(), sortOrder: int(0, 100000).optional() }),
    orderBy: [{ menu: "asc" }, { sortOrder: "asc" }], search: ["label", "link"], filters: ["isActive", "menu"], include: { parent: { select: { label: true } } },
    guard: (tx, d, ex) => noSelfParent(tx, "menuItem", d, ex),
  },
  tiers: {
    model: "wholesaleTier", perm: "wholesale.review", label: "سطح همکار", auditName: "wholesale_tier", immutable: ["key"],
    create: z.object({ key: keyish, name: req(60), discountPercent: int(0, 100).optional(), minOrder: int(0).optional(), priceRule: z.enum(["wholesale_price", "retail_minus_percent"]).optional(), isActive: bool.optional() }),
    orderBy: [{ minOrder: "asc" }], search: ["name", "key"], include: { _count: { select: { profiles: true } } },
    beforeDelete: async (tx, id) => {
      if (await tx.wholesaleProfile.count({ where: { tierId: id } })) throw conflict("همکارانی در این سطح هستند؛ ابتدا آن‌ها را به سطح دیگری ببرید.");
    },
  },
  seo: {
    model: "sEOSetting", perm: "seo.write", label: "تنظیم سئو", auditName: "seo_setting", immutable: ["scope"],
    create: z.object({ scope: keyish, title: opt(120), description: opt(300), ogImage: image, robots: z.enum(["index,follow", "noindex,follow", "noindex,nofollow"]).nullable().optional() }),
    orderBy: [{ scope: "asc" }], search: ["scope", "title"],
  },
  blog: {
    model: "blogPost", perm: "blog.write", label: "مقاله", auditName: "blog_post", slugKind: "post",
    create: z.object({ title: req(160), slug, excerpt: opt(400), content: req(50000), featuredImage: image, categoryId: z.string().max(40).nullable().optional().transform((v) => v || null), tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(), authorName: opt(60), isPublished: bool.optional(), publishedAt: dateOpt, seoTitle: opt(120), seoDescription: opt(300), canonical: link }),
    orderBy: [{ createdAt: "desc" }], search: ["title", "slug"], filters: ["isPublished", "categoryId"], include: { category: { select: { name: true } } },
    guard: async (_tx, d, ex) => { if (d.isPublished && !d.publishedAt && !ex?.publishedAt) d.publishedAt = new Date(); },
  },
  "blog-categories": {
    model: "blogCategory", perm: "blog.write", label: "دسته وبلاگ", auditName: "blog_category",
    create: z.object({ name: req(60), slug }),
    orderBy: [{ name: "asc" }], search: ["name", "slug"], include: { _count: { select: { posts: true } } },
    beforeDelete: async (tx, id) => {
      if (await tx.blogPost.count({ where: { categoryId: id } })) throw conflict("این دسته مقاله دارد؛ ابتدا مقاله‌ها را به دسته دیگری ببرید.");
    },
  },
};
