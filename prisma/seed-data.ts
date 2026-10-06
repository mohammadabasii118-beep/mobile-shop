export type Kind = "case" | "glass" | "charger" | "cable" | "earbuds" | "powerbank" | "holder" | "flash" | "lens" | "airpods" | "watch";

export interface Product {
  id: string;
  name: string;
  brand: string;
  kind: Kind;
  hue: number; // tint for the generated visual
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  badge?: string;
  compat?: string;
  cat?: string; // shop category override
  sub?: string; // shop subcategory
  img?: string; // real product photo (public/)
}

export const categories: { slug: string; label: string; kind: Kind; hue: number }[] = [
  { slug: "case", label: "قاب و کاور", kind: "case", hue: 14 },
  { slug: "glass", label: "گلس", kind: "glass", hue: 190 },
  { slug: "charger", label: "شارژر", kind: "charger", hue: 40 },
  { slug: "cable", label: "کابل", kind: "cable", hue: 160 },
  { slug: "earbuds", label: "هندزفری", kind: "earbuds", hue: 280 },
  { slug: "powerbank", label: "پاوربانک", kind: "powerbank", hue: 220 },
  { slug: "holder", label: "هولدر", kind: "holder", hue: 340 },
  { slug: "flash", label: "فلش", kind: "flash", hue: 100 },
  { slug: "lens", label: "محافظ لنز", kind: "lens", hue: 260 },
];

export const brands = ["Apple", "Samsung", "Xiaomi", "Anker", "Baseus", "JBL", "Huawei", "Nokia"];

export const products: Product[] = [
  { id: "1", name: "قاب سیلیکونی MagSafe", brand: "Apple", kind: "case", hue: 14, price: 1_290_000, oldPrice: 1_590_000, rating: 4.8, reviews: 214, badge: "پرفروش", compat: "iPhone 15 Pro Max" },
  { id: "2", name: "گلس آنتی‌استاتیک 9H", brand: "Baseus", kind: "glass", hue: 190, price: 185_000, oldPrice: 240_000, rating: 4.6, reviews: 532, badge: "۲۳٪ تخفیف", compat: "Galaxy S24 Ultra" },
  { id: "3", name: "شارژر سریع ۶۵ وات GaN", brand: "Anker", kind: "charger", hue: 40, price: 1_450_000, rating: 4.9, reviews: 187, badge: "جدید" },
  { id: "4", name: "کابل Type-C به Lightning ۱ متر", brand: "Apple", kind: "cable", hue: 160, price: 690_000, oldPrice: 790_000, rating: 4.5, reviews: 96 },
  { id: "5", name: "ایرپاد بی‌سیم مدل Air Pro", brand: "Xiaomi", kind: "earbuds", hue: 280, price: 2_190_000, oldPrice: 2_690_000, rating: 4.7, reviews: 342, badge: "ویژه" },
  { id: "6", name: "پاوربانک ۲۰۰۰۰ میلی‌آمپر", brand: "Xiaomi", kind: "powerbank", hue: 220, price: 1_350_000, rating: 4.6, reviews: 421 },
  { id: "7", name: "هولدر مگنتی خودرو", brand: "Baseus", kind: "holder", hue: 340, price: 420_000, oldPrice: 520_000, rating: 4.4, reviews: 73 },
  { id: "8", name: "فلش OTG دو کانکتور ۱۲۸GB", brand: "Samsung", kind: "flash", hue: 100, price: 890_000, rating: 4.5, reviews: 58, badge: "جدید" },
  { id: "9", name: "کاور شفاف ضد ضربه", brand: "Samsung", kind: "case", hue: 200, price: 340_000, oldPrice: 420_000, rating: 4.3, reviews: 260, compat: "Galaxy S24" },
  { id: "10", name: "محافظ لنز دوربین فلزی", brand: "Apple", kind: "lens", hue: 260, price: 210_000, rating: 4.6, reviews: 129, badge: "جدید" },
  { id: "11", name: "شارژر وایرلس ۱۵ وات", brand: "Samsung", kind: "charger", hue: 30, price: 980_000, oldPrice: 1_150_000, rating: 4.7, reviews: 204 },
  { id: "12", name: "هدفون بلوتوثی Over-Ear", brand: "JBL", kind: "earbuds", hue: 320, price: 3_400_000, rating: 4.8, reviews: 88, badge: "پرفروش" },
];

