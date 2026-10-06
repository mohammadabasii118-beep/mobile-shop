# CLAUDE.md — فروشگاه کیس لاین (Caseline) (لوازم جانبی موبایل)

فروشگاه اینترنتی فارسی (RTL) با پنل مدیریت. قیمت‌ها به تومان (عدد صحیح).

## قانون اصلی: DESIGN.md منبع واحد طراحی است

قبل از **هر** تغییر UI (کامپوننت، صفحه، استایل، متن رابط):

1. `DESIGN.md` را بخوان (حداقل بخش‌های مرتبط؛ بخش ۱۸ تصمیم‌های اجرایی است).
2. قوانین آن را رعایت کن (tokenها، Do/Don't، RTL، Accessibility، Motion).
3. اگر تصمیم جدیدی لازم است که در `DESIGN.md` نیست، **اول `DESIGN.md` را به‌روز کن**، سپس کد بنویس. در پیام commit ذکر کن.
4. رنگ/اندازه/radius/سایه فقط از CSS variableهای `src/app/globals.css` (بلوک tokens). هیچ hex در کامپوننت‌ها (به‌جز نمونه‌ی رنگ محصول از دیتابیس).
5. اگر کد و `DESIGN.md` اختلاف دارند، `DESIGN.md` برنده است، مگر اینکه کاربر صریحاً تغییرش دهد.

## فناوری

Next.js 16 (App Router، Server Components + Server Actions) · React 19 · TypeScript strict · CSS خالص با tokens (بدون Tailwind) · lucide-react · SQLite با `better-sqlite3` (`src/lib/db.ts`، همه‌ی schema همان‌جاست) · فونت Vazirmatn از `@fontsource-variable` (self-hosted).

## دستورها

`npm run dev` · `npm run build` · `npm start` · `npm run seed` (`-- --empty` / `seed:reset`) · `npm run typecheck` · `npm run smoke` (روی سرور در حال اجرا).
ادمین seed: `admin` / `admin123`. هر تغییر کد را با `npx tsc --noEmit` و `npx next build` بررسی کن.

## ساختار و قراردادها

- `src/app/(shop)` سایت، `src/app/admin/(panel)` پنل (guard در layout با `requireAdmin()`)، `src/app/admin/login` ورود.
- **Server Action مدیریتی** حتماً با `await assertAdmin()` شروع شود (فایل‌های `src/lib/actions/admin-*.ts`). Route Handlerهای مدیریتی هم همین‌طور.
- فرمت پول/تاریخ/ارقام فقط با `src/lib/format.ts`. ارقام فارسی در UI، لاتین در DB و URL. تاریخ UI شمسی (`Intl` با `fa-IR-u-ca-persian`)، DB میلادی UTC.
- قیمت سفارش **هرگز** از کلاینت نیامده؛ `priceCart`/`placeOrder` در `src/lib/orders.ts` از DB محاسبه می‌کند.
- محصول متغیر: `variations.attrs` JSON با کلید slug ویژگی (`phone-brand`, `phone-model`, `color`). ویژگی فرزند (مدل) با `attributes.parent_attribute_id` و `attribute_terms.parent_term_id` به والد (برند) وصل است؛ ترکیب‌ها فقط با `generateCombos` (`src/lib/variations.ts`) ساخته شود. slugهای پایه در `ATTR` ثابت‌اند و حذف نمی‌شوند.
- تصویر محصول: مسیر `/uploads/...` (آپلود مدیر، ذخیره در `data/uploads`) یا `art:p-xxx[@#hex]` (SVG نمونه، `Pic` نمایش می‌دهد).
- فقط logical properties (`inline-start/end`، `padding-inline`)؛ `left/right/ml/mr` ممنوع. متن لاتین داخل جمله‌ی فارسی: `<bdi>`.
- هر لیست: حالت loading/empty/error. دسترسی‌پذیری (DESIGN.md §۱۳) جزو «تمام‌شده» است.
- در SQL از نام‌های رزرو (`all`, `out`, …) به‌عنوان alias استفاده نکن؛ کوئری‌ها پارامتری باشند.
- بعد از تغییر UI با viewport ۳۲۰/۳۹۰/۷۶۸/۱۴۴۰ و تم تیره بررسی کن؛ اسکرول افقی نباید وجود داشته باشد.

## وضعیت

کامل و تست‌شده: سایت (Home با اسلایدر، shop، category، product متغیر، search، cart، checkout، account، wishlist)، پنل (داشبورد، محصولات، ویژگی‌ها، دسته/برند، موجودی، سفارش، پرداخت، تخفیف، کوپن، نظر، کاربر، بنر، گزارش، تنظیمات).
کارهای بعدی: درگاه پرداخت واقعی (`src/lib/payments.ts`)، پیامک، آدرس‌های ذخیره‌شده.

`archive/` نسخه‌ی قدیمی دموی ایستا است؛ تغییرش نده.

بدون درخواست کاربر PR نساز. کار روی branch مشخص‌شده انجام شود.
