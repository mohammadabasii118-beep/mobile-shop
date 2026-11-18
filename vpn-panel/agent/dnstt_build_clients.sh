#!/usr/bin/env bash
# Run ON a node (as root): cross-compiles dnstt-client for Windows, Android (Termux) and Linux into /root/dnstt-clients/.
# Download the files with SFTP (Bitvise, WinSCP, FileZilla) - nothing is served over HTTP.
#   curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/BRANCH/vpn-panel/agent/dnstt_build_clients.sh | bash
set -eu
OUTDIR=${OUTDIR:-/root/dnstt-clients}
d=$(mktemp -d); trap 'rm -rf "$d"' EXIT
mkdir -p "$OUTDIR"
case "$(uname -m)" in x86_64) ga=amd64;; aarch64|arm64) ga=arm64;; *) echo "unsupported CPU $(uname -m)"; exit 1;; esac
command -v git >/dev/null || { apt-get update -y >/dev/null && apt-get install -y git >/dev/null; }
ok=0
for ver in $(curl -fsSL --connect-timeout 15 'https://go.dev/dl/?mode=json' 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['version'])" 2>/dev/null) go1.23.4 go1.22.5; do
  for base in https://go.dev/dl https://dl.google.com/go https://golang.google.cn/dl https://mirrors.aliyun.com/golang; do
    if curl -fsSL --connect-timeout 15 "$base/$ver.linux-$ga.tar.gz" -o "$d/go.tgz" && tar -C "$d" -xzf "$d/go.tgz" 2>/dev/null; then ok=1; break 2; fi
  done
done
[ $ok = 1 ] || { echo "FAIL  could not download Go"; exit 1; }
git clone https://www.bamsoftware.com/git/dnstt.git "$d/dnstt" >/dev/null 2>&1 || { echo "FAIL  could not clone dnstt"; exit 1; }
cd "$d/dnstt/dnstt-client"
export GOPATH="$d/gopath" GOCACHE="$d/cache" GOTOOLCHAIN=local GOFLAGS=-mod=mod CGO_ENABLED=0
export GOPROXY="https://proxy.golang.org|https://goproxy.io|https://goproxy.cn|direct"
for t in windows/amd64:dnstt-client-windows-amd64.exe linux/arm64:dnstt-client-android-arm64 linux/amd64:dnstt-client-linux-amd64; do
  os=${t%%/*}; rest=${t#*/}; arch=${rest%%:*}; name=${rest#*:}
  if GOOS=$os GOARCH=$arch "$d/go/bin/go" build -ldflags="-s -w" -o "$OUTDIR/$name" . 2>"$d/err.log"; then echo "built $name"; else echo "FAIL  $name"; grep -v '^go: downloading' "$d/err.log" | tail -5; exit 1; fi
done
ls -l "$OUTDIR"
