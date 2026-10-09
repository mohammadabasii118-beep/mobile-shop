#!/usr/bin/env bash
# Restore the bot from a backup made by deploy/backup.sh on a fresh Ubuntu/Debian server (run as root).
# Usage:  bash install.sh /root/pcl-backup-....tar.gz [APP_DIR=/opt/pcl-transfer]
# Stop the OLD bot first (the same token can't poll from two servers).
set -euo pipefail
BACKUP="${1:?usage: install.sh BACKUP.tar.gz [APP_DIR]}"
APP="${2:-/opt/pcl-transfer}"
[ "$(id -u)" = 0 ] || { echo "run as root (sudo -i)"; exit 1; }

if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y && apt-get install -y python3 python3-venv python3-pip fonts-dejavu-core
fi

mkdir -p "$APP" && tar xzf "$BACKUP" -C "$APP"
cd "$APP"
envval() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true; }
DB="$(envval DB_PATH)"; DB="${DB:-pclbot.db}"
[[ "$DB" = /* ]] || DB="$APP/$DB"
mkdir -p "$(dirname "$DB")"
[ -f "$APP/db.snapshot" ] && mv -f "$APP/db.snapshot" "$DB"
if [ -d "$APP/onc_assets_external" ]; then
  A="$(envval ONC_ASSETS_DIR)"; A="${A:-$APP/onc_assets}"; mkdir -p "$A"; cp -a "$APP/onc_assets_external"/. "$A"/; rm -rf "$APP/onc_assets_external"
fi

python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
cat > "$UNIT_DIR/pclbot.service" <<UNIT
[Unit]
Description=PCL Telegram bot (Transfer + ONE NIGHT CHAMPION)
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$APP
ExecStart=$APP/.venv/bin/python run.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now pclbot
sleep 4
systemctl is-active pclbot
journalctl -u pclbot -n 12 --no-pager
echo "✅ done. Test the bot in Telegram. Payment callback: point your domain's DNS to this server (see deploy/nginx.conf)."
