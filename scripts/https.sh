#!/usr/bin/env bash
# آدرس HTTPS ثابت و مستقیم روی همین سرور (با Caddy و گواهی رایگان Let's Encrypt)، به‌جای تونل رایگان.
#   بدون دامنه:  curl -fsSL <آدرس این فایل> | bash          (از آدرس رایگان sslip.io استفاده می‌کند)
#   با دامنه:    curl -fsSL <آدرس این فایل> | DOMAIN=miras.example.com bash   (قبلش A رکورد دامنه را به IP سرور بزن)
# شرط: پورت ۸۰ و ۴۴۳ آزاد باشد. اگر برنامه‌ی دیگری آن‌ها را گرفته باشد، چیزی نصب نمی‌شود و به آن برنامه دست نمی‌زنیم.
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
say "آدرس: https://$DOMAIN"

# ── پورت‌ها باید آزاد باشند (یا فقط Caddy آن‌ها را گرفته باشد) ──
for p in 80 443; do
  OWNER="$(ss -ltnpH "sport = :$p" 2>/dev/null | head -1 || true)"
  if [ -n "$OWNER" ] && ! echo "$OWNER" | grep -q caddy; then
    die "پورت $p را برنامه‌ی دیگری گرفته: $OWNER
به آن برنامه (مثلاً پنل VPN یا nginx) دست نمی‌زنم. این خط را برایم بفرست تا راه امن دیگری بدهم."
  fi
done

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
$DOMAIN {
  encode gzip
  reverse_proxy 127.0.0.1:$PORT
}
# miras-end"
CF=/etc/caddy/Caddyfile
if [ -f "$CF" ] && grep -qE '^[^#[:space:]].*\{' "$CF" && ! grep -q 'miras-begin' "$CF" && ! grep -q 'Caddy!' "$CF"; then
  say "Caddyfile موجود دست‌نخورده می‌ماند؛ فقط بلوک میراث اضافه می‌شود"
  printf '\n%s\n' "$BLOCK" >> "$CF"
else
  # Caddyfile پیش‌فرض/خودمان: بلوک را جایگزین می‌کنیم
  printf '%s\n' "$BLOCK" > "$CF"
fi
caddy validate --config "$CF" --adapter caddyfile >/dev/null || die "تنظیم Caddy نامعتبر شد"

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy

# ── صبر برای گواهی ──
say "گرفتن گواهی HTTPS (تا ۶۰ ثانیه)"
OK=0
for _ in $(seq 1 30); do
  if curl -fsS -m 6 "https://$DOMAIN/health" >/dev/null 2>&1; then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  journalctl -u caddy -n 25 --no-pager
  die "گواهی/آدرس بالا نیامد. لاگ بالا را بفرست. (چک کن پورت ۸۰ و ۴۴۳ از بیرون باز باشند)"
fi

# ── بازی و ربات به آدرس جدید وصل شوند؛ تونل رایگان دیگر لازم نیست ──
{ grep -v '^WEBAPP_URL=' "$ENV_FILE" || true; echo "WEBAPP_URL=https://$DOMAIN"; } > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE" && chmod 600 "$ENV_FILE"
systemctl disable --now miras-tunnel 2>/dev/null || true
pkill -x cloudflared 2>/dev/null || true
systemctl restart miras

printf '\n\033[1;32m✔ آدرس ثابت HTTPS آماده است: https://%s\033[0m\n' "$DOMAIN"
echo "  حالا توی تلگرام به ربات یک /start جدید بزن (پیام‌های قدیمی به آدرس تونل وصلن)."
echo "  این آدرس با ری‌استارت یا ریبوت عوض نمی‌شود."
