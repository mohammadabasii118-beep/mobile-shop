#!/usr/bin/env python3
"""One-shot health report for a node: system settings, every VPN service, its port, recent errors and who is
connected. Prints OK / WARN / FAIL lines. Standard library only; run as root on the node:
    curl -fsSL https://RAW_URL/doctor.py | python3
Passwords and keys are never printed."""
import json
import os
import re
import subprocess

SUBNETS = ["10.99.0.0/16", "10.88.0.0/16", "10.77.0.0/24", "10.66.0.0/24", "10.55.0.0/24"]
SERVICES = [("xray", "Xray (VLESS/VMess/Trojan/Shadowsocks)"), ("sing-box", "sing-box (Hysteria2/TUIC)"),
            ("wg-quick@wg0", "WireGuard"), ("openvpn-server@server", "OpenVPN"), ("xl2tpd", "L2TP daemon"),
            ("strongswan-starter", "IPsec (L2TP/IKEv2)"), ("ocserv", "AnyConnect"), ("vpn-node-agent", "node agent")]
fails = warns = 0


def sh(*cmd, timeout=15):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout + r.stderr).strip()
    except (OSError, subprocess.TimeoutExpired) as e:
        return 127, str(e)


def say(level, text):
    global fails, warns
    fails += level == "FAIL"
    warns += level == "WARN"
    print(f"{level:4}  {text}")


def head(title):
    print(f"\n== {title}")


def read(path):
    try:
        return open(path).read()
    except OSError:
        return ""


def errors_of(unit, minutes=30, n=3):
    _, out = sh("journalctl", "-u", unit, "--since", f"-{minutes}min", "--no-pager", "-o", "cat")
    bad = [l.strip()[:200] for l in out.splitlines()
           if re.search(r"error|fail|fatal|denied|unable|cannot|refused|invalid", l, re.I)
           and not re.search(r"deprecated|WARNING: |Consider setting", l)]
    return bad[-n:]


def system():
    head("system")
    _, fwd = sh("sysctl", "-n", "net.ipv4.ip_forward")
    say("OK" if fwd == "1" else "FAIL", f"ip_forward = {fwd}")
    _, pol = sh("iptables", "-S", "FORWARD")
    drop = "-P FORWARD DROP" in pol
    chain = "DOCKER-USER" if sh("iptables", "-S", "DOCKER-USER")[0] == 0 else "FORWARD"
    say("WARN" if drop else "OK", f"FORWARD policy is {'DROP' if drop else 'ACCEPT'} (Docker/firewall); rules go in {chain}")
    missing = [n for n in SUBNETS if sh("iptables", "-C", chain, "-s", n, "-j", "ACCEPT")[0] != 0]
    say("OK" if not missing else ("FAIL" if drop else "WARN"),
        "forward rules for VPN subnets: " + ("all present" if not missing else "missing for " + ", ".join(missing)
                                             + "  (the agent adds them every 30 s once updated)"))
    _, nat = sh("iptables", "-t", "nat", "-S", "POSTROUTING")
    nmiss = [n for n in SUBNETS if f"-s {n}" not in nat or "MASQUERADE" not in nat]
    say("OK" if not nmiss else "FAIL", "NAT masquerade: " + ("all present" if not nmiss else "missing for " + ", ".join(nmiss)))
    _, mem = sh("sh", "-c", "free -m | awk '/Mem:/ {print $2\" MB, \"$7\" MB available\"}'")
    say("OK", f"memory {mem}")


def services():
    head("services")
    for unit, label in SERVICES:
        _, state = sh("systemctl", "is-active", unit)
        _, nres = sh("systemctl", "show", unit, "-p", "NRestarts", "--value")
        loops = int(nres) if nres.isdigit() else 0
        state = state.splitlines()[0] if state else "unknown"
        if state == "active":
            say("WARN" if loops > 3 else "OK", f"{label}: active" + (f", restarted {loops} times" if loops else ""))
        else:
            say("FAIL", f"{label}: {state}")
        for line in errors_of(unit):
            print(f"        {line}")


