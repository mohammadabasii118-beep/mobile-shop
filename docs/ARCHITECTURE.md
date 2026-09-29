# CaseLine — Architecture & Roadmap

Checkpoint of the approved front-end (static demo, mock data): branch `checkpoint/frontend-demo-v1`.

## Phase 0 audit (what existed)

| Area | State at checkpoint |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript, Tailwind 4, hand-written shadcn-style primitives (`components/ui.tsx`) |
| Pages | Home, Shop, Product, Blog, Support, Checkout, Account (login, profile, orders, tickets, edit) |
| Data | All products/categories/blog in `lib/data.ts` (mock, static) |
| State | Cart, session, orders, tickets in `localStorage` via `public/site.js` (vanilla) |
| Auth | Fake (any 4-digit code accepted) |
| Payments | None |
| Responsive | Mobile-first, checked at 390 / 1300 px |
| Theme | Light / dark / system, no flash (inline head script) |

## Current architecture (after Phase 1)

```
app/                    routes (server components read the DB)
components/             UI (unchanged look); header/footer/menu now data-driven
lib/db.ts               Prisma client (driver adapter for PostgreSQL)
lib/queries.ts          read-side data layer (server-only) → view models in lib/types.ts
prisma/schema.prisma    52 models; prisma/migrations/*; prisma/seed.ts (+ seed-data.ts)
public/site.js          cart/search/checkout UI glue — STILL localStorage (replaced in Phase 2)
```

Server-rendered pages: `/`, `/shop`, `/product/[slug]`, `/blog`, `/support`, `/checkout`, `/account/*`.
Header, footer, main menu, category menu, homepage sections, banner, blog, products and site settings come from PostgreSQL.

## Database (PostgreSQL + Prisma 7)

Money is integer Toman. Highlights:

* **Auth/RBAC:** `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `Session`, `OtpCode`, `PasswordResetToken`.
  Roles seeded: super_admin, admin, product_manager, order_manager, content_manager, support, wholesale_manager, customer, wholesale_partner.
* **Catalog:** `Category` (tree), `Brand`, `PhoneModel`, `Product` (independent **retail** and **wholesale** price fields, SEO fields), `ProductVariant`, `ProductImage`, `ProductPhoneModel`, `Inventory` + `InventoryMovement`, `PriceHistory`, `ProductRelation`.
* **Commerce:** `Cart`/`CartItem`, `WishlistItem`, `Order` (+`OrderItem`, `OrderStatusHistory`), `Payment`/`PaymentProof` (private storage keys), `Coupon`/`CouponUsage`, `ShippingMethod`, `Address`.
* **Wallet vs loyalty (separate ledgers):** `Wallet`/`WalletTransaction`, `LoyaltyAccount`/`LoyaltyTransaction`.
* **Wholesale:** `WholesaleApplication`, `WholesaleProfile`, `WholesaleTier`.
* **Engagement:** `Review`, `ProductQuestion`, `BackInStockRequest`, `Notification` (channel column ready for SMS/email/Telegram), `SupportTicket`/`SupportMessage`.
* **Content/site:** `Banner`, `HomepageSection`, `MenuItem`, `BlogPost`/`BlogCategory`, `SiteSetting` (site info, payment info, shipping), `SEOSetting`, `AdminLog`.

## Backend plan

| Phase | Scope | Status |
|---|---|---|
| 0 | Audit, checkpoint, architecture | done |
| 1 | Schema, migrations, seed, DB-backed read path (menu, home, shop, product, blog, search) | **done** |
| 2 | Real auth (OTP + password, sessions, RBAC helpers), DB cart, checkout, orders, card-to-card payment + private receipt upload, order timeline | next |
| 3 | Admin panel: dashboard, products/categories/brands/phone models, inventory, orders, payment review, users | |
| 4 | Wholesale (application, approval, tiers, server-side wholesale pricing), wallet, loyalty, coupons, reviews, Q&A, back-in-stock, tickets | |
| 5 | Homepage/banner/menu/footer/settings/blog CMS, SEO (metadata, JSON-LD, sitemap, robots, brand/phone pages), audit log, security hardening, tests | |

Rules kept for every phase: prices and permissions are decided on the server; secrets only in `.env`; admin routes protected on the backend; uploads never public.

## Run locally

```bash
cp .env.example .env            # fill DATABASE_URL and AUTH_SECRET
npm install                     # also runs `prisma generate`
npx prisma migrate dev          # create tables
npx prisma db seed              # demo data
npm run dev                     # http://localhost:3000
```

Demo logins (development seed only): admin `09120000001 / Admin@12345`, customer `09120000002 / Customer@12345`, partner `09120000003 / Partner@12345`.
