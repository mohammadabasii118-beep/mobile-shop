export type ArtKey =
  | 'iphone'
  | 'case'
  | 'glass'
  | 'adapter'
  | 'cable'
  | 'powerbank'
  | 'airpods'

export type CategoryId =
  | 'cases'
  | 'glass'
  | 'charging'
  | 'powerbank'
  | 'airpods'

export interface Category {
  id: CategoryId
  title: string
  subtitle: string
  art: ArtKey
}

export interface Product {
  id: string
  name: string
  category: CategoryId
  art: ArtKey
  tagline: string
  description: string
  price: number
  oldPrice?: number
  rating: number
  reviews: number
  colors: { name: string; hex: string }[]
  features: string[]
  bestseller?: boolean
  isNew?: boolean
}

export const categories: Category[] = [
  {
    id: 'cases',
    title: 'قاب گوشی',
    subtitle: 'محافظت در کنار زیبایی',
    art: 'case',
  },
  {
    id: 'glass',
    title: 'گلس محافظ',
    subtitle: 'شفافیت بی‌نهایت',
    art: 'glass',
  },
  {
    id: 'charging',
    title: 'شارژر و کابل',
    subtitle: 'همیشه آماده شارژ',
    art: 'adapter',
  },
  {
    id: 'powerbank',
    title: 'پاوربانک',
    subtitle: 'انرژی بدون محدودیت',
    art: 'powerbank',
  },
  {
    id: 'airpods',
    title: 'ایرپاد و صدا',
    subtitle: 'صدایی فراتر از انتظار',
    art: 'airpods',
  },
]

