# Telegram VPN Sales Bot (3x-ui / Sanaei)

ربات تلگرام فروش خودکار VPN: خرید پلن → سفارش → کارت‌به‌کارت → رسید → **Verification** → (تأیید خودکار یا ادمین) → ساخت Client واقعی در 3x-ui → لینک/QR/Subscription برای کاربر.

> قانون اصلی: **عکس رسید هیچ‌وقت به‌تنهایی proof پرداخت نیست.** تأیید خودکار فقط وقتی انجام می‌شود که یک Verification Provider معتبر (لجر تراکنش‌های واقعی بانک) نتیجه `VERIFIED` بدهد و ریسک `LOW` باشد؛ در غیر این‌صورت پرداخت در صف `NEEDS_REVIEW` می‌ماند.

Stack: Node 20+ · TypeScript · PostgreSQL · Prisma 6 · grammY · Zod · pino · vitest

## معماری

```
src/
  bot/            فقط UI تلگرام (user.ts, admin.ts) — بدون business logic
  modules/        users products orders payments vpn support coupons notifications admin settings
  providers/
    payments/     PaymentProvider (CardToCard, Crypto[disabled]) + PaymentVerificationProvider (ledger)
    vpn/          VpnProvider → xui/ (client, provider, link) + mock (فقط test/demo)
  jobs/           scheduler: retry provisioning, traffic sync, expiry, re-verify, notifications flush, xui health
  server.ts       /health و /webhooks/bank-transactions (HMAC)
  config/ db/ utils/
prisma/           schema + migrations
dev/fakeXui.ts    شبیه‌ساز HTTP پنل 3x-ui (فقط تست/دمو)
demo/             دموی وب + دموی اسکریپتی
```

### جریان پرداخت
`submitReceipt` → OCR/parse (فقط extraction) → `PaymentVerificationProvider` (لجر بانک) → Risk Engine (LOW/MEDIUM/HIGH، قابل‌تنظیم) → تصمیم:

| شرایط | نتیجه |
|---|---|
| Verified + LOW + حالت `AUTO_VERIFICATION` | `AUTO_APPROVE` → Order PAID → Provision → ارسال |
| فقط رسید/OCR، مبلغ اشتباه، trackingCode تکراری، رسید تکراری، ریسک MEDIUM | `NEEDS_REVIEW` (صف ادمین) |
| ریسک HIGH | `NEEDS_REVIEW` یا `REJECT` (تنظیم `risk.highAction`) |
| `verification.mode=MANUAL_REVIEW` | همیشه بررسی دستی |

یک تراکنش بانکی فقط یک‌بار قابل claim است (unique constraint). Approve دوباره/دوبار کلیک/callback replay هیچ Client دومی نمی‌سازد (guard اتمیک روی status + `ProvisioningTask.orderId` unique).

### لجر بانکی (منبع تأیید خودکار)
`POST /webhooks/bank-transactions` با هدر `X-Signature: hex(HMAC_SHA256(BANK_WEBHOOK_SECRET, rawBody))`:
```json
{"trackingCode":"556677889","amount":250000,"unit":"IRT","destination":"6037991122334455","occurredAt":"2026-10-01T12:00:00Z","source":"sms-gateway"}
```
این endpoint را از API بانک/درگاه یا سرویس خواندن پیامک واریز (روی گوشی/سرور خودتان) تغذیه کنید. **هیچ اتصال آماده‌ای به بانک خاصی در این پروژه نیست.** تا وقتی لجر تغذیه نشود، همه پرداخت‌ها به صف بررسی می‌روند (امن‌ترین حالت).

### Provisioning (idempotent)
UUID/email/subId قبل از تماس با پنل در DB ذخیره می‌شوند؛ اگر timeout شد، تلاش بعدی Client را با email پیدا و adopt می‌کند. Retry خودکار: `1m,5m,15m,30m,1h` (قابل‌تنظیم) و بعد هشدار ادمین با دکمه Retry. تمدید روی **همان Client** اعمال می‌شود (مقادیر مطلق expiry/traffic یک‌بار در Task ذخیره می‌شود).

