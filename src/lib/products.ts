/**
 * ⚠️ داده‌های نمایشی (DEMO DATA)
 * این محصولات و قیمت‌ها صرفاً برای نمایش دمو هستند و واقعی نیستند.
 * برای اتصال به بک‌اند واقعی، این ماژول را با فراخوانی API جایگزین کنید
 * (ساختار تایپ‌ها عمداً مستقل از منبع داده طراحی شده است).
 */

export type ColorOption = { name: string; hex: string };

export type Category = {
  slug: string;
  name: string;
  tagline: string;
  /** decorative hue used for placeholder art */
  hue: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  colors: ColorOption[];
  stock: number;
  badges: Array<"featured" | "new" | "bestseller" | "offer">;
  shortDesc: string;
  description: string;
  specs: Array<{ label: string; value: string }>;
  hue: number;
  /**
   * مسیر تصویر واقعی محصول (مثلاً "/images/products/slug.jpg").
   * اگر خالی باشد، یک placeholder تمیز و قابل‌تکمیل نمایش داده می‌شود.
   */
  image?: string;
  /** زوایای اضافی برای نمایش چندتصویری؛ در صورت وجود پر شود. */
  gallery?: string[];
};

export const categories: Category[] = [
  { slug: "cases", name: "قاب موبایل", tagline: "محافظت با ظاهری لوکس", hue: 230 },
  { slug: "glass", name: "گلس و محافظ صفحه", tagline: "شفافیت بی‌نقص", hue: 190 },
  { slug: "chargers", name: "شارژر", tagline: "انرژی سریع و ایمن", hue: 265 },
  { slug: "cables", name: "کابل شارژ", tagline: "دوام در هر اتصال", hue: 210 },
  { slug: "powerbanks", name: "پاوربانک", tagline: "قدرت همیشه همراه", hue: 250 },
  { slug: "headphones", name: "هندزفری و هدفون", tagline: "صدای ناب و عمیق", hue: 280 },
  { slug: "speakers", name: "اسپیکر", tagline: "صحنه را پر کن", hue: 300 },
  { slug: "holders", name: "هولدر موبایل", tagline: "تثبیت هوشمند", hue: 160 },
  { slug: "smartwatch", name: "ساعت هوشمند", tagline: "تکنولوژی روی مچ", hue: 215 },
  { slug: "accessories", name: "لوازم جانبی دیگر", tagline: "هر آنچه نیاز داری", hue: 340 },
];

export const categoryBySlug = (slug: string) =>
  categories.find((c) => c.slug === slug);

const C = {
  black: { name: "مشکی تایتان", hex: "#15161a" },
  silver: { name: "نقره‌ای", hex: "#c7ccd6" },
  graphite: { name: "خاکستری دودی", hex: "#4b4f58" },
  ice: { name: "یخی", hex: "#aeb9d6" },
  white: { name: "سفید قمری", hex: "#eef0f4" },
};

