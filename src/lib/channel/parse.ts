/**
 * خواندن پست کانال: عنوان، قیمت، موجودی، برند/مدل گوشی، رنگ‌ها و دسته‌ی محصول.
 * منطق خالص (بدون دیتابیس و شبکه)؛ بدون هوش مصنوعی، فقط الگوهای شفاف تا نتیجه قابل پیش‌بینی و قابل تست باشد.
 */
import { normDigits } from '../format';

export type PhoneBrand = 'apple' | 'samsung' | 'xiaomi';
export type ParsedModel = { brand: PhoneBrand; name: string };
export type ParsedColor = { slug: string; name: string; hex: string };
export type CategoryHint = 'case' | 'glass' | 'cable' | 'charger' | 'powerbank' | 'audio' | 'holder' | 'storage';

export type ParsedPost = {
  title: string;
  description: string;
  price: number | null;
  stock: number | null;
  models: ParsedModel[];
  brands: PhoneBrand[];
  colors: ParsedColor[];
  category: CategoryHint | null;
};

export const BRAND_NAME: Record<PhoneBrand, string> = { apple: 'Apple', samsung: 'Samsung', xiaomi: 'Xiaomi' };

/** ی/ک عربی، نیم‌فاصله، ارقام فارسی و فاصله‌های اضافه */
export function clean(s: string): string {
  return normDigits(s)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‏‎]/g, ' ')
    .replace(/[ \t]+/g, ' ');
}