## 3x-ui نسخه 2.9.4
Adapter از API پنل زیر استفاده می‌کند: `POST /login`، `GET /panel/api/inbounds/list|get/:id`، `POST /panel/api/inbounds/addClient`، `updateClient/:key`، `/:id/delClient/:key`، `GET getClientTraffics/:email`. احراز هویت: `XUI_API_TOKEN` (Bearer) یا کوکی با login خودکار. لینک VLESS/VMess/Trojan/SS از تنظیمات **واقعی** inbound (reality/tls/ws/grpc/tcp/xhttp, pbk, sid, sni, fp, flow, …) ساخته می‌شود؛ Subscription فقط اگر `XUI_SUB_BASE_URL` تنظیم شده باشد.

⚠️ **راستی‌آزمایی روی پنل شما الزامی است** (بخش Known limitations): در `/admin → ⚙️ تنظیمات → 🔌 تست اتصال X-UI` و سپس یک خرید آزمایشی روی یک inbound تست.

## پنل مدیریت وب (`/admin`)
داشبورد SaaS فارسی/RTL با تم روشن و تیره، ریسپانسیو (دسکتاپ/تبلت/موبایل)، روی همان serviceهای ربات (بدون business logic جدا).
- **ورود:** در ربات (به‌عنوان ادمین) `/panel` را بفرستید → لینک **یک‌بارمصرف ۵ دقیقه‌ای** → نشست ۱۲ ساعته (کوکی HttpOnly + SameSite=Strict، تأیید مجدد ادمین بودن در هر درخواست، هدر CSRF برای تغییرات).
- بخش‌ها: Dashboard، Users، Products، Orders، Payments (drawer: رسید خصوصی، OCR، ریسک، تأیید بانکی، Audit)، VPN Services (Sync/Retry/Suspend/Resume/Renew/Delete با تأیید تایپی)، Coupons، Support (چت دوپنلی)، Notifications، Settings، Audit Logs.
- فقط داده‌ی واقعی دیتابیس نمایش داده می‌شود؛ بدون داده ⇒ Empty State. لینک/کانفیگ VPN در پنل نمایش داده نمی‌شود.
- فایل‌های UI در `public/admin/` (بدون build، بدون CDN/فونت خارجی). CSP سخت‌گیرانه (`script-src 'self'`).
- دسترسی هر بخش بر اساس نقش ادمین (RBAC) در سرور اعمال می‌شود. برای HTTPS پشت reverse proxy: `APP_URL=https://…` و در صورت نیاز `TRUST_PROXY=true`.

## چک‌لیست راه‌اندازی واقعی
```bash
npm run preflight                     # (Docker: docker compose run --rm bot node dist/scripts/preflight.js)
npm run xui:check -- --inbound <id>   # (Docker: docker compose run --rm bot node dist/scripts/xuiCheck.js --inbound <id>)
```
`xui:check` این مراحل را جدا PASS/FAIL می‌دهد: authentication، list/lookup inbound، create client، verify، traffic (واحد بایت)، expiry (epoch ms)، ساخت لینک، renew، suspend/resume، idempotency، cleanup. اگر هر مرحله FAIL شد، خطای خود پنل چاپ می‌شود؛ تا قبل از PASS کامل فروش را شروع نکنید.

## اجرا (Docker)
```bash
cp .env.example .env      # BOT_TOKEN, ADMIN_TELEGRAM_ID, POSTGRES_PASSWORD, XUI_*, CARD_*, BANK_WEBHOOK_SECRET
docker compose up -d --build
docker compose exec bot node dist/scripts/seed.js 1   # اختیاری: دو پلن نمونه روی inbound 1 (یا از /admin بسازید)
curl localhost:3000/health
```
Bot با long-polling کار می‌کند (دامنه/وب‌هوک تلگرام لازم نیست). فقط اگر لجر بانکی را با webhook تغذیه می‌کنید، پورت 3000 را پشت Caddy/nginx با HTTPS قرار دهید.