export const phoneModels: Record<string, string[]> = {
  Apple: ["iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15", "iPhone 14", "iPhone 13"],
  Samsung: ["Galaxy S24 Ultra", "Galaxy S24", "Galaxy A55", "Galaxy A35"],
  Xiaomi: ["Redmi Note 13 Pro", "Poco X6", "Xiaomi 14", "Redmi 13C"],
};

export const blogPosts = [
  { title: "چطور قاب مناسب گوشی‌مان را انتخاب کنیم؟", tag: "راهنما", read: "۵ دقیقه" },
  { title: "گلس ساده یا آنتی‌استاتیک؛ کدام بهتر است؟", tag: "مقایسه", read: "۴ دقیقه" },
  { title: "شارژ سریع چطور کار می‌کند و چه کابلی لازم است؟", tag: "آموزش", read: "۶ دقیقه" },
];

export const kindLabel: Record<Kind, string> = {
  case: "قاب و کاور", glass: "گلس", charger: "شارژر", cable: "کابل", earbuds: "هندزفری",
  powerbank: "پاوربانک", holder: "هولدر", flash: "فلش", lens: "محافظ لنز", airpods: "لوازم ایرپاد", watch: "لوازم اپل واچ",
};
export const categoryCounts: Record<Kind, number> = { case: 48, glass: 32, charger: 17, cable: 21, earbuds: 14, powerbank: 12, holder: 9, flash: 7, lens: 11, airpods: 9, watch: 12 };
export const heroWords = ["قاب", "گلس", "شارژر", "هندزفری", "پاوربانک"];
export const quickChips = ["قاب آیفون", "گلس", "شارژر", "کابل", "ایرپاد", "پاوربانک"];

const caseNames = ["قاب سیلیکونی MagSafe", "قاب شفاف ضدضربه", "قاب چرمی لوکس", "قاب رینگ‌دار ضدضربه", "قاب Armor سه‌لایه"];
const mk = (prefix: string, brand: string, models: string[], hue: number, base: number): Product[] =>
  caseNames.map((n, i) => ({
    id: `${prefix}${i}`, name: n, brand, kind: "case", hue: (hue + i * 28) % 360,
    price: base + i * 45_000, oldPrice: i % 2 === 0 ? Math.round((base + i * 45_000) * 1.25 / 1000) * 1000 : undefined,
    rating: 4.3 + (i % 4) / 10, reviews: 60 + i * 37, compat: models[i % models.length],
  }));

