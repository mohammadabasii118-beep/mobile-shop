# DESIGN.md — سیستم طراحی «ولتا» (Volta)

> **Single Source of Truth برای تمام UI این پروژه.**
> قبل از ساخت یا تغییر هر UI این فایل را بخوان. اگر الگوی جدیدی لازم است، اول همین‌جا اضافه کن، بعد کد بزن.
> Tokenها در `styles/tokens.css` پیاده‌سازی شده‌اند و از طریق Tailwind (`@theme`) در دسترس‌اند.

---

## 0. منبع الهام (Design Research)

از `VoltAgent/awesome-design-md` این سیستم‌ها بررسی شد. هدف کپی نبود؛ فقط اصول زیر استخراج و برای فروشگاه لوازم جانبی موبایل ترکیب شد:

| منبع | اصل برداشت‌شده | چگونه در ولتا اعمال شد |
|---|---|---|
| **Nike** | عکس محصول قهرمان است و UI عقب می‌نشیند. CTA گرد (pill). محصول روی «صحنهٔ» خاکستری روشن. قرمز فقط برای قیمت/تخفیف. | `stage` token، دکمه‌های pill، `discount` فقط روی قیمت و نشان تخفیف |
| **Apple** | یک accent واحد. سایه فقط برای خود محصول. تناوب بخش‌های تیره/روشن به‌جای خط جداکننده. | یک accent (`volt`)، `shadow-product`، بخش‌های `surface-dark` / روشن به‌صورت متناوب |
| **Linear / Vercel** | سطوح پلکانی (surface ladder) + hairline به‌جای سایه. سایهٔ لایه‌ای ظریف. Mono برای برچسب‌های فنی. | تمام Admin، `border` ۱px، `shadow-card` لایه‌ای |
| **Shopify / Framer** | بوم تیرهٔ سینمایی، تیتر بزرگ، یک CTA در هر بخش، فقط یک رنگ برجسته. | Hero تیره، یک CTA اصلی در هر بخش |
| **Stripe** | ارقام tabular برای مبالغ، نور اتمسفریک (mesh) در پس‌زمینهٔ هیرو. | `.num` / `.price`، نور رادیال محو پشت محصول 3D |

### سازگاری با فارسی (تصمیم مهم)
Apple/Vercel/Framer از **letter-spacing منفی** برای تیترها استفاده می‌کنند. در خط فارسی (متصل) این کار حروف را از هم جدا و ناخوانا می‌کند.
**قانون:** `letter-spacing` همیشه `0` است. «فشردگی» تیتر را با **اندازهٔ بزرگ‌تر، وزن بالا و line-height دقیق** می‌سازیم، نه tracking.
همچنین فارسی ascender/descender بلندتری دارد؛ line-height تیتر هرگز زیر `1.2` نمی‌رود.

---

## 1. Brand

- **نام:** ولتا (Volta) — لوازم جانبی موبایل
- **Personality:** دقیق، آرام، فنی، مطمئن. مثل یک ابزار خوب: ساده، سنگین، بی‌ادعا.
- **Tone فارسی:** کوتاه، محاوره‌ای-معیار، بدون اغراق. «قاب‌هایی که با گوشی‌ات یکی می‌شوند.» نه «بهترین قیمت‌ها با تخفیف‌های ویژه!!!»
- **Visual direction:** Premium / Tech / Minimal. تیره و سینمایی در لحظه‌های «هیرو»، روشن و آرام در لحظه‌های «خرید».
- **Minimalism:** هر بخش یک پیام + یک CTA. فضای خالی ویژگی است، نه نقص.
- **Photography direction:**
  - محصول تنها، روی صحنهٔ بی‌رنگ (`stage`)، نور نرم از بالا-چپ، سایهٔ تماسی ملایم.
  - زاویهٔ ۳/۴ برای تصویر اصلی؛ تصویر دوم (hover) زاویهٔ پشت یا جزئیات.
  - بدون دست، بدون پس‌زمینهٔ شلوغ، بدون ریتوش رنگی. رنگ محصول تنها رنگ تصویر است.
  - فعلاً تصاویر با `ProductArt` (تصویرسازی برداری) و مدل‌های procedural 3D جایگزین شده‌اند؛ هنگام عکاسی واقعی همین نسبت‌ها و صحنه حفظ شود.