بدون Docker: `deploy/vpn-bot.service` (systemd). مایگریشن‌ها هنگام استارت `prisma migrate deploy` اجرا می‌شوند. لاگ‌ها JSON (pino) با redact برای secretها؛ `restart: unless-stopped` فعال است.

**Backup:** `deploy/backup.sh` (pg_dump + volume رسیدها) را با cron روزانه اجرا و نسخه‌ها را خارج از سرور نگه دارید. Restore: `gunzip -c db_X.sql.gz | docker compose exec -T db psql -U vpn vpnbot`.

## ENV
`DATABASE_URL BOT_TOKEN ADMIN_TELEGRAM_ID APP_URL PORT RECEIPT_DIR XUI_BASE_URL XUI_USERNAME XUI_PASSWORD XUI_API_TOKEN XUI_SUB_BASE_URL XUI_PUBLIC_HOST VPN_PROVIDER CARD_TO_CARD_ENABLED CARD_HOLDER CARD_NUMBER BANK_NAME PAYMENT_INSTRUCTIONS CRYPTO_ENABLED BANK_WEBHOOK_SECRET OCR_ENABLED` — جزئیات در `.env.example`. در production مقدار `VPN_PROVIDER=mock` رد می‌شود. اعتبارنامه‌ی پنل اصلی (`default`) در env سرور است. پنل‌های اضافه از داخل ربات/پنل وب (مجوز `panels.manage`، فقط SUPER_ADMIN) ثبت می‌شوند؛ رمز و توکن آن‌ها با `SECRETS_KEY` (AES-256-GCM) رمزنگاری در DB ذخیره می‌شود و هرگز نمایش/لاگ نمی‌شود.

### چند پنل و چند inbound
هر محصول به یک «پنل + inbound» وصل است (`xuiProviderId` + `xuiInboundId`). ساخت، تمدید، sync و حذف هر سرویس همیشه روی همان پنل انجام می‌شود. افزودن/ویرایش/تست پنل و دیدن inboundها: ربات `/admin` ← «🖥 پنل‌ها و inboundها» یا پنل وب ← «پنل‌ها و inbound». هنگام ساخت/ویرایش محصول، inbound روی همان پنل بررسی می‌شود. افزودن گروهی: خط `panel=کد-پنل` بالای لیست. سلامت هر پنل هر دقیقه بررسی می‌شود (هشدار بعد از دو شکست پیاپی + پیام بازگشت اتصال).

## نقش‌های ادمین
`ADMIN_TELEGRAM_ID` = SUPER_ADMIN. بقیه از جدول `Admin` (نقش‌ها: SUPER_ADMIN, PAYMENT_ADMIN, VPN_ADMIN, SUPPORT_ADMIN, PRODUCT_ADMIN). مثال: `INSERT INTO "Admin"(id,"telegramId",role,"updatedAt") VALUES ('a1',123456,'PAYMENT_ADMIN',now());`

## تست و کنترل کیفیت
```bash
npm test          # نیاز به PostgreSQL؛ TEST_DATABASE_URL (نام دیتابیس باید به _test ختم شود)
npm run typecheck && npm run lint && npm run build
```

## دمو
```bash
npm run demo:script   # گفتگوی کامل اسکریپتی در ترمینال
npm run demo          # شبیه‌ساز تلگرام در مرورگر: http://localhost:8080  (کاربر + ادمین + شبیه‌ساز بانک + پنل جعلی X-UI)
```
(نیاز به `DATABASE_URL` و `NODE_ENV=development`.)

**آنلاین کردن دمو:** (۱) روی هر VPS: `npm run demo` و پشت HTTPS یا `cloudflared tunnel --url http://localhost:8080`؛ (۲) دموی واقعی تلگرام: توکن را از @BotFather بگیرید، `.env` را پر کنید و `docker compose up -d` — کاربران با لینک `t.me/<bot>` وارد می‌شوند.

