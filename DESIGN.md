---
version: 1.0
name: CaseLine Design System
description: "Dark, premium, Persian-first (RTL) design system for the CaseLine phone-case & accessories store. Dark studio canvas, white pill CTAs, controlled violet/pink/orange gradient cards, borderless editorial product tiles, dense Linear/Vercel-style admin."
lang: fa
dir: rtl
colors:
  canvas: "#0C0C0C"          # page background (brand)
  surface-1: "#141416"       # panels, inputs, secondary buttons
  surface-2: "#1C1C1F"       # product tiles, selected chips, hover of surface-1
  surface-3: "#26262B"       # pressed / deepest lift, tooltips
  hairline: "#26262B"        # 1px borders
  hairline-soft: "#1A1A1E"   # row dividers, footer rules
  ink: "#FFFFFF"             # headings, prices, primary-button surface
  text: "#D7E2EA"            # DEFAULT body text (brand light text)
  text-muted: "#868C91"      # = #D7E2EA @ 60% on canvas — secondary text
  text-subtle: "#5D6265"     # = #D7E2EA @ 40% — placeholders, disabled
  on-primary: "#0C0C0C"      # text on white pill
  accent-blue: "#0099FF"     # links, focus ring, selected indicator ONLY
  violet: "#7357F6"
  pink: "#EC4899"            # "سرخابی"
  orange: "#FF8A3D"
  success: "#22C55E"
  warning: "#FFB020"
  danger: "#FF5577"          # discount %, errors, out-of-stock
  focus-ring: "0 0 0 1px #0099FF, 0 0 0 4px rgba(0,153,255,.18)"
gradients:
  brand: "linear-gradient(100deg, #7357F6 0%, #EC4899 55%, #FF8A3D 100%)"   # text accent, logo mark, progress fill, chart area
  spot-violet: "radial-gradient(120% 100% at 80% 0%, #8E78FF, #7357F6 55%, #3E2AB5)"
  spot-pink: "radial-gradient(120% 100% at 20% 0%, #F472B6, #EC4899 55%, #9D1F62)"
  spot-orange: "radial-gradient(120% 100% at 80% 0%, #FFA66B, #FF8A3D 55%, #C24A14)"
typography:
  family: "Vazirmatn, system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif"
  display-xl: { size: 88px, mobile: 44px, weight: 900, line: 1.0 }
  display-lg: { size: 64px, mobile: 36px, weight: 900, line: 1.05 }
  display-md: { size: 40px, mobile: 28px, weight: 800, line: 1.15 }
  h1:         { size: 32px, mobile: 26px, weight: 800, line: 1.3 }
  h2:         { size: 24px, mobile: 20px, weight: 800, line: 1.4 }
  h3:         { size: 18px, mobile: 17px, weight: 700, line: 1.5 }
  body-lg:    { size: 18px, mobile: 16px, weight: 400, line: 1.9 }
  body:       { size: 15px, mobile: 15px, weight: 400, line: 1.8 }
  body-sm:    { size: 14px, mobile: 14px, weight: 500, line: 1.7 }
  caption:    { size: 12px, mobile: 12px, weight: 500, line: 1.6 }
  price-lg:   { size: 28px, mobile: 24px, weight: 900, line: 1.2 }
  price:      { size: 15px, mobile: 14px, weight: 800, line: 1.4 }
  button:     { size: 14px, mobile: 14px, weight: 600, line: 1.0 }
  letter-spacing: 0          # ALWAYS 0 for Persian (see §3)
spacing: { 1: 4px, 2: 8px, 3: 12px, 4: 16px, 5: 20px, 6: 24px, 8: 32px, 10: 40px, 14: 56px, 18: 72px, 24: 96px }
rounded: { xs: 4px, sm: 6px, md: 10px, lg: 14px, xl: 20px, xxl: 30px, pill: 100px, full: 9999px }
shadows:
  0: "none"
  1: "inset 0 0.5px 0 rgba(255,255,255,.08)"
  2: "inset 0 0.5px 0 rgba(255,255,255,.10), 0 10px 30px rgba(0,0,0,.35)"
  3: "0 24px 60px rgba(0,0,0,.55)"