const np = (id: string, name: string, brand: string, kind: Kind, hue: number, price: number, extra: Partial<Product> = {}): Product => ({ id, name, brand, kind, hue, price, rating: 4.4 + (id.length % 5) / 10, reviews: 40 + id.length * 17, ...extra });
export const airpodsItems: Product[] = [
  np("ap1", "کیس سیلیکونی ایرپاد پرو ۲", "Apple", "airpods", 320, 240_000, { oldPrice: 300_000, compat: "AirPods Pro 2", sub: "appro12" }),
  np("ap2", "کاور محافظ طرح‌دار ایرپاد ۳", "Baseus", "airpods", 20, 190_000, { compat: "AirPods 3", badge: "جدید", sub: "ap3" }),
  np("ap3", "قلاب ضدگمشدگی ایرپاد", "Baseus", "airpods", 200, 95_000, { compat: "AirPods Pro", sub: "appro12" }),
  np("ap4", "تیپ سیلیکونی ایرپاد پرو (۳ جفت)", "Apple", "airpods", 260, 130_000, { oldPrice: 165_000, compat: "AirPods Pro 2", sub: "appro12" }),
  np("ap5", "بند گردنی ایرپاد", "Baseus", "airpods", 150, 85_000, { compat: "AirPods 2", sub: "ap12" }),
  np("ap6", "کیس چرمی ایرپاد پرو", "Apple", "airpods", 30, 420_000, { compat: "AirPods Pro 2", sub: "appro12" }),
  np("ap7", "کیس سیلیکونی ایرپاد ۴", "Apple", "airpods", 180, 260_000, { compat: "AirPods 4", sub: "ap4", badge: "جدید" }),
  np("ap8", "کاور شفاف ایرپاد پرو ۳", "Baseus", "airpods", 240, 280_000, { compat: "AirPods Pro 3", sub: "appro3", badge: "جدید" }),
  np("ap9", "کیس سیلیکونی ایرپاد ۱ و ۲", "Baseus", "airpods", 60, 150_000, { compat: "AirPods 1/2", sub: "ap12", oldPrice: 190_000 }),
  np("ap10", "کیس محافظ ایرپاد ۴ ضدضربه", "Baseus", "airpods", 300, 310_000, { compat: "AirPods 4", sub: "ap4" }),
  np("ap11", "کیس محافظ ایرپاد پرو ۳", "Apple", "airpods", 100, 360_000, { compat: "AirPods Pro 3", sub: "appro3" }),
];
export const watchItems: Product[] = [
  np("wt1", "بند سیلیکونی اپل واچ ۴۵mm", "Apple", "watch", 10, 260_000, { oldPrice: 330_000, compat: "Apple Watch 9" , sub: "band" }),
  np("wt2", "بند میلانز فلزی اپل واچ", "Baseus", "watch", 210, 380_000, { compat: "Apple Watch 45mm" , sub: "band" }),
  np("wt3", "قاب محافظ اپل واچ سری ۹", "Apple", "watch", 180, 210_000, { compat: "Apple Watch 9", badge: "جدید" , sub: "wguard" }),
  np("wt4", "گلس نانو اپل واچ", "Baseus", "watch", 190, 120_000, { compat: "Apple Watch 45mm" , sub: "wglass" }),
  np("wt5", "پایه شارژر مگنتی اپل واچ", "Anker", "watch", 40, 450_000, { oldPrice: 520_000, compat: "Apple Watch" }),
  np("wt6", "بند نایلونی Sport Loop", "Apple", "watch", 330, 310_000, { compat: "Apple Watch Ultra" , sub: "band" }),
  np("wt7", "استند رومیزی اپل واچ", "Baseus", "watch", 250, 280_000, { compat: "Apple Watch" }),
  np("wt8", "گلس سرامیکی اپل واچ اولترا", "Baseus", "watch", 200, 160_000, { compat: "Apple Watch Ultra", sub: "wglass" }),
  np("wt9", "گارد ضدضربه اپل واچ ۴۱mm", "Apple", "watch", 20, 230_000, { compat: "Apple Watch 41mm", sub: "wguard", oldPrice: 290_000 }),
  np("wt10", "بند اسپورت دو رنگ اپل واچ", "Baseus", "watch", 120, 240_000, { compat: "Apple Watch 45mm", sub: "band" }),
];
export const electricItems: Product[] = [
  products[2], products[3], products[5], products[10],
  np("el1", "آداپتور دو پورت ۳۵ وات", "Anker", "charger", 55, 690_000, { oldPrice: 820_000, badge: "جدید" }),
  np("el2", "کابل USB-C به USB-C ۶۰ وات", "Baseus", "cable", 165, 320_000),
];

export const accessoryItems: Product[] = [
  np("ac1", "محافظ کابل سیلیکونی (۳ عددی)", "Baseus", "cable", 100, 85_000, { cat: "accessories", sub: "cableguard" }),
  np("ac2", "محافظ کابل فنری ضدشکستگی", "Anker", "cable", 190, 70_000, { cat: "accessories", sub: "cableguard", oldPrice: 95_000 }),
  np("ac3", "آویز گوشی طنابی", "Baseus", "lens", 330, 110_000, { cat: "accessories", sub: "charm", badge: "جدید" }),
  np("ac4", "بند مچی و آویز موبایل", "Xiaomi", "lens", 260, 90_000, { cat: "accessories", sub: "charm" }),
  np("ac5", "پاپ‌سوکت مگنتی", "Baseus", "holder", 350, 130_000, { cat: "accessories", sub: "popsocket", oldPrice: 160_000 }),
  np("ac6", "پاپ‌سوکت طرح‌دار", "Xiaomi", "holder", 20, 75_000, { cat: "accessories", sub: "popsocket" }),
  np("ac7", "هولدر رومیزی تاشو", "Baseus", "holder", 210, 260_000, { cat: "accessories", sub: "holder" }),
];