/* ───────── قیمت ───────── */
const PRICE_RE = /(?:قیمت|price)[^\d\n]{0,10}([\d,٬،.]+)\s*(هزار|میلیون)?/i;
/** اولین «قیمت: …» به تومان. «598 هزار» ← ۵۹۸٬۰۰۰ ؛ عدد کوچک بدون واحد (زیر ۱۰٬۰۰۰) هزارتومان فرض می‌شود. */
export function parsePrice(text: string): number | null {
  const m = PRICE_RE.exec(clean(text));
  if (!m) return null;
  const raw = m[1].replace(/[,٬،]/g, '');
  let n = Number(raw);
  if (!Number.isFinite(n)) n = Number(raw.replace(/\./g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (m[2] === 'میلیون') n *= 1_000_000;
  else if (m[2] === 'هزار') n *= 1_000;
  else if (n < 10_000) n *= 1_000;
  return Math.round(n);
}

export function parseStock(text: string): number | null {
  const m = /(?:موجودی|تعداد)[^\d\n]{0,6}(\d{1,5})/.exec(clean(text));
  return m ? Number(m[1]) : null;
}

/* ───────── رنگ‌ها (slug همان slug رنگ‌های پایه‌ی فروشگاه است) ───────── */
const COLORS: { slug: string; name: string; hex: string; words: string[] }[] = [
  { slug: 'navy', name: 'سرمه‌ای', hex: '#1f2a5a', words: ['آبی سرمه ای', 'سرمه ای', 'navy', 'midnight'] },
  { slug: 'light-blue', name: 'آبی روشن', hex: '#8ec5ff', words: ['آبی روشن', 'آبی آسمانی', 'light blue', 'sky blue'] },
  { slug: 'blue', name: 'آبی', hex: '#2f6bff', words: ['آبی', 'blue'] },
  { slug: 'black', name: 'مشکی', hex: '#17181c', words: ['مشکی', 'سیاه', 'black'] },
  { slug: 'white', name: 'سفید', hex: '#f3f4f6', words: ['سفید', 'white'] },
  { slug: 'pink', name: 'صورتی', hex: '#f2a7c3', words: ['صورتی', 'pink'] },
  { slug: 'hot-pink', name: 'سرخابی', hex: '#d6336c', words: ['سرخابی'] },
  { slug: 'green', name: 'سبز', hex: '#3f8f6b', words: ['سبز', 'green'] },
  { slug: 'mint', name: 'یشمی', hex: '#2e8b6e', words: ['یشمی'] },
  { slug: 'sand', name: 'شنی', hex: '#d8c3a5', words: ['شنی', 'بژ', 'sand', 'beige'] },
  { slug: 'clear', name: 'شفاف', hex: '#dbe4ee', words: ['شفاف', 'clear', 'transparent'] },
  { slug: 'red', name: 'قرمز', hex: '#d62839', words: ['قرمز', 'red'] },
  { slug: 'burgundy', name: 'زرشکی', hex: '#8b1e3f', words: ['زرشکی', 'burgundy'] },
  { slug: 'yellow', name: 'زرد', hex: '#f4c20d', words: ['زرد', 'yellow'] },
  { slug: 'orange', name: 'نارنجی', hex: '#f77f00', words: ['نارنجی', 'orange'] },
  { slug: 'purple', name: 'بنفش', hex: '#7a4cc9', words: ['بنفش', 'purple', 'violet'] },
  { slug: 'gray', name: 'خاکستری', hex: '#6b7078', words: ['خاکستری', 'طوسی', 'gray', 'grey'] },
  { slug: 'silver', name: 'نقره‌ای', hex: '#c9ccd1', words: ['نقره ای', 'silver'] },
  { slug: 'gold', name: 'طلایی', hex: '#d4af37', words: ['طلایی', 'gold'] },
  { slug: 'brown', name: 'قهوه‌ای', hex: '#7b4a2b', words: ['قهوه ای', 'brown'] },
  { slug: 'cream', name: 'کرم', hex: '#e8dcc0', words: ['کرم', 'cream'] },
  { slug: 'teal', name: 'فیروزه‌ای', hex: '#20b2aa', words: ['فیروزه ای', 'teal'] },
];
const COLOR_WORDS = COLORS.flatMap((c) => c.words.map((w) => ({ w, c }))).sort((a, b) => b.w.length - a.w.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** رنگ‌ها را از خط‌هایی که کلمه‌ی «رنگ» دارند می‌خواند؛ اگر چنین خطی نبود، کل متن را می‌گردد. */
export function parseColors(text: string): ParsedColor[] {
  const lines = clean(text).split('\n');
  const tagged = lines.filter((l) => /رنگ|colou?r/i.test(l));
  const scope = (tagged.length ? tagged : lines).join('\n').toLowerCase();
  const found: { at: number; c: (typeof COLORS)[number] }[] = [];
  let rest = scope;
  for (const { w, c } of COLOR_WORDS) {
    const re = new RegExp(`(?<![\\p{L}])${esc(w)}(?![\\p{L}])`, 'gu');
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      found.push({ at: m.index, c });
      // کلمه‌ی استفاده‌شده را خنثی می‌کنیم تا «آبی» داخل «آبی سرمه‌ای» دوباره شمرده نشود
      rest = rest.slice(0, m.index) + ' '.repeat(w.length) + rest.slice(m.index + w.length);
    }
  }
  const seen = new Set<string>();
  return found
    .sort((a, b) => a.at - b.at)
    .filter((f) => (seen.has(f.c.slug) ? false : (seen.add(f.c.slug), true)))
    .map((f) => ({ slug: f.c.slug, name: f.c.name, hex: f.c.hex }));
}

/* ───────── مدل گوشی ───────── */
const SUFFIX: Record<string, string> = {
  'pro max': ' Pro Max', promax: ' Pro Max', 'پرو مکس': ' Pro Max', pro: ' Pro', 'پرو': ' Pro', plus: ' Plus', '+': ' Plus', 'پلاس': ' Plus',
  mini: ' Mini', 'مینی': ' Mini', ultra: ' Ultra', 'اولترا': ' Ultra', fe: ' FE', 't': 'T',
};
const sfx = (s: string | undefined) => (s ? SUFFIX[s.toLowerCase().replace(/\s+/g, ' ').trim()] ?? '' : '');
const SPLIT = /\s*(?:[\/|،,؛;]|\sو\s|\s[-–]\s|\sیا\s)\s*/;

type Family = {
  brand: PhoneBrand;
  prefix: RegExp;
  chunk: (c: string) => string | null;
};

const FAMILIES: Family[] = [
  {
    brand: 'apple',
    prefix: /(?<![\p{L}])(?:iphone|ایفون|آیفون)\s*/giu,
    chunk: (c) => {
      const m = /^(\d{1,2})\s*(pro\s*max|promax|پرو\s*مکس|pro|پرو|plus|پلاس|mini|مینی)?(?![\p{L}])/iu.exec(c);
      return m ? `iPhone ${m[1]}${sfx(m[2])}` : null;
    },
  },
  {
    brand: 'samsung',
    prefix: /(?<![\p{L}])(?:galaxy|گلکسی|samsung|سامسونگ)\s*/giu,
    chunk: (c) => {
      const m = /^(s|a|m)\s*-?(\d{1,2})\s*(ultra|اولترا|plus|پلاس|\+|fe)?(?![\p{L}\d])/iu.exec(c);
      if (m) return `Galaxy ${m[1].toUpperCase()}${m[2]}${sfx(m[3])}`;
      const z = /^z\s*(flip|fold)\s*(\d)/i.exec(c);
      return z ? `Galaxy Z ${z[1][0].toUpperCase()}${z[1].slice(1).toLowerCase()}${z[2]}` : null;
    },
  },
  {
    brand: 'xiaomi',
    prefix: /(?<![\p{L}])(?:redmi|ردمی|poco|پوکو|xiaomi|شیائومی)\s*/giu,
    chunk: (c) => {
      const poco = /^(x|f|m|c)\s*(\d{1,2})\s*(pro|gt)?(?![\p{L}\d])/iu.exec(c);
      if (poco) return `POCO ${poco[1].toUpperCase()}${poco[2]}${poco[3] ? ' ' + poco[3][0].toUpperCase() + poco[3].slice(1).toLowerCase() : ''}`;
      const note = /^(?:note|نوت)\s*(\d{1,2})\s*(pro\s*\+|pro\s*plus|pro|پرو|ultra|اولترا)?(?![\p{L}\d])/iu.exec(c);
      if (note) return `Redmi Note ${note[1]}${/\+|plus/i.test(note[2] ?? '') ? ' Pro+' : sfx(note[2])}`;
      const num = /^(\d{1,2}[a-z]?)\s*(t|pro|پرو|ultra|اولترا)?(?![\p{L}\d])/iu.exec(c);
      return num ? `Xiaomi ${num[1].toUpperCase()}${sfx(num[2])}` : null;
    },
  },
];

/** بدون پیشوند: S24 Ultra / A55 / M34 (حداقل دو رقم تا با چیزهای دیگر اشتباه نشود) */
const SAMSUNG_BARE = /(?<![\p{L}\d])([sam])\s?(\d{2})\s*(ultra|اولترا|plus|پلاس|\+|fe)?(?![\p{L}\d])/giu;

export function parseModels(text: string): { models: ParsedModel[]; brands: PhoneBrand[] } {
  const models: ParsedModel[] = [];
  const add = (brand: PhoneBrand, name: string) => {
    if (!models.some((m) => m.name === name)) models.push({ brand, name });
  };
  const lines = clean(text).split('\n');
  const rel = lines.filter((l) => /مدل|مناسب|سازگار|برای|گوشی|for|fits?|compatible/i.test(l));
  const scopes = rel.length ? [rel, lines] : [lines];
  for (const scope of scopes) {
    for (const line of scope) {
      for (const f of FAMILIES) {
        const idxs: number[] = [];
        const ends: number[] = [];
        f.prefix.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = f.prefix.exec(line))) {
          idxs.push(m.index + m[0].length);
          ends.push(m.index);
        }
        idxs.forEach((start, i) => {
          const tail = line.slice(start, ends[i + 1] ?? line.length);
          for (const chunk of tail.split(SPLIT)) {
            const name = f.chunk(chunk.trim());
            if (!name) break;
            add(f.brand, name);
          }
        });
      }
      let b: RegExpExecArray | null;
      SAMSUNG_BARE.lastIndex = 0;
      while ((b = SAMSUNG_BARE.exec(line))) add('samsung', `Galaxy ${b[1].toUpperCase()}${b[2]}${sfx(b[3])}`);
    }
    if (models.length) break;
  }
  const brands = new Set<PhoneBrand>(models.map((m) => m.brand));
  if (!models.length) {
    const t = clean(text).toLowerCase();
    if (/اپل|apple/.test(t)) brands.add('apple');
    if (/سامسونگ|samsung/.test(t)) brands.add('samsung');
    if (/شیائومی|xiaomi/.test(t)) brands.add('xiaomi');
  }
  return { models, brands: [...brands] };
}