motion: { fast: 150ms, base: 250ms, slow: 450ms, ease: "cubic-bezier(.22,1,.36,1)", press: "scale(.95)" }
breakpoints: { sm: 480px, md: 810px, lg: 1024px, xl: 1280px }
container: { max: 1280px, gutter-mobile: 16px, gutter-tablet: 24px, gutter-desktop: 40px }
---

# CaseLine Design System

CaseLine is a Persian, RTL, dark, premium phone-case store. This file is the **single source of truth** for UI. It is an original synthesis, not a copy:

| Borrowed principle | From | Used for |
|---|---|---|
| Near-black artboard, white pill CTAs, charcoal secondary pills, gradient "spotlight" cards, one blue signal color | **Framer** | Global look, hero, category tiles, buttons |
| Photography-first product tile, flat/borderless product cards, filter rail, filter chips, sale-only color, 2-up mobile grid, off-canvas filter | **Nike** | Product card, grid, filters, badges, price |
| Surface ladder instead of shadows, dense tables, status pills, quiet chrome | **Linear** | Admin surfaces, tables, status |
| Hairline-driven layout, underline tabs, breadcrumbs, command search, calm density | **Vercel** | Admin navigation and data screens |
| Everything else (RTL, Vazirmatn, tomans, Persian line-heights, gradient budget, stock states) | **CaseLine** | Original |

---

## 1. Visual Theme

- **Dark studio.** `canvas #0C0C0C` is the room; products are the lights. Chrome is almost invisible, products and gradient spotlight cards carry the color.
- **Premium restraint.** Neutral UI + *one* chromatic moment per viewport. If two gradient cards and a gradient headline are on screen, remove one.
- **Young, tech, fashion.** Huge heavy Persian headlines, generous space, soft pill geometry.
- No light-mode storefront. (Admin is dark too.)

## 2. Color Rules

**Surface ladder (hierarchy by lift, never by shadow):** `canvas → surface-1 → surface-2 → surface-3`. A child is exactly one step above its parent.

| Role | Token |
|---|---|
| Page | `canvas` |
| Panels, forms, drawers, secondary buttons | `surface-1` |
| Product image tile, selected chip, hover on surface-1 | `surface-2` |
| Pressed, tooltips, nested-in-nested | `surface-3` |
| Headings, prices, icons on dark | `ink #FFF` |
| Default body text | `text #D7E2EA` |
| Meta, captions, inactive tabs | `text-muted` |
| Placeholder, disabled | `text-subtle` |

**Chromatic budget**
- **Brand gradient family** (violet → pink → orange) is allowed **only** on: (a) spotlight cards (`spot-violet/pink/orange`), (b) one accent word in a hero headline, (c) logo mark, (d) free-shipping/progress fill, (e) chart area fills in admin. **Never** on buttons, section backgrounds, body text, nav, or inputs.
- Max **2 spotlight cards per viewport**. Never 3 in one row.
- **accent-blue** = links, focus ring, selected-thumbnail ring. Never a fill.
- **danger #FF5577** = discount %, validation errors, out-of-stock, destructive. It is the only "sale" color (Nike rule): the *price itself stays white*, the `٪ تخفیف` pill is danger.
- **success** = in stock, paid, delivered. **warning** = low stock, pending.
- Contrast: `text`/`ink` on canvas and surfaces ≥ 7:1; `text-muted` ≥ 4.5:1. Never put `text-subtle` on anything that must be read.

## 3. Typography (Persian)

- **Font:** Vazirmatn 300–900 (loaded from Google Fonts, fallback system). Latin text (CaseLine wordmark, SKUs, order IDs, brand names) uses the same family.
- **Letter-spacing is `0` for all Persian text.** Negative tracking breaks Arabic-script joining. Poster feel comes from **size + weight 800/900 + tight line-height (1.0–1.15)**. Only the Latin wordmark may use `-0.5px`.
- **Persian line-heights are larger than Latin**: body 1.8, captions 1.6. Headings 1.0–1.4. Never set Persian body below 1.6.
- **Digits:** Persian digits (`Intl.NumberFormat('fa-IR')`) everywhere user-facing. SKUs, order IDs, phone/zip inputs, and codes stay Latin digits inside `dir="ltr"` spans.
- **Scale:** use only the tokens in the front matter. Display tiers are for hero/campaign moments only; product names are `body-sm` 600 or `h3`.
- Text wraps with `text-wrap: balance` on headings. Product names clamp to 2 lines.
- Weight rhythm: 900 (display/prices) · 800 (headings) · 600 (buttons, names) · 400/500 (body).

