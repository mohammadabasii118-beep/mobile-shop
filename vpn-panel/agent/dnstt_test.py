#!/usr/bin/env python3
"""End-to-end check of a DNSTT tunnel, the way a user would use it: dnstt-client talks to the tunnel domain through a
normal DNS resolver, and an Xray client (VLESS) sits behind it. Run it on any Linux machine, ideally one in the network
whose users you are serving:

    python3 dnstt_test.py TUNNEL_DOMAIN PUBLIC_KEY UUID [RESOLVER_IP]

TUNNEL_DOMAIN and PUBLIC_KEY are shown in the panel (Protocols -> DNSTT); UUID is in the user's DNSTT config.
RESOLVER_IP defaults to the first nameserver in /etc/resolv.conf. Needs `xray` and (it builds it if missing) Go + git.
Standard library only."""
import glob
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time

BUILD = r"""set -e
d=$(mktemp -d); trap 'rm -rf "$d"' EXIT
case "$(uname -m)" in x86_64) ga=amd64;; aarch64|arm64) ga=arm64;; *) echo "unsupported CPU"; exit 1;; esac
command -v git >/dev/null || { apt-get update -y >/dev/null && apt-get install -y git >/dev/null; }
ok=0
for ver in $(curl -fsSL --connect-timeout 15 'https://go.dev/dl/?mode=json' 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['version'])" 2>/dev/null) go1.23.4 go1.22.5; do
  for base in https://go.dev/dl https://dl.google.com/go https://golang.google.cn/dl https://mirrors.aliyun.com/golang; do
    if curl -fsSL --connect-timeout 15 "$base/$ver.linux-$ga.tar.gz" -o "$d/go.tgz" && tar -C "$d" -xzf "$d/go.tgz" 2>/dev/null; then ok=1; break 2; fi
  done
done
[ $ok = 1 ] || { echo "could not download Go"; exit 1; }
git clone https://www.bamsoftware.com/git/dnstt.git "$d/dnstt"
cd "$d/dnstt/dnstt-client"
GOPATH="$d/gopath" GOCACHE="$d/cache" GOTOOLCHAIN=local GOFLAGS=-mod=mod "$d/go/bin/go" build -o "$OUT" .
"""


def xray_client_config(uuid, upstream_port, socks_port):
    """Xray client: a local SOCKS inbound whose only way out is VLESS to the dnstt-client's local port."""
    return {"log": {"loglevel": "warning"},
            "inbounds": [{"listen": "127.0.0.1", "port": socks_port, "protocol": "socks", "settings": {"udp": False}}],
            "outbounds": [{"protocol": "vless", "settings": {"vnext": [{"address": "127.0.0.1", "port": upstream_port,
                           "users": [{"id": uuid, "encryption": "none"}]}]},
                           "streamSettings": {"network": "tcp", "security": "none"}}]}


def default_resolver(text=None):
    text = open("/etc/resolv.conf").read() if text is None else text
    for line in text.splitlines():
        f = line.split()
        if len(f) >= 2 and f[0] == "nameserver" and "." in f[1]:
            return f[1]
    return "8.8.8.8"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def find(name, extra=()):
    return shutil.which(name) or next(iter(p for g in extra for p in glob.glob(g) if os.access(p, os.X_OK)), None)


def tail(proc_out, n=6):
    return " | ".join(l.strip() for l in (proc_out or "").strip().splitlines()[-n:])


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    domain, pub, uuid = sys.argv[1:4]
    resolver = sys.argv[4] if len(sys.argv) > 4 else default_resolver()
    xray = find("xray", ["/usr/local/bin/xray", "/usr/local/x-ui/bin/xray-linux-*", "/usr/local/x-ui/bin/xray*"])
    if not xray:
        sys.exit("xray is not installed here (x-ui installs one under /usr/local/x-ui/bin/)")
    client = find("dnstt-client", ["/usr/local/bin/dnstt-client", "/tmp/dnstt-client"])
    if not client:
        client = "/usr/local/bin/dnstt-client"
        print("dnstt-client is missing; building it (a few minutes)...", flush=True)
        r = subprocess.run(["bash", "-c", BUILD], env={**os.environ, "OUT": client}, capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit("build failed: " + tail(r.stdout + r.stderr))
    up, socks = free_port(), free_port()
    cfg = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
    json.dump(xray_client_config(uuid, up, socks), cfg)
    cfg.close()
    procs = []
    try:
        dns = subprocess.Popen([client, "-udp", f"{resolver}:53", "-pubkey", pub, domain, f"127.0.0.1:{up}"],
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        procs.append(dns)
        xr = subprocess.Popen([xray, "run", "-config", cfg.name], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        procs.append(xr)
        time.sleep(3)
        for p, name in ((dns, "dnstt-client"), (xr, "xray")):
            if p.poll() is not None:
                sys.exit(f"{name} exited at once: " + tail(p.stdout.read()))
        print(f"tunnel {domain} via resolver {resolver}; fetching a test page (DNSTT is slow, up to 60 s)...", flush=True)
        t0 = time.time()
        r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-m", "60", "-w", "%{http_code}", "--socks5-hostname",
                            f"127.0.0.1:{socks}", "https://www.gstatic.com/generate_204"],
                           capture_output=True, text=True, env={**os.environ, "no_proxy": "", "NO_PROXY": ""})
        if r.stdout.strip() == "204":
            print(f"PASS  the page came through the DNS tunnel in {time.time() - t0:.1f} s")
        else:
            for p in procs:
                p.terminate()
            print(f"FAIL  no answer (http {r.stdout.strip() or '000'}, curl exit {r.returncode})")
            print("  dnstt-client:", tail(dns.communicate(timeout=3)[0]))
            print("  xray:", tail(xr.communicate(timeout=3)[0]))
    finally:
        for p in procs:
            if p.poll() is None:
                p.kill()
        os.unlink(cfg.name)


if __name__ == "__main__":
    main()
