/* Development seed. Demo credentials are printed at the end; never run with SEED_DEMO in production. */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { seedDemoOrders } from "./seed-demo-orders";
import { blogPosts2, blogCats, catalog, phoneModels, shopCatOf, shopCats, shopSubOf } from "./seed-data";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

const PERMISSIONS: [string, string][] = [
  ["dashboard.view", "مشاهده داشبورد"], ["product.read", "مشاهده محصولات"], ["product.write", "ویرایش محصولات"], ["product.delete", "حذف محصولات"],
  ["category.write", "مدیریت دسته‌بندی"], ["brand.write", "مدیریت برند"], ["phone.write", "مدیریت مدل گوشی"], ["inventory.write", "مدیریت موجودی"],
  ["order.read", "مشاهده سفارش‌ها"], ["order.write", "مدیریت سفارش‌ها"], ["payment.review", "بررسی پرداخت‌ها"], ["customer.read", "مشاهده مشتریان"],
  ["customer.write", "مدیریت مشتریان"], ["wholesale.review", "بررسی درخواست عمده"], ["coupon.write", "مدیریت کوپن"], ["review.moderate", "مدیریت نظرات"],
  ["banner.write", "مدیریت بنر"], ["homepage.write", "مدیریت صفحه اصلی"], ["menu.write", "مدیریت منو"], ["blog.write", "مدیریت وبلاگ"],
  ["support.reply", "پاسخ به پشتیبانی"], ["wallet.adjust", "مدیریت کیف پول"], ["loyalty.adjust", "مدیریت امتیاز"], ["shipping.write", "مدیریت ارسال"],
  ["refund.manage", "ثبت درخواست بازگشت وجه"], ["refund.approve", "تأیید و تکمیل بازگشت وجه بانکی"], ["wallet.read", "مشاهده کیف پول"], ["loyalty.read", "مشاهده امتیاز وفاداری"], ["support.read", "مشاهده پشتیبانی"],
  ["seo.write", "مدیریت سئو"], ["settings.write", "تنظیمات سایت"], ["audit.read", "مشاهده لاگ‌ها"], ["role.manage", "مدیریت نقش‌ها"],
];
const ROLES: { key: string; name: string; staff: boolean; perms: string[] | "all" | "all-but-roles" }[] = [
  { key: "super_admin", name: "مدیر ارشد", staff: true, perms: "all" },
  { key: "admin", name: "مدیر", staff: true, perms: "all-but-roles" },
  { key: "product_manager", name: "مدیر محصول", staff: true, perms: ["dashboard.view", "product.read", "product.write", "product.delete", "category.write", "brand.write", "phone.write", "inventory.write"] },
  { key: "order_manager", name: "مدیر سفارش", staff: true, perms: ["dashboard.view", "order.read", "order.write", "payment.review", "refund.manage", "shipping.write", "customer.read"] },
  { key: "content_manager", name: "مدیر محتوا", staff: true, perms: ["dashboard.view", "blog.write", "banner.write", "homepage.write", "menu.write", "seo.write"] },
  { key: "support", name: "پشتیبان", staff: true, perms: ["dashboard.view", "support.reply", "support.read", "customer.read", "review.moderate", "order.read"] },
  { key: "wholesale_manager", name: "مدیر همکاران عمده", staff: true, perms: ["dashboard.view", "wholesale.review", "customer.read", "order.read"] },
  { key: "customer", name: "مشتری", staff: false, perms: [] },
  { key: "wholesale_partner", name: "همکار عمده", staff: false, perms: [] },
];

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.SEED_DEMO) throw new Error("Refusing to seed demo data in production (set SEED_DEMO=1 to override).");

  /* roles & permissions */
  for (const [key, label] of PERMISSIONS) await db.permission.upsert({ where: { key }, update: { label }, create: { key, label } });
  const perms = await db.permission.findMany();
  for (const r of ROLES) {
    const role = await db.role.upsert({ where: { key: r.key }, update: { name: r.name, isStaff: r.staff }, create: { key: r.key, name: r.name, isStaff: r.staff } });
    const keys = r.perms === "all" ? perms.map((p) => p.key) : r.perms === "all-but-roles" ? perms.filter((p) => p.key !== "role.manage").map((p) => p.key) : r.perms;
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: perms.filter((p) => keys.includes(p.key)).map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
  const roleId = async (key: string) => (await db.role.findUniqueOrThrow({ where: { key } })).id;

  /* demo users */
  const demo = [
    { phone: "09120000001", email: "admin@caseline.local", first: "مدیر", last: "سایت", password: "Admin@12345", role: "super_admin" },
    { phone: "09120000002", email: "customer@caseline.local", first: "مشتری", last: "نمونه", password: "Customer@12345", role: "customer" },
    { phone: "09120000006", email: "products@caseline.local", first: "مدیر", last: "محصول", password: "Manager@12345", role: "product_manager" },
    { phone: "09120000003", email: "partner@caseline.local", first: "همکار", last: "نمونه", password: "Partner@12345", role: "wholesale_partner" },
  ];
  const users: Record<string, string> = {};
  for (const u of demo) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const user = await db.user.upsert({
      where: { phone: u.phone },
      update: { passwordHash },
      create: { phone: u.phone, email: u.email, passwordHash, firstName: u.first, lastName: u.last, displayName: `${u.first} ${u.last}`, phoneVerifiedAt: new Date() },
    });
    users[u.role] = user.id;
    await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: await roleId(u.role) } }, update: {}, create: { userId: user.id, roleId: await roleId(u.role) } });
    if (u.role !== "super_admin") await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: await roleId("customer") } }, update: {}, create: { userId: user.id, roleId: await roleId("customer") } });
  }

  /* wholesale tiers + partner profile */
  const tiers = [
    { key: "bronze", name: "برنز", discountPercent: 0, minOrder: 3_000_000, isActive: true },
    { key: "silver", name: "نقره‌ای", discountPercent: 3, minOrder: 10_000_000, isActive: false },
    { key: "gold", name: "طلایی", discountPercent: 6, minOrder: 25_000_000, isActive: false },
  ];
  for (const t of tiers) await db.wholesaleTier.upsert({ where: { key: t.key }, update: t, create: t });
  const bronze = await db.wholesaleTier.findUniqueOrThrow({ where: { key: "bronze" } });
  await db.wholesaleProfile.upsert({ where: { userId: users.wholesale_partner }, update: {}, create: { userId: users.wholesale_partner, tierId: bronze.id, storeName: "فروشگاه نمونه" } });

  /* pending wholesale applications (real rows an admin can approve in the panel) */
  const applicants = [
    { phone: "09120000004", first: "علی", last: "رضایی", store: "موبایل‌کده رضایی", type: "physical_store", city: "تهران", instagram: "mobilekade_rezaei" },
    { phone: "09120000005", first: "سارا", last: "محمدی", store: "کیف و قاب سارا", type: "instagram_shop", city: "اصفهان", instagram: "sara_cases" },
  ];
  for (const a of applicants) {
    const user = await db.user.upsert({ where: { phone: a.phone }, update: {}, create: { phone: a.phone, firstName: a.first, lastName: a.last, displayName: `${a.first} ${a.last}`, phoneVerifiedAt: new Date() } });
    await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: await roleId("customer") } }, update: {}, create: { userId: user.id, roleId: await roleId("customer") } });
    if (!(await db.wholesaleApplication.findFirst({ where: { phone: a.phone } })))
      await db.wholesaleApplication.create({ data: { userId: user.id, name: `${a.first} ${a.last}`, phone: a.phone, storeName: a.store, businessType: a.type, instagram: a.instagram, city: a.city, address: `${a.city}، خیابان اصلی، پلاک ۱۲`, description: "فروش لوازم جانبی موبایل، حدود ۵۰ سفارش در ماه." } });
  }

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
      ratingAvg: p.rating, ratingCount: p.reviews, soldCount: p.reviews * 3, visualKind: p.kind, visualHue: p.hue,
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

  await db.coupon.upsert({ where: { code: "CASE10" }, update: {}, create: { code: "CASE10", type: "percent", value: 10, minOrder: 200_000, maxDiscount: 300_000, perUserLimit: 1 } });
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

  const settings: Record<string, unknown> = {
    site: { name: "CaseLine", tagline: "فروشگاه لوازم جانبی موبایل", phone: "021-12345678", email: "info@caseline.ir", address: "تهران، میدان ونک، خیابان ملاصدرا", hours: "هر روز ساعت ۸ صبح تا ۱۰ شب", telegram: "https://t.me/caseline_shop", instagram: "https://instagram.com/caseline", topBar: "در تلگرام | کد تخفیف خرید اول: CASE10", footerText: "در کیس‌لاین، لوازم جانبی موبایل را اورجینال، با ضمانت سازگاری با مدل گوشی و پرداخت مطمئن تهیه کنید." },
    payment: { bankName: "بانک نمونه", accountHolder: "فروشگاه کیس‌لاین", cardNumber: "6037-0000-0000-0000", accountNumber: "0000000000", iban: "IR000000000000000000000000", description: "لطفاً مبلغ را به کارت زیر واریز و رسید را بارگذاری کنید." },
    shipping: { freeThreshold: 2_000_000 },
    general: { currency: "تومان", lowStockNotify: true },
    loyalty: { enabled: true, amountPerPoint: 10000, earnOn: "payment", minOrderTotal: 0, redeemEnabled: true, pointValue: 100, minRedeemPoints: 100, maxRedeemPercent: 30 },
  };
  for (const [key, value] of Object.entries(settings)) await db.siteSetting.upsert({ where: { key }, update: {}, create: { key, value: value as object } });
  await db.sEOSetting.upsert({ where: { scope: "global" }, update: {}, create: { scope: "global", title: "CaseLine | فروشگاه لوازم جانبی موبایل", description: "قاب، گلس، شارژر، کابل و هندزفری اورجینال با ضمانت سازگاری با مدل گوشی شما", robots: "index,follow" } });

  /* accounts start empty: no placeholder money or points are stored as real data */
  const cust = users.customer;
  await db.wallet.upsert({ where: { userId: cust }, update: {}, create: { userId: cust } });
  await db.loyaltyAccount.upsert({ where: { userId: cust }, update: {}, create: { userId: cust } });
  if ((await db.address.count({ where: { userId: cust } })) === 0) await db.address.create({ data: { userId: cust, title: "خانه", receiver: "مشتری نمونه", phone: "09120000002", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱", isDefault: true } });

  /* pending reviews for the moderation queue */
  if ((await db.review.count()) === 0) {
    for (const [i, p] of (await db.product.findMany({ take: 2, orderBy: { soldCount: "desc" } })).entries())
      await db.review.create({ data: { productId: p.id, userId: cust, rating: 5 - i, body: i ? "کیفیت خوب بود ولی بسته‌بندی ساده‌تر از انتظارم بود." : "عالی بود، دقیقاً مطابق توضیحات و سازگار با گوشی من." } });
  }

  await seedDemoOrders(db);

  console.log(`\nSeed OK: ${n} products.\nDemo logins (dev only):\n  admin     09120000001 / Admin@12345\n  customer  09120000002 / Customer@12345\n  partner   09120000003 / Partner@12345\n  product manager (limited) 09120000006 / Manager@12345`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
