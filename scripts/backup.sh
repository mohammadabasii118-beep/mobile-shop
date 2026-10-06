#!/usr/bin/env bash
# Backup: PostgreSQL dump + private uploads. Usage: scripts/backup.sh [output-dir]   (needs pg_dump, DATABASE_URL in env or .env)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
: "${DATABASE_URL:?DATABASE_URL is required}"
OUT="${1:-./backups}"; STAMP="$(date +%Y%m%d-%H%M%S)"; mkdir -p "$OUT"
DB_URL="${DATABASE_URL%%\?*}"   # drop ?schema=… (pg_dump does not understand it)
pg_dump --format=custom --no-owner "$DB_URL" > "$OUT/db-$STAMP.dump" || { rm -f "$OUT/db-$STAMP.dump"; echo "pg_dump failed" >&2; exit 1; }
[ -d "${UPLOAD_DIR:-./storage}" ] && tar -czf "$OUT/uploads-$STAMP.tar.gz" -C "${UPLOAD_DIR:-./storage}" .
( cd "$OUT" && sha256sum "db-$STAMP.dump" $( [ -f "uploads-$STAMP.tar.gz" ] && echo "uploads-$STAMP.tar.gz" ) > "SHA256-$STAMP.txt" )
echo "Backup written to $OUT ($STAMP)"
