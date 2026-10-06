# CaseLine — DESIGN.md

Source of truth for the storefront's look. Functionality, data, routes, APIs and business logic are **not** part of this document and must not change when the UI changes.

Working name of the identity: **Pine & Paper**.

## 1. Principles

1. **The product is the page.** Photography and product shape carry the visual weight; the interface stays quiet around them.
2. **One voice of colour.** Deep pine green is the only brand colour. Saffron appears in small, deliberate moments (a price accent, a rating star, a focus detail). Sale red appears only for discounts.
3. **Editorial type, not template type.** A Persian serif display face for headlines, a neutral Persian sans for everything you read or click.
4. **Calm geometry.** Three radii only (6, 10, 16px) plus a pill for chips. No frosted glass, no coloured shadows, no gradients except on a placeholder where no photo exists.
5. **Hairlines over boxes.** Structure comes from 1px rules and whitespace, not from stacking bordered cards.
6. **Motion confirms, never decorates.** 120–240ms, opacity/transform only, and everything is off under `prefers-reduced-motion`.

Reference systems studied (principles only, nothing copied): the product-tile and quiet-chrome approach of Apple and Meta, the dense photography-first grids of Nike, the single-accent discipline and tidy search/filter patterns of Airbnb, the restrained two-radius vocabulary of Pinterest. No colour, typeface, layout, asset or component from any of them is used.

## 2. Colour

Tokens live in `app/globals.css`. Component code uses the semantic names only (`bg-primary`, `text-muted`, `border-border`…), never raw hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F4F3EE` | `#0D1512` | Page |
| `surface` | `#FBFAF7` | `#111C18` | Bands, header, inputs |
| `surface-2` | `#ECEAE2` | `#1A2A24` | Placeholders, quiet fills, chips |
| `card` | `#FFFFFF` | `#16241F` | Cards, drawers, dialogs |
| `border` | `#DAD8CF` | `#25382F` | Hairlines |
| `border-strong` | `#B9B6AA` | `#365044` | Inputs, focus-adjacent edges |
| `foreground` | `#14201B` | `#ECF0EC` | Text |
| `muted` | `#5E6A64` | `#93A59B` | Secondary text (≥ 4.5:1 on `background`) |
| `primary` | `#123F34` | `#7BD9AE` | Brand, primary actions, links |
| `primary-hover` | `#0C2E26` | `#98E6C3` | |
| `primary-fg` | `#F4F3EE` | `#07241A` | Text on primary |
| `secondary` | `#14201B` | `#ECF0EC` | Ink buttons, inverted bands |
| `accent` | `#D7A13A` | `#E8B658` | Saffron highlights only |
| `hot` | `#B9381E` | `#F0765B` | Discounts |
| `success` / `warning` / `error` | `#1E7A4F` / `#B7791F` / `#B42318` | `#4CCB8C` / `#E8B658` / `#FF7A70` | Status |

Rules: accent never carries text smaller than 18px on a light surface; `primary` text on `background` is 9.6:1 (light) and 11:1 (dark).

## 3. Typography

| Role | Family | Size / line-height | Weight |
|---|---|---|---|
| Display | Markazi Text (variable) | 64 / 1.05 (mobile 40 / 1.1) | 600 |
| H1 | Markazi Text | 44 / 1.15 (mobile 32) | 600 |
| H2 | Markazi Text | 32 / 1.2 (mobile 26) | 600 |
| H3 | Noto Sans Arabic (variable) | 20 / 1.5 | 700 |
| Body | Noto Sans Arabic | 15 / 1.9 | 400 |
| Small | Noto Sans Arabic | 13 / 1.7 | 400–500 |
| Caption | Noto Sans Arabic | 12 / 1.6 | 500 |
| Button | Noto Sans Arabic | 14 / 1 | 600 |
| Price | Noto Sans Arabic, tabular | 16–28 | 800 |

Both families are self-hosted through `@fontsource-variable` (no external requests) and preloaded in `app/layout.tsx`. Digits are always Persian (`fa-IR`), set with tabular figures where columns line up. Latin brand names use the same sans at `letter-spacing: .06em`, uppercase.

## 4. Space, shape, depth

- 4px base; section rhythm 72px desktop / 48px mobile; container max 1240px, gutters 16 / 24 / 40.
- Radii: `6px` controls and badges · `10px` cards and images · `16px` large panels, drawers, dialogs · pill only for chips and the search field.
- Depth: one hairline shadow (`0 1px 0` at 6% ink) for resting cards, one soft shadow for raised layers (drawer, menu, dialog). Hover lift is a 2px translate, never a bigger shadow.

## 5. Components

**Header** — Desktop: a quiet announcement band (existing rotating top bar, restyled as an ink strip), then a single row: wordmark, text navigation with an underline marker, a wide search field that opens the existing search overlay, then account / wishlist-free icon set / night mode / cart as square 10px-radius icon buttons. A floating compact copy appears after scrolling. Mobile: menu · wordmark · cart on one row, the search field as a full-width second row, and a flat bottom tab bar with a top-edge active marker.

**Buttons** — Primary (pine fill), Secondary (ink fill), Outline (1px `border-strong`), Ghost. Height 40 / 44 / 52, radius 10px. Pressed state moves 1px down. Disabled = 45% opacity, no shadow.

**Product card** — Photo first on a neutral `surface-2` plate with a 10px radius. Above the photo: a discount percentage chip top-start. Below, in order: brand (uppercase latin, caption), name (two lines), price row with the old price struck through. A thin arrow slides in on hover. No border, no box around the text.

**Section header** — H2 in Markazi with a hairline running to the "view all" link.

**Product page** — Gallery left (sticky) with a vertical thumbnail rail; right column built from hairline-separated blocks: title and rating → price → options → quantity and primary action → delivery notes → details tabs. On mobile the primary action sticks to the bottom.

**Shop / category** — A header band with breadcrumb and title, a sticky toolbar (filters, sort, result count), a 4 / 3 / 2 column grid, designed empty and loading states.

**Cart drawer / search / chat** — Same markup produced by `public/site.js`, restyled with the `cl-*` classes: square-cornered sheet, hairline rows, ink checkout button.

**Forms** — 44px inputs, 1px `border-strong`, label above, error text below in `error`, focus ring 2px `primary`.

## 6. Motion

| Where | What | Duration |
|---|---|---|
| Links, buttons | colour / 1px press | 120ms |
| Product card | image scale 1 → 1.03, arrow reveal | 240ms |
| Sections | fade-up 12px once when entering | 320ms |
| Drawer / overlay | slide + fade | 220ms |
| Page | none (no route animation) | — |

All of it is removed by `prefers-reduced-motion`.

## 7. Accessibility and RTL

RTL is the default; layouts use logical properties (`start/end`, `ms/me`). Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI edges. Targets ≥ 44px on touch. Every icon-only button keeps its `aria-label`. Focus is a visible 2px ring. The existing `data-*` hooks used by `public/site.js` and the test suite are part of the contract and are never removed.

## 8. What must not change

Routes, server actions, API handlers, database schema, authentication, cart and checkout logic, pricing, SEO output and every `data-*` / `id` / `aria-*` hook relied on by `public/site.js`, `public/shop.js`, `public/blog.js` and `scripts/*.test.ts`.
