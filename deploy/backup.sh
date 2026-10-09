#!/usr/bin/env bash
# One-file backup of the whole bot: code, .env, the database (consistent snapshot), ONC assets (fonts/backgrounds/PCL logo).
# Usage:  bash deploy/backup.sh [APP_DIR=/opt/pcl-transfer] [OUT=~/pcl-backup-DATE.tar.gz]
set -euo pipefail
APP="${1:-/opt/pcl-transfer}"
OUT="${2:-$HOME/pcl-backup-$(date +%F-%H%M).tar.gz}"
cd "$APP"
PY="$APP/.venv/bin/python"; [ -x "$PY" ] || PY="$(command -v python3)"

envval() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true; }
DB="$(envval DB_PATH)"; DB="${DB:-pclbot.db}"
ASSETS="$(envval ONC_ASSETS_DIR)"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# SQLite online backup = a safe copy even while the bot is running (never copy a live .db file by hand)
"$PY" - "$DB" "$TMP/db.snapshot" <<'PY'
import sqlite3, sys
src = sqlite3.connect(sys.argv[1]); dst = sqlite3.connect(sys.argv[2])
src.backup(dst); dst.close(); src.close()
print("database snapshot OK")
PY

EXTRA=()
# assets that live outside the app folder (e.g. /data/onc_assets) are included too
if [ -n "$ASSETS" ] && [ -d "$ASSETS" ] && [[ "$ASSETS" = /* ]] && [[ "$ASSETS" != "$APP"/* ]]; then
  mkdir -p "$TMP/onc_assets_external"; cp -a "$ASSETS"/. "$TMP/onc_assets_external"/
  EXTRA=(-C "$TMP" onc_assets_external)
fi
tar czf "$OUT" --exclude=.venv --exclude=__pycache__ --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' \
    --exclude='*.pre-onc.bak' -C "$APP" . -C "$TMP" db.snapshot "${EXTRA[@]}"
chmod 600 "$OUT"
echo "✅ backup: $OUT  ($(du -h "$OUT" | cut -f1))"
echo "⚠️  it contains .env (bot token / merchant id): move it with scp and delete it afterwards."
