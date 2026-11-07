#!/usr/bin/env python3
"""Clean-Cloudflare-IP scanner (no secrets, stdlib only): run it on a server near your users (your Iran
server is ideal) to find Cloudflare edge IPs that are fast and reachable from that network. Put the best
one in the panel's "آی‌پی تمیز" (cf_address) field of a node, so its Cloudflare configs dial that IP
directly and skip DNS (which Iran often poisons or points at a slow/blocked edge).

    curl -fsSL https://PANEL/cf-scan.py | python3 - --port 2083 --top 10

It TCP-connects (and, unless --no-tls, does a TLS handshake with --sni) to sampled Cloudflare IPs on the
port your configs use, measures the latency, and prints the quickest. It never sends your traffic anywhere
and carries no credentials. "Clean" is relative to the network you run it from and to the moment you run
it, so scan from a representative box and re-scan when things change."""
import argparse
import concurrent.futures
import ipaddress
import random
import socket
import ssl
import sys
import time

# Cloudflare's published IPv4 ranges (https://www.cloudflare.com/ips-v4). The edges answer for every
# proxied domain, so any reachable one serves your config; we only rank them by how fast they answer.
CF_RANGES = [
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
    "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
    "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
]


def sample_ips(count: int, seed: int | None = None) -> list[str]:
    """`count` random, distinct IPs drawn from the Cloudflare ranges (skipping network/broadcast)."""
    rng = random.Random(seed)
    nets = [ipaddress.ip_network(r) for r in CF_RANGES]
    weights = [n.num_addresses for n in nets]
    out, seen = [], set()
    attempts = 0
    while len(out) < count and attempts < count * 40:
        attempts += 1
        net = rng.choices(nets, weights=weights)[0]
        host = rng.randint(1, net.num_addresses - 2) if net.num_addresses > 2 else 0
        ip = str(net.network_address + host)
        if ip not in seen:
            seen.add(ip)
            out.append(ip)
    return out


def probe(ip: str, port: int, sni: str, timeout: float, do_tls: bool) -> float | None:
    """Milliseconds to open the connection to `ip:port` (through a TLS handshake for `sni` unless do_tls is
    False), or None if it failed or timed out — the way a filtered or dead edge looks from here."""
    start = time.perf_counter()
    try:
        sock = socket.create_connection((ip, port), timeout=timeout)
    except OSError:
        return None
    try:
        if do_tls:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with ctx.wrap_socket(sock, server_hostname=sni) as ss:
                ss.do_handshake()
        return (time.perf_counter() - start) * 1000
    except (OSError, ssl.SSLError):
        return None
    finally:
        try:
            sock.close()
        except OSError:
            pass


def main() -> int:
    ap = argparse.ArgumentParser(description="Find fast, reachable Cloudflare edge IPs from this machine.")
    ap.add_argument("--port", type=int, default=2083, help="Cloudflare port your configs use (default 2083; also 443, 2053, 2087, 2096, 8443).")
    ap.add_argument("--sni", default="www.cloudflare.com", help="TLS server name for the handshake (any host behind Cloudflare works).")
    ap.add_argument("--count", type=int, default=600, help="How many random IPs to sample (default 600).")
    ap.add_argument("--top", type=int, default=10, help="How many of the best to print (default 10).")
    ap.add_argument("--timeout", type=float, default=2.0, help="Per-IP timeout in seconds (default 2).")
    ap.add_argument("--workers", type=int, default=200, help="Concurrent probes (default 200).")
    ap.add_argument("--no-tls", action="store_true", help="Only a TCP connect, no TLS handshake (faster, less strict).")
    ap.add_argument("--seed", type=int, default=None, help="Fix the random sample (for a repeatable run).")
    args = ap.parse_args()

    if args.port not in (443, 2053, 2083, 2087, 2096, 8443):
        print(f"! port {args.port} is not a Cloudflare HTTPS port; use 443/2053/2083/2087/2096/8443", file=sys.stderr)

    ips = sample_ips(args.count, args.seed)
    print(f"scanning {len(ips)} Cloudflare IPs on port {args.port} "
          f"({'TCP only' if args.no_tls else 'TLS'}), timeout {args.timeout}s ...", file=sys.stderr)

    results: list[tuple[float, str]] = []
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(probe, ip, args.port, args.sni, args.timeout, not args.no_tls): ip for ip in ips}
        for fut in concurrent.futures.as_completed(futs):
            done += 1
            ms = fut.result()
            if ms is not None:
                results.append((ms, futs[fut]))
            if done % 100 == 0:
                print(f"  {done}/{len(ips)} done, {len(results)} reachable ...", file=sys.stderr)

    results.sort()
    if not results:
        print("no reachable Cloudflare IP found — the port may be filtered here, or the network is down. "
              "Try --port 443, or run from another server.", file=sys.stderr)
        return 1

    print(f"\n# {len(results)}/{len(ips)} reachable. Best {min(args.top, len(results))} (latency):")
    for ms, ip in results[:args.top]:
        print(f"{ip}\t{ms:6.1f} ms")
    best = results[0][1]
    print(f"\n# Put the top IP in the panel node's «آی‌پی تمیز» (cf_address) field:\n{best}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
