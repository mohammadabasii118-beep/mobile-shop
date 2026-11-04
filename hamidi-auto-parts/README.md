# فروشگاه حمیدی — HAMIDI AUTO PARTS

نسخه نمایشی (Frontend Demo) فروشگاه اینترنتی لوازم یدکی نیسان و هوندا.

## اجرا

```bash
cd hamidi-auto-parts
npm install
npm run dev      # http://localhost:3000
```

بیلد تولیدی: `npm run build && npm start`

## تکنولوژی

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · کامپوننت‌های shadcn/ui (Radix) · Lucide React · Zustand (سبد خرید با localStorage) · فونت وزیرمتن · Sonner

## ساختار

| مسیر | توضیح |
| --- | --- |
| `src/data/vehicles.ts` | برندها، مدل‌ها و بازه سال ساخت — افزودن مدل جدید فقط با یک خط |
| `src/data/categories.ts` | ۱۶ دسته‌بندی قطعات |
| `src/data/products.ts` | محصولات نمونه (کد فنی، OEM، سازگاری، قیمت، موجودی) |
| `src/lib/catalog.ts` | جستجو (نام، کد فنی، OEM، مدل) + فیلتر و مرتب‌سازی |
| `src/store/cart.ts` | سبد خرید Zustand با ذخیره در localStorage |
| `src/components/ui` | کامپوننت‌های پایه به سبک shadcn/ui |
| `public/parts/*.svg` | رندرهای استودیویی قطعات (تولیدشده با `scripts/generate-part-images.mjs`) |

## صفحات

`/` خانه · `/shop` فروشگاه · `/nissan` · `/honda` · `/categories` و `/categories/[slug]` · `/product/[slug]` · `/search?q=` · `/cart` · `/contact` · `/about`

> کد تخفیف نمایشی: `HAMIDI10`
