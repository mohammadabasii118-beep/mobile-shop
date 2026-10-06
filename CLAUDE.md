# CLAUDE.md — فروشگاه ولتا (لوازم جانبی موبایل)

فروشگاه اینترنتی فارسی (RTL) برای لوازم جانبی موبایل. قیمت‌ها به تومان.

## قانون اصلی: DESIGN.md منبع واحد طراحی است

قبل از **هر** تغییر UI (کامپوننت، صفحه، استایل، متن رابط):

1. `DESIGN.md` را بخوان (حداقل بخش‌های مرتبط با تغییر).
2. قوانین آن را رعایت کن (tokenها، Do/Don't، RTL، Accessibility، Motion).
3. اگر تصمیم جدیدی لازم است که در `DESIGN.md` نیست، **اول `DESIGN.md` را به‌روز کن**، سپس کد بنویس. در پیام commit ذکر کن.
4. هیچ رنگ/اندازه/radius/سایه‌ی hard-code در کامپوننت‌ها نگذار؛ فقط tokenها (`src/styles/tokens.css` ← از `DESIGN.md`).
5. اگر کد و `DESIGN.md` اختلاف دارند، `DESIGN.md` برنده است، مگر اینکه کاربر صریحاً تغییرش دهد.

## زبان و جهت

- `lang="fa" dir="rtl"` در ریشه. فونت: **Vazirmatn**.
- فقط logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`). از `left/right/ml/mr/pl/pr/text-left` استفاده نکن.
- متن UI فارسی؛ نام برند و مدل محصول لاتین (داخل `<bdi>` در جمله‌ی فارسی).
- ارقام فارسی در UI، لاتین در URL/SKU/DB. قیمت فقط با util مرکزی `lib/format.ts` فرمت شود.
- تاریخ شمسی در UI، میلادی در DB.

## فناوری (پیشنهادی، در انتظار تأیید)

Next.js (App Router) · TypeScript strict · Tailwind CSS · shadcn/ui (سفارشی‌شده با tokenها) · lucide-react · Framer Motion (فقط hero/drawer/modal/carousel) · معماری component-based.

## ساختار مسیرها

`/` · `/shop` · `/category/[slug]` · `/product/[slug]` · `/search` · `/cart` · `/checkout` · `/account` · `/wishlist` · `/admin` (مدیریت: محصولات، دسته‌ها، سفارش‌ها، کاربران، موجودی، تخفیف‌ها، کد تخفیف، بنرها، برندها، پرداخت‌ها، گزارش‌ها، تنظیمات).

ادمین از همان tokenها استفاده می‌کند ولی چیدمان متراکم دارد (بخش ۱۰ در `DESIGN.md`).

## وضعیت فعلی

- فاز ۱ (فعلی): بررسی design system، `DESIGN.md`، دموی HTML ایستا در `demo/index.html` (Home + Product Card). **هنوز پروژه‌ی Next.js ساخته نشده**؛ منتظر تأیید کاربر روی ظاهر و stack.
- قالب قابل استفاده‌ی مجدد: `template/` (HTML/CSS/JS ایستا) و `volta-template.zip`.
- فاز ۲: scaffold پروژه، `tokens.css`، primitives، Home و ProductCard واقعی.
- فاز ۳: shop/category/product/search/cart/checkout/account/wishlist.
- فاز ۴: admin.

## روش کار

- تغییرات کوچک و متمرکز؛ قبل از اتمام lint/typecheck/build را اجرا کن.
- برای هر لیست: حالت‌های loading، empty، error.
- برای UI، با viewport موبایل (۳۹۰px) و دسکتاپ (۱۴۴۰px)، RTL، و تم روشن/تیره چک کن.
- دسترسی‌پذیری (DESIGN.md §۱۳) بخشی از «تمام‌شده» است.
- کار روی branch مشخص‌شده انجام شود؛ بدون درخواست کاربر PR نساز.
