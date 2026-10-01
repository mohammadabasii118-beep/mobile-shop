#!/usr/bin/env bash
# Daily backup (cron): database + private receipts. Keep copies OFF the server.
set -euo pipefail
DIR=${BACKUP_DIR:-/var/backups/vpn-bot}; mkdir -p "$DIR"; TS=$(date +%F_%H%M)
docker compose exec -T db pg_dump -U vpn vpnbot | gzip > "$DIR/db_$TS.sql.gz"
docker run --rm -v vpn-bot_receipts:/r -v "$DIR":/b alpine tar czf "/b/receipts_$TS.tgz" -C /r .
find "$DIR" -type f -mtime +14 -delete
