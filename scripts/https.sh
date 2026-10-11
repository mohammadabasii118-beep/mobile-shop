#!/usr/bin/env bash
# آدرس HTTPS ثابت و مستقیم روی همین سرور (با Caddy و گواهی رایگان Let's Encrypt)، به‌جای تونل رایگان.
#   بدون دامنه:  curl -fsSL <آدرس این فایل> | bash          (از آدرس رایگان sslip.io استفاده می‌کند)
#   با دامنه:    curl -fsSL <آدرس این فایل> | DOMAIN=miras.example.com bash   (قبلش A رکورد دامنه را به IP سرور بزن)
# پورت HTTPS: ۴۴۳ اگر آزاد باشد؛ اگر برنامه‌ی دیگری (مثلاً VPN) آن را گرفته باشد خودکار ۸۴۴۳ (یا HTTPS_PORT=...).
# پورت ۸۰ باید آزاد یا مال خود Caddy باشد (برای گرفتن گواهی). به برنامه‌های دیگر دست نمی‌زنیم.
set -euo pipefail
ENV_FILE=/etc/miras.env
say() { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "با root اجرا کن"
[ -f "$ENV_FILE" ] || die "اول install.sh را اجرا کن"
PORT="$(grep '^PORT=' "$ENV_FILE" | cut -d= -f2)"; PORT="${PORT:-3000}"

# ── دامنه ──
if [ -z "${DOMAIN:-}" ]; then
  IP="$(curl -4 -fsS -m 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
  [ -n "$IP" ] || die "IP سرور پیدا نشد؛ DOMAIN را خودت بده"
  DOMAIN="miras.$(echo "$IP" | tr . -).sslip.io"
fi
say "دامنه: $DOMAIN"

# ── پورت‌ها ──
owner_of() { ss -ltnpH "sport = :$1" 2>/dev/null | head -1 || true; }
OWN80="$(owner_of 80)"
if [ -n "$OWN80" ] && ! echo "$OWN80" | grep -q caddy; then
  die "پورت ۸۰ را برنامه‌ی دیگری گرفته: $OWN80
برای گرفتن گواهی به پورت ۸۰ نیاز داریم. این خط را برایم بفرست تا راه امن دیگری بدهم."
fi
if [ -z "${HTTPS_PORT:-}" ]; then
  OWN443="$(owner_of 443)"
  if [ -z "$OWN443" ] || echo "$OWN443" | grep -q caddy; then HTTPS_PORT=443
  else HTTPS_PORT=8443; say "پورت ۴۴۳ مال برنامه‌ی دیگری است ($(echo "$OWN443" | grep -o 'users:.*' | head -c 60)); بازی روی پورت $HTTPS_PORT با HTTPS اجرا می‌شود"; fi
fi
if [ "$HTTPS_PORT" != 443 ]; then
  OWNP="$(owner_of "$HTTPS_PORT")"
  if [ -n "$OWNP" ] && ! echo "$OWNP" | grep -q caddy; then die "پورت $HTTPS_PORT هم گرفته شده: $OWNP؛ HTTPS_PORT=<پورت آزاد دیگر> را بده"; fi
fi
if [ "$HTTPS_PORT" = 443 ]; then SITE="$DOMAIN"; URL="https://$DOMAIN"; else SITE="$DOMAIN:$HTTPS_PORT"; URL="https://$DOMAIN:$HTTPS_PORT"; fi
say "آدرس نهایی: $URL"

# ── نصب Caddy ──
if ! command -v caddy >/dev/null; then
  say "نصب Caddy"
  command -v apt-get >/dev/null || die "این اسکریپت برای اوبونتو/دبیان است"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y >/dev/null && apt-get install -y caddy
fi

# ── تنظیم Caddy: اگر Caddyfile دیگری (با سایت‌های دیگر) هست فقط بلوک ما اضافه می‌شود ──
BLOCK="# miras-begin
$SITE {
  encode gzip
  reverse_proxy 127.0.0.1:$PORT
}
# miras-end"
CF=/etc/caddy/Caddyfile
[ -f "$CF" ] && [ ! -f "$CF.bak.miras" ] && cp "$CF" "$CF.bak.miras"
# بلوک قدیمیِ خودمان (اگر از اجرای قبلی مانده) حذف می‌شود؛ بقیه‌ی فایل هیچ‌وقت دست نمی‌خورد
[ -f "$CF" ] && sed -i '/# miras-begin/,/# miras-end/d' "$CF"
if [ -f "$CF" ] && grep -qE '^[^#[:space:]]' "$CF"; then
  say "Caddyfile موجود دست‌نخورده می‌ماند؛ فقط بلوک میراث به انتهایش اضافه می‌شود"
  printf '\n%s\n' "$BLOCK" >> "$CF"
else
  printf '%s\n' "$BLOCK" > "$CF"   # فایل خالی یا فقط کامنت
fi
# اگر Caddyfile موجود تنظیم سراسری auto_https دارد (مثلاً خاموش)، گواهی خودکار کار نمی‌کند؛ دست نمی‌زنیم
if grep -qE '^\s*auto_https' "$CF" 2>/dev/null; then
  [ -f "$CF.bak.miras" ] && cp "$CF.bak.miras" "$CF"
  die "Caddyfile موجود auto_https را تنظیم کرده؛ برای اینکه خرابش نکنم متوقف شدم. محتوای $CF را برایم بفرست."
fi
if ! caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1; then
  [ -f "$CF.bak.miras" ] && cp "$CF.bak.miras" "$CF"
  die "تنظیم Caddy نامعتبر شد؛ تنظیم قبلی برگردانده شد و چیزی عوض نشد."
fi

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then ufw allow 80/tcp >/dev/null; ufw allow "$HTTPS_PORT"/tcp >/dev/null; fi
systemctl enable --now caddy
if ! systemctl reload caddy; then
  [ -f "$CF.bak.miras" ] && cp "$CF.bak.miras" "$CF" && systemctl reload caddy || true
  die "Caddy تنظیم جدید را نپذیرفت؛ تنظیم قبلی برگردانده شد."
fi

# ── صبر برای گواهی ──
say "گرفتن گواهی HTTPS (تا ۶۰ ثانیه)"
OK=0
for _ in $(seq 1 30); do
  if curl -fsS -m 6 "$URL/health" >/dev/null 2>&1; then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  journalctl -u caddy -n 25 --no-pager
  die "گواهی/آدرس بالا نیامد. لاگ بالا را بفرست. (چک کن پورت ۸۰ و $HTTPS_PORT از بیرون باز باشند؛ در فایروال پنل سرور هم باید باز باشند)"
fi

# ── بازی و ربات به آدرس جدید وصل شوند؛ تونل رایگان دیگر لازم نیست ──
{ grep -v '^WEBAPP_URL=' "$ENV_FILE" || true; echo "WEBAPP_URL=$URL"; } > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE" && chmod 600 "$ENV_FILE"
systemctl disable --now miras-tunnel 2>/dev/null || true
pkill -x cloudflared 2>/dev/null || true
systemctl restart miras

printf '\n\033[1;32m✔ آدرس ثابت HTTPS آماده است: %s\033[0m\n' "$URL"
echo "  حالا توی تلگرام به ربات یک /start جدید بزن (پیام‌های قدیمی به آدرس تونل وصلن)."
echo "  این آدرس با ری‌استارت یا ریبوت عوض نمی‌شود."