const photoCases: Partial<Product>[] = [
  { name: "قاب مشکی محافظ لنز طرح اپل", compat: "iPhone 15 Pro", img: "/products/p1.webp", badge: "پرفروش" },
  { name: "قاب کریسمسی طرح جینجربرد", compat: "iPhone 16 Pro", img: "/products/p2.webp", badge: "جدید" },
  { name: "قاب کیف‌پولی طرح ونگوگ با بند", compat: "iPhone 15", img: "/products/p3.webp" },
  { name: "قاب شفاف طرح لاک‌پشت دریایی", compat: "iPhone 16", img: "/products/p4.webp", badge: "جدید" },
  { name: "قاب طرح گربه و گل صورتی", compat: "iPhone 15 Pro Max", img: "/products/p5.webp" },
];
const withPhotos = (items: Product[]) => items.map((p, i) => ({ ...p, ...photoCases[i], hue: p.hue }));

export const rails = [
  { slug: "iphone", title: "قاب آیفون", items: withPhotos(mk("ip", "Apple", ["iPhone 15 Pro Max", "iPhone 15", "iPhone 14 Pro", "iPhone 13", "iPhone 12"], 14, 290_000)) },
  { slug: "samsung", title: "قاب سامسونگ", items: mk("sm", "Samsung", ["Galaxy S24 Ultra", "Galaxy S24", "Galaxy A55", "Galaxy A35", "Galaxy S23"], 200, 240_000) },
  { slug: "xiaomi", title: "قاب شیائومی", items: mk("xi", "Xiaomi", ["Redmi Note 13 Pro", "Poco X6", "Xiaomi 14", "Redmi 13C", "Poco F5"], 30, 180_000) },
  { slug: "airpods", title: "لوازم جانبی ایرپاد", items: airpodsItems.slice(0, 5) },
  { slug: "watch", title: "لوازم جانبی اپل واچ", items: watchItems.slice(0, 5) },
  { slug: "electric", title: "لوازم برقی", items: electricItems.slice(0, 5) },
];

export const homeCategories = [
  { slug: "iphone", label: "قاب آیفون", count: 48, logos: ["", "15", "14"] },
  { slug: "samsung", label: "قاب سامسونگ", count: 36, logos: ["S", "A", "Z"] },
  { slug: "xiaomi", label: "قاب شیائومی", count: 29, logos: ["Mi", "R", "P"] },
  { slug: "other", label: "سایر لوازم جانبی", count: 84, logos: ["⚡", "🎧", "🔋"] },
];

export const allProducts: Product[] = Array.from(
  new Map([...products, ...rails.flatMap((r) => r.items), ...airpodsItems, ...watchItems, ...electricItems, ...accessoryItems].map((p) => [p.id, p])).values(),
);
export const getProduct = (id: string) => allProducts.find((p) => p.id === id);

const modelKinds: Kind[] = ["case", "glass", "lens"];
export function optionsFor(p: Product): { label: string; options: string[] } {
  if (modelKinds.includes(p.kind)) {
    const list = phoneModels[p.brand] ?? Object.values(phoneModels).flat();
    return { label: "مدل گوشی خود را انتخاب کنید", options: list };
  }
  if (p.kind === "airpods") return { label: "مدل ایرپاد خود را انتخاب کنید", options: ["AirPods Pro 2", "AirPods Pro", "AirPods 3", "AirPods 2"] };
  if (p.kind === "watch") return { label: "سایز اپل واچ را انتخاب کنید", options: ["۴۱mm", "۴۵mm", "۴۹mm (Ultra)"] };
  return { label: "رنگ خود را انتخاب کنید", options: ["مشکی", "سفید", "آبی", "نقره‌ای"] };
}

