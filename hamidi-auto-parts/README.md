# فروشگاه حمیدی — HAMIDI AUTO PARTS

فروشگاه اینترنتی لوازم یدکی نیسان و هوندا — Next.js 16 (App Router) + TypeScript، با تمرکز بر سرعت و SEO.

## اجرا

```bash
npm install
npm run dev                      # توسعه: http://localhost:3000
npm run build && npm start       # نسخه تولیدی (برای سنجش سرعت از این استفاده کنید)
```

در محیط تولید آدرس دامنه را تنظیم کنید (canonical، sitemap و Schema از آن ساخته می‌شوند):

```bash
NEXT_PUBLIC_SITE_URL=https://hamidiautoparts.ir
```

## معماری رندر

| مسیر | نوع رندر | دلیل |
| --- | --- | --- |
| `/` ، `/categories` | Static + ISR (۱ ساعت) | محتوای ثابت، قیمت‌ها ساعتی تازه می‌شوند |
| `/product/[slug]` | SSG + ISR، `dynamicParams` | همه محصولات در build ساخته می‌شوند؛ محصول جدید در اولین درخواست ساخته و کش می‌شود |
| `/shop`، `/[brand]`، `/[brand]/[model]`، `/categories/[slug]`، `/search` | SSR | نتایج به فیلتر/صفحه وابسته‌اند؛ همه محصولات در HTML سرور هستند |
| `/about`، `/contact`، `/cart` | Static | سبد خرید فقط در کلاینت (localStorage) |

- **Server Components پیش‌فرض.** فقط این بخش‌ها Client هستند: جستجوی زنده، شمارنده و صفحه سبد، دکمه افزودن به سبد، انتخاب تعداد، منوی موبایل، انتخاب خودرو، فلش‌های اسلایدر، کپی کد، فرم تماس و اعلان‌ها.
- **فیلترها بدون JavaScript:** همه فیلترها، مرتب‌سازی و صفحه‌بندی لینک واقعی هستند. پنل فیلتر موبایل، گالری محصول و دکمه تماس شناور فقط با CSS کار می‌کنند.
- **کاتالوگ به مرورگر ارسال نمی‌شود:** جستجوی زنده از `/api/search` می‌خواند و سبد خرید فقط اطلاعات لازم هر کالا را نگه می‌دارد.
- **لایه داده (`src/lib/catalog.ts`، فقط سرور):** همه صفحات فقط از این توابع داده می‌گیرند. با رشد کاتالوگ، فقط همین فایل به دیتابیس یا موتور جستجو وصل می‌شود.

## SEO

- آدرس‌ها: `/nissan`، `/nissan/murano`، `/categories/discs-pads`، `/product/front-brake-disc-teana-hap-ns-1021`
- Metadata، canonical، Open Graph و Twitter اختصاصی برای هر صفحه (`src/lib/seo.tsx`)
- صفحه‌های فیلترشده و مرتب‌شده `noindex,follow` هستند و canonical آن‌ها آدرس تمیز صفحه است. لینک فیلترها `rel="nofollow"` دارند. صفحه‌بندی (`?page=N`) قابل ایندکس است.
- آدرس‌های قدیمی محصول (مثلاً `/product/hap-ns-1021`) با ریدایرکت 308 به آدرس اصلی منتقل می‌شوند.
- جستجو، سبد خرید و API: `noindex` و Disallow در robots.txt
- Schema.org شامل Organization و AutoPartsStore، WebSite با SearchAction، BreadcrumbList، Product (همراه Offer، شرایط ارسال و مرجوعی، و سازگاری با خودرو) و ItemList
- `sitemap.xml` برای صفحات اصلی و `/product/sitemap/[n].xml` برای محصولات (هر فایل ۱۰ هزار محصول، همراه تصویر)

## سرعت

- تصاویر با `next/image` در قالب AVIF و WebP (مثلاً ۱۵KB به‌جای PNG ۳۶۸KB)، با width و height ثابت (CLS = 0) و preload تصویر LCP
- فونت وزیرمتن متغیر، محلی و زیرمجموعه‌شده (۷۳KB برای همه وزن‌ها) با fallback هم‌اندازه
- CSS به‌صورت inline (بدون درخواست مسدودکننده)، `content-visibility` برای بخش‌های پایین صفحه، و سایه هدر با CSS بدون اسکریپت
- حذف Radix Dialog، Radix Select و Sonner؛ جایگزینی با `<dialog>` و `<select>` بومی مرورگر و یک سیستم اعلان سبک
- هدرهای امنیتی (HSTS، nosniff، frame-options و …) و `poweredByHeader: false`

## ساختار

| مسیر | توضیح |
| --- | --- |
| `src/data/vehicles.ts` | برندها، مدل‌ها و بازه سال ساخت |
| `src/data/categories.ts` ، `products.ts` ، `brand-content.ts` | دسته‌بندی‌ها، محصولات نمونه و متن اختصاصی صفحه برندها |
| `src/lib/catalog.ts` | لایه داده (فقط سرور) |
| `src/lib/seo.tsx` | Metadata و JSON-LD |
| `assets/parts-svg` → `public/images/parts` | تصاویر قطعات (`node scripts/rasterize-parts.mjs`) |
| `src/fonts/vazirmatn-fa.woff2` | فونت زیرمجموعه‌شده |

> کد تخفیف نمایشی: `HAMIDI10`
