import type { ArtKind, CategorySlug, Product, ProductColor } from '@/types';

const C = {
  black: { name: 'مشکی', hex: '#1a1a1d' },
  clear: { name: 'شفاف', hex: '#cfd8df' },
  violet: { name: 'بنفش', hex: '#8B5CF6' },
  blue: { name: 'آبی', hex: '#38BDF8' },
  pink: { name: 'سرخابی', hex: '#EC4899' },
  orange: { name: 'نارنجی', hex: '#FB923C' },
  green: { name: 'سبز', hex: '#22C55E' },
  white: { name: 'سفید', hex: '#f1f5f9' },
  brown: { name: 'قهوه‌ای', hex: '#8a5a3c' },
} satisfies Record<string, ProductColor>;

const IP16 = ['آیفون 16 پرو مکس', 'آیفون 16 پرو', 'آیفون 16'];
const IP15 = ['آیفون 15 پرو مکس', 'آیفون 15 پرو', 'آیفون 15'];
const SAM = ['سامسونگ S25 Ultra', 'سامسونگ S25 Plus', 'سامسونگ S25'];

type Seed = {
  n: string; cat: CategorySlug; brand: string; art: ArtKind; price: number; old?: number; r: number; rc: number;
  stock: number; models: string[]; colors: ProductColor[]; tags: string[]; flags?: ('f' | 'b' | 'n')[]; d: string;
};

