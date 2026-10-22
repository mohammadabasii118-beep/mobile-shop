#!/usr/bin/env bash
# One-line panel installer (Ubuntu/Debian, run as root).
#   bash <(curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/BRANCH/vpn-panel/install-panel.sh) --domain panel.example.com
# Re-running it updates the panel and keeps your settings and data.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/mohammadabasii118-beep/mobile-shop.git}"
BRANCH="${BRANCH:-claude/vpn-panel}"
INSTALL_DIR="${INSTALL_DIR:-/opt/vpn-panel}"
DOMAIN=""; PASSWORD=""; SECURE=""; ADMIN_PORT=""; ADMIN_PATH=""; OPEN_ADMIN=""

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --secure) SECURE=1; shift ;;                       # login page only on a random port, under a random secret path
    --admin-port) ADMIN_PORT="$2"; SECURE=1; shift 2 ;;
    --admin-path) ADMIN_PATH="$2"; SECURE=1; shift 2 ;;
    --no-secure) OPEN_ADMIN=1; shift ;;                # back to the plain address
    --branch) BRANCH="$2"; shift 2 ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
done
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

# A fresh server often runs automatic updates for a few minutes and holds the apt lock
wait_for_apt() {
  local i=0
  while pgrep -x apt-get >/dev/null || pgrep -x apt >/dev/null || pgrep -x dpkg >/dev/null || pgrep -f unattended-upgr >/dev/null; do
    [ $i -eq 0 ] && echo "Waiting for another apt process to finish (automatic updates)..."
    i=$((i+1)); [ $i -gt 120 ] && { echo "apt is still busy after 10 minutes; try again later"; exit 1; }
    sleep 5
  done
}

wait_for_apt
command -v git >/dev/null || { apt-get update -y && apt-get install -y git curl openssl; }
if [ -z "${SKIP_DOCKER:-}" ] && ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# Code: clone once, then fast-forward on re-runs
if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout -q -f FETCH_HEAD
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
APP="$INSTALL_DIR/vpn-panel"
ENV_FILE="$APP/.env"

# Settings: keep an existing .env; --domain on a re-run changes the address
urls_for() {   # an IP cannot get a certificate: serve plain HTTP
  if [[ "$1" =~ ^[0-9.]+$ ]]; then PANEL_URL="http://$1"; PANEL_FROM="http://$1"
  else PANEL_URL="https://$1"; PANEL_FROM="$1"; fi
}
if [ ! -f "$ENV_FILE" ]; then
  if [ -z "$DOMAIN" ]; then
    DOMAIN=$(curl -fsS https://api.ipify.org || true)
    [ -n "$DOMAIN" ] || { echo "pass --domain panel.example.com (or --domain SERVER_IP)"; exit 1; }
    echo "No --domain given, using the server IP $DOMAIN (plain HTTP)."
  fi
  PASSWORD="${PASSWORD:-$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)}"
  urls_for "$DOMAIN"
  umask 077
  cat > "$ENV_FILE" <<ENV
PANEL_URL=$PANEL_URL
PANEL_FROM=$PANEL_FROM
PANEL_ADMIN_PASSWORD=$PASSWORD
PANEL_SECRET=$(openssl rand -hex 32)
PANEL_API_KEY=$(openssl rand -hex 24)
ENV
  NEW_INSTALL=1
elif ! grep -q '^PANEL_API_KEY=' "$ENV_FILE"; then   # older install: add the key bots use
  echo "PANEL_API_KEY=$(openssl rand -hex 24)" >> "$ENV_FILE"
fi
if [ -f "$ENV_FILE" ] && [ -z "${NEW_INSTALL:-}" ] && [ -n "$DOMAIN" ]; then
  urls_for "$DOMAIN"
  sed -i "s|^PANEL_URL=.*|PANEL_URL=$PANEL_URL|; s|^PANEL_FROM=.*|PANEL_FROM=$PANEL_FROM|" "$ENV_FILE"
  echo "Address changed to $PANEL_URL (admin password unchanged)."
fi

set_env() { grep -q "^$1=" "$ENV_FILE" && sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE" || echo "$1=$2" >> "$ENV_FILE"; }
unset_env() { sed -i "/^$1=/d" "$ENV_FILE"; }
if [ -n "$OPEN_ADMIN" ]; then
  unset_env PANEL_ADMIN_PORT; unset_env PANEL_ADMIN_PATH
  echo "Secure admin address turned off: the panel is on its normal address again."
elif [ -n "$SECURE" ]; then
  [ -n "$ADMIN_PORT" ] || ADMIN_PORT=$(grep '^PANEL_ADMIN_PORT=' "$ENV_FILE" | cut -d= -f2- || true)
  [ -n "$ADMIN_PORT" ] || ADMIN_PORT=$(shuf -i 20000-60000 -n 1)
  [ -n "$ADMIN_PATH" ] || ADMIN_PATH=$(grep '^PANEL_ADMIN_PATH=' "$ENV_FILE" | cut -d= -f2- || true)
  [ -n "$ADMIN_PATH" ] || ADMIN_PATH=$(openssl rand -hex 8)
  set_env PANEL_ADMIN_PORT "$ADMIN_PORT"; set_env PANEL_ADMIN_PATH "$ADMIN_PATH"
fi
bash "$APP/deploy/make-caddyfile.sh" "$ENV_FILE" "$APP/deploy/Caddyfile.new"
if [ -z "${SKIP_DOCKER:-}" ]; then
  # a broken Caddyfile would take the panel down: check it first and keep the working one otherwise
  if docker run --rm -v "$APP/deploy/Caddyfile.new:/etc/caddy/Caddyfile:ro" caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    mv "$APP/deploy/Caddyfile.new" "$APP/deploy/Caddyfile"
  else
    echo "The new Caddy settings did not validate; keeping the previous ones."
    [ -f "$APP/deploy/Caddyfile" ] || { echo "no previous Caddyfile: stopping"; exit 1; }
    rm -f "$APP/deploy/Caddyfile.new"
  fi
  docker compose --env-file "$ENV_FILE" -f "$APP/deploy/docker-compose.yml" up -d --build
else
  mv "$APP/deploy/Caddyfile.new" "$APP/deploy/Caddyfile"
fi

URL=$(grep '^PANEL_URL=' "$ENV_FILE" | cut -d= -f2-)
echo
AP=$(grep '^PANEL_ADMIN_PORT=' "$ENV_FILE" | cut -d= -f2- || true); APATH=$(grep '^PANEL_ADMIN_PATH=' "$ENV_FILE" | cut -d= -f2- || true)
if [ -n "$AP" ] && [ -n "$APATH" ]; then
  HOSTPART=$(echo "$URL" | sed 's|^\(https\?://\)\(.*\)$|\2|')
  SCHEME=$(echo "$URL" | sed 's|^\(https\?://\).*$|\1|')
  echo "Panel login (keep this address private): ${SCHEME}${HOSTPART}:${AP}/${APATH}/"
  echo "Open TCP port $AP in the server's firewall. Nodes and subscription links keep using $URL."
else
  echo "Panel is up: $URL"
fi
if [ -n "${NEW_INSTALL:-}" ]; then
  echo "Admin password: $(grep '^PANEL_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)   (saved in $ENV_FILE)"
fi
echo "API key for bots/scripts: in $ENV_FILE (PANEL_API_KEY); use it as: Authorization: Bearer <key>"
case "$URL" in http://*) echo "WARNING: plain HTTP. Use a domain so node tokens and passwords are encrypted." ;; esac
echo "Ports 80 and 443 must be open. Next: Locations -> New location, then run the install command on each node."
