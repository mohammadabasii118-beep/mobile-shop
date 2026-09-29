# سیستم طراحی کیس‌لاین

این سند، سیستم طراحی‌ای را که واقعاً در کد این پروژه استفاده می‌شود مستند می‌کند — نه یک سند آرمانی جدا از کد. هر مقدار زیر مستقیماً از `app/globals.css` و `tailwind.config.ts` گرفته شده است.

## ۱. رنگ‌ها (توکن‌های CSS)

همه‌ی رنگ‌ها به‌صورت متغیر CSS در `:root` تعریف شده‌اند و **هرگز مستقیم در جای دیگری هاردکد نمی‌شوند** (به‌جز چند گرادینت تزئینی خاص در هیرو/بنر). هر متغیر یک نسخه‌ی حالت تاریک هم دارد.

| توکن | روشن | تاریک | استفاده |
|---|---|---|---|
| `--bg` | `#fafaf9` | `#121212` | پس‌زمینه‌ی کلی صفحه |
| `--surface` | `#ffffff` | `#1c1c1c` | پس‌زمینه‌ی کارت/فرم (کلاس `.surface`) |
| `--surface-2` | `#f5f5f4` | `#262626` | پس‌زمینه‌ی ثانویه، کمی متمایز از surface (کلاس `.surface2`) |
| `--text` | `#171717` | `#f2f2f0` | رنگ متن اصلی |
| `--muted` | `#737373` | `#a3a3a3` | متن کم‌رنگ/توضیحی (کلاس `.muted`) |
| `--line` | `#e7e5e4` | `#333333` | خط جداکننده/حاشیه (کلاس `.line`) |
| `--ink` | `#171717` | `#2d2d2d` | پس‌زمینه‌ی دکمه‌های اصلی/تیره (عمداً در هر دو تم تیره می‌ماند — دلیل در کامنت بالای `globals.css`) |

این توکن‌ها هم در Tailwind (`tailwind.config.ts` → `theme.extend.colors`) و هم به‌صورت مستقیم در `style={{ background: "var(--ink)" }}` استفاده می‌شوند. تغییر تم (`ThemeToggle`) فقط `data-theme` را روی `<html>` عوض می‌کند؛ رنگ سیستم‌عامل هم از طریق `prefers-color-scheme` پشتیبانی می‌شود.

## ۲. تایپوگرافی

- فونت اصلی: **وزیر (Vazir)** — از طریق متغیر فونت Next.js (`--font-vazir`)، با `Tahoma, sans-serif` به‌عنوان جایگزین.
- اندازه‌ها از کلاس‌های استاندارد Tailwind استفاده می‌کنند (بدون مقیاس سفارشی): `text-xs`/`text-sm`/`text-base`/`text-lg`/`text-xl`/`text-2xl`/`text-3xl`/`text-5xl`.
- عنوان صفحات: `text-2xl font-extrabold`. عنوان بخش‌های صفحه اصلی: `text-lg md:text-xl font-bold`. متن بدنه: `text-sm leading-7` یا `leading-8`.

## ۳. فاصله‌گذاری و شبکه (Grid)

- عرض حداکثر محتوا: `max-w-7xl` برای صفحات اصلی فروشگاه، `max-w-3xl`/`max-w-xl`/`max-w-sm`/`max-w-lg`/`max-w-2xl` برای فرم‌ها و صفحات متنی — بسته به محتوا.
- حاشیه‌ی افقی استاندارد: `px-4 md:px-8`.
- شبکه‌ی کارت محصول: `grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5`.
- گردی گوشه: `rounded-lg` برای ورودی‌ها/دکمه‌های کوچک، `rounded-2xl`/`rounded-3xl` برای کارت‌ها و بخش‌های بزرگ، `rounded-full` برای دکمه‌ها/نشان‌ها/آواتار.

## ۴. اجزای پایه (Components)

| جزء | الگو |
|---|---|
| دکمه‌ی اصلی | `h-11 px-6/8 rounded-full text-white font-bold text-sm` با `style={{ background: "var(--ink)" }}` |
| دکمه‌ی مخرب (حذف/لغو) | همان الگو با `background: "#a24e56"` |
| ورودی متن | `h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none` |
| کارت | `surface border line rounded-2xl p-5` (یا `p-4`/`p-8` بسته به چگالی محتوا) |
| جدول ادمین | `surface border line rounded-2xl overflow-hidden` + `<table className="w-full text-sm">` با `thead` به رنگ `surface2` |
| دکمه‌ی آیکونی | دایره‌ای (`w-8/9/10 h-8/9/10 rounded-full flex items-center justify-center`) + همیشه `aria-label` صریح (هرگز فقط آیکون بدون برچسب) |

## ۵. آیکون‌ها

یک مجموعه‌ی آیکون SVG داخلی در `components/Icon.tsx` — بدون هیچ کتابخانه‌ی بیرونی (مثل lucide/heroicons). هر آیکون جدید باید در همان فایل اضافه شود تا از یک سبک خطی یکسان پیروی کند.

## ۶. حالت تاریک (Dark Mode)

هر رنگ توکن، یک مقدار جایگزین برای `:root[data-theme="dark"]` و `@media (prefers-color-scheme: dark)` دارد. یک کامپوننت جدید هرگز نباید رنگ خام (hex) به‌صورت مستقیم در JSX بنویسد — همیشه از طریق کلاس‌های `.surface`/`.muted`/`.line` یا `var(--ink)`/`var(--text)` در `style`.

## ۷. دسترسی‌پذیری (Accessibility) — وضعیت فعلی

بررسی شد (این دور): تمام `<img>` تگ‌های پروژه دارای `alt` هستند؛ تمام دکمه‌های فقط-آیکون (`WishlistButton`, `CompareButton`, `ThemeToggle`) دارای `aria-label` صریح هستند؛ آکاردئون توضیحات محصول (`ProductInfoTabs`) از `aria-expanded`/`aria-controls`/`aria-hidden` استاندارد استفاده می‌کند. **موارد باقی‌مانده برای یک بازبینی کامل‌تر در آینده:** بررسی Contrast Ratio رسمی رنگ `--muted` روی `--bg` در هر دو تم با ابزار WCAG، تست واقعی با صفحه‌خوان (Screen Reader) روی جریان کامل خرید، و بررسی ترتیب Tab (Tab Order) در فرم‌های چندمرحله‌ای.

## ۸. عملکرد (Performance) — وضعیت فعلی

بررسی شد: پروژه از `next/image` برای تصاویر محصول/دسته‌بندی استفاده می‌کند (بهینه‌سازی/Lazy-loading خودکار Next.js)؛ هیچ کتابخانه‌ی انیمیشن سنگین (مثل framer-motion) نصب نیست — انیمیشن‌ها فقط با CSS Transition ساده (`transition-transform`, `transition-colors`) پیاده شده‌اند که هزینه‌ی عملکردی ناچیزی دارند. **مورد باقی‌مانده:** اندازه‌گیری واقعی Lighthouse/Core Web Vitals، که فقط روی یک دیپلوی واقعی (نه این Sandbox) قابل انجام است.
