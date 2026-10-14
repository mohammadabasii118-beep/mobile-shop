#!/usr/bin/env bash
# Node installer. Served by the panel at /node-install.sh with the panel URL filled in.
# Usage: bash <(curl -sL https://panel/node-install.sh) --token TOKEN --address node.example.com
set -euo pipefail
PANEL_URL="__PANEL_URL__"
TOKEN=""; ADDRESS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --address) ADDRESS="$2"; shift 2 ;;
    *) echo "unknown option $1"; exit 1 ;;
  esac
done
[ -n "$TOKEN" ] && [ -n "$ADDRESS" ] || { echo "need --token and --address"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl openssl python3 iptables strongswan strongswan-starter xl2tpd ppp

command -v xray >/dev/null || bash -c "$(curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
command -v sing-box >/dev/null || curl -fsSL https://sing-box.app/install.sh | sh

CONF_DIR=/etc/vpn-node
mkdir -p "$CONF_DIR" /opt/vpn-node
chmod 755 "$CONF_DIR"

# Agent
curl -fsSL "$PANEL_URL/node/agent.py" -o /opt/vpn-node/agent.py
cat > "$CONF_DIR/agent.json" <<JSON
{"panel_url": "$PANEL_URL", "token": "$TOKEN", "tls_self_signed": true}
JSON
chmod 600 "$CONF_DIR/agent.json"

# Reality keys (private key never leaves this server)
if [ ! -f "$CONF_DIR/reality.json" ]; then
  python3 - "$CONF_DIR/reality.json" <<'PY'
import json, re, secrets, subprocess, sys
out = subprocess.run(["xray", "x25519"], capture_output=True, text=True, check=True).stdout
priv = re.search(r"Private\s*Key:\s*(\S+)", out, re.I).group(1)
pub = re.search(r"(?:Public\s*Key|Password[^:]*):\s*(\S+)", out, re.I).group(1)
json.dump({"private": priv, "public": pub, "short_id": secrets.token_hex(4)}, open(sys.argv[1], "w"))
PY
  chmod 600 "$CONF_DIR/reality.json"
fi

# Self-signed certificate for Trojan/Hysteria2. Replace tls.crt/tls.key with real ones and
# set "tls_self_signed": false in agent.json once you have a certificate for $ADDRESS.
if [ ! -f "$CONF_DIR/tls.crt" ]; then
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 3650 \
    -subj "/CN=$ADDRESS" -keyout "$CONF_DIR/tls.key" -out "$CONF_DIR/tls.crt"
  chmod 644 "$CONF_DIR/tls.crt" "$CONF_DIR/tls.key"
fi

# L2TP/IPsec base config (users and PSK are filled in by the agent)
cat > /etc/ipsec.conf <<'EOF2'
config setup
  uniqueids=no
conn l2tp-psk
  keyexchange=ikev1
  authby=secret
  type=transport
  left=%defaultroute
  leftprotoport=17/1701
  right=%any
  rightprotoport=17/%any
  auto=add
  ike=aes256-sha1-modp2048,aes128-sha1-modp2048,aes128-sha1-modp1024,3des-sha1-modp1024!
  esp=aes256-sha1,aes128-sha1,3des-sha1!
  dpddelay=30
  dpdtimeout=120
  dpdaction=clear
EOF2
cat > /etc/xl2tpd/xl2tpd.conf <<'EOF2'
[global]
port = 1701
[lns default]
ip range = 10.99.0.10-10.99.7.250
local ip = 10.99.0.1
require chap = yes
refuse pap = yes
require authentication = yes
name = l2tpd
pppoptfile = /etc/ppp/options.xl2tpd
length bit = yes
EOF2
cat > /etc/ppp/options.xl2tpd <<'EOF2'
require-mschap-v2
ms-dns 1.1.1.1
ms-dns 8.8.8.8
asyncmap 0
auth
mtu 1280
mru 1280
lock
proxyarp
connect-delay 5000
name l2tpd
EOF2

# Forwarding + NAT for L2TP clients
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-vpn-node.conf
sysctl --system >/dev/null
IFACE=$(ip route show default | awk '{print $5; exit}')
cat > /etc/systemd/system/vpn-node-nat.service <<UNIT
[Unit]
Description=NAT for L2TP clients
After=network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'iptables -t nat -C POSTROUTING -s 10.99.0.0/16 -o $IFACE -j MASQUERADE || iptables -t nat -A POSTROUTING -s 10.99.0.0/16 -o $IFACE -j MASQUERADE'
[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/vpn-node-agent.service <<'UNIT'
[Unit]
Description=VPN node agent
After=network-online.target
[Service]
ExecStart=/usr/bin/python3 /opt/vpn-node/agent.py
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now strongswan-starter xl2tpd xray sing-box vpn-node-nat vpn-node-agent || true
echo
echo "Done. Open these ports in the provider firewall:"
echo "  TCP 443, 8443, 8388   UDP 8388, 36712   UDP 500, 4500, 1701 (L2TP/IPsec)"
echo "The node should show as online in the panel within a minute."