def ports():
    head("listening ports (what the node accepts)")
    _, out = sh("ss", "-H", "-lntup")
    wanted = {}
    xr = read("/usr/local/etc/xray/config.json")
    try:
        for i in json.loads(xr).get("inbounds", []):
            if i.get("tag") != "api":
                wanted[("tcp", i["port"])] = f"xray {i['tag']}"
    except ValueError:
        say("FAIL", "xray config.json is missing or not valid JSON" if not xr else "xray config.json is not valid JSON")
    for key, label in (("port", "openvpn"),):
        m = re.search(rf"^{key}\s+(\d+)", read("/etc/openvpn/server/server.conf"), re.M)
        if m:
            wanted[("udp", int(m.group(1)))] = label
    _, wgp = sh("wg", "show", "wg0", "listen-port")
    if wgp.isdigit():
        wanted[("udp", int(wgp))] = "wireguard"
    for proto, port, label in (("udp", 500, "ipsec ike"), ("udp", 4500, "ipsec nat-t"), ("udp", 1701, "l2tp")):
        wanted[(proto, port)] = label
    m = re.search(r"^tcp-port\s*=\s*(\d+)", read("/etc/ocserv/ocserv.conf"), re.M)
    if m:
        wanted[("tcp", int(m.group(1)))] = "anyconnect"
    have = {}
    for line in out.splitlines():
        f = line.split()
        if len(f) >= 5 and f[0] in ("tcp", "udp"):
            port = f[4].rsplit(":", 1)[-1]
            name = (re.search(r'\(\("([^"]+)"', line) or [None, "?"])[1]
            if port.isdigit():
                have[(f[0], int(port))] = name
    for (proto, port), label in sorted(wanted.items(), key=lambda x: x[0][1]):
        owner = have.get((proto, port))
        if owner is None:
            say("FAIL", f"{proto}/{port} {label}: nothing is listening")
        elif owner.startswith(("xray", "sing-box", "openvpn", "ocserv", "charon", "xl2tpd")) or label == "wireguard":
            say("OK", f"{proto}/{port} {label}")
        else:
            say("FAIL", f"{proto}/{port} {label}: held by another program ({owner})")


def config():
    head("configuration")
    chap = [l for l in read("/etc/ppp/chap-secrets").splitlines() if l.strip()]
    say("OK" if chap else "WARN", f"L2TP users in chap-secrets: {len(chap)}")
    sec = read("/etc/ipsec.secrets")
    say("OK" if "PSK" in sec else "FAIL", "IPsec PSK present" if "PSK" in sec else "IPsec PSK missing in /etc/ipsec.secrets")
    eap = len(re.findall(r": EAP ", sec))
    say("OK" if eap else "WARN", f"IKEv2 (EAP) users: {eap}")
    _, conns = sh("ipsec", "statusall")
    for name in ("l2tp-psk", "ikev2-eap"):
        say("OK" if name in conns else "FAIL", f"ipsec connection {name} {'loaded' if name in conns else 'NOT loaded'}")
    if "l2tp-psk" not in conns or "ikev2-eap" not in conns:
        print("        ipsec statusall (first lines):")
        for line in conns.splitlines()[:12]:
            print("          " + line[:160])
    say("OK" if os.path.exists("/etc/ipsec.d/certs/server.crt") else "FAIL", "IKEv2 server certificate file")
    code, nproc = sh("systemctl", "show", "openvpn-server@server", "-p", "LimitNPROC", "--value")
    if code == 0:
        say("OK" if nproc == "infinity" or (nproc.isdigit() and int(nproc) > 100) else "FAIL",
            f"OpenVPN process limit = {nproc or 'n/a'} (10 makes the auth script fail next to Xray)")
    ovu = [l for l in read("/etc/vpn-node/ovpn-users").splitlines() if l.strip()]
    say("OK" if ovu else "WARN", f"OpenVPN users: {len(ovu)}")
    ocu = [l for l in read("/etc/ocserv/ocpasswd").splitlines() if l.strip()]
    say("OK" if ocu else "WARN", f"AnyConnect users: {len(ocu)}")
    sock = os.path.exists("/run/occtl.socket")
    say("OK" if sock else "WARN", "ocserv control socket (occtl) /run/occtl.socket")
    if not sock:
        print("        ocserv.conf socket lines: " + " | ".join(l for l in read("/etc/ocserv/ocserv.conf").splitlines() if "socket" in l))
    wgc = read("/etc/wireguard/wg0.conf")
    say("OK" if "[Peer]" in wgc else "WARN", f"WireGuard peers: {wgc.count('[Peer]')}")


def connected():
    head("connected right now")
    _, hs = sh("wg", "show", "wg0", "latest-handshakes")
    live = [l for l in hs.splitlines() if len(l.split()) == 2 and l.split()[1] != "0"]
    say("OK" if live else "WARN", f"WireGuard peers that ever shook hands: {len(live)} of {len(hs.splitlines())}")
    st = read("/var/lib/vpn-node/ovpn/status.log")
    n = len([l for l in st.splitlines() if l.startswith("CLIENT_LIST,")])
    say("OK" if n else "WARN", f"OpenVPN clients: {n}")
    say("OK" if os.path.isdir("/run/vpn-node") and os.listdir("/run/vpn-node") else "WARN",
        "L2TP sessions: " + str(len(os.listdir("/run/vpn-node")) if os.path.isdir("/run/vpn-node") else 0))
    _, ups = sh("sh", "-c", "ipsec statusall | grep -E 'Security Associations'")
    print(f"        IPsec: {ups or 'n/a'}")
    _, oc = sh("occtl", "show", "users")
    print(f"        AnyConnect: {oc.splitlines()[0] if oc else 'n/a'}" if oc else "        AnyConnect: n/a")


if __name__ == "__main__":
    if os.geteuid() != 0:
        print("run as root")
    system()
    services()
    ports()
    config()
    connected()
    print(f"\nsummary: {fails} FAIL, {warns} WARN")