## 4. Layout & Spacing

- 4px base grid; use spacing tokens only.
- **Container** 1280px max, gutters 16 / 24 / 40 (mobile / tablet / desktop).
- **Section rhythm:** 96px desktop · 64px tablet · 48px mobile. Sections are separated by space, not dividers.
- Section header = eyebrow (blue, `caption`) + display/H1 + optional `body-lg` text max 52ch.
- **Product grid:** ≥1280 → 4 columns, gap 20 · 810–1279 → 3 columns, gap 16 · <810 → **2 columns**, gap 12 (never 1 column for products).
- **Category grid:** 3 → 2 → 2 columns; first tile may be a spotlight card.
- Hero: copy on the start (right) side, spotlight cards/3D on the end (left) side; stacks on tablet/mobile with copy first.

## 5. Elevation & Radius

- Hierarchy = surface lift. Shadows exist only at: level 1 (top edge highlight on cards), level 2 (floating: popovers, sticky bars), level 3 (modals, sheets).
- **Radius:** inputs `md 10` · product image tile `lg 14` · panels/cards `xl 20` · spotlight cards, modals, bottom sheets `xxl 30` · every CTA and chip `pill` · icon buttons `full`. No square buttons. No radius below `xs`.

## 6. Components

### 6.1 Buttons (pill vocabulary — nothing else)
| Variant | Spec |
|---|---|
| **primary** | bg `ink`, text `on-primary`, pill, 600. **One per viewport.** Hover bg `#E8E8E8`. |
| **secondary** | bg `surface-1`, text `ink`, pill. Hover `surface-2`. |
| **translucent** | bg `surface-2`, radius `xxl`, for use on busy/gradient backgrounds. |
| **on-spotlight** | white pill on gradient cards (same as primary). |
| **text link** | `text-muted` → `ink` on hover, underline only on inline links. |
| **icon** | 40px circle (44px on touch), bg `surface-1`, icon `ink`. |
| **danger** | secondary pill with `danger` text; confirmation step required. |
- Sizes: **lg** 52h/26px pad (hero, checkout), **md** 44h/18px pad (default), **sm** 36h (admin tables, desktop only).
- States: pressed `scale(.95)`; focus `focus-ring`; disabled 40% opacity, no pointer events; loading = spinner replaces label, width fixed.
- Add-to-cart on product tiles is an **icon circle** (white, 40px), not a text button.

### 6.2 Inputs & Forms
- bg `surface-1`, 1px `hairline`, radius `md`, min-height 44px, padding 10×14, text 15px `ink`.
- Placeholder `text-subtle`. Label above, 13px 600 `text-muted`.
- Focus: border `accent-blue` + `focus-ring`. Error: border `danger` + message below in `danger` 12px. Success: no green border; optional check icon.
- On panels (`surface-1`) inputs sit on `canvas` color.
- Select: custom chevron on the **end** (left) side. Toggle: 44×26 pill, on = `violet`; knob rests at the **start (right)** when off and travels to the **end (left)** when on (the mirror of LTR).
- Search field: pill (radius 100), icon at start (right).
- Phone, email, zip, card inputs: `dir="ltr"` with `text-align: right`.
- Checkbox/radio: 20px, `surface-2` fill, on = `ink` fill with `on-primary` check.

### 6.3 Navigation
- **Header (desktop):** height 64 (56 when scrolled), `canvas` @ 85% + blur, 1px `hairline-soft` bottom once scrolled. **RTL order, start→end:** logo (right) · primary links · search / account / wishlist / cart (left). Cart badge = 16px violet circle at the top-**start** corner of the icon.
- Links: 14px 500, `text-muted`; active/hover = `ink` on `surface-1` pill.
- **Header (mobile ≤ 810):** logo · search · cart · hamburger; hamburger opens a **full-width drawer** (`surface-1`, slides from the start/right side, links 18px 700, 56px rows).
- **Mobile bottom bar (optional, storefront only):** 64px + safe-area, 5 items (خانه، دسته‌ها، جستجو، سبد، حساب), `canvas` @ 92% + blur, active = `ink` icon + label, inactive `text-muted`. Hidden on checkout and PDP (PDP has the sticky buy bar).
- **Breadcrumb:** caption, `text-muted`, `/` separator, current page `ink`.
- **Pagination / load-more:** secondary pill "نمایش بیشتر".
- **Footer:** `canvas`, 1px `hairline-soft` top, 4 columns → 2 on tablet/mobile (brand+newsletter spans full width), links 13px `text-muted`, copyright centered caption.

