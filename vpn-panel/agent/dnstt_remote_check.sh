#!/usr/bin/env bash
# Run on ANY Linux machine outside the DNSTT node (e.g. another node): tests the tunnel the way a real client would,
# through a public DNS resolver. Tells you whether the node's host network lets the tunnel through.
#   curl -fsSL .../dnstt_remote_check.sh | bash -s -- TUNNEL_DOMAIN PUBLIC_KEY [RESOLVER_IP]
set -u
DOMAIN=${1:?usage: dnstt_remote_check.sh TUNNEL_DOMAIN PUBLIC_KEY [RESOLVER_IP]}
PUB=${2:?public key missing}
RESOLVER=${3:-8.8.8.8}
if ! command -v dnstt-client >/dev/null; then
  echo "building dnstt-client (a few minutes)..."
  curl -fsSL "${DNSTT_TEST_URL:-https://raw.githubusercontent.com/mohammadabasii118-beep/mobile-shop/claude/vpn-panel/vpn-panel/agent/dnstt_test.py}" -o /root/dnstt_test.py \
    && python3 -c "import sys;sys.path.insert(0,'/root');import dnstt_test as m;print(m.BUILD)" | OUT=/usr/local/bin/dnstt-client bash >/tmp/dnstt-build.log 2>&1
  command -v dnstt-client >/dev/null || { echo "FAIL  could not build dnstt-client:"; grep -v '^go: downloading' /tmp/dnstt-build.log | tail -10; exit 1; }
fi
command -v ssh >/dev/null || { apt-get install -y openssh-client >/dev/null 2>&1; }
LOG=$(mktemp); trap 'kill $CL 2>/dev/null; rm -f "$LOG"' EXIT
dnstt-client -udp "$RESOLVER:53" -pubkey "$PUB" "$DOMAIN" 127.0.0.1:7000 >"$LOG" 2>&1 &
CL=$!
sleep 4
echo "tunnel $DOMAIN through resolver $RESOLVER (DNS tunnels are slow, waiting up to 90 s)..."
OUT=$(ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=90 -p 7000 remotecheck@127.0.0.1 true 2>&1 | tail -1)
echo "ssh through the tunnel: $OUT"
if echo "$OUT" | grep -q "Permission denied"; then
  echo "PASS  the tunnel works from this network through $RESOLVER"
else
  echo "FAIL  no SSH answer through the tunnel"; echo "--- dnstt-client:"; tail -4 "$LOG"; exit 1
fi