export const productFaq = [
  { q: "آیا محصول اورجینال و دارای ضمانت است؟", a: "بله، همه محصولات کیس‌لاین اورجینال هستند و تا ۷ روز امکان بازگشت دارند." },
  { q: "چطور مطمئن شوم با گوشی من سازگار است؟", a: "قبل از خرید مدل گوشی را انتخاب کنید؛ فقط مدل‌های سازگار نمایش داده می‌شوند." },
  { q: "ارسال سفارش چقدر طول می‌کشد؟", a: "در تهران همان روز و در سایر شهرها بین ۲ تا ۴ روز کاری." },
];
export const productReviews = [
  { name: "محمد ج.", text: "کیفیت عالی بود و دقیقاً با گوشیم جفت شد. ارسال هم سریع بود.", rate: 5 },
  { name: "سارا ر.", text: "رنگش از عکس هم قشنگ‌تره. پیشنهاد می‌کنم.", rate: 5 },
  { name: "علی م.", text: "خوب بود، فقط بسته‌بندی می‌تونست بهتر باشه.", rate: 4 },
];

export interface BlogPost { slug: string; title: string; cat: string; date: string; excerpt: string; cover: string; kind: Kind; hue: number }
export const blogCats = ["راهنمای خرید", "آموزش شارژ و کابل", "مقایسه محصولات", "اخبار موبایل"];
const mkPost = (i: number, title: string, cat: string, date: string, cover: string, kind: Kind, hue: number, excerpt: string): BlogPost => ({ slug: `post-${i}`, title, cat, date, excerpt, cover, kind, hue });
export const blogPosts2: BlogPost[] = [
  mkPost(1, "چطور قاب مناسب گوشی‌مان را انتخاب کنیم؟ راهنمای کامل ۱۴۰۵", blogCats[0], "۱ مهر ۱۴۰۵", "راهنمای انتخاب قاب", "case", 14, "قاب خوب فقط ظاهر گوشی را عوض نمی‌کند؛ از افتادن، خط و خش و لرزش هم محافظت می‌کند. در این مطلب نکات مهم خرید را مرور می‌کنیم."),
  mkPost(2, "گلس ساده یا آنتی‌استاتیک؛ کدام برای گوشی شما بهتر است؟", blogCats[2], "۲ مهر ۱۴۰۵", "گلس ساده یا آنتی‌استاتیک؟", "glass", 190, "تفاوت لایه‌ها، شفافیت و مقاومت در برابر ضربه را کنار هم بررسی کردیم تا انتخاب برایتان ساده‌تر شود."),
  mkPost(3, "شارژ سریع چطور کار می‌کند و چه کابلی لازم است؟", blogCats[1], "۵ مهر ۱۴۰۵", "شارژ سریع چیست؟", "charger", 40, "استانداردهای PD و QC، توان شارژر و کیفیت کابل چه تفاوتی در سرعت شارژ ایجاد می‌کنند؟"),
  mkPost(4, "بهترین پاوربانک‌های سفر در سال ۱۴۰۵؛ مقایسه ظرفیت و توان", blogCats[2], "۸ مهر ۱۴۰۵", "بهترین پاوربانک سفر", "powerbank", 220, "ظرفیت واقعی، خروجی سریع و وزن؛ سه معیاری که هنگام خرید پاوربانک باید بررسی کنید."),
  mkPost(5, "آیفون ۱۵ پرو مکس چه قابی می‌خواهد؟ ۵ گزینه پرفروش", blogCats[3], "۱۰ مهر ۱۴۰۵", "قاب iPhone 15 Pro Max", "case", 24, "از قاب‌های MagSafe تا کاورهای ضدضربه؛ پرفروش‌ترین گزینه‌های مخصوص آیفون ۱۵ پرو مکس."),
  mkPost(6, "هندزفری بی‌سیم یا سیمی؟ مقایسه کیفیت صدا و قیمت", blogCats[2], "۱۲ مهر ۱۴۰۵", "هندزفری بی‌سیم یا سیمی؟", "earbuds", 280, "کیفیت صدا، تأخیر و ماندگاری باتری را برای استفاده روزمره و ورزش مقایسه کردیم."),
  mkPost(7, "چطور کابل اورجینال را از تقلبی تشخیص بدهیم؟", blogCats[0], "۱۷ مهر ۱۴۰۵", "کابل اورجینال یا تقلبی؟", "cable", 160, "چند نشانه ساده که به کمک آن‌ها می‌توانید پیش از خرید، کیفیت کابل و آداپتور را بسنجید."),
  mkPost(8, "هولدر خودرو؛ چه مدلی برای گوشی شما مناسب است؟", blogCats[0], "۲۰ مهر ۱۴۰۵", "راهنمای خرید هولدر", "holder", 340, "هولدر مگنتی، دریچه‌ای یا داشبوردی؟ نقاط قوت و ضعف هر مدل را بررسی می‌کنیم."),
  mkPost(9, "محافظ لنز دوربین واقعاً لازم است؟", blogCats[0], "۲۴ مهر ۱۴۰۵", "محافظ لنز دوربین", "lens", 260, "لنز دوربین گران‌ترین بخش گوشی است. چه زمانی محافظ لنز ارزش خرید دارد؟"),
  mkPost(10, "بهترین قاب‌های سامسونگ S24 اولترا در بازار", blogCats[3], "۲۶ مهر ۱۴۰۵", "قاب Galaxy S24 Ultra", "case", 200, "قاب‌های سه‌لایه، شفاف و چرمی مخصوص S24 اولترا را با هم مقایسه کرده‌ایم."),
  mkPost(11, "شارژر وایرلس ۱۵ وات؛ همه چیز درباره شارژ بی‌سیم", blogCats[1], "۲۸ مهر ۱۴۰۵", "شارژ وایرلس", "charger", 30, "شارژ بی‌سیم چقدر سرعت دارد و آیا به باتری آسیب می‌زند؟"),
  mkPost(12, "فلش OTG چیست و چطور به گوشی وصل می‌شود؟", blogCats[1], "۳۰ مهر ۱۴۰۵", "فلش OTG چیست؟", "flash", 100, "برای انتقال سریع فایل بین گوشی و کامپیوتر، فلش دو کانکتور بهترین انتخاب است."),
  mkPost(13, "کدام برند لوازم جانبی گوشی قابل اعتمادتر است؟", blogCats[2], "۲ آبان ۱۴۰۵", "برندهای معتبر لوازم جانبی", "charger", 210, "Anker، Baseus و Xiaomi را از نظر کیفیت ساخت، گارانتی و قیمت مقایسه کردیم."),
  mkPost(14, "قاب شیائومی Redmi Note 13 Pro؛ راهنمای خرید", blogCats[3], "۴ آبان ۱۴۰۵", "قاب Redmi Note 13 Pro", "case", 30, "بهترین قاب‌های موجود برای ردمی نوت ۱۳ پرو از نظر محافظت و قیمت."),
  mkPost(15, "چند نکته برای عمر بیشتر باتری گوشی", blogCats[3], "۷ آبان ۱۴۰۵", "عمر بیشتر باتری", "powerbank", 150, "عادت‌های ساده‌ای که به سلامت باتری گوشی در طولانی‌مدت کمک می‌کنند."),
];