/* ───────── دسته ───────── */
const CATS: [CategoryHint, RegExp][] = [
  ['glass', /گلس|محافظ\s*صفحه|screen\s*protector|tempered/i],
  ['case', /قاب|کاور|case|cover/i],
  ['powerbank', /پاور\s*بانک|power\s*bank/i],
  ['cable', /کابل|مبدل|cable/i],
  ['charger', /شارژر|آداپتور|charger|adapter/i],
  ['audio', /هندزفری|هدفون|ایرپاد|airpod|earbud|headphone|هدست/i],
  ['holder', /هولدر|پایه\s*نگهدارنده|holder/i],
  ['storage', /فلش|مموری|رم\s*میکرو|flash\s*drive|memory/i],
];
export function parseCategory(title: string, text: string): CategoryHint | null {
  for (const hay of [clean(title), clean(text)]) for (const [k, re] of CATS) if (re.test(hay)) return k;
  return null;
}

/* ───────── کل پست ───────── */
const FIELD_LINE = /^\s*(?:(?:قیمت|price|موجودی|تعداد)[^\n\d]{0,6}\d|(?:رنگ(?:[\s\u200c]?ها)?|مناسب(?:\s*برای)?|مدل(?:[\s\u200c]?ها)?|سازگار(?:\s*با)?)\s*[:：])/i;
export function parsePost(raw: string): ParsedPost {
  const text = raw.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\r/g, '').trim(); // نیم‌فاصله‌ها برای نمایش حفظ می‌شوند
  const lines = text.split('\n').map((l) => l.trim());
  const titleLine = lines.find((l) => /\p{L}/u.test(l)) ?? '';
  const title = titleLine.replace(/^[^\p{L}\p{N}]+/u, '').replace(/#\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'محصول جدید';
  const body = lines
    .filter((l) => l !== titleLine && !FIELD_LINE.test(normDigits(l))) // قیمت/موجودی/رنگ/مدل در متغیرها و قیمت محصول هستند، در توضیحات تکرار نمی‌شوند
    .map((l) => l.replace(/#\S+/g, '').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const { models, brands } = parseModels(text);
  return {
    title,
    description: body.slice(0, 8000),
    price: parsePrice(text),
    stock: parseStock(text),
    models,
    brands,
    colors: parseColors(text),
    category: parseCategory(title, text),
  };
}
