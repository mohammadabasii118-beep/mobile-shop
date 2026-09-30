#!/usr/bin/env bash
# CaseLine — first-time server setup for Ubuntu 22.04/24.04. Run as root. Safe to re-run (never overwrites .env or the database).
#
#   sudo DOMAIN=shop.example.com EMAIL=you@example.com bash deploy/install.sh /root/caseline.tar.gz
#
# Nothing here touches any external service. It asks for the first admin's phone and password interactively
# (they are never written to disk or to logs).
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=shop.example.com}"
: "${EMAIL:?Set EMAIL (used for the free SSL certificate)}"
TARBALL="${1:-}"
APP_USER="${APP_USER:-caseline}"
APP_DIR="${APP_DIR:-/srv/caseline}"
DATA_DIR="${DATA_DIR:-/srv/caseline-data}"
DB_NAME="${DB_NAME:-caseline}"
APP_PORT="${APP_PORT:-3000}"
[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }
[ -f "$TARBALL" ] || { echo "Usage: DOMAIN=… EMAIL=… bash install.sh /path/to/caseline.tar.gz" >&2; exit 1; }
. /etc/os-release; case "$VERSION_ID" in 22.04|24.04) ;; *) echo "Tested on Ubuntu 22.04/24.04 only (found $VERSION_ID)." >&2; exit 1;; esac
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

say "1/9 System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw nginx certbot python3-certbot-nginx postgresql postgresql-contrib cron openssl
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  say "Installing Node.js 22 (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v; psql --version

say "2/9 Service user and folders"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR/storage" "$DATA_DIR/backups"
chmod 700 "$DATA_DIR" "$DATA_DIR/storage" "$DATA_DIR/backups"

say "3/9 Application files"
tar -xzf "$TARBALL" -C "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"

say "4/9 PostgreSQL database (kept if it already exists)"
systemctl enable --now postgresql
ENV_FILE="$APP_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  echo ".env already exists — keeping it (database and secrets unchanged)."
else
  DB_PASS="$(openssl rand -hex 24)"
  AUTH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  if ! sudo -u postgres psql -Atc "select 1 from pg_roles where rolname='$APP_USER'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE ROLE $APP_USER LOGIN PASSWORD '$DB_PASS'"
  else
    sudo -u postgres psql -c "ALTER ROLE $APP_USER PASSWORD '$DB_PASS'"
  fi
  sudo -u postgres psql -Atc "select 1 from pg_database where datname='$DB_NAME'" | grep -q 1 || sudo -u postgres createdb -O "$APP_USER" "$DB_NAME"
  umask 077
  cat > "$ENV_FILE" <<ENV
DATABASE_URL="postgresql://$APP_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME?schema=public"
AUTH_SECRET="$AUTH_SECRET"
APP_URL="https://$DOMAIN"
NODE_ENV="production"
TRUST_PROXY="1"
UPLOAD_DIR="$DATA_DIR/storage"
STORAGE_DRIVER="local"
# Replace with a real SMS provider before public launch (see docs/EXTERNAL_SERVICES.md). With "console" OTP codes are only printed to the server log.
SMS_PROVIDER="console"
NOTIFY_CHANNELS=""
DB_POOL_MAX="10"
# Password-reset e-mails (fill in, then: systemctl restart caseline). Empty = no e-mail is sent.
EMAIL_SMTP_URL=""
EMAIL_FROM=""
ENV
  chown "$APP_USER:$APP_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
fi

say "5/9 Install dependencies, migrate, build"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm ci && npx prisma migrate deploy && npm run build"

say "6/9 First admin account (skipped if a super admin already exists)"
HAS_ADMIN="$(sudo -u postgres psql -d "$DB_NAME" -Atc "select count(*) from \"UserRole\" ur join \"Role\" r on r.id=ur.\"roleId\" where r.key='super_admin'" 2>/dev/null || echo 0)"
if [ "${HAS_ADMIN:-0}" = "0" ]; then
  read -r -p "Admin mobile number (09xxxxxxxxx): " ADMIN_PHONE
  read -r -s -p "Admin password (min 12 chars, upper+lower+digit): " ADMIN_PASSWORD; echo
  sudo -u "$APP_USER" env BOOTSTRAP_ADMIN_PHONE="$ADMIN_PHONE" BOOTSTRAP_ADMIN_PASSWORD="$ADMIN_PASSWORD" bash -lc "cd '$APP_DIR' && npm run bootstrap:prod"
  unset ADMIN_PASSWORD
else
  echo "A super admin already exists."
fi

say "7/9 systemd service"
cat > /etc/systemd/system/caseline.service <<UNIT
[Unit]
Description=CaseLine shop
After=network.target postgresql.service
[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1 -p $APP_PORT
Restart=always
RestartSec=3
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable caseline
systemctl restart caseline

say "8/9 nginx (HTTP first, then HTTPS via Let's Encrypt), firewall, backups"
cat > /etc/nginx/sites-available/caseline <<NGINX
server {
  listen 80;
  server_name $DOMAIN;
  client_max_body_size 30m;
  location / {
    proxy_pass http://127.0.0.1:$APP_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 60s;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/caseline /etc/nginx/sites-enabled/caseline
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw --force enable
if certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect; then
  echo "HTTPS enabled."
else
  echo "WARNING: certificate request failed (is the DNS A record for $DOMAIN pointing to this server?). Fix DNS, then run:  certbot --nginx -d $DOMAIN -m $EMAIL --agree-tos --redirect" >&2
fi
cat > /etc/cron.d/caseline-backup <<CRON
# Nightly backup at 03:10, keeps 14 days. Copy $DATA_DIR/backups off the server too.
10 3 * * * $APP_USER bash $APP_DIR/deploy/backup-cron.sh >> $DATA_DIR/backups/cron.log 2>&1
CRON
chmod 644 /etc/cron.d/caseline-backup

say "9/9 Checks"
sleep 4
curl -fsS "http://127.0.0.1:$APP_PORT/api/health" && echo
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm run preflight" || true
echo
echo "Done. Open https://$DOMAIN  ·  logs: journalctl -u caseline -f  ·  update later: bash $APP_DIR/deploy/update.sh <new-tarball>"