/* ---------- Shop catalog ---------- */
const extraSpecs: [string, string, Kind, string, number, number][] = [
  ["گلس مات ضدلک", "Baseus", "glass", "iPhone 15", 210, 160_000],
  ["گلس پرایوسی ضدجاسوسی", "Samsung", "glass", "Galaxy S24", 190, 260_000],
  ["گلس سرامیکی ۹H+", "Xiaomi", "glass", "Redmi Note 13 Pro", 170, 190_000],
  ["کابل Type-C به Type-C ۶۰ وات", "Anker", "cable", "", 160, 320_000],
  ["کابل مگنتی سه‌سر", "Baseus", "cable", "", 140, 380_000],
  ["شارژر دیواری ۲۰ وات", "Apple", "charger", "", 45, 780_000],
  ["شارژر فندکی ۳۰ وات", "Xiaomi", "charger", "", 35, 350_000],
  ["ایرباد بلوتوثی Sport", "JBL", "earbuds", "", 300, 1_890_000],
  ["هندزفری سیمی Type-C", "Samsung", "earbuds", "", 270, 420_000],
  ["پاوربانک ۱۰۰۰۰ مگ‌سیف", "Anker", "powerbank", "", 230, 1_650_000],
  ["پاوربانک ۳۰۰۰۰ لپ‌تاپی", "Baseus", "powerbank", "", 215, 2_450_000],
  ["هولدر دریچه‌ای", "Baseus", "holder", "", 350, 240_000],
  ["رینگ نگهدارنده مگنتی", "Xiaomi", "holder", "", 330, 180_000],
  ["محافظ لنز شفاف", "Samsung", "lens", "Galaxy S24 Ultra", 250, 170_000],
  ["فلش ۶۴GB USB-C", "Samsung", "flash", "", 105, 590_000],
];
const extras: Product[] = extraSpecs.map(([name, brand, kind, compat, hue, price], i) => ({
  id: `x${i}`, name, brand, kind, hue, price, oldPrice: i % 3 === 0 ? Math.round(price * 1.2 / 1000) * 1000 : undefined,
  rating: 4.2 + (i % 5) / 10, reviews: 20 + i * 23, badge: i % 5 === 1 ? "جدید" : undefined, compat: compat || undefined,
}));
export const catalog: Product[] = [...allProducts, ...extras];

