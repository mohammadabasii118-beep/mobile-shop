#!/usr/bin/env bash
# Restore a backup INTO AN EMPTY DATABASE (refuses to touch one that has tables). Usage:
#   scripts/restore.sh <db-dump-file> <target-database-url> [uploads-tarball] [uploads-dir]
set -euo pipefail
DUMP="${1:?dump file}"; TARGET="${2:?target database url}"; UPL="${3:-}"; UDIR="${4:-./storage}"
URL="${TARGET%%\?*}"
N="$(psql "$URL" -Atc "select count(*) from information_schema.tables where table_schema='public'")"
if [ "$N" != "0" ]; then echo "Refusing: target database already has $N tables. Restore into a new empty database, then switch DATABASE_URL." >&2; exit 1; fi
pg_restore --no-owner --exit-on-error -d "$URL" "$DUMP"
if [ -n "$UPL" ]; then mkdir -p "$UDIR"; tar -xzf "$UPL" -C "$UDIR"; fi
echo "Restore complete."