export const products: Product[] = [
  {
    id: 'titan-case-black',
    name: 'قاب تیتانیوم آورا',
    category: 'cases',
    art: 'case',
    tagline: 'لمس مخملی، استحکام نظامی',
    description:
      'قابی با بدنه ترکیبی از پلی‌کربنات و لبه‌های جاذب ضربه، پوشش ضد اثر انگشت و بریدگی دقیق برای دکمه‌ها و دوربین. سازگار با شارژ مگ‌سیف.',
    price: 1290000,
    oldPrice: 1690000,
    rating: 4.9,
    reviews: 412,
    colors: [
      { name: 'مشکی تیتان', hex: '#1c1c20' },
      { name: 'نقره‌ای', hex: '#c7cad1' },
      { name: 'آبی عمیق', hex: '#2b3a67' },
    ],
    features: ['سازگار با مگ‌سیف', 'ضد ضربه نظامی', 'لبه بلند محافظ دوربین'],
    bestseller: true,
  },
  {
    id: 'clear-case-mag',
    name: 'قاب شفاف مگ‌سیف',
    category: 'cases',
    art: 'case',
    tagline: 'شفافیتی که زرد نمی‌شود',
    description:
      'پلیمر نسل جدید با مقاومت در برابر زردشدگی، حلقه مغناطیسی داخلی و شفافیت کریستالی برای نمایش کامل رنگ گوشی شما.',
    price: 990000,
    rating: 4.7,
    reviews: 221,
    colors: [{ name: 'شفاف', hex: '#e8edf5' }],
    features: ['حلقه مگ‌سیف داخلی', 'ضد زردشدگی', 'لمس نرم'],
    isNew: true,
  },
  {
    id: 'leather-case',
    name: 'قاب چرم دست‌دوز',
    category: 'cases',
    art: 'case',
    tagline: 'اصالت در دستان شما',
    description:
      'چرم طبیعی دباغی‌شده با آستر میکروفایبر، که با گذر زمان زیباتر می‌شود. دوخت دقیق و حس لوکس در هر تماس.',
    price: 1790000,
    rating: 4.8,
    reviews: 158,
    colors: [
      { name: 'قهوه‌ای', hex: '#5a3b2c' },
      { name: 'مشکی', hex: '#18181b' },
    ],
    features: ['چرم طبیعی', 'آستر میکروفایبر', 'دوام بالا'],
  },
  {
    id: 'glass-pro',
    name: 'گلس شفاف Pro',
    category: 'glass',
    art: 'glass',
    tagline: 'محافظت نامرئی',
    description:
      'شیشه سکوریت ۹H با پوشش اولئوفوبیک ضد اثر انگشت، لبه‌های گرد ۲.۵D و شفافیت ۹۹.۹٪ که حساسیت لمسی را حفظ می‌کند.',
    price: 450000,
    oldPrice: 650000,
    rating: 4.9,
    reviews: 903,
    colors: [{ name: 'شفاف', hex: '#dfeaf6' }],
    features: ['سختی 9H', 'پوشش ضد اثر انگشت', 'نصب بدون حباب'],
    bestseller: true,
  },
  {
    id: 'glass-privacy',
    name: 'گلس حریم خصوصی',
    category: 'glass',
    art: 'glass',
    tagline: 'فقط برای چشمان شما',
    description:
      'فیلتر زاویه دید که نمایشگر را از دید اطرافیان محافظت می‌کند، همراه با محافظت کامل در برابر خش و ضربه.',
    price: 690000,
    rating: 4.6,
    reviews: 274,
    colors: [{ name: 'دودی', hex: '#4a4f57' }],
    features: ['فیلتر حریم خصوصی', 'ضد اشعه آبی', 'سختی 9H'],
  },
  {
    id: 'glass-camera',
    name: 'محافظ لنز دوربین',
    category: 'glass',
    art: 'glass',
    tagline: 'نگهبان شیشه‌ای لنز',
    description:
      'محافظ شیشه‌ای مجزا برای هر لنز با حلقه فلزی، بدون کاهش کیفیت تصویر و فلش.',
    price: 320000,
    rating: 4.7,
    reviews: 189,
    colors: [{ name: 'تیتانیوم', hex: '#9a9ea7' }],
    features: ['حلقه فلزی', 'بدون افت کیفیت عکس', 'نصب آسان'],
    isNew: true,
  },
  {
    id: 'adapter-35w',
    name: 'آداپتور ۳۵ وات دو پورت',
    category: 'charging',
    art: 'adapter',
    tagline: 'دو دستگاه، یک شارژر',
    description:
      'شارژر دیواری GaN با دو پورت USB-C، شارژ سریع همزمان و بدنه فشرده. مجهز به محافظت هوشمند حرارتی.',
    price: 1150000,
    rating: 4.8,
    reviews: 341,
    colors: [{ name: 'سفید', hex: '#f3f4f6' }],
    features: ['فناوری GaN', 'دو پورت USB-C', 'محافظت حرارتی'],
    bestseller: true,
  },
  {
    id: 'cable-braided',
    name: 'کابل بافته USB-C',
    category: 'charging',
    art: 'cable',
    tagline: 'استقامت در هر گره',
    description:
      'کابل USB-C به USB-C با روکش بافته‌شده، پشتیبانی از شارژ ۱۰۰ وات و انتقال داده پرسرعت. طول ۱.۵ متر.',
    price: 390000,
    oldPrice: 520000,
    rating: 4.7,
    reviews: 526,
    colors: [
      { name: 'مشکی', hex: '#1b1b1f' },
      { name: 'نقره‌ای', hex: '#c9ccd2' },
    ],
    features: ['شارژ تا 100W', 'روکش بافته', 'انتقال داده سریع'],
  },
  {
    id: 'magsafe-charger',
    name: 'شارژر مغناطیسی مگ‌سیف',
    category: 'charging',
    art: 'adapter',
    tagline: 'بچسبان و شارژ کن',
    description:
      'پد شارژ مغناطیسی با هم‌ترازی دقیق، شارژ بی‌سیم سریع و بدنه آلومینیومی ظریف.',
    price: 1390000,
    rating: 4.6,
    reviews: 203,
    colors: [{ name: 'سفید', hex: '#eef0f3' }],
    features: ['اتصال مغناطیسی', 'شارژ بی‌سیم سریع', 'بدنه آلومینیومی'],
    isNew: true,
  },
  {
    id: 'powerbank-10k',
    name: 'پاوربانک مگ‌سیف ۱۰۰۰۰',
    category: 'powerbank',
    art: 'powerbank',
    tagline: 'انرژی که همراه شماست',
    description:
      'پاوربانک مغناطیسی با ظرفیت ۱۰۰۰۰ میلی‌آمپر، نمایشگر دیجیتال درصد شارژ، پایه نگهدارنده و شارژ همزمان سیمی و بی‌سیم.',
    price: 2290000,
    oldPrice: 2790000,
    rating: 4.9,
    reviews: 487,
    colors: [
      { name: 'مشکی مات', hex: '#1a1a1e' },
      { name: 'نقره‌ای', hex: '#c7cad1' },
    ],
    features: ['اتصال مگ‌سیف', 'نمایشگر دیجیتال', 'پایه نگهدارنده'],
    bestseller: true,
  },
  {
    id: 'powerbank-20k',
    name: 'پاوربانک پرسفر ۲۰۰۰۰',
    category: 'powerbank',
    art: 'powerbank',
    tagline: 'برای سفرهای طولانی',
    description:
      'ظرفیت بالای ۲۰۰۰۰ میلی‌آمپر با سه پورت خروجی، شارژ سریع ۶۵ وات و قابلیت شارژ لپ‌تاپ.',
    price: 2990000,
    rating: 4.7,
    reviews: 162,
    colors: [{ name: 'مشکی', hex: '#161619' }],
    features: ['خروجی 65W', 'سه پورت', 'شارژ لپ‌تاپ'],
  },
  {
    id: 'airpods-pro',
    name: 'ایرپاد Pro نسل جدید',
    category: 'airpods',
    art: 'airpods',
    tagline: 'سکوت را بشنوید',
    description:
      'حذف نویز فعال نسل جدید، صدای فضایی شخصی‌سازی‌شده و کیس شارژ USB-C با عمر باتری طولانی. مقاوم در برابر عرق و آب.',
    price: 5490000,
    oldPrice: 5990000,
    rating: 4.9,
    reviews: 731,
    colors: [{ name: 'سفید', hex: '#f4f5f7' }],
    features: ['حذف نویز فعال', 'صدای فضایی', 'کیس USB-C'],
    bestseller: true,
  },
  {
    id: 'airpods-case',
    name: 'کاور محافظ ایرپاد',
    category: 'airpods',
    art: 'airpods',
    tagline: 'لباسی برای صدای شما',
    description:
      'کاور سیلیکونی نرم با حلقه نگهدارنده و بریدگی دقیق پورت، محافظ کیس ایرپاد در برابر ضربه و خش.',
    price: 290000,
    rating: 4.5,
    reviews: 318,
    colors: [
      { name: 'آبی', hex: '#3b6fd4' },
      { name: 'مشکی', hex: '#1b1b1f' },
      { name: 'سبز', hex: '#2f8f6b' },
    ],
    features: ['سیلیکون نرم', 'حلقه نگهدارنده', 'سازگار با شارژ بی‌سیم'],
    isNew: true,
  },
  {
    id: 'earbuds-tips',
    name: 'فوم مموری ایرپاد',
    category: 'airpods',
    art: 'airpods',
    tagline: 'جداسازی کامل صدا',
    description:
      'جایگزین فوم مموری برای عایق‌بندی بهتر صدا و افزایش کیفیت بیس، در سه سایز مختلف.',
    price: 180000,
    rating: 4.4,
    reviews: 97,
    colors: [{ name: 'مشکی', hex: '#1b1b1f' }],
    features: ['فوم مموری', 'سه سایز', 'عایق صدای بهتر'],
  },
]

export function formatToman(value: number): string {
  return value.toLocaleString('fa-IR')
}

export const bestsellers = products.filter((p) => p.bestseller)
export const newArrivals = products.filter((p) => p.isNew)

export function productsByCategory(id: CategoryId): Product[] {
  return products.filter((p) => p.category === id)
}

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id)
}
