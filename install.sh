#!/usr/bin/env bash
# نصب و به‌روزرسانی «میراث» روی سرور لینوکسی (به‌صورت root).
#   نصب تست (بدون ربات):  curl -fsSL <آدرس این فایل> | bash
#   نصب واقعی:            curl -fsSL <آدرس این فایل> | BOT_TOKEN="توکن" ADMIN_IDS="شناسه‌ی_تلگرام_تو" bash
# اجرای دوباره = به‌روزرسانی (دیتابیس، عکس کارت‌ها و تنظیمات شما حفظ می‌شود).
set -euo pipefail

REPO="${REPO:-https://github.com/mohammadabasii118-beep/mobile-shop.git}"
BRANCH="${BRANCH:-claude/card-battle-game}"
DIR="${DIR:-/opt/miras}"
PORT="${PORT:-3000}"
ENV_FILE=/etc/miras.env

say() { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "این اسکریپت را با کاربر root اجرا کن."
command -v systemctl >/dev/null || die "systemd پیدا نشد (این اسکریپت برای سرورهای معمول اوبونتو/دبیان/سنت‌اواس است)."

# ── ابزارهای پایه ──
need_pkgs=""
command -v git  >/dev/null || need_pkgs="$need_pkgs git"
command -v curl >/dev/null || need_pkgs="$need_pkgs curl"
if [ -n "$need_pkgs" ]; then
  say "نصب:$need_pkgs"
  if command -v apt-get >/dev/null; then apt-get update -y >/dev/null && apt-get install -y $need_pkgs
  elif command -v dnf >/dev/null; then dnf install -y $need_pkgs
  elif command -v yum >/dev/null; then yum install -y $need_pkgs
  else die "نصب $need_pkgs را دستی انجام بده."; fi
fi

# ── Node.js ۲۲ ──
node_major() { node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/'; }
if ! command -v node >/dev/null || [ "$(node_major)" -lt 22 ]; then
  say "نصب Node.js 22"
  if command -v apt-get >/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
  elif command -v dnf >/dev/null || command -v yum >/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && (dnf install -y nodejs || yum install -y nodejs)
  else die "Node.js 22 را دستی نصب کن (https://nodejs.org)."; fi
fi
[ "$(node_major)" -ge 22 ] || die "نسخه‌ی Node باید ۲۲ یا بالاتر باشد (الان: $(node -v))."

# ── دریافت کد ──
if [ -d "$DIR/.git" ]; then
  say "به‌روزرسانی کد در $DIR"
  git -C "$DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DIR" checkout -q -B "$BRANCH" FETCH_HEAD
  git -C "$DIR" reset -q --hard FETCH_HEAD
else
  say "دریافت کد در $DIR"
  git clone --depth 1 -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

say "نصب وابستگی‌ها و ساخت برنامه (چند دقیقه طول می‌کشد)"
npm install --no-audit --no-fund
npm run build

# ── تنظیمات (فایل env؛ مقدارهای قبلی حفظ می‌شوند) ──
touch "$ENV_FILE"; chmod 600 "$ENV_FILE"
setenv() { { grep -v "^$1=" "$ENV_FILE" || true; printf '%s=%s\n' "$1" "$2"; } > "$ENV_FILE.tmp"; mv "$ENV_FILE.tmp" "$ENV_FILE"; chmod 600 "$ENV_FILE"; }
delenv() { { grep -v "^$1=" "$ENV_FILE" || true; } > "$ENV_FILE.tmp"; mv "$ENV_FILE.tmp" "$ENV_FILE"; chmod 600 "$ENV_FILE"; }
setenv PORT "$PORT"
setenv DATA_DIR "$DIR/data"
if [ -n "${BOT_TOKEN:-}" ]; then setenv BOT_TOKEN "$BOT_TOKEN"; fi
if [ -n "${ADMIN_IDS:-}" ]; then setenv ADMIN_IDS "$ADMIN_IDS"; fi
if grep -q '^BOT_TOKEN=' "$ENV_FILE"; then
  setenv NODE_ENV production; MODE="واقعی (فقط ورود با تلگرام)"
else
  delenv NODE_ENV; MODE="تست (ورود آزمایشی و پنل مدیریت برای همه باز است)"
fi

# ── سرویس systemd ──
cat > /etc/systemd/system/miras.service <<UNIT
[Unit]
Description=Miras card battle game
After=network.target

[Service]
WorkingDirectory=$DIR
EnvironmentFile=$ENV_FILE
ExecStart=$DIR/node_modules/.bin/tsx server/src/index.ts
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

# سرویس/پروسه‌ی قدیمی که پورت را گرفته آزاد شود
systemctl disable --now game 2>/dev/null || true
systemctl stop miras 2>/dev/null || true
OLD_PID="$(ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)"
if [ -n "$OLD_PID" ]; then say "بستن پروسه‌ی قدیمی روی پورت $PORT (pid $OLD_PID)"; kill "$OLD_PID" 2>/dev/null || true; sleep 1; fi

# فایروال سرور (اگر فعال است)
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then ufw allow "$PORT/tcp" >/dev/null; fi
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then firewall-cmd --permanent --add-port="$PORT/tcp" >/dev/null && firewall-cmd --reload >/dev/null; fi

systemctl daemon-reload
systemctl enable --now miras

say "بررسی سلامت"
OK=0
for _ in $(seq 1 30); do
  if curl -fs "http://127.0.0.1:$PORT/health" >/dev/null; then OK=1; break; fi
  sleep 1
done
if [ "$OK" != 1 ]; then journalctl -u miras -n 30 --no-pager; die "سرور بالا نیامد؛ لاگ بالا را بفرست."; fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
printf '\n\033[1;32m✔ «میراث» بالا آمد — حالت %s\033[0m\n' "$MODE"
echo "  آدرس:        http://${IP:-IP-سرور}:$PORT"
echo "  لاگ:         journalctl -u miras -f"
echo "  ری‌استارت:    systemctl restart miras"
echo "  داده‌ها:      $DIR/data (دیتابیس و عکس کارت‌ها؛ بکاپ بگیر)"
echo "  اگر از بیرون باز نشد، پورت $PORT را در فایروال پنل سرور (جایی که سرور را خریدی) باز کن."
