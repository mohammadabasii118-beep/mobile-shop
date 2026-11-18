#!/usr/bin/env python3
"""BackPack transport tester (no secrets, stdlib only): try every reverse transport between your Iran
server and a foreign one, and see which ones hold on this path, with their ping and throughput — the way
BackPack's own tester does, so you can pick the transport before building a real tunnel.

It runs in two halves, one line on each server (both as root), sharing one --token you pick:

    # 1) on the FOREIGN server (kharej) — leave it running:
    curl -fsSL https://PANEL/bp-test.py | python3 - kharej --token SECRET

    # 2) on the IRAN server — the verdict prints here:
    curl -fsSL https://PANEL/bp-test.py | python3 - iran --token SECRET --kharej FOREIGN_IP

The Iran side binds one BackPack server per transport and, through each, reaches an echo service the
foreign side runs; it sends small packets (ping) and a short burst (throughput) and reports HELD or down.
Everything it starts is a temporary process on a high port, torn down at the end; it carries no
credentials and sends your traffic nowhere. "Held" is true for this path at this moment — re-run when
the route changes. Port 9100 of the foreign server must be reachable from Iran (that is where the test
control channels land); open it on the foreign firewall while testing."""
import argparse
import hashlib
import os
import platform
import socket
import ssl
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request

# The reverse transports to try, in the panel's order. Both halves must agree on this list and its order,
# because each transport gets a control port and a data port derived from its index.
# The plain "udp" transport is left out: it only forwards UDP, and the panel's tunnels carry TCP (VMess/VLESS/
# Reality), so a TCP probe of it would always read "down". Every transport here can carry the real traffic.
TRANSPORTS = ["tcp", "tcpmux", "stealth", "pck", "kcp", "quic", "ws", "wsmux", "wss", "wssmux", "xdi"]
LABELS = {"tcp": "TCP", "tcpmux": "TCP Mux", "stealth": "Stealth", "pck": "PCK", "udp": "UDP",
          "kcp": "KCP+FEC", "quic": "QUIC", "ws": "WS", "wsmux": "WS Mux", "wss": "WSS", "wssmux": "WSS Mux", "xdi": "xDi"}
CTL_BASE = 9100      # control port for transport i = CTL_BASE + i (bound on Iran, dialled by kharej)
DATA_BASE = 9400     # the forwarded port for transport i = DATA_BASE + i (served on Iran, reaches the echo)
ECHO_PORT = 9390     # the echo service on the foreign server (reached through each tunnel)
ARCHES = {"x86_64": "amd64", "amd64": "amd64", "aarch64": "arm64", "arm64": "arm64"}


def fetch_binary(base: str, sha256: str) -> str:
    """Download the pinned BackPack binary from the panel, check its hash, and return the path to it."""
    arch = ARCHES.get(platform.machine().lower())
    if not arch:
        sys.exit(f"unsupported CPU: {platform.machine()}")
    out = os.path.join(tempfile.gettempdir(), f"bp-test-{sha256[:12]}")
    if os.path.exists(out) and os.access(out, os.X_OK):
        return out
    url = base.rstrip("/") + f"/backpack/linux-{arch}.tar.gz"
    with urllib.request.urlopen(url, timeout=120) as r:
        data = r.read()
    tmp = out + ".tgz"
    with open(tmp, "wb") as f:
        f.write(data)
    with tarfile.open(tmp) as t:
        member = next((m for m in t.getmembers() if m.isfile() and os.path.basename(m.name) == "backpack"), None)
        if not member:
            sys.exit("the downloaded archive has no 'backpack' binary")
        with t.extractfile(member) as src, open(out, "wb") as dst:
            dst.write(src.read())
    os.chmod(out, 0o755)
    got = hashlib.sha256(open(out, "rb").read()).hexdigest()
    if sha256 and got != sha256:
        os.remove(out)
        sys.exit(f"binary hash mismatch (expected {sha256[:12]}…, got {got[:12]}…) — not running it")
    os.remove(tmp)
    return out


def write(path: str, text: str) -> None:
    with open(path, "w") as f:
        f.write(text)


def run_echo(port: int):
    """A tiny TCP echo server, bound to loopback: whatever the tunnel delivers here is bounced straight back."""
    import threading
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", port))
    srv.listen(64)

    def serve(c):
        try:
            while chunk := c.recv(65536):
                c.sendall(chunk)
        except OSError:
            pass
        finally:
            c.close()

    def loop():
        while True:
            try:
                c, _ = srv.accept()
            except OSError:
                return
            threading.Thread(target=serve, args=(c,), daemon=True).start()
    threading.Thread(target=loop, daemon=True).start()
    return srv