### 6.4 Product UI (Nike-inspired, CaseLine-tuned)

**Product tile / card** — *flat and borderless: the photo is the card.*
```
┌────────────────────┐  image tile: aspect 1:1, bg surface-2, radius lg (14)
│ [badge] [badge]  ♡ │  badges top-start (right), wishlist icon-button top-end (left)
│                    │
│      product       │  product art centered with 8% padding
│                    │
│               (＋) │  quick-add white icon circle, bottom-end; hover-visible on
└────────────────────┘  desktop, ALWAYS visible on touch
 ● ● ○ ○                 color swatches 12px (max 4 + "+n")
 قاب ضدضربه آیفون ۱۶ پرو   name: body-sm 600, ink, 2-line clamp, min-height 2 lines
 قاب گوشی · ★ ۴٫۸ (۱۶۸)   caption, text-muted
 ۵۹۰٬۰۰۰ تومان   ٪۱۸      price (ink 800) + old price (muted, strike) + discount pill
 ● موجود / فقط ۳ عدد       stock line (caption)
```
- No outer border, no card background, no padding around the text block. Gap image→text 12px, between rows 4–6px.
- Hover (desktop): image scales 1.06 inside the clipped tile (450ms), tile → `surface-3` hint via 10% white overlay; **no translateY lift** and no shadow.
- Whole card is one link to the PDP; wishlist and quick-add stop propagation.
- **Out of stock:** art at 40% opacity, "ناموجود" pill (danger text on surface-1) centered, quick-add replaced by "خبرم کن" secondary icon; price shown in `text-muted`.
- **Skeleton:** tile = `surface-2` shimmer, text = 3 bars.
- Price format: `۱٬۲۵۰٬۰۰۰ تومان`. Old price on its own line above or after on desktop; on mobile it wraps under the price.

**Product grid** — see §4. Optional editorial interleave: after row 2, one full-width spotlight card spanning all columns (max once per grid).

**Filters (PLP)**
- **Desktop (≥1024):** sticky filter rail, **264px, on the start (right) side**, `canvas` (no panel), groups separated by `hairline`. Group = title (14px 700 `ink`) + content. Types: checkbox list with counts in `text-muted` `(۱۲)`; **color swatch grid** (28px circles, selected = 2px `ink` ring with 2px canvas gap); **model chips**; **price range** (dual slider + two tomans inputs); **toggles** for «فقط موجود» and «فقط تخفیف‌دار».
- **Above grid:** result count (`text-muted`), active-filter chips (surface-2 pill with ✕), «پاک کردن همه» text link, sort select (secondary pill, end side).
- **Tablet (810–1023):** rail hidden; "فیلتر" + "مرتب‌سازی" secondary pills open a **side drawer** (start side, 380px).
- **Mobile (<810):** sticky bar under header with two pills: `فیلتر (n)` and `مرتب‌سازی`. Both open **bottom sheets** (radius `xxl` top, drag handle, max 85vh). Filter sheet has sticky footer: primary pill «نمایش ۲۴ محصول» + text link «پاک کردن». Sort sheet = radio rows 56px with check on the end side.
- Chips: unselected = `canvas` bg + 1px `hairline`; selected = `surface-2` bg + `ink` text (no color fill).

**Badges** (pill, caption 600, padding 3×10)
| Badge | Style |
|---|---|
| `٪ تخفیف` | bg `danger @ 16%`, text `danger` |
| `پرفروش` | bg `violet @ 20%`, text `#B9A8FF` |
| `جدید` | bg `surface-3`, text `ink` |
| `ارسال رایگان` | bg `success @ 14%`, text `success` |
| `محدود` | bg `warning @ 16%`, text `warning` |
Max 2 badges on a tile (discount first). Badges never use gradients.

