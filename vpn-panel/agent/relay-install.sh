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
# older installs kept one agent per server (/etc/vtunnel/agent.json); an agent per tunnel replaces it for the same tunnel
if [ -f /etc/vtunnel/agent.json ] && python3 -c "import json,sys;sys.exit(0 if json.load(open('/etc/vtunnel/agent.json')).get('id')==$ID else 1)"; then
  systemctl disable --now vtunnel-agent 2>/dev/null || true
  rm -f /etc/vtunnel/agent.json /etc/systemd/system/vtunnel-agent.service
fi
cat > /etc/vtunnel/agent-$ID.json <<JSON
{"panel_url": "$PANEL_URL", "token": "$TOKEN", "id": $ID}
JSON
chmod 600 /etc/vtunnel/agent-$ID.json
cat > /etc/systemd/system/vtunnel-agent-$ID.service <<UNIT
[Unit]
Description=vtunnel agent (tunnel $ID)
After=network-online.target

[Service]
Environment=VTUNNEL_RELAY_CONF=/etc/vtunnel/agent-$ID.json
Environment=VTUNNEL_AGENT_SERVICE=vtunnel-agent-$ID
ExecStart=/usr/bin/python3 /opt/vtunnel/relay_agent.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable vtunnel-agent-$ID
systemctl restart vtunnel-agent-$ID
sleep 3
echo "vtunnel agent for tunnel $ID: $(systemctl is-active vtunnel-agent-$ID). The panel now sets up the tunnel by itself; watch it under Tunnels."
