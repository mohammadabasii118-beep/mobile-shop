#!/usr/bin/env bash
# Installs the Iran side of a vtunnel tunnel. Served by the panel at /relay-install.sh with the panel URL filled in.
# Usage: bash <(curl -fsSL https://panel/relay-install.sh) --token TOKEN
set -euo pipefail
PANEL_URL="__PANEL_URL__"
TOKEN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    *) echo "unknown option $1"; exit 1 ;;
  esac
done
[ -n "$TOKEN" ] || { echo "need --token"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }
command -v python3 >/dev/null || { apt-get update -y >/dev/null && apt-get install -y python3 >/dev/null; }
command -v curl >/dev/null || { apt-get update -y >/dev/null && apt-get install -y curl >/dev/null; }

CFG=$(curl -fsS -m 20 -H "Authorization: Bearer $TOKEN" "$PANEL_URL/api/relay/config") || { echo "cannot reach the panel or the token is wrong"; exit 1; }
ID=$(printf '%s' "$CFG" | python3 -c "import sys,json;print(json.load(sys.stdin)['tunnel']['id'])")

mkdir -p /etc/vtunnel /opt/vtunnel /var/lib/vtunnel
curl -fsSL "$PANEL_URL/relay/agent.py" -o /opt/vtunnel/relay_agent.py
curl -fsSL "$PANEL_URL/vtunnel.py" -o /usr/local/bin/vtunnel.py
chmod +x /usr/local/bin/vtunnel.py
cat > /etc/vtunnel/agent.json <<JSON
{"panel_url": "$PANEL_URL", "token": "$TOKEN", "id": $ID}
JSON
chmod 600 /etc/vtunnel/agent.json
cat > /etc/systemd/system/vtunnel-agent.service <<UNIT
[Unit]
Description=vtunnel agent
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 /opt/vtunnel/relay_agent.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now vtunnel-agent
sleep 3
echo "vtunnel agent: $(systemctl is-active vtunnel-agent). The panel now sets up the tunnel by itself; watch it under Tunnels."
