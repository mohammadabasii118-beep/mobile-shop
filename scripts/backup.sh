#!/usr/bin/env bash
# Backs up the database and every uploaded-file folder into one timestamped
# archive under ./backups/. Run this BEFORE any migration, Prisma schema
# change, or risky deploy — see README "بکاپ و بازیابی".
#
# Usage:
#   ./scripts/backup.sh
#
# Requires: pg_dump (matching your PostgreSQL major version), DATABASE_URL
# set in the environment (or in .env, if you export it first).

set -euo pipefail

if [ -f .env ]; then
  # shellcheck disable=SC1091
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs -0 2>/dev/null || true)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "خطا: DATABASE_URL تنظیم نشده است (در .env یا محیط)." >&2
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="backups/${TIMESTAMP}"
mkdir -p "$OUT_DIR"

echo "1/3 — تخلیه دیتابیس..."
pg_dump "$DATABASE_URL" --format=custom --file="${OUT_DIR}/database.dump"

echo "2/3 — بایگانی فایل‌های آپلودی عمومی (public/uploads)..."
if [ -d public/uploads ]; then
  tar -czf "${OUT_DIR}/public-uploads.tar.gz" public/uploads
fi

echo "3/3 — بایگانی فایل‌های خصوصی (رسیدهای کارت‌به‌کارت)..."
if [ -d private-uploads ]; then
  tar -czf "${OUT_DIR}/private-uploads.tar.gz" private-uploads
fi

echo ""
echo "بکاپ کامل شد: ${OUT_DIR}/"
echo "این پوشه را در جایی خارج از همین سرور (استوریج ابری، سرور دیگر) هم نگه دارید."
