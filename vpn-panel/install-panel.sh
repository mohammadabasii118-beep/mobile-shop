#!/usr/bin/env bash
# One-line panel installer (Ubuntu/Debian, run as root).
#   bash <(curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/BRANCH/vpn-panel/install-panel.sh) --domain panel.example.com
# Re-running it updates the panel and keeps your settings and data.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/mohammadabasii118-beep/mobile-shop.git}"
BRANCH="${BRANCH:-claude/vpn-panel}"
INSTALL_DIR="${INSTALL_DIR:-/opt/vpn-panel}"
DOMAIN=""; PASSWORD=""

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
done
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

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
ENV
  NEW_INSTALL=1
elif [ -n "$DOMAIN" ]; then
  urls_for "$DOMAIN"
  sed -i "s|^PANEL_URL=.*|PANEL_URL=$PANEL_URL|; s|^PANEL_FROM=.*|PANEL_FROM=$PANEL_FROM|" "$ENV_FILE"
  echo "Address changed to $PANEL_URL (admin password unchanged)."
fi

if [ -z "${SKIP_DOCKER:-}" ]; then
  docker compose --env-file "$ENV_FILE" -f "$APP/deploy/docker-compose.yml" up -d --build
fi

URL=$(grep '^PANEL_URL=' "$ENV_FILE" | cut -d= -f2-)
echo
echo "Panel is up: $URL"
if [ -n "${NEW_INSTALL:-}" ]; then
  echo "Admin password: $(grep '^PANEL_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)   (saved in $ENV_FILE)"
fi
case "$URL" in http://*) echo "WARNING: plain HTTP. Use a domain so node tokens and passwords are encrypted." ;; esac
echo "Ports 80 and 443 must be open. Next: Locations -> New location, then run the install command on each node."