**Stock status** (dot + caption): `● موجود` success · `● فقط ۳ عدد` warning (when ≤ 10) · `● ناموجود` danger. PDP shows the same with a sentence.

**Price & discount**
- Current price: `ink`, 800 (card) / 900 (PDP `price-lg`). Old price: `text-muted`, strike-through, 12–15px. Discount: danger pill `٪۲۲`.
- Always tomans, always grouped, Persian digits, unit after number. Never abbreviate to «هزار تومان» except in the free-shipping sentence.

**PDP**: gallery on the **start (right)** half, info on the end half (stacks on mobile). Gallery = main tile (`surface-2`, radius `xl`) + 4 thumbs (selected = blue ring). Tabs for «تصویر / سه‌بعدی». Info order: badges → name (h1) → rating+reviews → price block → short text → model chips → color swatches → qty → CTAs (primary «افزودن به سبد», secondary «خرید فوری») → info tiles (ارسال، بازگشت) → disclosure rows (Nike accordion: توضیحات، مشخصات، نظرات). **Mobile:** sticky buy bar (price + primary pill) above safe-area, replaces bottom bar.

**Cart / Checkout**
- Cart line: 76px `surface-2` thumb (radius md) · name/model/color · qty pill · line price · remove. Summary = `surface-1` panel, radius `xl`, free-shipping progress (brand gradient fill, 8px), coupon input + secondary pill, rows, total (20px 900), primary lg pill. Mobile: summary becomes sticky bottom bar with total + primary pill.
- Checkout steps = chip row (selected = surface-2), single column on mobile. Cart drawer opens from the **left** (end side) at 420px.

### 6.5 Cards & Panels
- **Panel:** `surface-1`, radius `xl`, padding 24 (16 on mobile), no border. Nested elements use `canvas` or `surface-2`.
- **Spotlight card:** gradient (§2), radius `xxl`, padding 30, white text, product art bleeding off the end edge with drop-shadow, white pill CTA.
- **Category tile:** `surface-1`, radius `xl`, min-height 230 (200 mobile), index number `text-muted`, name 22px 800, art at the end side; hover → `surface-2` and art lifts 6px.
- **Info tile:** `surface-1`, radius `lg`, title 14px 700 + 13px muted text.

### 6.6 Modal / Dialog / Sheet
- Overlay `rgba(0,0,0,.7)` + 6px blur. Dialog: `surface-1`, radius `xxl`, shadow 3, max-width 560 (form) / 720 (rich), padding 24–32, header row (title h2 + icon close at the **end/left**), footer with actions: primary on the **start (right)**, secondary next to it.
- Mobile: dialogs become **bottom sheets** (radius `xxl` top, handle, safe-area padding, max 90vh, scroll inside).
- Esc / overlay click closes (except destructive confirm). Focus trapped; focus returns to trigger.
- **Toast:** `surface-3` pill-rounded (radius xl), bottom-center, 56px above bottom bar, 2.8s, icon + text, max 3.

### 6.7 Tables (admin + account)
- Header row: caption 12px `text-muted`, bg `surface-1`, sticky; row height 48 (admin) / 56 (account), 1px `hairline-soft` dividers, no zebra, hover row = `surface-1`.
- Text alignment: start (right) for text, **numbers/prices also start-aligned with tabular numerals**; actions column at the end (left).
- IDs/SKUs in `dir="ltr"` monospace-ish (`ui-monospace`, 12.5px).
- Status = pill: `surface-2` bg + 6px colored dot + label (success/warning/danger/blue/pink).
- Below 810px: tables scroll horizontally inside their own container (min-width 560) **or** collapse to stacked rows for account/orders (preferred for ≤4 columns).
- Empty state: centered icon (surface-2 circle), h3, muted text, secondary pill.

## 7. Admin Dashboard (`/admin`) — Linear + Vercel × CaseLine

Principles: **calm density**, hairlines over fills, status as dots, numbers first, brand only in tiny doses. Admin is still dark, still RTL, still Vazirmatn, and uses the same tokens — but denser.

