# لوکس‌سل — فروشگاه لوکس لوازم جانبی موبایل

فروشگاه اینترنتی لوازم جانبی موبایل با سبک **Dark Luxury / Futuristic / Premium 3D**،
کاملاً فارسی و RTL، همراه با یک تجربهٔ سینمایی **Scroll‑Storytelling** پنج‌صحنه‌ای
روی صفحهٔ اصلی.

> ⚠️ این یک پروژهٔ **نمایشی (دمو)** است: داده‌ها، قیمت‌ها، نظرات و موجودی‌ها ساختگی‌اند
> و هیچ پرداخت واقعی انجام نمی‌شود.

## تکنولوژی‌ها

| ابزار | کاربرد |
|---|---|
| Next.js 14 (App Router) + React 18 + TypeScript | اسکلت اپلیکیشن |
| Tailwind CSS | سیستم طراحی و استایل |
| Three.js + @react-three/fiber + @react-three/drei | صحنه‌های سه‌بعدی |
| GSAP + ScrollTrigger | **تنها موتور اسکرول**: pin، scrub و روایت صحنه‌ها |
| Motion (`motion`) | میکرو‌تعامل‌های UI (هاور، منو، تیلت کارت) |
| lucide-react | آیکون‌ها |
| Vazirmatn | تایپوگرافی فارسی (فونت محلی) |

تفکیک GSAP و Motion عمدی است: GSAP فقط برای اسکرول، Motion فقط برای UI — بدون هم‌پوشانی.

## اجرا

```bash
npm install
npm run dev     # توسعه → http://localhost:3000
# یا
npm run build && npm start   # نسخهٔ production
```

## معماری تجربهٔ سینمایی

- کانتینر `۵۰۰vh` با یک «استیج» `sticky` (pin نیتیو، بدون layout shift).
- یک `<Canvas>` پایدار که اجزایش با **پیشرفت اسکرول** (۰→۱) ترنسفورم می‌شوند؛
  مقدار پیشرفت از طریق یک singleton سبک (`src/lib/scroll.ts`) در `useFrame`
  خوانده می‌شود تا هیچ re‑render ری‌اکتی رخ ندهد.
- Canvas با `pointer-events-none` پوشیده شده؛ متن‌ها و دکمه‌ها همیشه کلیک‌پذیرند.
- پنج صحنه: Hero → قاب و محافظت → قدرت و شارژ → صدا → ویترین محصولات (گرید واقعی).
- **Reduced‑Motion**: نسخهٔ ساکن و سبک جایگزین می‌شود.

## ساختار پوشه‌ها

```
src/
├─ app/                     # صفحات (App Router)
│  ├─ page.tsx              # صفحهٔ اصلی (سینمایی + ویترین)
│  ├─ products/             # فروشگاه، فیلتر/مرتب‌سازی، جزئیات محصول
│  ├─ cart, checkout        # سبد و تسویه (نمایشی)
│  ├─ account, login        # حساب کاربری و ورود (نمایشی)
│  └─ about, contact, terms, not-found
├─ components/
│  ├─ layout/               # Header, Footer, MobileMenu, Logo
│  ├─ home/                 # بخش‌های صفحهٔ اصلی
│  │  └─ cinematic/         # CinematicHome + CinematicScene (R3F)
│  ├─ product/              # ProductCard, ProductDetail, ProductsBrowser, ProductViewer3D
│  └─ ui/                   # Reveal, ProductArt, ProductMedia
└─ lib/
   ├─ products.ts           # دادهٔ نمایشی محصولات (قابل جایگزینی با API)
   ├─ cart-context.tsx      # state سبد خرید (+ localStorage)
   ├─ format.ts             # اعداد و قیمت فارسی
   └─ scroll.ts             # وضعیت و توابع کمکی اسکرول
```

## تصاویر واقعی محصولات

راهنما در `public/images/products/README.md`. تا قبل از افزودن تصویر واقعی،
یک placeholder تمیز نمایش داده می‌شود؛ هرگز تصویر تصادفی به‌جای محصول واقعی استفاده نمی‌شود.

## آماده‌سازی برای بک‌اند

- دادهٔ نمایشی در `src/lib/products.ts` متمرکز شده و تایپ‌ها مستقل از منبع داده‌اند؛
  برای اتصال واقعی، این ماژول را با فراخوانی API جایگزین کنید.
- درگاه پرداخت عمداً غیرفعال است و بدون اعتبارنامهٔ معتبر فعال نمی‌شود.
