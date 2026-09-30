/**
 * Optional: fills an EMPTY shop with the demo CATALOGUE (categories, brands, phone models, ~70 products with stock, homepage sections,
 * menus, banner, blog posts, shipping methods, wholesale tiers). Run once on the server:  npm run import:demo -- --yes
 *
 * It deliberately does NOT create: users or passwords, orders, wallets, reviews, ratings, coupons, the bank-card details or the
 * shop contact details. Prices, stock and shipping costs are placeholders — edit or delete them in /admin.
 * Refuses to run when products already exist (use --force to add anyway). Never deletes anything.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { syncRbac } from "../prisma/rbac";
import { blogPosts2, blogCats, catalog, phoneModels, shopCatOf, shopCats, shopSubOf } from "../prisma/seed-data";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const slugify = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

async function main() {
  if (!process.argv.includes("--yes")) throw new Error("This adds DEMO catalogue content to the database. Re-run with --yes to confirm.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const existing = await db.product.count();
  if (existing > 0 && !process.argv.includes("--force")) throw new Error(`Refusing: ${existing} product(s) already exist (use --force to add the demo catalogue anyway).`);
  await syncRbac(db);

  /* wholesale tiers + partner profile */
  const tiers = [
    { key: "bronze", name: "برنز", discountPercent: 0, minOrder: 3_000_000, isActive: true },
    { key: "silver", name: "نقره‌ای", discountPercent: 3, minOrder: 10_000_000, isActive: false },
    { key: "gold", name: "طلایی", discountPercent: 6, minOrder: 25_000_000, isActive: false },
  ];
  for (const t of tiers) await db.wholesaleTier.upsert({ where: { key: t.key }, update: t, create: t });

  /* categories (tree from the storefront's shop categories) */
  const icons: Record<string, number> = {};
  let order = 0;
  for (const c of shopCats) {
    const top = await db.category.upsert({ where: { slug: c.slug }, update: { name: c.label, sortOrder: order }, create: { slug: c.slug, name: c.label, sortOrder: order } });
    icons[c.slug] = top.id as unknown as number;
    let so = 0;
    for (const sub of c.subs) await db.category.upsert({ where: { slug: sub.slug }, update: { name: sub.label, parentId: top.id, sortOrder: so++ }, create: { slug: sub.slug, name: sub.label, parentId: top.id, sortOrder: so++ } });
    order++;
  }

  /* brands + phone models */
  const brandNames = ["Apple", "Samsung", "Xiaomi", "Anker", "Baseus", "JBL", "Huawei", "Nokia", "Honor", "Google", "OnePlus"];
  for (const [i, name] of brandNames.entries()) await db.brand.upsert({ where: { slug: slugify(name) }, update: {}, create: { slug: slugify(name), name, sortOrder: i, description: `محصولات ${name} در کیس‌لاین` } });
  const phoneList: [string, string][] = [];
  for (const [brand, list] of Object.entries(phoneModels)) for (const m of list) phoneList.push([brand, m]);
  for (const extra of [["Apple", "iPhone 16 Pro Max"], ["Apple", "iPhone 16 Pro"], ["Apple", "iPhone 16"], ["Apple", "iPhone 14 Pro"], ["Apple", "iPhone 12"], ["Samsung", "Galaxy S25 Ultra"], ["Samsung", "Galaxy S23"], ["Xiaomi", "Xiaomi 15"], ["Xiaomi", "Poco F5"]] as [string, string][]) phoneList.push(extra);
  const seen = new Set<string>();
  let po = 0;
  for (const [brand, name] of phoneList) {
    if (seen.has(name)) continue;
    seen.add(name);
    const b = await db.brand.findUniqueOrThrow({ where: { slug: slugify(brand) } });
    await db.phoneModel.upsert({ where: { slug: slugify(name) }, update: {}, create: { slug: slugify(name), name, brandId: b.id, sortOrder: po++ } });
  }
  const phones = await db.phoneModel.findMany();

  /* products */
  const cats = await db.category.findMany();
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));
  const brandBySlug = new Map((await db.brand.findMany()).map((b) => [b.slug, b.id]));
  let n = 0;
  for (const p of catalog) {
    const top = shopCatOf(p), sub = shopSubOf(p);
    const catId = catBySlug.get(sub && catBySlug.has(sub) ? sub : top)!;
    const retail = p.oldPrice ?? p.price;
    const slug = `${slugify(p.name)}-${p.id}`;
    const data = {
      name: p.name, categoryId: catId, brandId: brandBySlug.get(slugify(p.brand)) ?? null, badge: p.badge ?? null, isActive: true,
      shortDescription: `${p.name}${p.compat ? ` مخصوص ${p.compat}` : ""} با ضمانت اصالت و ارسال سریع`,
      description: `${p.name} یکی از پرطرفدارترین محصولات کیس‌لاین است. کیفیت ساخت بالا، سازگاری دقیق با مدل گوشی و ضمانت ۷ روزه بازگشت.`,
      specifications: { "برند": p.brand, ...(p.compat ? { "سازگار با": p.compat } : {}), "ضمانت": "۷ روز بازگشت" },
      retailPrice: retail, retailDiscount: retail - p.price, wholesalePrice: Math.round((p.price * 0.8) / 1000) * 1000, minWholesaleQty: 5,
      ratingAvg: 0, ratingCount: 0, soldCount: p.reviews * 3, // no invented ratings; soldCount only orders the rails visualKind: p.kind, visualHue: p.hue,
    };
    const prod = await db.product.upsert({ where: { slug }, update: data, create: { slug, sku: `CL-${p.id.toUpperCase()}`, ...data } });
    if (p.img) {
      await db.productImage.deleteMany({ where: { productId: prod.id } });
      await db.productImage.create({ data: { productId: prod.id, url: p.img, alt: p.name, isPrimary: true } });
    }
    const variant = await db.productVariant.upsert({ where: { sku: `CL-${p.id.toUpperCase()}-STD` }, update: {}, create: { productId: prod.id, sku: `CL-${p.id.toUpperCase()}-STD`, name: "استاندارد" } });
    const qty = p.id === "ap5" ? 0 : 3 + ((n * 7) % 58);
    await db.inventory.upsert({ where: { variantId: variant.id }, update: {}, create: { variantId: variant.id, quantity: qty, lowStockThreshold: 5 } });
    if (p.compat) {
      const ph = phones.find((x) => x.name === p.compat);
      if (ph) await db.productPhoneModel.upsert({ where: { productId_phoneModelId: { productId: prod.id, phoneModelId: ph.id } }, update: {}, create: { productId: prod.id, phoneModelId: ph.id } });
    }
    n++;
  }

  /* shipping, coupons, banners, homepage, menus, blog, settings */
  for (const [i, s] of [
    { key: "post", name: "پست پیشتاز", cost: 60_000, freeThreshold: 2_000_000, description: "تحویل ۲ تا ۴ روز کاری" },
    { key: "courier", name: "پیک (تهران)", cost: 90_000, freeThreshold: 3_000_000, description: "تحویل همان روز" },
    { key: "pickup", name: "تحویل حضوری", cost: 0, freeThreshold: null, description: "از فروشگاه" },
  ].entries()) await db.shippingMethod.upsert({ where: { key: s.key }, update: {}, create: { ...s, sortOrder: i } });

  if ((await db.banner.count()) === 0) await db.banner.create({ data: { title: "داغ‌ترین کدهای تخفیف و پیشنهادهای ویژه", subtitle: "فقط و فقط در کانال تلگرام کیس‌لاین", buttonText: "ورود به کانال", buttonLink: "https://t.me/caseline_shop", placement: "home_telegram" } });

  const sections = [
    ["hero", "hero", "هیرو"], ["brands", "marquee", "برندها"], ["rail:iphone", "product_rail", "قاب آیفون"], ["rail:samsung", "product_rail", "قاب سامسونگ"],
    ["categories", "categories", "دسته‌بندی‌ها"], ["rail:xiaomi", "product_rail", "قاب شیائومی"], ["rail:airpods", "product_rail", "لوازم جانبی ایرپاد"],
    ["rail:watch", "product_rail", "لوازم جانبی اپل واچ"], ["rail:electric", "product_rail", "لوازم برقی"], ["newest", "newest", "تازه‌ترین محصولات"],
    ["telegram", "banner", "کانال تلگرام"], ["blog", "blog", "آخرین وبلاگ‌ها"],
  ];
  for (const [i, [key, type, title]] of sections.entries()) await db.homepageSection.upsert({ where: { key }, update: {}, create: { key, type, title, sortOrder: i, config: key.startsWith("rail:") ? { categorySlug: key.slice(5), limit: 5 } : undefined } });

  if ((await db.menuItem.count()) === 0) {
    await db.menuItem.createMany({ data: [
      { menu: "main", label: "فروشگاه", link: "/shop", sortOrder: 0 }, { menu: "main", label: "وبلاگ", link: "/blog", sortOrder: 1 }, { menu: "main", label: "پشتیبانی", link: "/support", sortOrder: 2 },
      { menu: "footer", label: "محصولات", link: "/shop", sortOrder: 0 }, { menu: "footer", label: "بلاگ", link: "/blog", sortOrder: 1 }, { menu: "footer", label: "حساب کاربری", link: "/account", sortOrder: 2 },
      { menu: "footer", label: "تماس با ما", link: "/support", sortOrder: 3 }, { menu: "footer", label: "پشتیبانی", link: "/support", sortOrder: 4 },
    ] });
  }

  for (const c of blogCats) await db.blogCategory.upsert({ where: { slug: slugify(c) }, update: {}, create: { slug: slugify(c), name: c } });
  const bc = new Map((await db.blogCategory.findMany()).map((c) => [c.name, c.id]));
  for (const [i, b] of blogPosts2.entries()) {
    await db.blogPost.upsert({
      where: { slug: b.slug }, update: {},
      create: { slug: b.slug, title: b.title, excerpt: b.excerpt, content: `${b.excerpt}\n\nدر این مطلب نکات مهم و کاربردی را مرور می‌کنیم تا انتخابی مطمئن داشته باشید.\n\nهمه محصولات کیس‌لاین اورجینال هستند و با ضمانت بازگشت ارسال می‌شوند.`, categoryId: bc.get(b.cat), tags: [b.cat], authorName: "تیم کیس‌لاین", isPublished: true, publishedAt: new Date(Date.now() - i * 86400000 * 3) },
    });
  }

  await db.sEOSetting.upsert({ where: { scope: "global" }, update: {}, create: { scope: "global", title: "CaseLine | فروشگاه لوازم جانبی موبایل", description: "قاب، گلس، شارژر، کابل و هندزفری اورجینال با ضمانت سازگاری با مدل گوشی شما", robots: "index,follow" } });
  console.log(`Demo catalogue imported: ${await db.product.count()} products, ${await db.category.count()} categories, ${await db.blogPost.count()} blog posts.`);
  console.log("Next: restart the app (systemctl restart caseline), then edit prices/stock/shipping in /admin and fill /admin/settings (contact + bank card).");
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); }).finally(() => db.$disconnect());
