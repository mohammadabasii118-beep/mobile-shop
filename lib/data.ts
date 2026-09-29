export type Kind = "case" | "glass" | "charger" | "cable" | "earbuds" | "powerbank" | "holder" | "flash" | "lens";

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
  powerbank: "پاوربانک", holder: "هولدر", flash: "فلش", lens: "محافظ لنز",
};
export const categoryCounts: Record<Kind, number> = { case: 48, glass: 32, charger: 17, cable: 21, earbuds: 14, powerbank: 12, holder: 9, flash: 7, lens: 11 };
export const heroWords = ["قاب", "گلس", "شارژر", "هندزفری", "پاوربانک"];
export const quickChips = ["قاب آیفون", "گلس", "شارژر", "کابل", "ایرپاد", "پاوربانک"];

const caseNames = ["قاب سیلیکونی MagSafe", "قاب شفاف ضدضربه", "قاب چرمی لوکس", "قاب رینگ‌دار ضدضربه", "قاب Armor سه‌لایه"];
const mk = (prefix: string, brand: string, models: string[], hue: number, base: number): Product[] =>
  caseNames.map((n, i) => ({
    id: `${prefix}${i}`, name: n, brand, kind: "case", hue: (hue + i * 28) % 360,
    price: base + i * 45_000, oldPrice: i % 2 === 0 ? Math.round((base + i * 45_000) * 1.25 / 1000) * 1000 : undefined,
    rating: 4.3 + (i % 4) / 10, reviews: 60 + i * 37, compat: models[i % models.length],
  }));

export const rails = [
  { slug: "iphone", title: "قاب آیفون", items: mk("ip", "Apple", ["iPhone 15 Pro Max", "iPhone 15", "iPhone 14 Pro", "iPhone 13", "iPhone 12"], 14, 290_000) },
  { slug: "samsung", title: "قاب سامسونگ", items: mk("sm", "Samsung", ["Galaxy S24 Ultra", "Galaxy S24", "Galaxy A55", "Galaxy A35", "Galaxy S23"], 200, 240_000) },
  { slug: "xiaomi", title: "قاب شیائومی", items: mk("xi", "Xiaomi", ["Redmi Note 13 Pro", "Poco X6", "Xiaomi 14", "Redmi 13C", "Poco F5"], 30, 180_000) },
  { slug: "other", title: "سایر لوازم جانبی", items: [products[1], products[2], products[4], products[5], products[6]] },
];

export const homeCategories = [
  { slug: "iphone", label: "قاب آیفون", count: 48, logos: ["", "15", "14"] },
  { slug: "samsung", label: "قاب سامسونگ", count: 36, logos: ["S", "A", "Z"] },
  { slug: "xiaomi", label: "قاب شیائومی", count: 29, logos: ["Mi", "R", "P"] },
  { slug: "other", label: "سایر لوازم جانبی", count: 84, logos: ["⚡", "🎧", "🔋"] },
];

export const allProducts: Product[] = Array.from(
  new Map([...products, ...rails.flatMap((r) => r.items)].map((p) => [p.id, p])).values(),
);
export const getProduct = (id: string) => allProducts.find((p) => p.id === id);

const modelKinds: Kind[] = ["case", "glass", "lens"];
export function optionsFor(p: Product): { label: string; options: string[] } {
  if (modelKinds.includes(p.kind)) {
    const list = phoneModels[p.brand] ?? Object.values(phoneModels).flat();
    return { label: "مدل گوشی خود را انتخاب کنید", options: list };
  }
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
