#!/usr/bin/env bash
# Restores a backup produced by scripts/backup.sh. DESTRUCTIVE — this
# overwrites the target database and upload folders. Always test a restore
# on a staging/copy database first (see README "آزمایش بازیابی").
#
# Usage:
#   ./scripts/restore.sh backups/20260101-120000

set -euo pipefail

BACKUP_DIR="${1:-}"
if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
  echo "استفاده: ./scripts/restore.sh backups/<TIMESTAMP>" >&2
  exit 1
fi

if [ -f .env ]; then
  # shellcheck disable=SC1091
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs -0 2>/dev/null || true)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "خطا: DATABASE_URL تنظیم نشده است." >&2
  exit 1
fi

echo "این عملیات دیتابیس فعلی و فایل‌های آپلودی را با محتوای بکاپ جایگزین می‌کند."
read -r -p "برای ادامه 'yes' را تایپ کنید: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "لغو شد."
  exit 0
fi

if [ -f "${BACKUP_DIR}/database.dump" ]; then
  echo "1/3 — بازیابی دیتابیس..."
  pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "${BACKUP_DIR}/database.dump"
else
  echo "هشدار: database.dump در این بکاپ پیدا نشد، از این مرحله صرف‌نظر شد." >&2
fi

if [ -f "${BACKUP_DIR}/public-uploads.tar.gz" ]; then
  echo "2/3 — بازیابی فایل‌های عمومی..."
  rm -rf public/uploads
  tar -xzf "${BACKUP_DIR}/public-uploads.tar.gz" -C .
fi

if [ -f "${BACKUP_DIR}/private-uploads.tar.gz" ]; then
  echo "3/3 — بازیابی فایل‌های خصوصی..."
  rm -rf private-uploads
  tar -xzf "${BACKUP_DIR}/private-uploads.tar.gz" -C .
fi

echo ""
echo "بازیابی کامل شد. اجرا کنید: npx prisma generate && npm run build"
