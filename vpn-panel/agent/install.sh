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
apt-get install -y curl openssl python3 iptables strongswan strongswan-starter xl2tpd ppp wireguard openvpn ocserv

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

if [[ "$ADDRESS" =~ ^[0-9.]+$ ]]; then SAN_OV="IP:$ADDRESS"; else SAN_OV="DNS:$ADDRESS"; fi
# Self-signed certificate for Trojan/Hysteria2. Replace tls.crt/tls.key with real ones and
# set "tls_self_signed": false in agent.json once you have a certificate for $ADDRESS.
if [ ! -f "$CONF_DIR/tls.crt" ]; then
  if [[ "$ADDRESS" =~ ^[0-9.]+$ ]]; then SAN="IP:$ADDRESS"; else SAN="DNS:$ADDRESS"; fi
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 3650 \
    -subj "/CN=$ADDRESS" -addext "subjectAltName=$SAN" -keyout "$CONF_DIR/tls.key" -out "$CONF_DIR/tls.crt"
  chmod 644 "$CONF_DIR/tls.crt" "$CONF_DIR/tls.key"
fi

# WireGuard server key
if [ ! -f "$CONF_DIR/wg.json" ]; then
  WG_PRIV=$(wg genkey); WG_PUB=$(printf %s "$WG_PRIV" | wg pubkey)
  printf '{"private": "%s", "public": "%s"}' "$WG_PRIV" "$WG_PUB" > "$CONF_DIR/wg.json"
  chmod 600 "$CONF_DIR/wg.json"
fi
mkdir -p /etc/wireguard
[ -f /etc/wireguard/wg0.conf ] || { printf '[Interface]\nAddress = 10.88.0.1/16\nListenPort = 51820\nPrivateKey = %s\n' "$(python3 -c "import json;print(json.load(open('$CONF_DIR/wg.json'))['private'])")" > /etc/wireguard/wg0.conf; chmod 600 /etc/wireguard/wg0.conf; }

# OpenVPN: own CA + server cert; users are checked by a script against /etc/vpn-node/ovpn-users
OV=$CONF_DIR/ovpn
if [ ! -f "$OV/ca.crt" ]; then
  mkdir -p "$OV"
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 3650 -subj "/CN=vpn-node-ca" -keyout "$OV/ca.key" -out "$OV/ca.crt"
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -subj "/CN=$ADDRESS" -keyout "$OV/server.key" -out "$OV/server.csr"
  printf 'basicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\nsubjectAltName=%s\n' "$SAN_OV" > "$OV/ext.cnf"
  openssl x509 -req -in "$OV/server.csr" -CA "$OV/ca.crt" -CAkey "$OV/ca.key" -CAcreateserial -days 3650 -extfile "$OV/ext.cnf" -out "$OV/server.crt"
  chmod 644 "$OV/server.key" "$OV/server.crt" "$OV/ca.crt"; chmod 600 "$OV/ca.key"
fi
touch "$CONF_DIR/ovpn-users"; chmod 644 "$CONF_DIR/ovpn-users"
cat > /opt/vpn-node/ovpn-auth.sh <<'SH'
#!/bin/sh
u=$(sed -n 1p "$1"); p=$(sed -n 2p "$1")
h=$(printf %s "$p" | sha256sum | cut -d' ' -f1)
grep -qxF "$u:$h" /etc/vpn-node/ovpn-users
SH
chmod 755 /opt/vpn-node/ovpn-auth.sh
mkdir -p /etc/openvpn/server
cat > /etc/openvpn/server/server.conf <<EOF2
port 1194
proto udp
dev tun
ca $OV/ca.crt
cert $OV/server.crt
key $OV/server.key
dh none
ecdh-curve prime256v1
topology subnet
server 10.55.0.0 255.255.255.0
push "redirect-gateway def1"
push "dhcp-option DNS 1.1.1.1"
verify-client-cert none
username-as-common-name
auth-user-pass-verify /opt/vpn-node/ovpn-auth.sh via-file
script-security 2
cipher AES-256-GCM
keepalive 10 120
user nobody
group nogroup
persist-key
persist-tun
EOF2

# IKEv2 and AnyConnect reuse the TLS certificate
mkdir -p /etc/ipsec.d/certs /etc/ipsec.d/private
cp "$CONF_DIR/tls.crt" /etc/ipsec.d/certs/server.crt
cp "$CONF_DIR/tls.key" /etc/ipsec.d/private/server.key; chmod 600 /etc/ipsec.d/private/server.key
touch /etc/ocserv/ocpasswd; chmod 600 /etc/ocserv/ocpasswd
cat > /etc/ocserv/ocserv.conf <<EOF2
auth = "plain[passwd=/etc/ocserv/ocpasswd]"
tcp-port = 4443
udp-port = 4443
server-cert = $CONF_DIR/tls.crt
server-key = $CONF_DIR/tls.key
run-as-user = nobody
run-as-group = daemon
socket-file = /run/ocserv.socket
device = vpns
ipv4-network = 10.66.0.0/24
dns = 1.1.1.1
dns = 8.8.8.8
default-domain = vpn
try-mtu-discovery = true
EOF2

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
conn ikev2-eap
  keyexchange=ikev2
  left=%any
  leftid=@ADDRESS_PLACEHOLDER
  leftcert=server.crt
  leftsendcert=always
  leftsubnet=0.0.0.0/0
  right=%any
  rightid=%any
  rightauth=eap-mschapv2
  rightsourceip=10.77.0.0/24
  rightdns=1.1.1.1,8.8.8.8
  eap_identity=%identity
  ike=aes256-sha256-modp2048,aes256-sha256-ecp256,aes128-sha1-modp2048!
  esp=aes256-sha256,aes128-sha1!
  auto=add
EOF2
sed -i "s/ADDRESS_PLACEHOLDER/$ADDRESS/" /etc/ipsec.conf
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
Description=NAT for VPN client subnets
After=network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'for n in 10.99.0.0/16 10.88.0.0/16 10.77.0.0/24 10.66.0.0/24 10.55.0.0/24; do iptables -t nat -C POSTROUTING -s $n -o $IFACE -j MASQUERADE 2>/dev/null || iptables -t nat -A POSTROUTING -s $n -o $IFACE -j MASQUERADE; done'
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
systemctl disable --now ocserv.socket 2>/dev/null || true
systemctl enable --now strongswan-starter xl2tpd xray sing-box wg-quick@wg0 openvpn-server@server ocserv vpn-node-nat vpn-node-agent || true
echo
echo "Done. Open these ports in the provider firewall:"
echo "  TCP 443, 2053, 2083, 2087, 2096, 8443, 8388, 4443"
echo "  UDP 8388, 36712, 8444, 51820, 1194, 4443, 500, 4500, 1701"
echo "The node should show as online in the panel within a minute."
