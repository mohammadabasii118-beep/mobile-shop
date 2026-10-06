#!/usr/bin/env bash
# Update to a new release tarball. Backs up first. Usage (as root):  bash /srv/caseline/deploy/update.sh /root/caseline-new.tar.gz
set -euo pipefail
TARBALL="${1:?path to new caseline tarball}"; APP_USER="${APP_USER:-caseline}"; APP_DIR="${APP_DIR:-/srv/caseline}"
[ "$(id -u)" = 0 ] || { echo "Run as root." >&2; exit 1; }
sudo -u "$APP_USER" bash "$APP_DIR/deploy/backup-cron.sh"
tar -xzf "$TARBALL" -C "$APP_DIR"      # .env and uploads live outside the tarball and are untouched
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm ci && npx prisma migrate deploy && npm run build"
systemctl restart caseline
sleep 4; curl -fsS http://127.0.0.1:3000/api/health && echo
