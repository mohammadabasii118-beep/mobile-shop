#!/usr/bin/env bash
# Run ON a DNSTT node (as root): sends a login attempt through the tunnel straight into dnstt-server on this machine,
# with no DNS resolver and no client app in between. Tells you whether the server side of the tunnel works.
#   curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/BRANCH/vpn-panel/agent/dnstt_loopback.sh | bash
set -u
UNIT=/etc/systemd/system/dnstt-server.service
[ -f /etc/vpn-node/dnstt.pub ] && [ -f "$UNIT" ] || { echo "FAIL  DNSTT is not set up on this node (no /etc/vpn-node/dnstt.pub or $UNIT)"; exit 1; }
EXEC=$(grep '^ExecStart=' "$UNIT" | head -1)
PORT=$(echo "$EXEC" | grep -oE -- '-udp :[0-9]+' | grep -oE '[0-9]+$')
UPSTREAM=$(echo "$EXEC" | awk '{print $NF}')
DOMAIN=$(echo "$EXEC" | awk '{print $(NF-1)}')
echo "tunnel domain $DOMAIN, dnstt-server UDP :$PORT, forwards to $UPSTREAM"

if ! command -v dnstt-client >/dev/null; then
  echo "building dnstt-client (a few minutes)..."
  curl -fsSL "${DNSTT_TEST_URL:-https://raw.githubusercontent.com/mohammadabasii118-beep/mobile-shop/claude/vpn-panel/vpn-panel/agent/dnstt_test.py}" -o /root/dnstt_test.py \
    && OUT=/usr/local/bin/dnstt-client python3 -c "import sys;sys.path.insert(0,'/root');import dnstt_test as m;print(m.BUILD)" | bash 2>&1 | tail -3
  command -v dnstt-client >/dev/null || { echo "FAIL  could not build dnstt-client (see the lines above)"; exit 1; }
fi

LOG=$(mktemp); trap 'kill $CL 2>/dev/null; rm -f "$LOG"' EXIT
dnstt-client -udp 127.0.0.1:$PORT -pubkey "$(cat /etc/vpn-node/dnstt.pub)" "$DOMAIN" 127.0.0.1:7000 >"$LOG" 2>&1 &
CL=$!
sleep 5
if [ "${UPSTREAM##*:}" = "2222" ]; then
  OUT=$(ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=40 -p 7000 loopbackcheck@127.0.0.1 true 2>&1 | tail -1)
  echo "ssh through the tunnel: $OUT"
  if echo "$OUT" | grep -q "Permission denied"; then
    echo "PASS  the SSH server answered through the DNS tunnel; the server side is fine"
  else
    echo "FAIL  no SSH answer through the tunnel"
    echo "--- dnstt-client:"; tail -4 "$LOG"
    echo "--- dnstt-server:"; journalctl -u dnstt-server --since "-2min" --no-pager | tail -4 | cut -c1-160
    echo "--- sshd:"; journalctl -u vpn-node-sshd --since "-2min" --no-pager | tail -3 | cut -c1-160
    exit 1
  fi
else
  echo "this node forwards to $UPSTREAM (VLESS mode): use dnstt_test.py with a user's UUID instead"
fi