---

## 2. Colors

دو «سطح» (surface) داریم. کامپوننت‌ها فقط از **tokenهای معنایی** استفاده می‌کنند و با تغییر کلاس `surface-dark` / `surface-light` خودکار تغییر می‌کنند. **هرگز hex خام در کامپوننت ننویس.**

| Token | CSS var | Tailwind | Light | Dark | کاربرد |
|---|---|---|---|---|---|
| Background | `--bg` | `bg-bg` | `#F5F5F2` | `#0A0B0D` | بوم صفحه |
| Surface | `--surface` | `bg-surface` | `#FFFFFF` | `#121316` | کارت، پنل |
| Surface Elevated | `--elevated` | `bg-elevated` | `#FFFFFF` | `#1A1C20` | drawer، modal، popover |
| Stage | `--stage` | `bg-stage` | `#ECEBE6` | `#17191D` | پس‌زمینهٔ تصویر محصول |
| Text | `--fg` | `text-fg` | `#0E0F11` | `#F4F4F1` | متن اصلی |
| Muted Text | `--muted` | `text-muted` | `#62646A` | `#9A9CA3` | متن ثانویه (کنتراست ≥ 4.5) |
| Border | `--line` | `border-line` | `#E2E1DB` | `#25272C` | hairline ۱px |
| Primary | `--primary` | `bg-primary` | `#0E0F11` | `#F4F4F1` | CTA اصلی (pill مشکی/سفید) |
| Primary FG | `--primary-fg` | `text-primary-fg` | `#FFFFFF` | `#0A0B0D` | متن روی primary |
| Secondary | `--secondary` | `bg-secondary` | `#ECEBE6` | `#1F2125` | دکمهٔ ثانویه، chip |
| **Accent (Volt)** | `--accent` | `bg-accent` | `#C8F135` | `#C8F135` | **تنها** رنگ برجسته |
| Accent FG | `--accent-fg` | `text-accent-fg` | `#0E0F11` | `#0E0F11` | متن روی accent |
| Success | `--success` | `text-success` | `#0B7F55` | `#3DDC97` | موجود، موفق |
| Warning | `--warning` | `text-warning` | `#A8660A` | `#F5B942` | کم‌موجود |
| Error | `--danger` | `text-danger` | `#C8281C` | `#FF6B60` | خطا، ناموجود |
| Discount | `--discount` | `text-discount` | `#D92D20` | `#FF5A4F` | **فقط** قیمت قدیمی/درصد تخفیف |

**قواعد رنگ**
1. Primary = مشکی/سفید (مثل Nike/Apple). **Accent (Volt)** رنگ «انرژی» است: حالت انتخاب‌شده، badge «جدید»، focus ring، نقطهٔ زنده، نور 3D. هرگز رنگ متن روی پس‌زمینهٔ روشن نیست (کنتراست ندارد).
2. فقط یک رنگ برجسته. رنگ دوم اضافه نکن.
3. `discount` فقط روی قیمت/درصد تخفیف، هرگز پس‌زمینهٔ بزرگ.
4. رنگ‌های محصول (swatch) خارج از سیستم هستند و فقط روی swatch و محصول دیده می‌شوند.
5. Gradient فقط یک نوع: **نور رادیال محو** پشت محصول هیرو (`.glow`). گرادیان دیگری مجاز نیست.

---

## 3. Typography

**فونت:** Vazirmatn (Variable) — `@fontsource-variable/vazirmatn`. تنها فونت پروژه؛ سلسله‌مراتب با اندازه و وزن ساخته می‌شود.