export interface ShopSub { slug: string; label: string }
export interface ShopCat { slug: string; label: string; icon: string; subs: ShopSub[]; test: (p: Product) => boolean }
const kindCat = (p: Product) => p.cat ?? (p.kind === "case" ? "cases" : p.kind === "airpods" ? "airpods" : p.kind === "watch" ? "watch" : ["charger", "cable", "powerbank"].includes(p.kind) ? "electric" : "accessories");
export const shopCats: ShopCat[] = [
  { slug: "cases", label: "قاب و کاور موبایل", icon: "phone", subs: [{ slug: "iphone", label: "قاب آیفون" }, { slug: "samsung", label: "قاب سامسونگ" }, { slug: "xiaomi", label: "قاب شیائومی" }], test: (p) => kindCat(p) === "cases" },
  { slug: "airpods", label: "لوازم جانبی ایرپاد", icon: "headphones", subs: [{ slug: "ap12", label: "ایرپاد ۱ و ۲" }, { slug: "ap3", label: "ایرپاد ۳" }, { slug: "appro12", label: "ایرپاد پرو ۱ و ۲" }, { slug: "ap4", label: "ایرپاد ۴" }, { slug: "appro3", label: "ایرپاد پرو ۳" }], test: (p) => kindCat(p) === "airpods" },
  { slug: "watch", label: "لوازم جانبی اپل واچ", icon: "watch", subs: [{ slug: "band", label: "بند واچ" }, { slug: "wglass", label: "گلس واچ" }, { slug: "wguard", label: "گارد واچ" }], test: (p) => kindCat(p) === "watch" },
  { slug: "electric", label: "لوازم برقی", icon: "zap", subs: [], test: (p) => kindCat(p) === "electric" },
  { slug: "accessories", label: "اکسسوری و لوازم جانبی", icon: "sparkles", subs: [{ slug: "glass", label: "گلس" }, { slug: "cableguard", label: "محافظ کابل" }, { slug: "charm", label: "بند و آویز" }, { slug: "holder", label: "هولدر" }, { slug: "popsocket", label: "پاپ‌سوکت" }], test: (p) => kindCat(p) === "accessories" },
];
export const shopCatOf = (p: Product) => kindCat(p);
export const shopSubOf = (p: Product) => {
  if (p.sub) return p.sub;
  if (p.kind === "case") return p.brand === "Apple" ? "iphone" : p.brand === "Samsung" ? "samsung" : p.brand === "Xiaomi" ? "xiaomi" : "";
  if (p.kind === "glass" || p.kind === "lens") return p.cat === undefined ? "glass" : "";
  if (p.kind === "holder") return "holder";
  return "";
};
export const shopModels = Object.values(phoneModels).flat();
