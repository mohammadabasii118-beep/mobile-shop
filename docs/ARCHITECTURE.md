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
| 2 | Real auth (OTP + password, sessions, RBAC helpers), DB cart, checkout, orders, card-to-card payment + private receipt upload, order timeline | **done** |
| 3 | Admin panel: dashboard, products/categories/brands/phone models, inventory, orders, payment review, users | **done** |
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


## Phase 2 — server-side commerce

```
lib/server/
  env.ts  errors.ts  http.ts  rate-limit.ts  validation.ts (Zod)
  auth/   otp.ts  sms.ts (SmsProvider)  password.ts  session.ts  tickets.ts (jose)  guard.ts  service.ts
  pricing.ts   retail/wholesale unit price — the only place a price is decided
  cart.ts  coupons.ts  checkout.ts (quote + transactional createOrder)  orders.ts (status map, timeline)
  payments/  types.ts (PaymentProvider)  card-to-card.ts  index.ts (registry)  service.ts (receipt, approve, reject, cancel)
  storage/   types.ts (StorageDriver)  local.ts  index.ts      upload.ts (receipt validation)
app/api/**              thin route handlers (Zod in, JSON out); pages call the same services
```

* **Auth:** phone + OTP (first successful OTP creates the account) or phone + password; forgot/reset uses OTP → signed 10-minute ticket (jose) → new password, all sessions revoked. Sessions are opaque random tokens stored only as SHA-256 hashes, HttpOnly + SameSite=Lax (+Secure on https), 30-day sliding expiry.
* **OTP:** 4 digits, HMAC-hashed, 120 s TTL, single use (atomic consume), 5 wrong tries then dead, 60 s resend cooldown, per-phone and per-IP limits (PostgreSQL-backed counters, so limits hold across instances).
* **Pricing:** decided on the server from the signed-in user's approved wholesale role; wholesale only at or above the product's minimum quantity; tier minimum order enforced at checkout; coupons apply to retail-priced lines only. No API accepts a price or total.
* **Orders:** created in one DB transaction that re-prices everything, takes stock with `UPDATE … WHERE quantity >= n` (no overselling), stores product/price/address snapshots, status history, payment row, coupon usage, and empties the cart.
* **Payments:** `PaymentProvider` registry. Card-to-card is enabled (bank details come from `SiteSetting.payment`); SnappPay/TorobPay/BalePay are registered but disabled. Receipt → Payment `REVIEW` + Order `PAYMENT_REVIEW`; approve → `PAID` + `PROCESSING`; reject → `REJECTED` (+reason) and the order returns to `PENDING_PAYMENT` so the customer can resubmit.
* **Receipts:** private storage (`UPLOAD_DIR`), server-generated key, magic-byte + extension + size checks, streamed only to the owner or staff with `payment.review`.
* **Admin hooks:** `/api/admin/payments/[id]/approve|reject` (permission-checked) and `cancelOrder()` (restores stock) are ready for the Phase 3 UI.

### Production on a VPS

```bash
npm ci && npx prisma migrate deploy && npm run build
# production: do NOT run the demo seed. Create roles/permissions with `npx prisma db seed` only on a fresh, non-production database.
NODE_ENV=production TRUST_PROXY=1 npm start        # behind nginx/Caddy with HTTPS
```
Move PostgreSQL by changing only `DATABASE_URL` (`prisma migrate deploy` on the new database).

### Tests

`TRUST_PROXY=1 npm start -- -p 3300` then `BASE_URL=http://localhost:3300 npm run test:e2e` — 27 integration tests (auth, OTP rules, CSRF, cart, pricing, coupons, checkout, race for last unit, wholesale, receipts, access control, cancel/restock). Also `npm run typecheck` and `npm run lint`.

### Known limits after Phase 2

* Support tickets on `/account/tickets` are still browser-side demo data (Phase 4).
* Wallet payment, loyalty earning, refunds-to-wallet and notifications delivery (SMS/e-mail/Telegram) are schema-ready but not wired.
* Coupon usage is not returned on cancellation yet.
* No admin UI yet (Phase 3); use the seeded admin only through the API.


## Phase 3 — admin panel (`/admin`)

```
app/admin/**                 pages (server components: guard + data) → components/admin/* (client UI)
app/api/admin/**             REST API. Every handler is wrapped by adminRoute(permission, handler)
app/media/[...path]          public image files (uploads);  private receipts stay behind /api/orders/.../proof
lib/server/admin/
  core.ts       adminRoute(): CSRF → session → staff check → permission (server) → per-admin rate limit; audit(); diff()
  resources.ts  registry of simple CRUD resources: Zod schema, permission, search/filters, delete guards, immutable fields
  crud.ts       generic list/get/create/update/delete/reorder — every write is one transaction that also writes AdminLog
  products.ts inventory.ts orders.ts customers.ts wholesale.ts settings.ts misc.ts (dashboard, reviews, audit, wallet/loyalty/support views)
lib/admin/nav.ts, format.ts, product-map.ts
```

**Authorization.** `adminRoute` requires a signed-in *staff* user (role with `isStaff`) holding the listed permission; it is checked on every request from the DB (no permission is cached in the cookie). Pages call `requireAdminPage(perm)`; the sidebar only hides links for convenience. Role changes need `role.manage` and you can only grant/remove roles whose permissions you hold; you cannot demote or deactivate yourself.

**Resource registry** (`/api/admin/r/<resource>`): `categories, brands, phone-models, coupons, shipping, banners, homepage, menus, tiers, seo, blog`. Adding a new simple CRUD screen = one registry entry + one page config.

**Money-affecting rules kept in one place.** Product prices are validated (wholesale ≤ retail, discounts ≤ price); every retail/wholesale change writes `PriceHistory` (product, type, old, new, admin, time). Stock only changes through `adjustStock()` (atomic, never negative, writes `InventoryMovement` with `balanceAfter` + audit). Order status changes go through `ORDER_TRANSITIONS`; cancel/refund/payment-driven transitions have dedicated endpoints (cancel restocks, refund marks order+payment REFUNDED).

**Audit log.** `AdminLog` (admin, action, entity, id, old/new, ip, time). No write API exists, and a PostgreSQL trigger rejects UPDATE/DELETE, so even a compromised admin account cannot rewrite history.

**Uploads.** `POST /api/admin/upload`: JPG/PNG/WebP only (magic bytes + extension), ≤4 MB, random server-side name, stored in `UPLOAD_DIR/public/images`, served with `nosniff`. SVG/PDF are refused.

**Storefront wiring.** Header/footer menus, homepage sections (incl. hand-picked `productIds`), banners (`home_telegram`, `shop_top`), site info/logo/favicon, payment card details, shipping methods, coupons, categories, brands (`/brand/<slug>`), phone models (`/model/<slug>`) are all read from the database on each request.

### Tests

`npm run test:e2e` (server on :3300 with `TRUST_PROXY=1`) runs Phase 2 + Phase 3 suites sequentially: 75 integration tests (48 for the admin panel: authorization matrix, CRUD per module, price history, inventory races, order/payment flows, role escalation, wholesale approval, settings → storefront, audit immutability, rate limiting).

### Known limits after Phase 3

* Coupon usage is not rolled back on cancel/refund — see `docs/TECH_DEBT.md` #1.
* Wallet, loyalty and support screens are read-only; blog and SEO are basic forms (full versions later).
* Refund marks the order/payment and restocks; returning the money is manual until wallet refunds exist.
* Changing an order's shipping method after checkout does not recompute its shipping cost (the quote stays as a snapshot).
* Wholesale application *documents* are not uploadable/viewable yet (count only).