- **Shell:** sidebar 240px on the **start (right)** (collapses to 64px icon rail at 1024–1279; becomes a horizontal scrolling tab bar <810), `surface-1`, 1px `hairline` on its end edge. Top bar 56px: breadcrumb (start) · command search pill `جستجو یا دستور… ⌘K` (center) · notifications + avatar (end). Content max 1440, padding 24 (16 mobile).
- **Sidebar item:** 36px high, radius `md`, icon 16px, `text-muted`; active = `surface-2` + `ink`; group labels caption `text-subtle`. Logo mark uses the brand gradient (the only gradient in chrome).
- **Page header:** h1 (24px 800), muted description, actions at the end: secondary pills + one primary **sm** pill.
- **Tabs:** underline style (Vercel): text 14px 500, inactive `text-muted`, active `ink` with 2px `ink` underline; 1px `hairline` baseline. Scroll horizontally on mobile.
- **KPI tiles:** `surface-1`, radius `lg`, 1px `hairline`, padding 16: label (caption muted) · value (22px 900, tabular) · delta (caption; success ↑ / danger ↓ / warning). 4-up → 2-up → 2-up (never 1-up).
- **Charts:** area/line with `brand` gradient fill at 45%→0% opacity, 2.5px line `#8E78FF`, grid lines `hairline`, endpoint dot (white fill, violet stroke). Max one gradient chart per card; secondary series use `text-muted` / `accent-blue`. Axis labels 11–12px `text-muted`. Always include units in the chart title.
- **Data tables:** §6.7 with filter bar on top (search input + filter chips + sort), bulk-select checkboxes, row actions in a `…` icon button, pagination at the bottom (`۱ – ۲۰ از ۱۲۸` + prev/next icon pills).
- **Forms (product editor):** two-column on desktop (main form `surface-1` panel + side panel for status/category/tags), single column mobile; sticky save bar with primary sm pill «ذخیره» + secondary «انصراف»; unsaved-changes dot in the page title.
- **Status vocabulary** (consistent across all admin screens): پرداخت‌شده/تحویل‌شده = success · در انتظار/موجودی کم = warning · لغو/ناموفق/ناموجود = danger · در حال آماده‌سازی = blue · ارسال شد = pink.
- **Low-stock alert:** warning banner `warning @ 12%` bg, 1px `warning @ 30%` border, radius `lg`, icon + text + secondary sm pill.
- **Density:** admin body text 13–14px, row height 48, gaps 12–16. Never use display sizes in admin.
- Destructive actions: danger text, confirm dialog with the entity name typed or double-confirmed; never one-click delete.

## 8. RTL Rules (explicit)