export const products: Product[] = [
  {
    id: "p01",
    slug: "titan-magsafe-case",
    name: "قاب مغناطیسی تایتان پرو",
    categorySlug: "cases",
    price: 1_290_000,
    oldPrice: 1_690_000,
    rating: 4.8,
    reviews: 213,
    colors: [C.black, C.graphite, C.ice],
    stock: 24,
    badges: ["featured", "bestseller", "offer"],
    shortDesc: "قاب آلیاژی با حلقه مغناطیسی و بافت نرم لمسی",
    description:
      "قاب تایتان پرو با بدنه‌ی آلیاژی سبک و پوشش نرم‌لمس، محافظت نظامی در برابر ضربه را با ظاهری مینیمال ترکیب می‌کند. حلقه‌ی مغناطیسی داخلی اتصال سریع به شارژرهای بی‌سیم و پایه‌ها را ممکن می‌سازد.",
    specs: [
      { label: "جنس بدنه", value: "آلیاژ آلومینیوم + TPU" },
      { label: "سازگاری مغناطیسی", value: "دارد" },
      { label: "استاندارد ضربه", value: "MIL-STD 810G" },
      { label: "گارانتی", value: "۱۸ ماه" },
    ],
    hue: 230,
  },
  {
    id: "p02",
    slug: "crystal-nano-glass",
    name: "گلس نانو کریستال تمام‌صفحه",
    categorySlug: "glass",
    price: 390_000,
    oldPrice: 520_000,
    rating: 4.7,
    reviews: 518,
    colors: [C.ice],
    stock: 140,
    badges: ["bestseller", "offer"],
    shortDesc: "سختی ۹H با پوشش ضدانگشت و شفافیت ۹۹٪",
    description:
      "محافظ صفحه‌ی نانو کریستال با سختی ۹H و لایه‌ی اولئوفوبیک، از نمایشگر شما در برابر خش و اثر انگشت محافظت می‌کند بی‌آنکه حساسیت لمسی را کاهش دهد.",
    specs: [
      { label: "سختی", value: "۹H" },
      { label: "شفافیت", value: "۹۹٪" },
      { label: "پوشش", value: "ضدانگشت اولئوفوبیک" },
      { label: "نصب", value: "فریم راهنما همراه" },
    ],
    hue: 190,
  },
  {
    id: "p03",
    slug: "flux-gan-charger-65w",
    name: "شارژر گن فلاکس ۶۵ وات",
    categorySlug: "chargers",
    price: 1_450_000,
    rating: 4.9,
    reviews: 176,
    colors: [C.black, C.white],
    stock: 38,
    badges: ["featured", "new"],
    shortDesc: "سه‌پورت گالیوم‌نایتراید، شارژ سریع هم‌زمان",
    description:
      "شارژر فلاکس با فناوری GaN، توان ۶۵ وات را در بدنه‌ای فوق‌فشرده ارائه می‌دهد. سه پورت خروجی امکان شارژ هم‌زمان لپ‌تاپ، موبایل و ساعت را فراهم می‌کند.",
    specs: [
      { label: "توان", value: "۶۵ وات" },
      { label: "فناوری", value: "GaN نسل سوم" },
      { label: "پورت‌ها", value: "۲×USB-C + ۱×USB-A" },
      { label: "محافظت", value: "حرارتی و اضافه‌ولتاژ" },
    ],
    hue: 265,
  },
  {
    id: "p04",
    slug: "braided-usbc-cable",
    name: "کابل بافته‌شده USB-C پرو",
    categorySlug: "cables",
    price: 240_000,
    oldPrice: 310_000,
    rating: 4.6,
    reviews: 402,
    colors: [C.black, C.graphite, C.silver],
    stock: 210,
    badges: ["offer"],
    shortDesc: "روکش نایلون، انتقال ۱۰۰ وات و داده‌ی پرسرعت",
    description:
      "کابل پرو با روکش نایلونی بافته‌شده، دوام فوق‌العاده در برابر تا ۳۰ هزار خم را تضمین می‌کند و از انتقال توان ۱۰۰ وات پشتیبانی می‌کند.",
    specs: [
      { label: "طول", value: "۱.۵ متر" },
      { label: "حداکثر توان", value: "۱۰۰ وات" },
      { label: "سرعت داده", value: "تا ۱۰Gbps" },
      { label: "روکش", value: "نایلون بافته" },
    ],
    hue: 210,
  },
  {
    id: "p05",
    slug: "orbit-powerbank-20000",
    name: "پاوربانک اوربیت ۲۰٬۰۰۰",
    categorySlug: "powerbanks",
    price: 2_190_000,
    oldPrice: 2_590_000,
    rating: 4.8,
    reviews: 289,
    colors: [C.black, C.silver],
    stock: 52,
    badges: ["featured", "bestseller", "offer"],
    shortDesc: "نمایشگر دیجیتال، شارژ سریع ۳۰ وات دوطرفه",
    description:
      "پاوربانک اوربیت با ظرفیت ۲۰٬۰۰۰ میلی‌آمپرساعت و نمایشگر دیجیتال درصد شارژ، همراه قابل‌اعتماد سفرهای طولانی شماست. شارژ سریع دوطرفه ۳۰ واتی.",
    specs: [
      { label: "ظرفیت", value: "۲۰٬۰۰۰ mAh" },
      { label: "خروجی", value: "۳۰ وات PD" },
      { label: "نمایشگر", value: "دیجیتال درصدی" },
      { label: "پورت", value: "USB-C + USB-A" },
    ],
    hue: 250,
  },
  {
    id: "p06",
    slug: "aura-anc-earbuds",
    name: "هندزفری آئورا با نویز کنسلینگ",
    categorySlug: "headphones",
    price: 3_490_000,
    oldPrice: 3_990_000,
    rating: 4.9,
    reviews: 631,
    colors: [C.white, C.black, C.ice],
    stock: 29,
    badges: ["featured", "new", "bestseller"],
    shortDesc: "حذف فعال نویز، تا ۳۶ ساعت پخش، بلوتوث ۵.۳",
    description:
      "ایربادز آئورا با حذف فعال نویز هیبریدی و درایور دینامیک ۱۱ میلی‌متری، تجربه‌ی صوتی عمیق و شفافی می‌سازد. مقاوم در برابر آب و عرق با استاندارد IPX5.",
    specs: [
      { label: "نویز کنسلینگ", value: "فعال هیبریدی" },
      { label: "عمر باتری", value: "تا ۳۶ ساعت (با کیس)" },
      { label: "بلوتوث", value: "۵.۳" },
      { label: "مقاومت", value: "IPX5" },
    ],
    hue: 280,
  },
  {
    id: "p07",
    slug: "pulse-360-speaker",
    name: "اسپیکر پالس ۳۶۰ درجه",
    categorySlug: "speakers",
    price: 2_890_000,
    rating: 4.7,
    reviews: 154,
    colors: [C.black, C.graphite],
    stock: 17,
    badges: ["new"],
    shortDesc: "صدای فراگیر ۳۶۰، باس عمیق و نورپردازی محیطی",
    description:
      "اسپیکر پالس با پخش صدای ۳۶۰ درجه و رادیاتور باس دوگانه، فضای شنیداری همه‌جانبه‌ای خلق می‌کند. نورپردازی محیطی قابل‌تنظیم و مقاومت IP67.",
    specs: [
      { label: "توان", value: "۳۰ وات RMS" },
      { label: "پخش", value: "۳۶۰ درجه" },
      { label: "باتری", value: "تا ۲۰ ساعت" },
      { label: "مقاومت", value: "IP67" },
    ],
    hue: 300,
  },
  {
    id: "p08",
    slug: "grip-magnetic-holder",
    name: "هولدر مغناطیسی گریپ",
    categorySlug: "holders",
    price: 560_000,
    oldPrice: 720_000,
    rating: 4.5,
    reviews: 198,
    colors: [C.black, C.silver],
    stock: 88,
    badges: ["offer"],
    shortDesc: "پایه‌ی مغناطیسی قوی مخصوص داشبورد خودرو",
    description:
      "هولدر گریپ با آهنربای نئودیمیوم N52 و مفصل ۳۶۰ درجه، گوشی شما را محکم و در هر زاویه‌ای نگه می‌دارد. نصب سریع روی دریچه‌ی کولر.",
    specs: [
      { label: "نوع", value: "مغناطیسی داشبوردی" },
      { label: "چرخش", value: "۳۶۰ درجه" },
      { label: "آهنربا", value: "نئودیمیوم N52" },
      { label: "نصب", value: "گیره‌ی دریچه" },
    ],
    hue: 160,
  },
  {
    id: "p09",
    slug: "nova-smartwatch-pro",
    name: "ساعت هوشمند نوا پرو",
    categorySlug: "smartwatch",
    price: 5_690_000,
    oldPrice: 6_490_000,
    rating: 4.8,
    reviews: 357,
    colors: [C.black, C.silver, C.graphite],
    stock: 21,
    badges: ["featured", "new", "bestseller", "offer"],
    shortDesc: "نمایشگر AMOLED، GPS، پایش سلامت پیشرفته",
    description:
      "ساعت هوشمند نوا پرو با نمایشگر AMOLED همیشه‌روشن، GPS دقیق و حسگرهای پایش ضربان، اکسیژن خون و خواب، دستیار سلامتی کامل روی مچ شماست. بدنه‌ی تایتانیوم.",
    specs: [
      { label: "نمایشگر", value: "AMOLED ۱.۴ اینچ" },
      { label: "عمر باتری", value: "تا ۱۴ روز" },
      { label: "حسگرها", value: "HR، SpO2، خواب" },
      { label: "بدنه", value: "آلیاژ تایتانیوم" },
    ],
    hue: 215,
  },
  {
    id: "p10",
    slug: "lumen-wireless-pad",
    name: "شارژر بی‌سیم لومن ۱۵ وات",
    categorySlug: "chargers",
    price: 890_000,
    rating: 4.6,
    reviews: 142,
    colors: [C.black, C.white],
    stock: 64,
    badges: ["new"],
    shortDesc: "شارژ بی‌سیم سریع با نشانگر نوری نرم",
    description:
      "پد شارژ بی‌سیم لومن با توان ۱۵ وات و سیستم خنک‌کننده‌ی هوشمند، شارژی سریع و ایمن ارائه می‌دهد. سطح ضدلغزش و نشانگر LED محیطی.",
    specs: [
      { label: "توان", value: "۱۵ وات" },
      { label: "استاندارد", value: "Qi" },
      { label: "خنک‌کننده", value: "هوشمند" },
      { label: "نشانگر", value: "LED محیطی" },
    ],
    hue: 265,
  },
  {
    id: "p11",
    slug: "shield-clear-case",
    name: "قاب شفاف شیلد ضدزرد",
    categorySlug: "cases",
    price: 540_000,
    rating: 4.4,
    reviews: 276,
    colors: [C.ice, C.white],
    stock: 120,
    badges: [],
    shortDesc: "پلی‌کربنات شفاف با فناوری ضدزردشدگی",
    description:
      "قاب شیلد از پلی‌کربنات نظامی با پوشش ضدزرد ساخته شده و شفافیت خود را در طول زمان حفظ می‌کند. گوشه‌های ایربگ‌دار برای جذب ضربه.",
    specs: [
      { label: "جنس", value: "پلی‌کربنات + TPU" },
      { label: "ویژگی", value: "ضدزردشدگی" },
      { label: "گوشه", value: "ایربگ ضدضربه" },
      { label: "گارانتی", value: "۱۲ ماه" },
    ],
    hue: 230,
  },
  {
    id: "p12",
    slug: "echo-mini-speaker",
    name: "اسپیکر جیبی اکو مینی",
    categorySlug: "speakers",
    price: 1_190_000,
    oldPrice: 1_490_000,
    rating: 4.5,
    reviews: 93,
    colors: [C.black, C.ice, C.graphite],
    stock: 45,
    badges: ["offer"],
    shortDesc: "جمع‌وجور، باس شگفت‌انگیز، ضدآب",
    description:
      "اسپیکر اکو مینی با وجود ابعاد کوچک، صدایی قدرتمند و باسی شگفت‌انگیز ارائه می‌دهد. ضدآب IPX7 و بند سیلیکونی همراه برای حمل آسان.",
    specs: [
      { label: "توان", value: "۱۰ وات" },
      { label: "باتری", value: "تا ۱۲ ساعت" },
      { label: "مقاومت", value: "IPX7" },
      { label: "اتصال", value: "بلوتوث ۵.۲" },
    ],
    hue: 300,
  },
];

export const getProduct = (slug: string) =>
  products.find((p) => p.slug === slug);

export const productsByBadge = (badge: Product["badges"][number]) =>
  products.filter((p) => p.badges.includes(badge));

export const productsByCategory = (slug: string) =>
  products.filter((p) => p.categorySlug === slug);