const seeds: Seed[] = [
  { n: 'قاب شفاف مگ‌سیف آیفون 16 پرو مکس', cat: 'cases', brand: 'CaseLine', art: 'case', price: 690_000, old: 890_000, r: 4.8, rc: 214, stock: 42, models: IP16, colors: [C.clear, C.black, C.violet, C.pink], tags: ['مگ‌سیف', 'شفاف', 'آیفون'], flags: ['f', 'b'], d: 'قاب شفاف با حلقه مگ‌سیف قدرتمند، بدون زرد شدن و با لبه‌های برجسته برای محافظت از دوربین و صفحه.' },
  { n: 'قاب ضدضربه آیفون 16 پرو', cat: 'cases', brand: 'CaseLine', art: 'case', price: 590_000, r: 4.7, rc: 168, stock: 30, models: IP16, colors: [C.black, C.blue, C.violet], tags: ['ضدضربه', 'آیفون'], flags: ['f'], d: 'ساخته‌شده از TPU و پلی‌کربنات با گوشه‌های ایربگ‌دار؛ تست‌شده تا سقوط ۳ متری.' },
  { n: 'قاب چرمی آیفون 16', cat: 'cases', brand: 'Nomad', art: 'case', price: 1_250_000, old: 1_450_000, r: 4.9, rc: 97, stock: 12, models: ['آیفون 16 پرو', 'آیفون 16'], colors: [C.brown, C.black], tags: ['چرم', 'لوکس', 'آیفون'], flags: ['f', 'n'], d: 'چرم طبیعی با دوخت دست و حلقه مگ‌سیف؛ با گذر زمان زیباتر می‌شود.' },
  { n: 'قاب کربنی آیفون 15 پرو مکس', cat: 'cases', brand: 'CaseLine', art: 'case', price: 790_000, r: 4.6, rc: 133, stock: 25, models: IP15, colors: [C.black, C.orange], tags: ['کربن', 'اسپرت'], flags: ['b'], d: 'طرح فیبر کربن واقعی با وزن فوق سبک و حس لمس مات.' },
  { n: 'قاب Armor سامسونگ S25 Ultra', cat: 'cases', brand: 'UAG', art: 'case', price: 980_000, old: 1_200_000, r: 4.8, rc: 76, stock: 18, models: SAM, colors: [C.black, C.green], tags: ['Armor', 'ضدضربه', 'سامسونگ'], flags: ['f', 'b'], d: 'استاندارد نظامی، پشت ضدخش و محافظ کامل S-Pen.' },
  { n: 'قاب شفاف سامسونگ S25', cat: 'cases', brand: 'CaseLine', art: 'case', price: 420_000, r: 4.4, rc: 88, stock: 60, models: ['سامسونگ S25'], colors: [C.clear], tags: ['شفاف', 'سامسونگ'], flags: ['n'], d: 'نازک، شفاف و سبک؛ فقط به اندازه‌ی لازم محافظت می‌کند.' },
  { n: 'گلس آنتی‌استاتیک آیفون', cat: 'screen-protectors', brand: 'Baseus', art: 'glass', price: 190_000, old: 250_000, r: 4.5, rc: 301, stock: 120, models: [...IP16, ...IP15], colors: [C.clear], tags: ['گلس', 'آنتی‌استاتیک'], flags: ['b'], d: 'سخت‌تر از ۹H با پوشش ضدلک انگشت و نصب بدون حباب.' },
  { n: 'گلس فول‌چسب سامسونگ', cat: 'screen-protectors', brand: 'Mocoll', art: 'glass', price: 240_000, r: 4.3, rc: 112, stock: 80, models: SAM, colors: [C.clear, C.black], tags: ['گلس', 'فول‌چسب', 'سامسونگ'], d: 'فول‌چسب با پشتیبانی کامل از اثر انگشت زیر نمایشگر.' },
  { n: 'شارژر سریع 20 وات', cat: 'chargers', brand: 'Anker', art: 'charger', price: 390_000, r: 4.6, rc: 254, stock: 90, models: ['Type-C'], colors: [C.white, C.black], tags: ['شارژر', '20W', 'PD'], flags: ['b'], d: 'شارژ سریع PD با حفاظت دمایی هوشمند؛ ۵۰٪ شارژ در ۳۰ دقیقه.' },
  { n: 'شارژر سریع 33 وات', cat: 'chargers', brand: 'Xiaomi', art: 'charger', price: 520_000, old: 640_000, r: 4.5, rc: 142, stock: 55, models: ['Type-C'], colors: [C.white], tags: ['شارژر', '33W'], flags: ['f'], d: 'مناسب گوشی‌های اندرویدی و تبلت، با پورت Type-C پرقدرت.' },
  { n: 'کابل Type-C', cat: 'cables', brand: 'Baseus', art: 'cable', price: 150_000, r: 4.4, rc: 187, stock: 200, models: ['Type-C'], colors: [C.black, C.white, C.blue], tags: ['کابل', 'Type-C'], d: 'روکش بافته‌شده نایلونی و مقاوم در برابر خم شدن.' },
  { n: 'کابل Lightning', cat: 'cables', brand: 'Anker', art: 'cable', price: 210_000, r: 4.5, rc: 119, stock: 70, models: ['Lightning'], colors: [C.white, C.black], tags: ['کابل', 'Lightning'], d: 'کابل لایتنینگ ۱ متری با تایید MFi.' },
  { n: 'کابل Type-C به Type-C', cat: 'cables', brand: 'CaseLine', art: 'cable', price: 230_000, old: 290_000, r: 4.7, rc: 164, stock: 110, models: ['Type-C'], colors: [C.black, C.violet, C.pink], tags: ['کابل', 'Type-C', '60W'], flags: ['n', 'b'], d: 'پشتیبانی از شارژ ۶۰ وات و انتقال داده ۴۸۰ مگابیت.' },
  { n: 'پاوربانک 10000', cat: 'power-banks', brand: 'Xiaomi', art: 'powerbank', price: 780_000, r: 4.5, rc: 205, stock: 38, models: ['Type-C', 'Lightning'], colors: [C.black, C.white], tags: ['پاوربانک', '10000mAh'], flags: ['f'], d: 'کوچک و جیبی با شارژ سریع ۲۲.۵ وات و نمایشگر درصد.' },
  { n: 'پاوربانک 20000', cat: 'power-banks', brand: 'Anker', art: 'powerbank', price: 1_350_000, old: 1_600_000, r: 4.8, rc: 91, stock: 6, models: ['Type-C'], colors: [C.black, C.blue], tags: ['پاوربانک', '20000mAh', 'PD'], flags: ['f', 'b'], d: 'ظرفیت بالا با خروجی ۴۵ وات؛ لپ‌تاپ را هم شارژ می‌کند.' },
  { n: 'هولدر موبایل خودرو', cat: 'accessories', brand: 'Baseus', art: 'holder', price: 320_000, r: 4.2, rc: 74, stock: 48, models: ['همه مدل‌ها'], colors: [C.black], tags: ['هولدر', 'خودرو'], d: 'نگهدارنده مغناطیسی با پایه‌ی چرخشی ۳۶۰ درجه.' },
  { n: 'پایه رومیزی موبایل', cat: 'accessories', brand: 'CaseLine', art: 'holder', price: 260_000, r: 4.4, rc: 63, stock: 52, models: ['همه مدل‌ها'], colors: [C.black, C.white, C.violet], tags: ['پایه', 'رومیزی'], flags: ['n'], d: 'پایه‌ی آلومینیومی با زاویه قابل تنظیم و کف ضدلغزش.' },
  { n: 'مبدل Type-C', cat: 'accessories', brand: 'Ugreen', art: 'adapter', price: 140_000, r: 4.1, rc: 58, stock: 95, models: ['Type-C'], colors: [C.white, C.black], tags: ['مبدل', 'OTG'], d: 'تبدیل Type-C به USB-A با پشتیبانی OTG.' },
  { n: 'محافظ لنز دوربین', cat: 'screen-protectors', brand: 'CaseLine', art: 'lens', price: 170_000, r: 4.6, rc: 148, stock: 140, models: [...IP16, ...SAM], colors: [C.clear, C.violet, C.blue], tags: ['لنز', 'دوربین'], flags: ['n'], d: 'شیشه‌ی سخت با حلقه‌ی رنگی؛ بدون تاثیر روی کیفیت عکس.' },
  { n: 'کیف لوازم جانبی', cat: 'accessories', brand: 'CaseLine', art: 'bag', price: 360_000, old: 450_000, r: 4.7, rc: 41, stock: 0, models: ['همه مدل‌ها'], colors: [C.black, C.orange], tags: ['کیف', 'ارگانایزر'], d: 'ارگانایزر ضدآب برای کابل، شارژر و پاوربانک.' },
];

export const products: Product[] = seeds.map((s, i) => ({
  id: `p${i + 1}`,
  slug: `caseline-${i + 1}`,
  name: s.n,
  category: s.cat,
  brand: s.brand,
  sku: `CL-${s.cat.slice(0, 2).toUpperCase()}-${String(1000 + i * 7)}`,
  description: s.d,
  price: s.price,
  oldPrice: s.old,
  rating: s.r,
  reviewCount: s.rc,
  stock: s.stock,
  reserved: Math.min(s.stock, Math.floor(s.stock / 8)),
  minStock: 10,
  models: s.models,
  colors: s.colors,
  tags: s.tags,
  art: s.art,
  isFeatured: s.flags?.includes('f'),
  isBestseller: s.flags?.includes('b'),
  isNew: s.flags?.includes('n'),
}));

export const brands = Array.from(new Set(products.map((p) => p.brand)));
export const allModels = Array.from(new Set(products.flatMap((p) => p.models)));
export const allColors = Array.from(new Map(products.flatMap((p) => p.colors).map((c) => [c.name, c])).values());
export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
