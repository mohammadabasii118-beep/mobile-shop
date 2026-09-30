# Production guide (VPS, no deployment was performed)

## 1. Requirements
Node 22 LTS, PostgreSQL 16, nginx (or Caddy) with a TLS certificate, a non-root user, a systemd unit, a cron for backups.

## 2. Environment (`/srv/caseline/.env`, mode 600)
```
DATABASE_URL="postgresql://caseline:<strong>@127.0.0.1:5432/caseline?schema=public"
AUTH_SECRET="<openssl rand -base64 48>"
APP_URL="https://shop.example.com"      # https ⇒ Secure cookies + HSTS + correct canonicals/sitemap
NODE_ENV=production
TRUST_PROXY=1                            # only behind nginx/Caddy that overwrites X-Forwarded-For
UPLOAD_DIR="/srv/caseline-data/storage"  # private, writable, backed up, NOT under public/
SMS_PROVIDER="console"                   # replace before launch — see EXTERNAL_SERVICES.md
DB_POOL_MAX=10                           # keep (pool × app processes) < PostgreSQL max_connections
NOTIFY_CHANNELS=""
```
The app **refuses to start in production** with a placeholder `AUTH_SECRET` or an `http://` `APP_URL` (`ALLOW_INSECURE_HTTP=1` exists only for local staging checks).

## 3. First deployment
```
git clone … /srv/caseline && cd /srv/caseline
npm ci
npx prisma migrate deploy            # applies migrations; NEVER `migrate reset` / `db:reset` on a real DB
BOOTSTRAP_ADMIN_PHONE=09xxxxxxxxx BOOTSTRAP_ADMIN_PASSWORD='<≥12 chars, upper+lower+digit>' npm run bootstrap:prod
npm run build
npm run preflight                    # must print "Ready"
```
`bootstrap:prod` creates roles/permissions and the first super admin and marks the database as a *production instance*; from then on `prisma db seed` refuses to run there. **Do not run the demo seed on the real database** (it also refuses whenever any non-demo user exists). Then add real content (categories, products, banners, blog, shipping methods, payment card details, SEO) in `/admin`.

Demo accounts (`0912000000x`) exist only in development databases. `preflight` fails if any exist in the target DB.

## 4. Run
systemd unit (`ExecStart=/usr/bin/npm run start -- -p 3000`, `EnvironmentFile=/srv/caseline/.env`, `Restart=always`, `User=caseline`). Logs are JSON lines on stdout → `journalctl -u caseline -o cat`.

nginx essentials:
```
server { listen 443 ssl http2; server_name shop.example.com;
  client_max_body_size 30m;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; } }
server { listen 80; server_name shop.example.com; return 301 https://$host$request_uri; }
```
(`$remote_addr`, not `$proxy_add_x_forwarded_for`, so clients cannot spoof their IP.)

## 5. Health check
`GET /api/health` → `200 {"status":"ok","db":"up"}` or `503 {"status":"degraded"}`. No secrets or data. Point the uptime monitor at it.

## 6. Backup & restore
- **Database:** `scripts/backup.sh [dir]` → `pg_dump --format=custom` + tarball of `UPLOAD_DIR` + SHA-256 sums. Cron nightly, keep 14 dailies + 8 weeklies, copy **off-server**.
- **Restore (tested):** create an empty database, then `scripts/restore.sh <db-…dump> <new-database-url> [uploads-….tar.gz] [uploads-dir]`. It refuses a non-empty target. Point `DATABASE_URL` at it, run `npm run preflight`, start the app. Phase 5 verified a restore of the development database (1 649 users / 703 orders / 380 products / 263 wallet rows identical) into a scratch DB.
- Test a restore quarterly. Receipts and support attachments live in `UPLOAD_DIR` — the DB alone is not a complete backup.

## 7. Updating
`git pull && npm ci && npx prisma migrate deploy && npm run build && systemctl restart caseline` (back up first; migrations are forward-only).

## 8. Launch checklist
- [ ] `npm run preflight` = Ready · [ ] real SMS provider configured (OTP login is unusable with `console`) · [ ] payment card details filled in `/admin/settings` · [ ] shipping methods/costs real · [ ] `APP_URL` https, certificate auto-renews · [ ] nightly backup + a restore rehearsal · [ ] sitemap submitted · [ ] demo products/banners/blog reviewed or replaced · [ ] `finance.fourEyes` on and at least two staff hold `refund.approve`/`refund.manage` · [ ] firewall: only 80/443 (+ SSH) open, PostgreSQL bound to localhost.