| Role | کلاس | اندازه (mobile → desktop) | وزن | line-height | کاربرد |
|---|---|---|---|---|---|
| Display | `.t-display` | `clamp(2.5rem, 7vw, 5rem)` | 800 | 1.15 | فقط تیتر Hero |
| Heading 1 | `.t-h1` | `clamp(2rem, 4.5vw, 3.5rem)` | 800 | 1.2 | عنوان بخش‌ها |
| Heading 2 | `.t-h2` | `clamp(1.5rem, 3vw, 2.25rem)` | 700 | 1.3 | عنوان زیربخش |
| Heading 3 | `.t-h3` | `1.125rem → 1.25rem` | 700 | 1.4 | عنوان کارت |
| Body | `.t-body` | `1rem (16px)` | 400 | 1.9 | متن توضیحی |
| Body Small | `.t-small` | `0.875rem` | 400 | 1.7 | متن فشرده |
| Caption | `.t-caption` | `0.8125rem (13px)` | 500 | 1.6 | برچسب، متادیتا |
| Eyebrow | `.t-eyebrow` | `0.8125rem` | 600 | 1.4 | بالای تیتر؛ Latin به‌صورت mono-ish uppercase |
| Price | `.price` | `1rem → 1.875rem` | 700 | 1.2 | قیمت‌ها (ارقام Vazirmatn ذاتاً هم‌عرض‌اند؛ `tabular-nums` فقط برای ستون‌های جدول با `.num`) |
| Numbers | `.num` | — | — | — | `font-variant-numeric: tabular-nums` (جدول، KPI، شمارنده) |

**قواعد**
- `letter-spacing: 0` همه‌جا (بخش ۰).
- اعداد در UI **فارسی** (۱۲۳) با `Intl.NumberFormat('fa-IR')` نمایش داده می‌شوند — فقط از `lib/format.ts` استفاده کن.
- قیمت: عدد با جداکنندهٔ هزارگان + «تومان» کوچک‌تر کنار آن (`<Price />`). قیمت قدیمی خط‌خورده و `discount`.
- نام برند/مدل لاتین (iPhone 17 Pro) داخل `<bdi>` یا `dir="ltr"` تا ترتیب کلمات در RTL نشکند.
- متن فقط وزن‌های 400 / 500 / 600 / 700 / 800.

---

## 4. Spacing

پایه ۴px (Tailwind پیش‌فرض). فقط از این مقادیر استفاده کن:

| Token | px | کاربرد |
|---|---|---|
| `1` | 4 | فاصلهٔ آیکون-متن |
| `2` | 8 | فاصلهٔ درون گروه‌های کوچک |
| `3` | 12 | gap بین chipها |
| `4` | 16 | padding کارت موبایل، gutter موبایل |
| `6` | 24 | padding کارت، gutter دسکتاپ |
| `8` | 32 | فاصلهٔ بین بلوک‌ها |
| `12` | 48 | فاصلهٔ بین عنوان بخش و محتوا |
| `section` | `clamp(64px, 10vw, 128px)` | padding عمودی بخش‌ها (`py-section`) |

- **Container:** `max-width: 1440px`، gutter ۱۶px (mobile) / ۲۴px (md) / ۴۰px (xl). کلاس `.container-x`.
- **Grid محصول:** ۲ ستون (mobile) → ۳ (md) → ۴ (lg).
- **Touch target:** حداقل ۴۴×۴۴px (`min-h-11`).

---

## 5. Radius

| Token | px | Tailwind | کاربرد |
|---|---|---|---|
| `xs` | 6 | `rounded-xs` | badge کوچک، tag |
| `sm` | 10 | `rounded-sm` | ورودی‌های کوچک، swatch مربع |
| `md` | 14 | `rounded-md` | **Input**، dropdown |
| `lg` | 20 | `rounded-lg` | **Card**، تصویر محصول |
| `xl` | 28 | `rounded-xl` | **Modal / Drawer**، پنل‌های بزرگ |
| `2xl` | 36 | `rounded-2xl` | **Container** (بخش‌های کارتی بزرگ، stage هیرو) |
| `pill` | 9999 | `rounded-full` | **Button**، chip، badge، search |

