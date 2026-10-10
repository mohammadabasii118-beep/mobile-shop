#!/usr/bin/env bash
# تونل HTTPS رایگان (cloudflared) به‌صورت سرویس خودترمیم برای «میراث».
# هر بار که تونل بالا بیاید، آدرس جدید خودکار در /etc/miras.env گذاشته می‌شود و بازی/ربات ری‌استارت می‌شوند.
# نصب:  curl -fsSL https://raw.githubusercontent.com/mohammadabasii118-beep/mobile-shop/claude/card-battle-game/scripts/tunnel.sh | bash
set -euo pipefail
ENV_FILE=/etc/miras.env
[ "$(id -u)" -eq 0 ] || { echo "با root اجرا کن"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "اول install.sh را اجرا کن"; exit 1; }

if ! command -v cloudflared >/dev/null; then
  case "$(uname -m)" in x86_64) A=amd64 ;; aarch64|arm64) A=arm64 ;; *) echo "معماری پشتیبانی نمی‌شود"; exit 1 ;; esac
  curl -fsSL -o /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$A"
  chmod +x /usr/local/bin/cloudflared
fi

mkdir -p /opt/miras/scripts
cat > /opt/miras/scripts/tunnel-run.sh <<'RUN'
#!/usr/bin/env bash
ENV_FILE=/etc/miras.env
LOG=/var/log/miras-tunnel.log
PORT="$(grep '^PORT=' "$ENV_FILE" | cut -d= -f2)"; PORT="${PORT:-3000}"
: > "$LOG"
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" > "$LOG" 2>&1 &
CF=$!
URL=""
for _ in $(seq 1 90); do
  URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done
if [ -n "$URL" ]; then
  { grep -v '^WEBAPP_URL=' "$ENV_FILE" || true; echo "WEBAPP_URL=$URL"; } > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE" && chmod 600 "$ENV_FILE"
  systemctl restart miras
  echo "آدرس جدید بازی: $URL"
fi
wait "$CF"
RUN
chmod +x /opt/miras/scripts/tunnel-run.sh

cat > /etc/systemd/system/miras-tunnel.service <<'UNIT'
[Unit]
Description=Miras HTTPS tunnel (cloudflared)
After=network-online.target miras.service
Wants=network-online.target

[Service]
ExecStart=/opt/miras/scripts/tunnel-run.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

# تونل دستیِ قبلی خاموش شود تا فقط سرویس بماند
pkill -x cloudflared 2>/dev/null || true
systemctl daemon-reload
systemctl enable --now miras-tunnel
for _ in $(seq 1 60); do grep -q '^WEBAPP_URL=' "$ENV_FILE" && U="$(grep '^WEBAPP_URL=' "$ENV_FILE" | cut -d= -f2)" && [ -n "${U:-}" ] && grep -q "$U" /var/log/miras-tunnel.log 2>/dev/null && break; sleep 1; done
echo
echo "✔ تونل خودترمیم فعال شد."
echo "  آدرس فعلی: $(grep '^WEBAPP_URL=' "$ENV_FILE" | cut -d= -f2)"
echo "  حالا توی تلگرام به ربات /start بزن (پیام قدیمی را استفاده نکن)."
echo "  وضعیت: systemctl status miras-tunnel   |   آدرس‌ها: journalctl -u miras-tunnel -n 5 --no-pager"