## لینک اشتراک (Subscription) و نام سرویس
- با تنظیم `XUI_SUB_BASE_URL` (آدرس اشتراک پنل بدون subId) لینک اشتراک **اولویت اول** تحویل است؛ کانفیگ مستقیم زیرش به‌عنوان جایگزین می‌آید و QR هم از لینک اشتراک ساخته می‌شود. `xui:check` درستی آدرس را واقعاً با یک درخواست HTTP به subscription پنل تست می‌کند.
- مشتری می‌تواند نام دلخواه بگذارد (قبل از تحویل از صفحه‌ی پرداخت، و بعد از تحویل از «سرویس‌های من ← ✏️ نام سرویس»)؛ کنارش همیشه کد خودکار (`VPN-XXXXXX`) نمایش داده می‌شود. نام لاتین به نام Client در X-UI هم اضافه می‌شود (`tg_<id>_<order>_<name>`)؛ نام فارسی فقط در ربات و remark لینک مستقیم می‌آید، چون نام Client در پنل فقط کاراکترهای امن لاتین دارد.

## سرور داخل ایران / فیلتر بودن تلگرام
اگر `curl -m 10 https://api.telegram.org` از سرور جواب نمی‌دهد، یکی از این‌ها را انتخاب کنید:
1. **پیشنهادی:** ربات را روی یک VPS خارج از ایران اجرا کنید (فقط باید به پنل X-UI دسترسی داشته باشد).
2. `TELEGRAM_PROXY_URL=socks5://127.0.0.1:1080` (یا `http://…`) — تمام ترافیک تلگرام (API و دانلود رسید) از این پروکسی رد می‌شود.
3. `TELEGRAM_API_ROOT=https://relay.example.com` — Bot API reverse-proxy خودتان.

پنل X-UI اگر روی HTTPS است از `https://` استفاده کنید؛ اگر گواهی self-signed است: `XUI_TLS_INSECURE=true` (فقط opt-in؛ MITM را ممکن می‌کند — بهتر است دامنه + گواهی معتبر بگذارید).

## Known limitations
- Adapter 3x-ui بر اساس API مستند پنل نوشته شده و **علیه یک پنل 2.9.4 واقعی اجرا نشده** (در محیط توسعه به سورس/پنل دسترسی نبود). تست‌ها روی `dev/fakeXui.ts` (HTTP) هستند. اگر 2.9.4 مسیر/فیلدی را عوض کرده، فقط `src/providers/vpn/xui/client.ts` تغییر می‌کند.
- Verification خودکار به تغذیه‌ی لجر بانکی نیاز دارد؛ اتصال مستقیم به API بانک خاصی پیاده نشده.
- OCR اختیاری (`tesseract.js` نصب نیست و تست نشده)؛ parser متنی تست شده است.
- ارتباط واقعی با Telegram Bot API در تست‌ها شبیه‌سازی شده؛ قبل از production یک smoke test با توکن واقعی انجام دهید.
- Dockerfile/systemd در محیط توسعه اجرا نشده‌اند. Rate-limit و jobها in-process (تک‌instance).
- Crypto فقط معماری است و تا ثبت `ChainVerifier` واقعی غیرفعال می‌ماند.

### وقتی اتصال مستقیم به پنل فیلتر/کند است (ربات روی سرور خارج، پنل در ایران)
اتصال خروجی از ایران معمولاً کار می‌کند ولی ورودی از خارج مسدود است؛ پس تونل SSH **معکوس** بسازید: سرور پنل با `deploy/panel-tunnel-iran.service` به سرور ربات وصل می‌شود (کلید اختصاصی با `restrict,port-forwarding,permitlisten="127.0.0.1:12020"` در `authorized_keys` سرور ربات) و روی سرور ربات `deploy/panel-relay-bot.service` (socat) آن را برای کانتینر باز می‌کند. سپس `XUI_BASE_URL=https://host.docker.internal:12020/<مسیر-پنل>` و حتماً `XUI_PUBLIC_HOST=<آی‌پی/دامنه‌ی واقعی>` را تنظیم کنید (هاست لینک‌ها از آدرس پنل گرفته می‌شود).