**قاعده:** دکمه همیشه pill (مثل Nike/Shopify). سومین شکل دکمه (مستطیل گرد) ممنوع؛ فقط pill و دایره (icon button). Input = `md`. کارت = `lg`. تصویر داخل کارت `rounded-lg` با padding صفر نسبت به کارت (کارت = تصویر + متن زیر آن، بدون قاب اضافه).

---

## 6. Shadows / Elevation

عمق در درجهٔ اول از **سطح (surface ladder) + hairline** می‌آید، نه سایه (Linear/Nike). سایه فقط سه نوع دارد و همیشه نرم، لایه‌ای و کم‌پخش:

| Token | Tailwind | مقدار | کاربرد |
|---|---|---|---|
| `shadow-hairline` | `shadow-hairline` | `0 0 0 1px var(--line)` | کارت‌های ساکن (جایگزین border) |
| `shadow-card` | `shadow-card` | `0 1px 2px rgb(14 15 17 / .04), 0 12px 24px -16px rgb(14 15 17 / .18)` | hover کارت، dropdown |
| `shadow-float` | `shadow-float` | `0 2px 4px rgb(14 15 17 / .05), 0 32px 64px -24px rgb(14 15 17 / .35)` | drawer، modal |
| `shadow-product` | `.product-shadow` | سایهٔ تماسی بیضی زیر محصول | **فقط** تصویر/مدل محصول (مثل Apple) |

در سطح تیره سایه تقریباً دیده نمی‌شود؛ تمایز با `--surface`/`--elevated` + hairline انجام می‌شود. سایهٔ سنگین، `drop-shadow` رنگی و glow روی UI ممنوع (glow فقط پشت محصول هیرو).

---

## 7. RTL (از ابتدا، نه در انتها)

- `<html lang="fa" dir="rtl">` در `app/layout.tsx`.
- **فقط Logical Properties:** `ms-*`/`me-*`، `ps-*`/`pe-*`، `start-*`/`end-*`، `text-start`/`text-end`، `border-s`/`border-e`، `rounded-s-*`/`rounded-e-*`. استفاده از `ml/mr/pl/pr/left/right/text-left/text-right` **ممنوع** مگر دلیل ثابت (مثل کنترل 3D).
- آیکون‌های جهت‌دار (فلش، chevron) با کلاس `rtl-flip` یا انتخاب آیکون درست برگردانده می‌شوند. «بعدی» در RTL به سمت **چپ** است.
- Carousel/scroller: `scroll-snap` با `inline-start`؛ اسکرول از راست شروع می‌شود.
- Cart Drawer از سمت **end** باز می‌شود (چپ صفحه در RTL)؛ فیلتر موبایل از پایین (Bottom Sheet).
- Framer Motion: جهت‌ها را با `dir` محاسبه کن (`const sign = isRtl ? -1 : 1`) و x ثابت ننویس.
- Navigation موبایل: Bottom navigation با ترتیب RTL (اولین آیتم سمت راست).
- متن لاتین/عدد انگلیسی داخل متن فارسی: `<bdi>` یا `dir="ltr"`.

---

## 8. Components (الگوهای تثبیت‌شده)

