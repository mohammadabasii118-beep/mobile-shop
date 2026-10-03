# CLAUDE.md — راهنمای کار روی پروژه «ولتا» (فروشگاه لوازم جانبی موبایل)

## قانون اول: قبل از هر تغییر UI، `DESIGN.md` را بخوان

`DESIGN.md` منبع حقیقت (Single Source of Truth) برای تمام UI است. **پیش از ساخت یا تغییر هر کامپوننت، صفحه یا استایل، آن را کامل بخوان.**

### Workflow اجباری برای هر UI جدید
1. `DESIGN.md` را بخوان.
2. اگر کامپوننت مشابه وجود دارد (`components/ui`, `features/*`) آن را **Reuse** کن.
3. Design token / رنگ / radius / typography / سایهٔ جدید **بدون دلیل** نساز.
4. اگر الگوی جدیدی واقعاً لازم است: **اول `DESIGN.md` را به‌روزرسانی کن** (و `styles/tokens.css`)، بعد کد بزن، و در Changelog ثبت کن.
5. در کامپوننت‌ها hex خام ننویس؛ فقط tokenهای معنایی (`bg-surface`, `text-muted`, `border-line` …).

## پروژه
- فروشگاه فارسی، **RTL کامل**، فونت Vazirmatn، قیمت به تومان، اعداد فارسی.
- Stack: Next.js (App Router) · TypeScript · Tailwind CSS v4 · Lucide · Framer Motion · Three.js + React Three Fiber + Drei.
- وضعیت: **فاز Demo** (دادهٔ mock، بدون Backend و پرداخت واقعی). تا تأیید صریح صاحب پروژه روی Design System و Demo، وارد پیاده‌سازی کامل فروشگاه نشو.

## معماری
```
app/            مسیرها (فقط composition؛ بدون منطق سنگین)
components/     UI عمومی (ui/, layout/, product/)
features/       ماژول‌های دامنه (home, catalog, cart, showcase, admin)
3d/             صحنه‌ها و مدل‌های procedural (فقط با dynamic import)
lib/            توابع خالص و business (format, pricing, 3d-capability)
hooks/          هوک‌های مشترک
data/           دادهٔ mock (جایگزین API در آینده)
styles/         tokens.css و استایل‌های سراسری
types/          نوع‌های TypeScript مشترک
public/         استاتیک (public/3d برای glb فشرده)
```
- منطق Business (قیمت، تخفیف، جمع سبد، فیلتر) در `lib/` یا `features/*/` (store/selectors) است، **نه داخل کامپوننت‌های UI**.
- کامپوننت‌های UI فقط props می‌گیرند و render می‌کنند.

## قوانین RTL
- فقط logical properties (`ms/me/ps/pe/start/end/text-start`). `ml/mr/pl/pr/left/right` ممنوع.
- آیکون‌های جهت‌دار را در RTL درست کن (`rtl-flip`).
- لاتین/عدد انگلیسی داخل فارسی: `<bdi>` یا `dir="ltr"`.
- اعداد و قیمت فقط با `lib/format.ts`.
- `letter-spacing` همیشه 0 (فارسی متصل است).

## قوانین 3D / Performance
- `three`/`@react-three/*` را فقط داخل `3d/` و فقط با `next/dynamic({ ssr: false })` import کن؛ هرگز در `layout.tsx`.
- فقط یک Canvas فعال در هر زمان؛ بیرون از viewport متوقف شود.
- همیشه fallback دو‌بعدی (`ProductArt`) داشته باش؛ از `useCanUse3D` استفاده کن.
- هیچ asset خارجی (HDR/CDN) بارگذاری نکن.
- `prefers-reduced-motion` را رعایت کن.

## Accessibility
Focus visible، `aria-label` فارسی روی دکمه‌های آیکونی، touch target ≥ 44px، کنتراست ≥ 4.5، Drawer/Modal با focus-trap و Esc.

## دستورها
```bash
npm run dev        # توسعه
npm run build      # بیلد production
npm run typecheck  # بررسی نوع‌ها
```
قبل از commit: `npm run typecheck && npm run build`.

## Git
Branch کاری: `claude/premium-mobile-accessories-shop-ljsled`. بدون درخواست صریح PR نساز.