def kharej(args):
    """The foreign side: an echo service, plus one BackPack client per transport dialling the Iran server."""
    binary = args.bin or fetch_binary(args.base, args.sha256)
    workdir = tempfile.mkdtemp(prefix="bp-test-kharej-")
    run_echo(ECHO_PORT)
    procs = []
    for i, tr in enumerate(TRANSPORTS):
        conf = os.path.join(workdir, f"c{i}.toml")
        write(conf, f'[client]\nremote_addr = "{args.iran}:{CTL_BASE + i}"\ntransport = "{tr}"\ntoken = "{args.token}"\n'
                    f"accept_udp = true\n")
        procs.append(subprocess.Popen([binary, "-c", conf], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    print(f"foreign side up: echo on 127.0.0.1:{ECHO_PORT}, {len(TRANSPORTS)} clients dialling {args.iran}.")
    print("leave this running, then start the Iran side. Ctrl+C here when the Iran side prints its verdict.")
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        for p in procs:
            p.kill()
        print("\nstopped.")


def probe(port: int, timeout: float) -> tuple[bool, float, float]:
    """Through the forwarded port (which reaches the foreign echo): (held, ping_ms, throughput_Mbps)."""
    try:
        s = socket.create_connection(("127.0.0.1", port), timeout=timeout)
    except OSError:
        return False, 0.0, 0.0
    s.settimeout(timeout)
    try:
        s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        rtts = []
        for _ in range(8):
            t0 = time.perf_counter()
            s.sendall(b"p" * 64)
            got = 0
            while got < 64:
                b = s.recv(64 - got)
                if not b:
                    return False, 0.0, 0.0
                got += len(b)
            rtts.append((time.perf_counter() - t0) * 1000)
        rtts.sort()
        ping = rtts[len(rtts) // 2]
        payload = b"x" * 65536
        total, t0 = 0, time.perf_counter()
        while time.perf_counter() - t0 < 1.0:          # a one-second burst, echoed back
            s.sendall(payload)
            need = len(payload)
            while need > 0:
                b = s.recv(need)
                if not b:
                    break
                need -= len(b)
            total += len(payload)
        secs = time.perf_counter() - t0
        mbps = (total * 8 / secs / 1e6) if secs > 0 else 0.0     # one-way bytes over the round-trip window
        return True, ping, mbps
    except OSError:
        return False, 0.0, 0.0
    finally:
        s.close()


def iran(args):
    """The Iran side: one BackPack server per transport (each forwarding a data port to the foreign echo),
    then probe each in turn and print the verdict."""
    binary = args.bin or fetch_binary(args.base, args.sha256)
    workdir = tempfile.mkdtemp(prefix="bp-test-iran-")
    procs = []
    for i, tr in enumerate(TRANSPORTS):
        conf = os.path.join(workdir, f"s{i}.toml")
        write(conf, f'[server]\nbind_addr = "0.0.0.0:{CTL_BASE + i}"\ntransport = "{tr}"\ntoken = "{args.token}"\n'
                    f'ports = ["{DATA_BASE + i}=127.0.0.1:{ECHO_PORT}"]\naccept_udp = true\n')
        procs.append(subprocess.Popen([binary, "-c", conf], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    print(f"Iran side up: {len(TRANSPORTS)} servers bound {CTL_BASE}-{CTL_BASE + len(TRANSPORTS) - 1}.")
    print(f"waiting {args.settle}s for the tunnels to come up ...")
    time.sleep(args.settle)

    results = []
    for i, tr in enumerate(TRANSPORTS):
        held, ping, mbps = probe(DATA_BASE + i, args.timeout)
        results.append((tr, held, ping, mbps))
        line = f"  {LABELS[tr]:10}"
        if held:
            print(f"{line} HELD   {ping:6.1f} ms   {mbps:6.1f} Mb/s")
        else:
            print(f"{line} down")
    for p in procs:
        p.kill()

    held = [r for r in results if r[1]]
    print(f"\n# verdict: {len(held)}/{len(results)} transports held on this path.")
    if held:
        by_ping = sorted(held, key=lambda r: r[2])
        by_speed = sorted(held, key=lambda r: -r[3])
        print(f"# lowest ping : {LABELS[by_ping[0][0]]}  ({by_ping[0][2]:.1f} ms)")
        print(f"# most speed  : {LABELS[by_speed[0][0]]}  ({by_speed[0][3]:.1f} Mb/s)")
        print("# set the one you want as the BackPack tunnel's transport in the panel.")
    else:
        print("# nothing held — port 9100.. may be blocked between the servers, or the foreign side is not running.")
    return 0 if held else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Test which BackPack transports hold between two servers.")
    ap.add_argument("side", choices=["iran", "kharej"], help="which server this is")
    ap.add_argument("--token", required=True, help="a shared secret, the same on both sides")
    ap.add_argument("--kharej", dest="kharej_ip", default="", help="(iran side) the foreign server's IP")
    ap.add_argument("--iran", dest="iran", default="", help="(kharej side) the Iran server's IP")
    ap.add_argument("--base", default=os.environ.get("BP_TEST_BASE", ""), help="panel base URL to fetch the BackPack binary from")
    ap.add_argument("--sha256", default=os.environ.get("BP_TEST_SHA", ""), help="expected SHA-256 of the binary")
    ap.add_argument("--bin", default="", help="use this BackPack binary instead of fetching it (skips --base)")
    ap.add_argument("--settle", type=float, default=12.0, help="(iran) seconds to wait for tunnels before probing")
    ap.add_argument("--timeout", type=float, default=6.0, help="per-transport probe timeout, seconds")
    args = ap.parse_args()
    if not args.base and not args.bin:
        sys.exit("--base (panel URL) is required so the matching BackPack binary can be fetched")
    if args.side == "kharej":
        if not args.iran:
            sys.exit("the kharej side needs --iran IRAN_IP")
        kharej(args)
        return 0
    if not args.kharej_ip:
        sys.exit("the iran side needs --kharej FOREIGN_IP")
    return iran(args)


if __name__ == "__main__":
    sys.exit(main())
