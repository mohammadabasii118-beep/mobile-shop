#!/usr/bin/env bash
# Nightly backup + 14-day retention. Called by /etc/cron.d/caseline-backup as the app user.
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="${BACKUP_DIR:-/srv/caseline-data/backups}"
bash scripts/backup.sh "$DIR"
find "$DIR" -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' -o -name 'SHA256-*.txt' \) -mtime +14 -delete