| کامپوننت | مکان | نکات |
|---|---|---|
| Button | `components/ui/button.tsx` | variantها: `primary` (مشکی/سفید)، `accent` (volt، فقط یک بار در هر بخش)، `secondary`، `ghost`، `outline`. اندازه‌ها: `sm`(40) `md`(48) `lg`(56) `icon`(44). فشردن: `scale(.97)` |
| Badge / Chip | `components/ui/badge.tsx` | pill، `xs` متن، تغییر رنگ فقط با variant |
| Price | `components/ui/price.tsx` | تنها راه نمایش قیمت |
| Rating | `components/ui/rating.tsx` | ستارهٔ تکی + عدد (نه ردیف ۵ ستاره) برای کم‌نویزی |
| Product Card | `features/catalog/product-card.tsx` | تصویر روی `stage` بدون padding کارت، متن زیر تصویر. Hover: تصویر دوم + نوار Quick Add از پایین |
| Product Art | `components/product/product-art.tsx` | fallback دو‌بعدی و تصویر پیش‌فرض تا زمان عکاسی |
| Section Header | `components/ui/section-header.tsx` | eyebrow + h1 + لینک «مشاهدهٔ همه» |
| Cart Drawer | `components/layout/cart-drawer.tsx` | از `end` باز می‌شود، focus-trap، Esc |

**Hover/Press:** کارت `translateY(-2px)` + `shadow-card`؛ دکمه `scale(.97)` در active. بدون glow، بدون چرخش.

---

## 9. 3D Experience

اصل: **3D فقط جایی که به تصمیم خرید کمک می‌کند.**

| جا | دلیل UX | رفتار |
|---|---|---|
| Hero | نشان‌دادن مادیت و کیفیت محصول شاخص | شناور، واکنش به موس (parallax)، اسکرول = چرخش کم |
| Showcase | بررسی محصول از همهٔ زوایا و رنگ‌ها قبل از خرید | drag برای چرخش ۳۶۰°، zoom، swatch رنگ، تغییر variant |
| Configurator قاب | دیدن نتیجهٔ ترکیب مدل/رنگ/متریال | تغییر زنده، قیمت متناسب |
| صفحهٔ محصول | جایگزین/مکمل گالری | همان Viewer، با tab «۳D» |

**بودجه و قوانین عملکرد**
1. `three`/R3F/drei فقط در chunk‌های `dynamic(() => import(...), { ssr: false })` — هرگز در layout یا صفحاتی که 3D ندارند.
2. فقط **یک Canvas فعال** در هر زمان. Canvas بیرون از viewport با `IntersectionObserver` به `frameloop="never"` می‌رود (یا unmount).
3. `dpr` محدود: دسکتاپ `[1, 2]`، موبایل `[1, 1.5]`. `antialias` همیشه روشن (فقط یک Canvas فعال است؛ لبهٔ دندانه‌دار در موبایل کیفیت را خراب می‌کند).
4. مدل‌ها procedural و کم‌پلی‌گان‌اند (`RoundedBox` با segments کم). مدل‌های واقعی: فقط `.glb` فشرده (Draco/Meshopt + KTX2)، حداکثر ~۳۰۰KB برای هر مدل، در `public/3d/`.
5. نورپردازی با `Lightformer` محلی؛ **هیچ HDR/CDN خارجی** بارگذاری نمی‌شود.
6. `prefers-reduced-motion` ⇒ بدون شناوری/auto-rotate؛ فقط drag دستی.
7. **Fallback (`useCanUse3D`):** بدون WebGL، `saveData`، `deviceMemory ≤ 2`، `hardwareConcurrency ≤ 2`، یا خطای Canvas ⇒ `ProductArt` دو‌بعدی. هیچ صفحه‌ای بدون مدل 3D خراب نمی‌شود.
8. Suspense با اسکلت هم‌ابعاد (بدون layout shift).
9. موبایل: شناوری کم، بدون سایه‌های real-time، geometry ساده‌تر (`quality = 'low'`).

---

## 10. Motion (Framer Motion)

Subtle · Smooth · Purposeful. هر انیمیشن باید پاسخ بدهد: «به کاربر چه چیزی را نشان می‌دهد؟»

| Token | مقدار |
|---|---|
| `ease-out-expo` | `[0.22, 1, 0.36, 1]` |
| `duration-fast` | 150ms — hover، press |
| `duration-base` | 280ms — تغییر حالت |
| `duration-slow` | 600ms — reveal بخش‌ها |
| `spring-ui` | `{ type: 'spring', stiffness: 380, damping: 32 }` — drawer، layout |

