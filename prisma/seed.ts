import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function upsertCategory(name: string, slug: string, parentId?: string, imageUrl?: string) {
  return db.category.upsert({
    where: { slug },
    update: {},
    create: { name, slug, parentId, imageUrl },
  });
}

async function main() {
  // ---------- Admin user ----------
  const adminPassword = await bcrypt.hash("Admin@12345", 10);
  await db.user.upsert({
    where: { email: "admin@caseline.ir" },
    update: {},
    create: {
      name: "مدیر فروشگاه",
      email: "admin@caseline.ir",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  // ---------- Categories (top-level + sub-categories) ----------
  const tree: Record<string, { name: string; slug: string; children: { name: string; slug: string }[] }> = {
    case: {
      name: "قاب و کاور", slug: "case", children: [
        { name: "آیفون", slug: "case-iphone" },
        { name: "سامسونگ", slug: "case-samsung" },
        { name: "شیائومی", slug: "case-xiaomi" },
        { name: "هواوی", slug: "case-huawei" },
        { name: "آنر", slug: "case-honor" },
        { name: "سایر برندها", slug: "case-other" },
        { name: "قاب فانتزی", slug: "case-fancy" },
        { name: "قاب شفاف", slug: "case-clear" },
        { name: "قاب ضدضربه", slug: "case-rugged" },
        { name: "قاب مگ‌سیف", slug: "case-magsafe" },
      ],
    },
    airpods: {
      name: "کاور ایرپاد", slug: "airpods", children: [
        { name: "AirPods", slug: "airpods-1" },
        { name: "AirPods 2", slug: "airpods-2" },
        { name: "AirPods 3", slug: "airpods-3" },
        { name: "AirPods 4", slug: "airpods-4" },
        { name: "AirPods Pro", slug: "airpods-pro" },
        { name: "AirPods Pro 2", slug: "airpods-pro-2" },
      ],
    },
    cable: {
      name: "شارژ و کابل", slug: "cable", children: [
        { name: "شارژر", slug: "cable-charger" },
        { name: "کابل", slug: "cable-cable" },
        { name: "Type-C", slug: "cable-typec" },
        { name: "Lightning", slug: "cable-lightning" },
        { name: "شارژر وایرلس", slug: "cable-wireless" },
        { name: "شارژر فندکی", slug: "cable-car" },
        { name: "پاوربانک", slug: "cable-powerbank" },
        { name: "آداپتور", slug: "cable-adapter" },
      ],
    },
    protector: {
      name: "محافظ‌ها", slug: "protector", children: [
        { name: "گلس", slug: "protector-glass" },
        { name: "محافظ صفحه", slug: "protector-screen" },
        { name: "محافظ لنز", slug: "protector-lens" },
        { name: "محافظ Apple Watch", slug: "protector-watch" },
        { name: "محافظ ایرپاد", slug: "protector-airpods" },
      ],
    },
    holder: {
      name: "هولدر و پایه", slug: "holder", children: [
        { name: "هولدر خودرو", slug: "holder-car" },
        { name: "هولدر رومیزی", slug: "holder-desk" },
        { name: "پایه موبایل", slug: "holder-stand" },
        { name: "هولدر مگنتی", slug: "holder-magnetic" },
      ],
    },
    watch: {
      name: "لوازم ساعت", slug: "watch", children: [
        { name: "بند Apple Watch", slug: "watch-band" },
        { name: "قاب Apple Watch", slug: "watch-case" },
        { name: "محافظ صفحه", slug: "watch-protector" },
        { name: "بند ساعت هوشمند", slug: "watch-smartband" },
      ],
    },
    accessory: {
      name: "اکسسوری", slug: "accessory", children: [
        { name: "بند و استرپ", slug: "accessory-strap" },
        { name: "آویز موبایل", slug: "accessory-charm" },
        { name: "کیف", slug: "accessory-bag" },
        { name: "اکسسوری فانتزی", slug: "accessory-fancy" },
        { name: "محصولات ترند", slug: "accessory-trend" },
      ],
    },
  };

  const topCategories: Record<string, string> = {};
  for (const key of Object.keys(tree)) {
    const t = tree[key];
    const parent = await upsertCategory(t.name, t.slug);
    topCategories[key] = parent.id;
    for (const c of t.children) {
      await upsertCategory(c.name, c.slug, parent.id);
    }
  }

  // ---------- Brands & phone models ----------
  const apple = await db.brand.upsert({ where: { slug: "apple" }, update: {}, create: { name: "اپل", slug: "apple" } });
  const samsung = await db.brand.upsert({ where: { slug: "samsung" }, update: {}, create: { name: "سامسونگ", slug: "samsung" } });
  const xiaomi = await db.brand.upsert({ where: { slug: "xiaomi" }, update: {}, create: { name: "شیائومی", slug: "xiaomi" } });

  const iphone15pm = await db.phoneModel.upsert({ where: { slug: "iphone-15-pro-max" }, update: { brandId: apple.id }, create: { name: "آیفون ۱۵ پرو مکس", slug: "iphone-15-pro-max", brandId: apple.id } });
  const s24u = await db.phoneModel.upsert({ where: { slug: "galaxy-s24-ultra" }, update: { brandId: samsung.id }, create: { name: "گلکسی S24 اولترا", slug: "galaxy-s24-ultra", brandId: samsung.id } });
  const mi14 = await db.phoneModel.upsert({ where: { slug: "xiaomi-14" }, update: { brandId: xiaomi.id }, create: { name: "شیائومی ۱۴", slug: "xiaomi-14", brandId: xiaomi.id } });
  const iphone13 = await db.phoneModel.upsert({ where: { slug: "iphone-13" }, update: { brandId: apple.id }, create: { name: "آیفون ۱۳", slug: "iphone-13", brandId: apple.id } });
  const iphone14 = await db.phoneModel.upsert({ where: { slug: "iphone-14" }, update: { brandId: apple.id }, create: { name: "آیفون ۱۴", slug: "iphone-14", brandId: apple.id } });
  const a55 = await db.phoneModel.upsert({ where: { slug: "galaxy-a55" }, update: { brandId: samsung.id }, create: { name: "گلکسی A55", slug: "galaxy-a55", brandId: samsung.id } });

  // ---------- Colors ----------
  const pink = await db.color.upsert({ where: { slug: "pink" }, update: {}, create: { name: "صورتی", slug: "pink", hexCode: "#e8a0b4" } });
  const black = await db.color.upsert({ where: { slug: "black" }, update: {}, create: { name: "مشکی", slug: "black", hexCode: "#1a1a1a" } });
  const blue = await db.color.upsert({ where: { slug: "blue" }, update: {}, create: { name: "آبی", slug: "blue", hexCode: "#5b7fa6" } });

  // ---------- Pricing rules (cost price band -> sell price) ----------
  await db.pricingRule.createMany({
    data: [
      { minPrice: 100000, maxPrice: 200000, sellPrice: 298000 },
      { minPrice: 201000, maxPrice: 300000, sellPrice: 398000 },
      { minPrice: 301000, maxPrice: 400000, sellPrice: 498000 },
      { minPrice: 401000, maxPrice: 500000, sellPrice: 598000 },
    ],
    skipDuplicates: true,
  });

  // ---------- Sample products ----------
  const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/1000`;
  const products = [
    { name: "قاب چرمی آیفون ۱۵ پرو مکس", slug: "leather-case-iphone-15-pro-max", cat: "case-magsafe", brand: apple.id, model: iphone15pm.id, price: 450000, old: 590000, best: true, desc: "قاب چرم طبیعی با پوشش محافظ لبه‌های دوربین، ضدضربه از ارتفاع ۲ متری." },
    { name: "قاب سامسونگ گلکسی S24 اولترا", slug: "case-galaxy-s24-ultra", cat: "case-samsung", brand: samsung.id, model: s24u.id, price: 380000, isNew: true, desc: "قاب مات ضدلغزش با پوشش نانو ضدخط‌وخش." },
    { name: "قاب شیائومی ۱۴ سری آینه‌ای", slug: "mirror-case-xiaomi-14", cat: "case-xiaomi", brand: xiaomi.id, model: mi14.id, price: 320000, old: 400000, trending: true, desc: "ترکیب فریم فلزی و پشت آینه‌ای، ضدضربه." },
    { name: "کاور سیلیکونی ایرپاد پرو ۲", slug: "silicone-cover-airpods-pro-2", cat: "airpods-pro-2", price: 180000, best: true, desc: "سیلیکون نرم ضدضربه با جاخور کارابین." },
    { name: "کابل شارژ فست چارج تایپ‌سی", slug: "fast-charge-cable-typec", cat: "cable-typec", price: 220000, old: 280000, isNew: true, desc: "کابل بافت‌دار ۱۲۰ وات، طول ۱٫۲ متر." },
    { name: "شارژر دیواری ۶۵ وات GaN", slug: "gan-charger-65w", cat: "cable-charger", price: 650000, trending: true, desc: "فناوری GaN فشرده، دو پورت خروجی." },
    { name: "پاوربانک ۲۰۰۰۰ فست شارژ", slug: "powerbank-20000", cat: "cable-powerbank", price: 890000, old: 1050000, best: true, desc: "ظرفیت ۲۰۰۰۰ میلی‌آمپر با نمایشگر دیجیتال." },
    { name: "گلس محافظ صفحه سرامیکی", slug: "ceramic-glass-protector", cat: "protector-glass", price: 150000, old: 200000, best: true, desc: "انعطاف‌پذیر و مقاوم‌تر از شیشه معمولی." },
    { name: "هولدر مغناطیسی خودرو", slug: "magnetic-car-holder", cat: "holder-magnetic", price: 290000, isNew: true, desc: "آهنربای نئودیمیوم قدرتمند، چرخش ۳۶۰ درجه." },
    { name: "بند اپل واچ میلانیز", slug: "milanese-watch-band", cat: "watch-band", price: 480000, old: 600000, trending: true, desc: "استیل ضدزنگ با بافت میلانیز." },
  ];

  for (const p of products) {
    const cat = await db.category.findUnique({ where: { slug: p.cat } });
    if (!cat) continue;
    await db.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        description: p.desc,
        images: [img(p.slug), img(p.slug + "-2")],
        price: p.price,
        oldPrice: p.old,
        stock: 50,
        isActive: true,
        isBestSeller: !!p.best,
        isNew: !!p.isNew,
        isTrending: !!p.trending,
        categoryId: cat.id,
        brandId: p.brand,
        phoneModelId: p.model,
      },
    });
  }

  // ---------- Sample variable products (brand/model/color combinations) ----------
  const silCat = await db.category.findUnique({ where: { slug: "case-fancy" } });
  if (silCat) {
    const silicone = await db.product.upsert({
      where: { slug: "silicone-case-variable" },
      update: { hasVariants: true },
      create: {
        name: "قاب سیلیکونی",
        slug: "silicone-case-variable",
        description: "قاب سیلیکونی نرم و مقاوم، مخصوص چند مدل گوشی محبوب. برند، مدل و رنگ دلخواه را انتخاب کنید.",
        images: [img("silicone-case-variable"), img("silicone-case-variable-2")],
        price: 220000, // starting/reference price; real pricing comes from each variant
        stock: 0, // sold entirely through variants
        isActive: true,
        hasVariants: true,
        categoryId: silCat.id,
        brandId: apple.id,
      },
    });

    const silVariants: { brandId: string; phoneModelId: string; colorId: string; price: number; stock: number }[] = [
      { brandId: apple.id, phoneModelId: iphone13.id, colorId: pink.id, price: 220000, stock: 25 },
      { brandId: apple.id, phoneModelId: iphone13.id, colorId: black.id, price: 220000, stock: 30 },
      { brandId: apple.id, phoneModelId: iphone14.id, colorId: pink.id, price: 240000, stock: 0 }, // out of stock on purpose, for testing
      { brandId: apple.id, phoneModelId: iphone14.id, colorId: black.id, price: 240000, stock: 18 },
      { brandId: apple.id, phoneModelId: iphone14.id, colorId: blue.id, price: 240000, stock: 12 },
      { brandId: samsung.id, phoneModelId: a55.id, colorId: black.id, price: 210000, stock: 20 },
      { brandId: samsung.id, phoneModelId: a55.id, colorId: blue.id, price: 210000, stock: 15 },
    ];
    for (const v of silVariants) {
      await db.productVariant.upsert({
        where: { productId_brandId_phoneModelId_colorId: { productId: silicone.id, brandId: v.brandId, phoneModelId: v.phoneModelId, colorId: v.colorId } },
        update: { price: v.price, stock: v.stock },
        create: { productId: silicone.id, ...v, isActive: true },
      });
    }
  }

  // A second variable product that only varies by brand + model (no color)
  // — demonstrates the flexible-dimensions requirement (e.g. glass protectors).
  const glassCat = await db.category.findUnique({ where: { slug: "protector-glass" } });
  if (glassCat) {
    const glass = await db.product.upsert({
      where: { slug: "glass-protector-variable" },
      update: { hasVariants: true },
      create: {
        name: "گلس محافظ صفحه (چند مدل)",
        slug: "glass-protector-variable",
        description: "گلس سرامیکی نازک، سازگار با چند مدل گوشی. فقط کافیست برند و مدل گوشی خود را انتخاب کنید.",
        images: [img("glass-protector-variable")],
        price: 150000,
        stock: 0,
        isActive: true,
        hasVariants: true,
        categoryId: glassCat.id,
      },
    });
    const glassVariants = [
      { brandId: apple.id, phoneModelId: iphone13.id, price: 150000, stock: 40 },
      { brandId: apple.id, phoneModelId: iphone14.id, price: 150000, stock: 35 },
      { brandId: samsung.id, phoneModelId: a55.id, price: 140000, stock: 22 },
    ];
    for (const v of glassVariants) {
      await db.productVariant.upsert({
        where: { productId_brandId_phoneModelId_colorId: { productId: glass.id, brandId: v.brandId, phoneModelId: v.phoneModelId, colorId: null as any } },
        update: { price: v.price, stock: v.stock },
        create: { productId: glass.id, brandId: v.brandId, phoneModelId: v.phoneModelId, colorId: null, price: v.price, stock: v.stock, isActive: true },
      });
    }
  }

  // ---------- Homepage sections (order controls layout) ----------
  const sections: { type: any; title?: string; order: number }[] = [
    { type: "HERO", order: 0 },
    { type: "CATEGORY_STRIP", order: 1 },
    { type: "BEST_SELLERS", title: "پرفروش‌ترین‌ها", order: 2 },
    { type: "BANNER", order: 3 },
    { type: "NEW_ARRIVALS", title: "جدیدترین‌ها", order: 4 },
    { type: "DISCOUNTED", title: "تخفیف‌های ویژه", order: 5 },
    { type: "WHY_US", order: 6 },
    { type: "TESTIMONIALS", order: 7 },
  ];
  for (const s of sections) {
    const existing = await db.homepageSection.findFirst({ where: { type: s.type } });
    if (!existing) await db.homepageSection.create({ data: s });
  }

  // ---------- Sample banner ----------
  const bannerExists = await db.banner.findFirst();
  if (!bannerExists) {
    await db.banner.create({
      data: { title: "ست کامل اکسسوری", subtitle: "هماهنگ، ظریف، همیشگی", linkUrl: "/category/accessory", order: 0 },
    });
  }

  // ---------- Sample discount code ----------
  await db.discount.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: { code: "WELCOME10", type: "PERCENT", value: 10, isActive: true },
  });

  console.log("Seed complete. Admin login: admin@caseline.ir / Admin@12345");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
