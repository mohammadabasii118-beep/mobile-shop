# Security model & Phase 5 audit

## Controls in place
| Area | Control |
|---|---|
| Authentication | OTP or password; bcrypt (cost 12); constant-time failure path (`dummyVerify`) so unknown phones are indistinguishable; OTP hashed with `AUTH_SECRET`, single use, expiring; per-phone + per-IP limits on login, OTP request/verify, password change |
| Sessions | random token in an **HttpOnly, SameSite=Lax, Secure (when `APP_URL` is https)** cookie; only its hash is stored; password reset / change / deactivation revoke sessions server-side |
| Authorization | server-side only: `authorizeAdmin(perm)` on every admin API (`adminRoute`) and `requireAdminPage` on pages; customer data always filtered by `userId`; roles/permissions in DB |
| CSRF | every cookie-authenticated write goes through `route()`, which rejects cross-origin `Origin` (403 `csrf`); SameSite cookie as second layer |
| XSS | React escaping; CSP with **per-request nonce** + `strict-dynamic` (no `unsafe-inline`/`unsafe-eval` for scripts); JSON-LD escaped (`<` → `<`); `innerHTML` in `public/site.js` only with `esc()`-escaped values; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` |
| SQL injection | Prisma parameterised queries; the only raw SQL is `Prisma.sql` tagged templates with bound parameters |
| Rate limiting | PostgreSQL fixed-window limiter (multi-instance safe): auth, OTP, checkout, cart, coupon, reviews, uploads, tickets, wholesale, admin (read/write) **and a per-session write limiter (240/min) on every cookie-authenticated write** (Phase 5) |
| Uploads | magic-byte sniffing, extension/MIME agreement, 5 MB (receipts) / 4 MB (images) caps, server-generated names, stored **outside `public/`**; served only through authorised endpoints with `nosniff`, `CSP: sandbox`, `no-store`; request bodies over 12 MB refused (413) before parsing |
| Money | wallet and loyalty ledgers are append-only, idempotent per reference, balance can never go negative (guarded `UPDATE … WHERE balance + Δ >= 0`); orders/refunds serialised with row locks / advisory locks; refunds reserve their amount so parallel requests cannot exceed what was paid; **four-eyes** for bank refunds (Phase 5) |
| Headers | CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP, HSTS (https only); private paths `noindex` + `no-store` |
| Secrets | only in `.env` (git-ignored); production start refuses placeholder `AUTH_SECRET` and non-https `APP_URL`; `npm run preflight` checks the deployment |
| Logging | one-line JSON logs with a request id; 500 responses show the id, never a stack trace |

## Findings from the Phase 5 audit (all fixed, each with a test in `scripts/e2e-phase5.test.ts`)
| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | No global write throttle: an authenticated client could hammer any endpoint that lacked a specific limiter | Medium | per-session write limiter in `route()` (429) |
| 2 | Request bodies were buffered without a size limit before validation | Medium | 12 MB cap on declared length (413); 28 MB only on the product-media upload route (videos ≤ 25 MB); nginx `client_max_body_size 30m` |
| 3 | Bank refunds could be requested and approved by the same person | Medium (fraud) | four-eyes rule, setting `finance.fourEyes` (default on), audited |
| 4 | Partial refunds left loyalty points untouched (points farming through partial refunds) | Low–Medium | proportional reversal; final refund reverses only the remainder |
| 5 | `public/site.js` thumbnail builder interpolated image URLs/ids into `innerHTML`/CSS with `encodeURI` only | Low | `(`, `)`, `'`, `"` encoded, ids escaped, hue coerced to number |
| 6 | Production could start with a placeholder `AUTH_SECRET` or over plain http | Medium | startup validation (`productionProblems`) |
| 7 | Demo seed could run against a database with real users | High (data/credential exposure: known demo passwords) | seed refuses if the DB is marked production or contains non-demo users; `bootstrap-production` creates the first real admin |
| 8 | Rate-limit table grew without bound | Low | opportunistic pruning |
| 9 | Admin pages streamed through a Suspense boundary turned the permission redirect into a soft (200) redirect | Low | removed `admin/loading.tsx`; regression covered by the existing Phase 3 test |

Verified with no change needed: IDOR on orders / receipts / tickets, admin API 401/403 matrix, private upload paths, cookie flags, login enumeration, SQLi strings in filters, CSRF on admin writes, JSON-LD breakout, double-submit of wallet credits, parallel refunds.

## Accepted / documented
- `style-src 'unsafe-inline'` (inline `style=` attributes in the design). Scripts are strict.
- Receipt download returns 403 (not 404) to a non-owner: ids are unguessable cuids.
- `npm audit`: 4 advisories only in the Prisma CLI's transitive deps (see TECH_DEBT #10).
- Rate limiting per IP needs `TRUST_PROXY=1` behind nginx/Caddy that **overwrites** `X-Forwarded-For`.

## Phase 8 — registration without SMS
Public sign-up is full name + e-mail + password (`POST /api/auth/register`) and partner sign-up adds business fields (`POST /api/wholesale/register`); neither sends or needs a code. Bodies are `.strict()` (no roles/status/phone), passwords use the existing bcrypt(12) hashing, e-mail is unique (409 `email_taken`), registration is rate limited per IP and e-mail, and the standard CSRF/origin check applies. Phone-code sign-in only works for existing accounts and never creates one. Wholesale access is granted only by an admin approval. Known gap: password reset is still by phone code, so e-mail-only accounts need support until an e-mail gateway exists.

## Password reset by e-mail
`POST /api/auth/forgot {email}` always answers `{sent:true}` (no enumeration; per-IP 10/h and per-address 3/h, checked before the address is looked up). For a registered active account a 256-bit random token is stored **only as SHA-256**, valid 60 minutes, single use, and only the newest link works; the link is built from `APP_URL`. `POST /api/auth/reset {token,password}` claims the token atomically, sets the password (same bcrypt/policy) and signs every device out. Mail goes through `EMAIL_SMTP_URL`; without it nothing is sent and a warning is logged.
