#!/usr/bin/env python3
"""End-to-end check of a node: reads a user's subscription link, then for every proxy entry starts a
temporary local Xray *client*, connects through the node's public address and fetches a test page.

Run on the node:
    python3 selftest.py 'https://panel.example.com/sub/TOKEN' [label-filter]
Standard library only. Needs the `xray` binary (installed on every node) and `curl`."""
import base64
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

TEST_URL = os.environ.get("SELFTEST_URL", "https://www.gstatic.com/generate_204")


def _q(url):
    return {k: v[0] for k, v in urllib.parse.parse_qs(url.query).items()}


DEFAULT_PIN = ""   # set by main() from the node's own certificate


def _stream(net, security, q, host):
    s = {"network": net, "security": security}
    if security == "reality":
        s["realitySettings"] = {"serverName": q.get("sni", ""), "fingerprint": q.get("fp", "chrome"),
                                "publicKey": q.get("pbk", ""), "shortId": q.get("sid", "")}
    elif security == "tls":
        s["tlsSettings"] = {"serverName": q.get("sni") or host}
        pin = q.get("pcs") or (DEFAULT_PIN if q.get("allowInsecure") == "1" or q.get("insecure") == "1" else "")
        if pin:   # self-signed: trust exactly this certificate
            s["tlsSettings"]["pinnedPeerCertSha256"] = pin
    if net == "ws":
        s["wsSettings"] = {"path": q.get("path", "/"), "headers": {"Host": q.get("host") or host}}
    elif net == "grpc":
        s["grpcSettings"] = {"serviceName": q.get("serviceName", "")}
    return s


def outbound_for(link):
    """Share link -> (label, Xray outbound dict), or None for entries this tool cannot test."""
    scheme, _, rest = link.partition("://")
    if scheme == "vmess":
        j = json.loads(base64.b64decode(rest + "=" * (-len(rest) % 4)))
        q = {"path": j.get("path", ""), "host": j.get("host", ""), "sni": j.get("sni", ""), "pcs": j.get("pcs", ""),
             "allowInsecure": "1" if str(j.get("allowInsecure", j.get("insecure", ""))) in ("1", "True", "true") else "0"}
        net = j.get("net", "tcp")
        return j.get("ps", "vmess"), {"protocol": "vmess", "settings": {"vnext": [{
            "address": j["add"], "port": int(j["port"]), "users": [{"id": j["id"], "security": "auto"}]}]},
            "streamSettings": _stream(net, "tls" if j.get("tls") == "tls" else "none", q, j["add"])}
    u = urllib.parse.urlsplit(link)
    label, host, port = urllib.parse.unquote(u.fragment), u.hostname, u.port
    if not host or host == "127.0.0.1":   # usage remarks, not servers
        return None
    q = _q(u)
    if scheme == "vless":
        user = {"id": urllib.parse.unquote(u.username), "encryption": "none"}
        if q.get("flow"):
            user["flow"] = q["flow"]
        return label, {"protocol": "vless", "settings": {"vnext": [{"address": host, "port": port, "users": [user]}]},
                       "streamSettings": _stream(q.get("type", "tcp"), q.get("security", "none"), q, host)}
    if scheme == "trojan":
        return label, {"protocol": "trojan", "settings": {"servers": [{
            "address": host, "port": port, "password": urllib.parse.unquote(u.username)}]},
            "streamSettings": _stream(q.get("type", "tcp"), q.get("security", "tls"), q, host)}
    if scheme == "ss":
        cred = u.username + "=" * (-len(u.username) % 4)
        method, _, password = base64.urlsafe_b64decode(cred).decode().partition(":")
        return label, {"protocol": "shadowsocks", "settings": {"servers": [{
            "address": host, "port": port, "method": method, "password": password}]}}
    return None


def client_config(outbound, socks_port):
    return {"log": {"loglevel": "warning"},
            "inbounds": [{"listen": "127.0.0.1", "port": socks_port, "protocol": "socks", "settings": {"udp": False}}],
            "outbounds": [outbound]}


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def fetch_links(sub_url):
    req = urllib.request.Request(sub_url, headers={"User-Agent": "node-selftest"})
    body = urllib.request.urlopen(req, timeout=20).read().decode().strip()
    return base64.b64decode(body + "=" * (-len(body) % 4)).decode().splitlines()


def test_one(xray, outbound):
    port = free_port()
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(client_config(outbound, port), f)
    proc = subprocess.Popen([xray, "run", "-config", f.name], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        time.sleep(1.5)
        if proc.poll() is not None:
            return False, "client config rejected: " + proc.stdout.read().strip().splitlines()[-1][:160]
        r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-m", "12", "-w", "%{http_code}",
                            "--socks5-hostname", f"127.0.0.1:{port}", TEST_URL], capture_output=True, text=True)
        if r.stdout.strip() == "204":
            return True, "ok"
        proc.terminate()
        out = (proc.communicate(timeout=3)[0] or "").strip().splitlines()
        hint = next((l for l in reversed(out) if "Warning" not in l), "")[-160:]
        return False, f"no answer (http {r.stdout.strip() or '000'}, curl exit {r.returncode}) {hint}".strip()
    finally:
        if proc.poll() is None:
            proc.kill()
        os.unlink(f.name)


def cert_sha256(path):
    """SHA-256 (hex) of the first certificate in a PEM file: the value pinnedPeerCertSha256 expects.
    (Same as agent.py; kept here so this file runs on its own.)"""
    import hashlib
    import ssl
    try:
        pem = open(path).read().split("-----END CERTIFICATE-----")[0] + "-----END CERTIFICATE-----\n"
        return hashlib.sha256(ssl.PEM_cert_to_DER_cert(pem)).hexdigest()
    except (OSError, ValueError):
        return ""


def main():
    global DEFAULT_PIN
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    DEFAULT_PIN = cert_sha256(os.environ.get("SELFTEST_CERT", "/etc/vpn-node/tls.crt"))
    xray = shutil.which("xray") or "/usr/local/bin/xray"
    wanted = sys.argv[2].lower() if len(sys.argv) > 2 else ""
    entries = [e for e in (outbound_for(l) for l in fetch_links(sys.argv[1]) if "://" in l) if e]
    entries = [e for e in entries if wanted in e[0].lower()]
    if not entries:
        sys.exit("no testable entries (hysteria2, tuic, L2TP, OpenVPN, WireGuard, IKEv2 and AnyConnect are not covered)")
    ok = 0
    for label, ob in entries:
        good, note = test_one(xray, ob)
        ok += good
        print(("PASS  " if good else "FAIL  ") + label + ("" if good else "\n      " + note), flush=True)
    print(f"\n{ok}/{len(entries)} passed")


if __name__ == "__main__":
    main()