الگوها: scroll reveal (`y: 16 → 0` + opacity، `once`)، Cart drawer (spring از end)، تغییر قیمت/عدد (`AnimatedNumber`: slide عمودی ۸px)، تغییر فیلتر (`layout` + `AnimatePresence`)، افزودن به سبد (دکمه → ✓ + badge سبد bump).
**ممنوع:** حرکت دائمی در متن، parallax شدید، bounce، چرخش آیکون‌های تزئینی. همهٔ حرکت‌ها زیر `prefers-reduced-motion` خاموش یا به fade ساده تبدیل می‌شوند (`MotionConfig reducedMotion="user"` + `useReducedMotion`).

---

## 11. Layout Patterns

- **Hero:** تیره (`surface-dark`)، تیتر چپ‌چین‌نشده — در RTL تیتر سمت **راست**، محصول 3D سمت چپ. یک CTA اصلی (accent) + یک ثانویه (outline). نور رادیال محو. بدون بنر.
- **تناوب بخش‌ها:** تیره → روشن → روشن → تیره… جدا‌کننده، تغییر رنگ سطح است، نه خط.
- **Category:** کاشی‌های بزرگ نامتقارن (bento) با تصویرسازی محصول؛ نه آیکون‌های دایره‌ای تکراری.
- **Product page:** گالری/3D (۷ ستون) + اطلاعات sticky (۵ ستون) در دسکتاپ؛ stack در موبایل با نوار «افزودن به سبد» چسبیده به پایین.
- **Admin:** تیره، sidebar سمت **راست** (RTL)، سطوح پلکانی + hairline، چگالی بالاتر (padding کارت ۱۶–۲۰)، ارقام tabular، چارت تک‌رنگ (accent) با خط‌های راهنمای کم‌رنگ.

## 12. Responsive

Mobile-first. breakpoint: `sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`.
- Mobile: header ساده (منو، لوگو، سبد)، Bottom nav (خانه، دسته‌ها، جستجو، سبد، حساب)، فیلتر Bottom Sheet، 3D سبک، CTA تمام‌عرض.
- Tablet: grid ۳ ستون، nav جمع‌شده.
- Desktop: nav کامل، sidebar فیلتر، hover states.
- Large: container قفل ۱۴۴۰px، تیتر Display تا ۸۰px.

## 13. Accessibility

- Focus: ring ۲px + offset ۲px (`:focus-visible`)؛ روی سطح تیره `accent`، روی سطح روشن `fg` (accent روی سفید کنتراست ندارد)؛ هرگز `outline: none` بدون جایگزین.
- همهٔ کنترل‌های آیکونی `aria-label` فارسی دارند.
- Drawer/Modal: `role="dialog"`, `aria-modal`, focus trap، Esc، بازگرداندن focus.
- Viewer 3D: `role="img"` با توضیح + کنترل کیبورد (فلش‌ها = چرخش، +/- = zoom) + دکمهٔ «نمای ثابت».
- کنتراست متن ≥ 4.5:1؛ اجزای UI ≥ 3:1.
- Skip link «پرش به محتوا».
- `prefers-reduced-motion` رعایت می‌شود.

---

## 14. Do / Don't

**Do** — محصول را قهرمان کن · یک CTA اصلی در هر بخش · tokenها · logical properties · `Price`/`format.ts` · سطح به‌جای سایه.
**Don't** — gradient تزئینی · glassmorphism (فقط blur سبک و تک‌لایه برای header چسبان) · سایهٔ سنگین · کارت‌های کپی‌شدهٔ بدون سلسله‌مراتب · رنگ/radius/فونت جدید بدون به‌روزرسانی این فایل · `letter-spacing` منفی · `left/right`.

---

## 15. Changelog

- v0.1 — تعریف اولیهٔ سیستم و Demo (Home، Header، Hero، Categories، Product Card، 3D Showcase، Product Detail Preview، Cart Drawer، Admin Dashboard).
