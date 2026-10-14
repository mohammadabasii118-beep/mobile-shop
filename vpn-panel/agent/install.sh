#!/usr/bin/env bash
# Node installer. Served by the panel at /node-install.sh with the panel URL filled in.
# Usage: bash <(curl -sL https://panel/node-install.sh) --token TOKEN --address node.example.com
set -euo pipefail
PANEL_URL="__PANEL_URL__"
TOKEN=""; ADDRESS=""; LETSENCRYPT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --address) ADDRESS="$2"; shift 2 ;;
    --letsencrypt) LETSENCRYPT=1; shift ;;
    *) echo "unknown option $1"; exit 1 ;;
  esac
done
[ -n "$TOKEN" ] && [ -n "$ADDRESS" ] || { echo "need --token and --address"; exit 1; }
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

export DEBIAN_FRONTEND=noninteractive
wait_for_apt
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

# Real certificate (domain only, needs DNS pointing here and port 80 free). Falls back to the self-signed one.
if [ "$LETSENCRYPT" = 1 ] && [ ! -f "$CONF_DIR/.letsencrypt" ]; then
  if [[ "$ADDRESS" =~ ^[0-9.]+$ ]]; then
    echo "Let's Encrypt needs a domain, not an IP: keeping the self-signed certificate."
  else
    apt-get install -y certbot
    LE="/etc/letsencrypt/live/$ADDRESS"
    if certbot certonly --standalone -d "$ADDRESS" --non-interactive --agree-tos --register-unsafely-without-email; then
      mkdir -p /etc/letsencrypt/renewal-hooks/deploy
      cat > /etc/letsencrypt/renewal-hooks/deploy/vpn-node.sh <<HOOK
#!/bin/sh
cp $LE/fullchain.pem $CONF_DIR/tls.crt
cp $LE/privkey.pem $CONF_DIR/tls.key
chmod 644 $CONF_DIR/tls.crt $CONF_DIR/tls.key
cp $CONF_DIR/tls.crt /etc/ipsec.d/certs/server.crt
cp $CONF_DIR/tls.key /etc/ipsec.d/private/server.key
systemctl restart xray sing-box ocserv 2>/dev/null
ipsec restart 2>/dev/null
exit 0
HOOK
      chmod 755 /etc/letsencrypt/renewal-hooks/deploy/vpn-node.sh
      mkdir -p /etc/ipsec.d/certs /etc/ipsec.d/private
      RENEWED_LINEAGE=$LE /etc/letsencrypt/renewal-hooks/deploy/vpn-node.sh
      sed -i 's/"tls_self_signed": true/"tls_self_signed": false/' "$CONF_DIR/agent.json"
      touch "$CONF_DIR/.letsencrypt"
      echo "Let's Encrypt certificate installed for $ADDRESS."
    else
      echo "certbot failed (check DNS and that port 80 is open). Keeping the self-signed certificate."
    fi
  fi
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
status /var/lib/vpn-node/ovpn/status.log 10
EOF2
# Ubuntu's unit allows only 10 processes per user and Xray also runs as nobody: OpenVPN could not fork its auth script
mkdir -p /etc/systemd/system/openvpn-server@.service.d
printf '[Service]\nLimitNPROC=infinity\n' > /etc/systemd/system/openvpn-server@.service.d/vpn-node.conf
mkdir -p /var/lib/vpn-node/ovpn; chown nobody:nogroup /var/lib/vpn-node/ovpn

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
occtl-socket-file = /run/occtl.socket
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
refuse-pap
refuse-chap
refuse-mschap
ms-dns 1.1.1.1
ms-dns 8.8.8.8
asyncmap 0
auth
mtu 1280
mru 1280
proxyarp
noccp
lcp-echo-failure 4
lcp-echo-interval 30
name l2tpd
EOF2

# L2TP traffic accounting: remember which user owns each ppp interface and log the final total
mkdir -p /etc/ppp/ip-up.d /etc/ppp/ip-down.d /var/lib/vpn-node
cat > /etc/ppp/ip-up.d/vpn-node <<'SH'
#!/bin/sh
[ -n "$PEERNAME" ] || exit 0
mkdir -p /run/vpn-node
echo "$PEERNAME" > "/run/vpn-node/ppp-$IFNAME"
SH
cat > /etc/ppp/ip-down.d/vpn-node <<'SH'
#!/bin/sh
[ -n "$PEERNAME" ] || exit 0
echo "$IFNAME $PEERNAME $(( ${BYTES_SENT:-0} + ${BYTES_RCVD:-0} ))" >> /var/lib/vpn-node/ppp-closed
rm -f "/run/vpn-node/ppp-$IFNAME"
SH
chmod 755 /etc/ppp/ip-up.d/vpn-node /etc/ppp/ip-down.d/vpn-node

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
ExecStart=/bin/sh -c 'for n in 10.99.0.0/16 10.88.0.0/16 10.77.0.0/24 10.66.0.0/24 10.55.0.0/24; do iptables -t nat -C POSTROUTING -s \$n -o $IFACE -j MASQUERADE 2>/dev/null || iptables -t nat -A POSTROUTING -s \$n -o $IFACE -j MASQUERADE; done'
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
# apt starts these with the package's default config as soon as they are installed, and `enable --now` does nothing
# for a service that is already running: restart so they read the configuration written above
systemctl restart strongswan-starter xl2tpd ocserv || true
echo
# Ports that another program (for example x-ui) already holds: the matching protocol cannot start there
find_busy() {   # reads `ss -H -ltnup`; prints "proto/port program" for ports we need that a foreign program holds
  awk '
    BEGIN { n = split("tcp:443 tcp:2053 tcp:2083 tcp:2087 tcp:2096 tcp:2097 tcp:2098 tcp:8443 tcp:8388 tcp:4443 udp:36712 udp:8444 udp:51820 udp:1194", w, " "); for (i = 1; i <= n; i++) want[w[i]] = 1 }
    { split($5, a, ":"); port = a[length(a)]; name = $7; sub(/^[^"]*"/, "", name); sub(/".*/, "", name)
      if ((($1 ":" port) in want) && name !~ /^(xray|sing-box|openvpn|ocserv|ocserv-main|ocserv-worker)$/ && name != "") print $1 "/" port " " name }'
}
BUSY=$(ss -H -ltnup 2>/dev/null | find_busy | sort -u || true)
if [ -n "$BUSY" ]; then
  echo
  echo "WARNING: these ports are already used by another program, so the matching protocol will not start:"
  echo "$BUSY" | sed 's/^/  /'
  echo "Change the port in the panel (Protocols -> Ports) or stop the other program (for example x-ui)."
fi
echo
echo "Done. Open these ports in the provider firewall:"
echo "  TCP 443, 2053, 2083, 2087, 2096, 2097, 2098, 8443, 8388, 4443"
echo "  UDP 8388, 36712, 8444, 51820, 1194, 4443, 500, 4500, 1701"
echo "The node should show as online in the panel within a minute."
