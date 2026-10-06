# CaseLine

فروشگاه لوازم جانبی موبایل — Next.js + Prisma + PostgreSQL. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for architecture, roadmap and how to run.


## Admin panel

Sign in at `/account?next=/admin` with a staff account (demo: `09120000001 / Admin@12345`; limited role: `09120000006 / Manager@12345`) and open `/admin`. See `docs/ARCHITECTURE.md` (Phase 3) and `docs/TECH_DEBT.md`.


## Phase 4 demo flow (wallet, points, support, refunds)

1. `npx prisma migrate deploy && npx prisma db seed` (fresh dev DB; accounts start with **no** wallet money or points).
2. Admin `09120000001 / Admin@12345` → **کیف پول** → find `09120000002` → add credit; **باشگاه مشتریان** → add points (or leave the earn/redeem rules from **تنظیمات**).
3. Customer `09120000002 / Customer@12345` → add a product → checkout (use wallet / redeem points) → upload the receipt for the remaining amount.
4. Admin → **بررسی پرداخت‌ها** → approve → the customer receives points + notifications (`/account/notifications`).
5. Admin → order page → change status / tracking code (notifications), customer opens a ticket (`/account/tickets`), admin replies (`/admin/support`).
6. Admin → order page → **بازگشت وجه** (wallet or bank). Wallet: the customer confirms on the order page. Bank: an approver enters the bank tracking number in **بازگشت وجه**. Order becomes *مرجوع‌شده* only after the money has really moved; coupon, points and stock are restored once.

Notification gateways (SMS/e-mail/Telegram) are disabled until `NOTIFY_CHANNELS` and credentials are configured; queued deliveries are sent with `npm run notify:flush`.