1. `<html lang="fa" dir="rtl">`. Never rely on per-component `dir`; only isolate LTR inline content (`dir="ltr"` on SKUs, emails, phone, URLs, Latin brand names).
2. **Use CSS logical properties** (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`, `border-inline-start`). Do not write `left/right` in new UI code. Tailwind: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`.
3. **Start = right, end = left.** Logo, primary text, filter rail, sidebar and gallery are on the start side; cart/account icons, close buttons, add-to-cart circles and prev/next sit on the end side.
4. **Mirror** directional icons: arrows, chevrons, back/forward, carousel paddles, "next step" glyphs, progress direction. **Do not mirror**: search, heart, cart, play, check, clock, phone, media controls, logos, charts' time axis (time runs right→left in Persian dashboards; the latest point is on the **left**).
5. Progress bars, steppers, sliders and carousels **start from the right**. Carousels scroll-snap with `start` alignment; first item hugs the right gutter.
6. Numbers in running Persian text use Persian digits; use `<bdi>` around mixed content (model names like «iPhone 16 Pro»).
7. Toggles: off = knob at the start (right), on = knob at the end (left). Checkbox/radio controls sit at the start (right) with the label to their left.
8. Text alignment defaults to start (right). Centered text only for headings in hero/CTA blocks and the footer copyright.
9. Test every screen with real Persian strings, 2× longer than English (button labels, filters, table headers).

## 9. Mobile / Tablet / Desktop

| Breakpoint | Width | Behavior |
|---|---|---|
| mobile | < 810 (design for 360–430) | 1-col layout, 2-col product grid, drawer nav + optional bottom bar, filter/sort bottom sheets, sticky buy/total bars, sections 48px, display scales to mobile sizes |
| tablet | 810–1023 | 3-col grid, filter side drawer, 2-col hero → stacked, sections 64px, admin icon-less top tabs → sidebar rail at ≥1024 |
| desktop | 1024–1279 | Full header, filter rail, 3-col grid (4 at ≥1280), sections 96px |
| wide | ≥ 1280 | Container locks at 1280, 4-col grid |

Rules
- **Mobile first.** Write base styles for 360px, enhance upward.
- **Touch targets ≥ 44×44px** (icon buttons 44, chips 40 min + 4px spacing, rows 56).
- Respect **safe-area insets** (`env(safe-area-inset-*)`) on fixed bars/sheets.
- No horizontal page scroll, ever. Wide tables/diagrams scroll inside their own container. Gutter ≥ 16px.
- 3D: on mobile/tablet reduce DPR (≤1.25), drop secondary floating objects, and honor `prefers-reduced-motion` (static render). Lazy-load three.js.
- Hover-only affordances must have a touch equivalent (quick-add always visible on touch).
- Images: `aspect-ratio` boxes, `loading="lazy"`, `max-width:100%`.
- Forms: correct `inputmode`/`autocomplete`; 16px min input font to prevent iOS zoom.

## 10. Motion
- Durations 150 / 250 / 450ms, ease `cubic-bezier(.22,1,.36,1)`.
- Allowed: fade/slide-in on scroll (once), image zoom on product hover, press scale `.95`, sheet/drawer slide, cart-fly dot, heart pop, toast rise.
- One orchestrated moment per page (hero text reveal). No looping animation except the 3D float and skeleton shimmer.
- `prefers-reduced-motion: reduce` → disable transforms/parallax/float; keep fades ≤ 150ms.

## 11. Do / Don't

**Do**
- Start from tokens in the front matter; reference them by name.
- Keep the canvas `#0C0C0C` and default text `#D7E2EA`; headings and prices white.
- Use pill CTAs (one white primary per viewport) and icon-circle quick actions.
- Let products carry color; keep UI neutral; spend the gradient budget (§2) deliberately.
- Show price + old price + discount pill + stock status consistently everywhere.
- Use logical CSS properties and verify RTL mirroring on every new component.
- Provide mobile layout (2-col grid, sheets, sticky bars) *as part of* the component, not after.
- Use `surface` lift for hierarchy; add 1px hairlines instead of shadows for separation.
- Keep admin dense, quiet, tabular; use status dots + consistent status vocabulary.
- Provide loading (skeleton), empty, error and out-of-stock states for every data component.
- Honor reduced motion and keyboard focus (`focus-ring`) on every interactive element.

**Don't**
- Don't copy Framer/Nike/Linear/Vercel assets or fonts; use only the principles above.
- Don't apply negative letter-spacing to Persian, and don't use Latin line-heights for Persian.
- Don't use gradients on buttons, backgrounds of whole sections, nav, inputs, or body text.
- Don't put more than 2 spotlight cards in a viewport, or add a second chromatic accent (no teal/green brand color, no extra blues).
- Don't use accent-blue as a fill or CTA color.
- Don't give product cards borders, background fills, or shadows; don't lift them on hover.
- Don't use square or bordered-ghost buttons; don't add a third button shape.
- Don't use `left/right/ml/mr/pl/pr` in new UI code; don't hard-code LTR layouts; don't mirror non-directional icons.
- Don't show prices in dollars, Latin digits (outside SKUs/IDs), or without the تومان unit.
- Don't use pure-gray mid tones outside `text-muted/subtle`; don't use `#000` for canvas (it's `#0C0C0C`).
- Don't ship a 1-column product grid on mobile, hover-only controls, tap targets < 44px, or horizontal page scroll.
- Don't redesign existing pages ad hoc: apply this system only when the user has approved the change.
- Don't invent new radii, spacing, colors or font sizes; if a token is missing, propose it here first.

## 12. Iteration Guide for Claude
1. Read this whole file before any UI change (CLAUDE.md enforces it).
2. Build **one component at a time**; map each property to a token above.
3. Check: RTL (logical props), mobile 390 + tablet 810 + desktop 1440, focus states, reduced motion, empty/loading/error states.
4. Run `npm run typecheck`; view the page at 390px and 1440px before reporting done.
5. If a request conflicts with this file, say so and ask; don't silently deviate.
6. Reference demo: route `/design-demo` (`src/pages/DesignDemo.tsx`, `src/features/design-demo/`). Keep it in sync when tokens change.
