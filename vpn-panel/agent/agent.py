#!/usr/bin/env python3
"""Node agent. Pulls the desired state from the panel, renders configs for
Xray, sing-box and strongSwan/xl2tpd, reloads the services that changed, and
reports load and per-user traffic back. Standard library only."""
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request

CONF = os.environ.get("VPN_NODE_CONF", "/etc/vpn-node/agent.json")
STATE_DIR = os.path.dirname(CONF)
INTERVAL = 30
XRAY_API = "127.0.0.1:10085"


# ---------- renderers (pure functions, covered by tests) ----------
WS_PATHS = {"vmess_ws": "/ws", "vless_ws": "/vless", "trojan_ws": "/trojan"}
GRPC_SERVICE = "grpc"
DNSTT_UPSTREAM_PORT = 18466   # loopback VLESS inbound behind dnstt-server


def users_for(cfg, proto):
    return [u for u in cfg["users"] if proto in u["protos"]]


def render_xray(cfg, reality, tls, busy=frozenset()):
    """`busy`: TCP ports held by another program; those inbounds are left out so the rest still start."""
    ports = {k: v for k, v in cfg["protocols"].items() if v not in busy}
    certs = [{"certificateFile": tls["cert"], "keyFile": tls["key"]}]
    inbounds = [{"tag": "api", "listen": "127.0.0.1", "port": 10085, "protocol": "dokodemo-door",
                 "settings": {"address": "127.0.0.1"}}]

    def tls_stream(network, **extra):
        return {"network": network, "security": "tls", "tlsSettings": {"certificates": certs}, **extra}

    def add(proto, protocol, clients, stream, **settings):
        if proto in ports and clients:
            inbounds.append({"tag": proto, "port": ports[proto], "protocol": protocol,
                             "settings": {"clients": clients, **settings}, "streamSettings": stream})

    if cfg.get("dnstt") and cfg["dnstt"].get("inner", "ssh") == "vless" and users_for(cfg, "dnstt"):
        # DNSTT hands every tunnelled stream to this loopback-only inbound, which tells the users apart (and meters them)
        inbounds.append({"tag": "dnstt", "listen": "127.0.0.1", "port": DNSTT_UPSTREAM_PORT, "protocol": "vless",
                         "settings": {"clients": [{"id": u["uuid"], "email": u["name"]} for u in users_for(cfg, "dnstt")],
                                      "decryption": "none"},
                         "streamSettings": {"network": "tcp", "security": "none"}})
    sni = cfg["node"]["reality_sni"]
    add("vless", "vless",
        [{"id": u["uuid"], "email": u["name"], "flow": "xtls-rprx-vision"} for u in users_for(cfg, "vless")],
        {"network": "tcp", "security": "reality", "realitySettings": {
            "dest": sni + ":443", "serverNames": [sni],
            "privateKey": reality["private"], "shortIds": [reality["short_id"]]}},
        decryption="none")
    vless_plain = lambda p: [{"id": u["uuid"], "email": u["name"]} for u in users_for(cfg, p)]
    add("vless_tcp", "vless", vless_plain("vless_tcp"), tls_stream("tcp"), decryption="none")
    add("vless_raw", "vless", vless_plain("vless_raw"), {"network": "tcp", "security": "none"}, decryption="none")
    add("vless_ws", "vless", vless_plain("vless_ws"),
        tls_stream("ws", wsSettings={"path": WS_PATHS["vless_ws"]}), decryption="none")
    add("vless_grpc", "vless", vless_plain("vless_grpc"),
        tls_stream("grpc", grpcSettings={"serviceName": GRPC_SERVICE}), decryption="none")
    add("vmess_ws", "vmess",
        [{"id": u["uuid"], "email": u["name"], "alterId": 0} for u in users_for(cfg, "vmess_ws")],
        tls_stream("ws", wsSettings={"path": WS_PATHS["vmess_ws"]}))
    add("vmess_tcp", "vmess",
        [{"id": u["uuid"], "email": u["name"], "alterId": 0} for u in users_for(cfg, "vmess_tcp")],
        tls_stream("tcp"))
    trojan = lambda p: [{"password": u["password"], "email": u["name"]} for u in users_for(cfg, p)]
    add("trojan", "trojan", trojan("trojan"), tls_stream("tcp"))
    add("trojan_ws", "trojan", trojan("trojan_ws"),
        tls_stream("ws", wsSettings={"path": WS_PATHS["trojan_ws"]}))
    if "ss" in ports and users_for(cfg, "ss"):
        inbounds.append({
            "tag": "ss", "port": ports["ss"], "protocol": "shadowsocks",
            "settings": {"method": cfg["node"]["ss_method"], "password": cfg["node"]["ss_key"],
                         "network": "tcp,udp",
                         "clients": [{"password": u["ss_key"], "email": u["name"]} for u in users_for(cfg, "ss")]}})
    return {
        "log": {"loglevel": "warning"},
        "stats": {},
        "api": {"tag": "api", "services": ["StatsService"]},
        "policy": {"levels": {"0": {"statsUserUplink": True, "statsUserDownlink": True}}},
        "inbounds": inbounds,
        # `direct` stays first: it is the default outbound. Panel-defined outbounds and rules come after.
        "outbounds": [{"protocol": "freedom", "tag": "direct"}, {"protocol": "blackhole", "tag": "block"}]
                     + list(cfg.get("outbounds", [])),
        "routing": {"rules": [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]
                    + list(cfg.get("rules", []))},
    }


def render_singbox(cfg, tls, busy=frozenset()):
    ports, inbounds = {k: v for k, v in cfg["protocols"].items() if v not in busy}, []
    tls_block = {"enabled": True, "certificate_path": tls["cert"], "key_path": tls["key"], "alpn": ["h3"]}
    if "hy2" in ports and users_for(cfg, "hy2"):
        inbounds.append({"type": "hysteria2", "tag": "hy2", "listen": "::", "listen_port": ports["hy2"],
                         "users": [{"name": u["name"], "password": u["password"]} for u in users_for(cfg, "hy2")],
                         "tls": tls_block})
    if "tuic" in ports and users_for(cfg, "tuic"):
        inbounds.append({"type": "tuic", "tag": "tuic", "listen": "::", "listen_port": ports["tuic"],
                         "users": [{"name": u["name"], "uuid": u["uuid"], "password": u["password"]}
                                   for u in users_for(cfg, "tuic")],
                         "congestion_control": "bbr", "tls": tls_block})
    return {"log": {"level": "warn"}, "inbounds": inbounds, "outbounds": [{"type": "direct"}]}


def set_conf_value(text, key, value):
    """Set `key value` / `key = value` in a config file, keeping the file's own style."""
    import re
    return re.sub(rf"^({re.escape(key)})(\s*=\s*|\s+)\S+", lambda m: f"{m.group(1)}{m.group(2)}{value}",
                  text, flags=re.M)


OURS = {"xray", "sing-box", "openvpn", "ocserv", "ocserv-main", "ocserv-worker", "charon", "xl2tpd", "dnstt-server"}
TCP_PROTOS = {"vless", "vless_tcp", "vless_raw", "vless_ws", "vless_grpc", "vmess_ws", "vmess_tcp", "trojan", "trojan_ws", "ss", "anyc"}
UDP_PROTOS = {"hy2", "tuic", "wg", "ovpn", "anyc", "dnstt"}


def foreign_listeners(ss_text):
    """`ss -H -ltnup` output -> {("tcp", 443): "xray-linux-amd6"} for ports held by programs that are not ours."""
    import re
    out = {}
    for line in ss_text.splitlines():
        f = line.split()
        m = re.search(r'\(\("([^"]+)"', line)
        if len(f) >= 5 and m and m.group(1) not in OURS and f[0] in ("tcp", "udp"):
            port = f[4].rsplit(":", 1)[-1]
            if port.isdigit():
                out[(f[0], int(port))] = m.group(1)
    return out


def port_conflicts(cfg, foreign):
    """-> ([tcp ports to skip], [udp ports to skip], ["tcp/8443 nginx", ...]) for the enabled protocols."""
    tcp, udp, notes = set(), set(), []
    for proto, port in cfg["protocols"].items():
        for kind, group, bag in (("tcp", TCP_PROTOS, tcp), ("udp", UDP_PROTOS, udp)):
            if proto in group and (kind, port) in foreign:
                bag.add(port)
                notes.append(f"{kind}/{port} {foreign[(kind, port)]} ({proto})")
    return tcp, udp, sorted(set(notes))


def render_l2tp(cfg):
    lines = [f'"{u["name"]}" l2tpd "{u["password"]}" *' for u in users_for(cfg, "l2tp")]
    return {"chap_secrets": "\n".join(lines) + ("\n" if lines else ""),
            "ipsec_secrets": render_ipsec_secrets(cfg)}


def render_ipsec_secrets(cfg):
    """L2TP pre-shared key, the IKEv2 server key and one EAP line per IKEv2 user."""
    out = [f': PSK "{cfg["node"]["l2tp_psk"]}"', ": RSA /etc/ipsec.d/private/server.key"]
    out += [f'{u["name"]} : EAP "{u["password"]}"' for u in users_for(cfg, "ikev2")]
    return "\n".join(out) + "\n"


def render_wg(cfg, server_private):
    port = cfg["protocols"].get("wg", 51820)
    out = [f"[Interface]\nAddress = 10.88.0.1/16\nListenPort = {port}\nPrivateKey = {server_private}\n"]
    out += [f"[Peer]\nPublicKey = {u['wg_pub']}\nAllowedIPs = {u['wg_ip']}/32\n" for u in users_for(cfg, "wg") if u.get("wg_pub")]
    return "\n".join(out)


def render_ovpn_users(cfg):
    import hashlib
    return "".join(f'{u["name"]}:{hashlib.sha256(u["password"].encode()).hexdigest()}\n'
                   for u in users_for(cfg, "ovpn"))


def render_ocpasswd(cfg, hasher):
    """ocserv password file; `hasher(password)` returns a crypt(3) hash."""
    return "".join(f'{u["name"]}:*:{hasher(u["password"])}\n' for u in users_for(cfg, "anyc"))


# ---------- system glue ----------
def sh(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def write_if_changed(path, content, mode=0o600):
    try:
        if open(path).read() == content:
            return False
    except FileNotFoundError:
        pass
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        f.write(content)
    os.chmod(tmp, mode)
    os.replace(tmp, path)
    return True


def load_json(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def api(conf, method, path, body=None):
    req = urllib.request.Request(
        conf["panel_url"].rstrip("/") + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + conf["token"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def xray_usage():
    """Per-user bytes since the last call (counters are reset on read)."""
    r = sh("xray", "api", "statsquery", f"--server={XRAY_API}", "-reset")
    if r.returncode != 0 or not r.stdout.strip():
        return {}
    usage = {}
    for s in json.loads(r.stdout).get("stat", []):
        parts = s["name"].split(">>>")
        if len(parts) == 4 and parts[0] == "user":
            usage[parts[1]] = usage.get(parts[1], 0) + int(s.get("value", 0))
    return usage


# ---------- usage for protocols Xray does not meter ----------
class Counters:
    """Turns cumulative per-session byte counters into increments."""

    def __init__(self):
        self.last = {}

    def delta(self, key, total):
        prev = self.last.get(key, total)  # first sight: no increment yet
        self.last[key] = total
        return total - prev if total >= prev else total  # a lower value means the counter restarted

    def forget(self, key):
        return self.last.pop(key, 0)

    def drop_missing(self, seen):
        for k in [k for k in self.last if k not in seen]:
            del self.last[k]


def parse_openvpn_status(text):
    """OpenVPN status file (versions 1, 2 and 3) -> [(common_name, real_address, bytes_received + bytes_sent)].
    systemd starts openvpn-server@ with --status-version 2, so version 2 is what the node really writes."""
    rows, cols, v1 = [], None, False
    for line in text.splitlines():
        sep = "\t" if "\t" in line else ","
        f = line.split(sep)
        if f[:2] == ["HEADER", "CLIENT_LIST"]:               # versions 2 and 3: named columns
            cols = f[2:]
        elif f[0] == "CLIENT_LIST" and cols:
            d = dict(zip(cols, f[1:]))
            rx, tx = d.get("Bytes Received", ""), d.get("Bytes Sent", "")
            if d.get("Common Name") and rx.isdigit() and tx.isdigit():
                rows.append((d["Common Name"], d.get("Real Address", ""), int(rx) + int(tx)))
        elif line.startswith("Common Name,"):                # version 1: a section with fixed columns
            v1 = True
        elif line.startswith(("ROUTING TABLE", "GLOBAL STATS", "END")):
            v1 = False
        elif v1 and len(f) >= 4 and f[2].isdigit() and f[3].isdigit():
            rows.append((f[0], f[1], int(f[2]) + int(f[3])))
    return rows


def parse_occtl_users(text):
    """`occtl -j show users` -> [(session_id, username, rx + tx)]. Key names are matched case-insensitively
    and raw byte counters (`raw_rx`/`raw_tx`) are preferred over the human readable `rx`/`tx`."""
    try:
        data = json.loads(text)
    except ValueError:
        return []
    out = []
    for u in data if isinstance(data, list) else []:
        u = {str(k).lower(): v for k, v in u.items()}
        rx, tx = u.get("raw_rx", u.get("rx")), u.get("raw_tx", u.get("tx"))
        rx, tx = (int(x) if isinstance(x, str) and x.isdigit() else x for x in (rx, tx))
        if u.get("username") and isinstance(rx, int) and isinstance(tx, int):
            out.append((str(u.get("id", u["username"])), u["username"], rx + tx))
    return out


def ppp_usage(counters, run_dir="/run/vpn-node", sys_dir="/sys/class/net",
              closed_path="/var/lib/vpn-node/ppp-closed"):
    """L2TP sessions: live counters from the ppp interfaces plus the final totals pppd logs on hang-up."""
    usage, seen = {}, set()
    if os.path.isdir(run_dir):
        for name in os.listdir(run_dir):
            if not name.startswith("ppp-"):
                continue
            ifname = name[4:]
            try:
                user = open(os.path.join(run_dir, name)).read().strip()
                stats = os.path.join(sys_dir, ifname, "statistics")
                total = int(open(os.path.join(stats, "rx_bytes")).read()) + int(open(os.path.join(stats, "tx_bytes")).read())
            except (OSError, ValueError):
                continue
            key = "ppp:" + ifname
            seen.add(key)
            d = counters.delta(key, total)
            if user and d > 0:
                usage[user] = usage.get(user, 0) + d
    if os.path.exists(closed_path):
        tmp = closed_path + ".processing"
        os.replace(closed_path, tmp)
        for line in open(tmp).read().splitlines():
            parts = line.split()
            if len(parts) == 3 and parts[2].isdigit():
                d = int(parts[2]) - counters.forget("ppp:" + parts[0])
                if d > 0:
                    usage[parts[1]] = usage.get(parts[1], 0) + d
        os.remove(tmp)
    return usage


_net_counters = Counters()


def session_usage():
    usage = {}

    def add(name, n):
        if n > 0:
            usage[name] = usage.get(name, 0) + n

    seen = set()
    for name, addr, total in parse_openvpn_status(read_text("/var/lib/vpn-node/ovpn/status.log")):
        key = f"ovpn:{name}:{addr}"
        seen.add(key)
        add(name, _net_counters.delta(key, total))
    r = sh("occtl", "-j", "show", "users")
    if r.returncode == 0:
        for sid, name, total in parse_occtl_users(r.stdout):
            key = f"anyc:{sid}"
            seen.add(key)
            add(name, _net_counters.delta(key, total))
    _net_counters.drop_missing({k for k in _net_counters.last if k.startswith("ppp:")} | seen)
    for name, n in ppp_usage(_net_counters).items():
        add(name, n)
    return usage


def self_update(conf, expected_sha):
    """Replace this file with the panel's agent.py when its hash differs, then restart in place."""
    me = os.path.abspath(__file__)
    with open(me, "rb") as f:
        if not expected_sha or hashlib.sha256(f.read()).hexdigest() == expected_sha:
            return
    req = urllib.request.Request(conf["panel_url"].rstrip("/") + "/node/agent.py")
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    if hashlib.sha256(data).hexdigest() != expected_sha:
        return  # panel served something other than it advertised; keep the working agent
    compile(data, me, "exec")  # never install a file that does not parse
    with open(me + ".new", "wb") as f:
        f.write(data)
    os.replace(me + ".new", me)
    print("agent updated, restarting", flush=True)
    os.execv(sys.executable, [sys.executable, me])


def _cpu_times():
    """(busy, total) jiffies from /proc/stat; steal time counts as idle (it is the host's, not ours)."""
    with open("/proc/stat") as f:
        v = [int(x) for x in f.readline().split()[1:]]
    idle = v[3] + (v[4] if len(v) > 4 else 0) + (v[7] if len(v) > 7 else 0)
    return sum(v[:8]) - idle, sum(v[:8])


_cpu_prev = None


def cpu_load_percent():
    """CPU in use since the previous report, in percent. (The load average is a run-queue length and reads ~100%
    on small VPSes that are mostly idle.)"""
    global _cpu_prev
    try:
        now = _cpu_times()
        if _cpu_prev is None:
            time.sleep(0.5)
            prev, now = now, _cpu_times()
        else:
            prev = _cpu_prev
        _cpu_prev = now
        busy, total = now[0] - prev[0], now[1] - prev[1]
        return min(100, int(busy / total * 100)) if total > 0 else 0
    except (OSError, ValueError, IndexError):
        return min(100, int(os.getloadavg()[0] / (os.cpu_count() or 1) * 100))


_hash_cache = {}


def crypt_hash(password):
    if password not in _hash_cache:  # salted hash differs per call; cache so the file stays stable
        _hash_cache[password] = subprocess.run(["openssl", "passwd", "-6", "-stdin"], input=password,
                                               capture_output=True, text=True, check=True).stdout.strip()
    return _hash_cache[password]


_wg_last = {}


def wg_usage(cfg):
    """Bytes per user since the previous call, from cumulative `wg show` counters."""
    r = sh("wg", "show", "wg0", "transfer")
    if r.returncode != 0:
        return {}
    names = {u["wg_pub"]: u["name"] for u in users_for(cfg, "wg")}
    usage = {}
    for line in r.stdout.splitlines():
        try:
            pub, rx, tx = line.split("\t")
        except ValueError:
            continue
        total = int(rx) + int(tx)
        prev = _wg_last.get(pub, total)  # first sight: no delta yet
        delta = total - prev if total >= prev else total  # a lower counter means wg restarted
        _wg_last[pub] = total
        if pub in names and delta > 0:
            usage[names[pub]] = usage.get(names[pub], 0) + delta
    return usage


def ensure_conf_line(path, key, value):
    """Append `key = value` to a config file if it does not set `key` yet. True when the file changed."""
    import re
    text = read_text(path)
    if not text or re.search(rf"^{re.escape(key)}\s*=", text, re.M):
        return False
    return write_if_changed(path, text.rstrip("\n") + f"\n{key} = {value}\n", 0o644)


OPENVPN_DROPIN = "/etc/systemd/system/openvpn-server@.service.d/vpn-node.conf"
# Ubuntu starts openvpn-server@ with LimitNPROC=10, counted per user. Xray also runs as `nobody` with many
# threads, so OpenVPN could not fork its auth script ("unable to fork") and exited on every login.
OPENVPN_DROPIN_TEXT = "[Service]\nLimitNPROC=infinity\n"


def ensure_openvpn_limits(path=OPENVPN_DROPIN, conf="/etc/openvpn/server/server.conf"):
    """Install the systemd drop-in once. True when it was written (the service then needs a restart)."""
    if not os.path.exists(conf):
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return write_if_changed(path, OPENVPN_DROPIN_TEXT, 0o644)


VPN_SUBNETS = ["10.99.0.0/16", "10.88.0.0/16", "10.77.0.0/24", "10.66.0.0/24", "10.55.0.0/24"]   # L2TP, WireGuard, IKEv2, AnyConnect, OpenVPN


def forwarding_rules(subnets, chain, iface):
    """[(table, chain, rule)] that let VPN clients reach the internet: forward both ways, and masquerade."""
    rules = []
    for n in subnets:
        rules.append(("filter", chain, ["-s", n, "-j", "ACCEPT"]))
        rules.append(("filter", chain, ["-d", n, "-m", "state", "--state", "RELATED,ESTABLISHED", "-j", "ACCEPT"]))
        if iface:
            rules.append(("nat", "POSTROUTING", ["-s", n, "-o", iface, "-j", "MASQUERADE"]))
    return rules


def ensure_forwarding(run=None):
    """Idempotent. Docker (and some firewalls) set FORWARD to DROP and rewrite the chain, so this runs on every
    pass instead of once at install time. DOCKER-USER, when present, is evaluated before Docker's own rules."""
    run = run or sh
    run("sysctl", "-w", "net.ipv4.ip_forward=1")
    chain = "DOCKER-USER" if run("iptables", "-S", "DOCKER-USER").returncode == 0 else "FORWARD"
    route = run("ip", "route", "show", "default").stdout.split()
    iface = route[route.index("dev") + 1] if "dev" in route else ""
    for table, ch, rule in forwarding_rules(VPN_SUBNETS, chain, iface):
        if run("iptables", "-t", table, "-C", ch, *rule).returncode != 0:
            run("iptables", "-t", table, "-I" if table == "filter" else "-A", ch, *(["1"] if table == "filter" else []), *rule)


# pppd 2.4.9 as built for Ubuntu rejects these serial-port options ("unrecognized option 'lock'") and exits at once,
# which ends every L2TP session right after IPsec came up. Older installers wrote them to options.xl2tpd.
PPP_BAD_OPTIONS = ("lock", "connect-delay")


def fix_ppp_options(path="/etc/ppp/options.xl2tpd"):
    """Drop options pppd cannot parse. True when the file changed (xl2tpd is then restarted by the hash check)."""
    text = read_text(path)
    if not text:
        return False
    keep = [l for l in text.splitlines() if (l.split() or [""])[0] not in PPP_BAD_OPTIONS]
    new = "\n".join(keep) + "\n"
    return new != text and write_if_changed(path, new, 0o644)


def restart_on_config_change(service, paths, state_dir="/var/lib/vpn-node", do_restart=None):
    """Restart `service` once whenever its config files differ from what it was last restarted with.
    Covers services that apt started with default settings before our files existed. True if restarted."""
    blob = b"".join(open(p, "rb").read() for p in paths if os.path.exists(p))
    if not blob:
        return False
    digest = hashlib.sha256(blob).hexdigest()
    marker = os.path.join(state_dir, f"cfg-{service}.sha")
    if read_text(marker).strip() == digest:
        return False
    os.makedirs(state_dir, exist_ok=True)
    with open(marker, "w") as f:
        f.write(digest)
    (do_restart or restart)(service)
    return True


def restart(service):
    sh("systemctl", "reset-failed", service)  # after repeated crashes systemd refuses to start it again
    sh("systemctl", "restart", service)


def apply_port(path, values, service):
    """Rewrite listen ports in a service's config and restart it when they changed."""
    text = read_text(path)
    new = text
    for key, port in values.items():
        if port:
            new = set_conf_value(new, key, port)
    if text and new != text:
        write_if_changed(path, new, 0o644)
        restart(service)


XRAY_CONFIG = "/usr/local/etc/xray/config.json"


def install_xray_config(text, errors, test=None):
    """Write the new Xray config only if Xray accepts it; a bad outbound or rule must not take every inbound down.
    A rejected config is reported through `errors` and the running one is kept. True when restart is needed."""
    if read_text(XRAY_CONFIG) == text:
        return False
    candidate = os.path.join(STATE_DIR, "xray.candidate.json")
    write_if_changed(candidate, text, 0o600)
    ok, why = (test or xray_test)(candidate)
    if not ok:
        errors.append("xray config rejected, previous one kept: " + why)
        return False
    return write_if_changed(XRAY_CONFIG, text, 0o644)


def xray_test(path):
    import shutil
    if not shutil.which("xray"):
        return True, ""
    r = sh("xray", "run", "-test", "-config", path)
    last = [l for l in (r.stdout + r.stderr).strip().splitlines() if "deprecated" not in l]
    return r.returncode == 0, (last[-1] if last else "")[-260:]


# ---------- DNSTT: DNS tunnel server (one shared domain and key on every node) ----------
DNSTT_BIN = "/usr/local/bin/dnstt-server"
DNSTT_KEY = f"{STATE_DIR}/dnstt.key"
DNSTT_PUB = f"{STATE_DIR}/dnstt.pub"
DNSTT_UNIT = "/etc/systemd/system/dnstt-server.service"
DNSTT_INSTALL = r"""set -e
d=$(mktemp -d); trap 'rm -rf "$d"' EXIT
case "$(uname -m)" in x86_64) ga=amd64;; aarch64|arm64) ga=arm64;; *) echo "unsupported CPU $(uname -m)"; exit 1;; esac
command -v git >/dev/null || { apt-get update -y >/dev/null && apt-get install -y git >/dev/null; }
get_go() {
  for ver in "$@"; do
    for base in https://go.dev/dl https://dl.google.com/go https://golang.google.cn/dl https://mirrors.aliyun.com/golang; do
      if curl -fsSL --connect-timeout 15 "$base/$ver.linux-$ga.tar.gz" -o "$d/go.tgz" && tar -C "$d" -xzf "$d/go.tgz" 2>/dev/null; then
        echo "go $ver from $base"; return 0
      fi
    done
  done
  return 1
}
latest=$(curl -fsSL --connect-timeout 15 'https://go.dev/dl/?mode=json' 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['version'])" 2>/dev/null || true)
if get_go $latest go1.23.4 go1.22.5; then
  GO="$d/go/bin/go"
else
  echo "could not download Go; trying the distribution package"
  apt-get install -y golang-go >/dev/null && GO=$(command -v go) || { echo "no Go available: download from go.dev, dl.google.com and the apt package all failed"; exit 1; }
fi
git clone https://www.bamsoftware.com/git/dnstt.git "$d/dnstt"
cd "$d/dnstt/dnstt-server"
GOPATH="$d/gopath" GOCACHE="$d/cache" GOTOOLCHAIN=local GOFLAGS=-mod=mod GOPROXY="https://proxy.golang.org|https://goproxy.io|https://goproxy.cn|direct" "$GO" build -o /usr/local/bin/dnstt-server .
echo "dnstt-server installed"
"""


# ---------- DNSTT inner protocol "ssh": what NetMod's "DNSTT + SSH" speaks ----------
SSH_PORT = 2222                 # loopback-only sshd that dnstt-server forwards to
SSH_GROUP = "vpnssh"
SSH_PREFIX = "vs_"              # only accounts with this prefix, in our group, are ever created or removed
SSHD_CONF = f"{STATE_DIR}/sshd_config"
SSHD_UNIT = "/etc/systemd/system/vpn-node-sshd.service"
SSH_HOST_KEY = f"{STATE_DIR}/ssh_host_ed25519_key"
SSH_STATE = f"{STATE_DIR}/ssh-users.json"


def ssh_username(name):
    """Panel user name -> Linux account name. Plain when it is already a safe lowercase name, otherwise sanitised with a
    hash so that two different panel names can never share an account. Mirrored in panel/app/subscription.py."""
    import re
    base = re.sub(r"[^a-z0-9_-]", "_", name.lower())
    if base == name and len(SSH_PREFIX + base) <= 32:
        return SSH_PREFIX + base
    return (SSH_PREFIX + base[:20] + "_" + hashlib.sha256(name.encode()).hexdigest()[:8])[:32]


def plan_ssh_users(existing, state, wanted):
    """existing: our account names now; state: {account: sha256(password) we set}; wanted: {account: password}.
    -> (add, update, remove). Nothing outside the prefix is ever removed."""
    digest = lambda p: hashlib.sha256(p.encode()).hexdigest()
    add = sorted(u for u in wanted if u not in existing)
    update = sorted(u for u in wanted if u in existing and state.get(u) != digest(wanted[u]))
    remove = sorted(u for u in existing if u not in wanted and u.startswith(SSH_PREFIX))
    return add, update, remove


def sshd_config(port=SSH_PORT):
    return f"""# managed by the node agent
Port {port}
ListenAddress 127.0.0.1
HostKey {SSH_HOST_KEY}
PidFile /run/vpn-node-sshd.pid
AllowGroups {SSH_GROUP}
PasswordAuthentication yes
KbdInteractiveAuthentication no
PubkeyAuthentication no
PermitRootLogin no
PermitEmptyPasswords no
UsePAM yes
AllowTcpForwarding yes
AllowAgentForwarding no
X11Forwarding no
PermitTTY no
ForceCommand /bin/false
ClientAliveInterval 30
ClientAliveCountMax 4
LoginGraceTime 30
MaxAuthTries 4
MaxStartups 100:30:200
MaxSessions 20
UseDNS no
PrintMotd no
"""


SSHD_UNIT_TEXT = f"""[Unit]
Description=Loopback SSH for the DNS tunnel
After=network.target

[Service]
ExecStartPre=/usr/sbin/sshd -t -f {SSHD_CONF}
ExecStart=/usr/sbin/sshd -D -e -f {SSHD_CONF}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""


def sh_input(cmd, text):
    return subprocess.run(cmd, input=text, capture_output=True, text=True)


def ssh_accounts():
    """Names of the accounts this agent created: prefix + primary group vpnssh + our comment."""
    gid = (sh("getent", "group", SSH_GROUP).stdout.strip().split(":") + ["", "", ""])[2]
    out = set()
    for line in sh("getent", "passwd").stdout.splitlines():
        f = line.split(":")
        if len(f) >= 5 and f[0].startswith(SSH_PREFIX) and f[3] == gid and f[4] == "vpn-node":
            out.add(f[0])
    return out


def apply_ssh_users(cfg, errors):
    wanted = {ssh_username(u["name"]): u["password"] for u in users_for(cfg, "dnstt")}
    state = load_json(SSH_STATE, {}) or {}
    existing = ssh_accounts()
    add, update, remove = plan_ssh_users(existing, state, wanted)
    for name in add:
        r = sh("useradd", "-M", "-N", "-g", SSH_GROUP, "-s", "/usr/sbin/nologin", "-c", "vpn-node", name)
        if r.returncode != 0:
            errors.append(f"ssh account {name}: " + (r.stderr or r.stdout).strip()[-120:])
            wanted.pop(name, None)
    for name in add + update:
        if name in wanted:
            r = sh_input(["chpasswd", "-e"], f"{name}:{crypt_hash(wanted[name])}\n")
            if r.returncode != 0:
                errors.append(f"ssh password {name}: " + (r.stderr or r.stdout).strip()[-120:])
                wanted.pop(name, None)
    for name in remove:
        sh("pkill", "-KILL", "-u", name)   # an expired or disabled user is cut off now, not at the next login
        sh("userdel", name)
    new_state = {n: hashlib.sha256(p.encode()).hexdigest() for n, p in wanted.items()}
    if new_state != state:
        os.makedirs(STATE_DIR, exist_ok=True)
        write_if_changed(SSH_STATE, json.dumps(new_state), 0o600)


def apply_ssh(cfg, errors):
    """Run the loopback sshd and keep its accounts in step with the panel's users (inner protocol "ssh")."""
    import shutil
    if not shutil.which("sshd") and not os.path.exists("/usr/sbin/sshd"):
        sh("apt-get", "install", "-y", "openssh-server")
    if sh("getent", "group", SSH_GROUP).returncode != 0:
        sh("groupadd", "-f", SSH_GROUP)
    if not os.path.exists(SSH_HOST_KEY):
        sh("ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", SSH_HOST_KEY)
    changed = write_if_changed(SSHD_CONF, sshd_config(), 0o600)
    if write_if_changed(SSHD_UNIT, SSHD_UNIT_TEXT, 0o644):
        sh("systemctl", "daemon-reload")
        sh("systemctl", "enable", "vpn-node-sshd")
        changed = True
    if changed or sh("systemctl", "is-active", "vpn-node-sshd").stdout.strip() != "active":
        restart("vpn-node-sshd")
    apply_ssh_users(cfg, errors)
    if sh("systemctl", "is-active", "vpn-node-sshd").stdout.strip() != "active":
        last = (sh("journalctl", "-u", "vpn-node-sshd", "-n", "1", "--no-pager", "-o", "cat").stdout or "").strip()
        errors.append("ssh for the dns tunnel is not running: " + last[-140:])


def remove_ssh(errors):
    """Switched back to the VLESS inner protocol (or DNSTT is off): stop the loopback sshd and drop our accounts."""
    if not os.path.exists(SSHD_UNIT):
        return
    sh("systemctl", "disable", "--now", "vpn-node-sshd")
    for name in ssh_accounts():
        sh("pkill", "-KILL", "-u", name)
        sh("userdel", name)
    write_if_changed(SSH_STATE, "{}", 0o600)


def dnstt_unit(port, domain, key=DNSTT_KEY, upstream=None):
    return f"""[Unit]
Description=DNSTT server
After=network-online.target

[Service]
ExecStart={DNSTT_BIN} -udp :{port} -privkey-file {key} {domain} 127.0.0.1:{upstream or DNSTT_UPSTREAM_PORT}
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
"""


DNSTT_RULE_TAG = "vpn-node-dnstt"   # iptables comment: only rules carrying it are ever touched


def dnstt_redirect_plan(rules_text, port):
    """iptables -t nat -S PREROUTING output -> (add?, [stale rule specs to delete]). Public UDP 53 is redirected to the
    port dnstt-server listens on, because systemd-resolved usually owns :53 itself."""
    have, stale = False, []
    for line in rules_text.splitlines():
        f = line.split()
        if line.startswith("-A PREROUTING") and DNSTT_RULE_TAG in f and "--dport" in f and f[f.index("--dport") + 1] == "53" \
                and "REDIRECT" in f and "--to-ports" in f:
            if f[f.index("--to-ports") + 1] == str(port):
                have = True
            else:
                stale.append(f[2:])
    return not have, stale


def ensure_dnstt_redirect(port, run=None):
    """Idempotent; port=None removes our rule(s)."""
    run = run or sh
    add, stale = dnstt_redirect_plan(run("iptables", "-t", "nat", "-S", "PREROUTING").stdout, port or 0)
    for spec in stale:
        run("iptables", "-t", "nat", "-D", "PREROUTING", *spec)
    if port is not None and add:
        run("iptables", "-t", "nat", "-A", "PREROUTING", "-p", "udp", "--dport", "53", "-m", "comment", "--comment", DNSTT_RULE_TAG,
            "-j", "REDIRECT", "--to-ports", str(port))


_dnstt_install = {"thread": None, "failed_at": 0, "why": ""}


def ensure_dnstt_binary(errors, run=None, now=time.time):
    """Build dnstt-server in the background (a few minutes) and retry at most hourly. True once it is installed."""
    import shutil
    import threading
    if os.path.exists(DNSTT_BIN) or shutil.which("dnstt-server"):
        return True
    st = _dnstt_install
    if st["thread"] and st["thread"].is_alive():
        return False
    if st["failed_at"] and now() - st["failed_at"] < 3600:
        errors.append("dnstt-server install failed: " + st["why"])
        return False

    def work():
        r = (run or sh)("bash", "-c", DNSTT_INSTALL)
        if r.returncode != 0:
            st["failed_at"], st["why"] = now(), ((r.stderr or r.stdout).strip().splitlines() or ["unknown error"])[-1][-200:]
    st["failed_at"] = 0
    st["thread"] = threading.Thread(target=work, daemon=True)
    st["thread"].start()
    return False


def apply_dnstt(cfg, errors, udp_busy=frozenset()):
    """Returns {"dnstt_priv", "dnstt_pub"} when this node generated the key pair (the panel keeps the first one and
    hands it to every node), else {}."""
    d = cfg.get("dnstt")
    port = cfg["protocols"].get("dnstt")
    if not d or not port:
        if os.path.exists(DNSTT_UNIT):   # it was set up here before: undo it
            sh("systemctl", "disable", "--now", "dnstt-server")
            ensure_dnstt_redirect(None)
        remove_ssh(errors)
        return {}
    if port in udp_busy:
        return {}   # reported as a port conflict
    if not ensure_dnstt_binary(errors):
        return {}
    out = {}
    if d.get("privkey"):
        write_if_changed(DNSTT_KEY, d["privkey"].strip() + "\n", 0o600)
    elif not os.path.exists(DNSTT_KEY):
        r = sh(DNSTT_BIN, "-gen-key", "-privkey-file", DNSTT_KEY, "-pubkey-file", DNSTT_PUB)
        if r.returncode != 0:
            errors.append("dnstt key generation failed: " + (r.stderr or r.stdout).strip()[-160:])
            return {}
    if not d.get("privkey") and os.path.exists(DNSTT_PUB):
        out = {"dnstt_priv": read_text(DNSTT_KEY).strip(), "dnstt_pub": read_text(DNSTT_PUB).strip()}
    inner = d.get("inner", "ssh")
    if inner == "ssh":
        apply_ssh(cfg, errors)
    else:
        remove_ssh(errors)
    upstream = SSH_PORT if inner == "ssh" else DNSTT_UPSTREAM_PORT
    if write_if_changed(DNSTT_UNIT, dnstt_unit(port, d["domain"], upstream=upstream), 0o644):
        sh("systemctl", "daemon-reload")
        sh("systemctl", "enable", "dnstt-server")
    restart_on_config_change("dnstt-server", [DNSTT_UNIT, DNSTT_KEY])
    ensure_dnstt_redirect(port)
    if sh("systemctl", "is-active", "dnstt-server").stdout.strip() != "active":
        last = (sh("journalctl", "-u", "dnstt-server", "-n", "1", "--no-pager", "-o", "cat").stdout or "").strip()
        errors.append("dnstt-server is not running: " + last[-160:])
    return out


def apply(cfg, reality, tls, wg):
    """Write configs and restart what changed. Returns the port conflicts found."""
    tcp_busy, udp_busy, conflicts = port_conflicts(cfg, foreign_listeners(sh("ss", "-H", "-ltnup").stdout))
    errors = []
    xray_cfg = json.dumps(render_xray(cfg, reality, tls, tcp_busy), indent=1)
    if install_xray_config(xray_cfg, errors):
        restart("xray")
    if write_if_changed("/etc/sing-box/config.json", json.dumps(render_singbox(cfg, tls, udp_busy), indent=1), 0o644):
        restart("sing-box")
    l2 = render_l2tp(cfg)
    write_if_changed("/etc/ppp/chap-secrets", l2["chap_secrets"])  # read by pppd per login, no reload
    if write_if_changed("/etc/ipsec.secrets", l2["ipsec_secrets"]):
        sh("ipsec", "rereadsecrets")
    if wg and write_if_changed("/etc/wireguard/wg0.conf", render_wg(cfg, wg["private"])):
        if sh("wg", "show", "wg0").returncode == 0:
            stripped = sh("wg-quick", "strip", "wg0").stdout
            tmp = f"{STATE_DIR}/wg0.stripped"
            write_if_changed(tmp, stripped)
            sh("wg", "syncconf", "wg0", tmp)  # live update, keeps existing sessions
        else:
            sh("systemctl", "restart", "wg-quick@wg0")
    dnstt = apply_dnstt(cfg, errors, udp_busy)
    ensure_forwarding()
    fix_ppp_options()
    restart_on_config_change("strongswan-starter", ["/etc/ipsec.conf"])
    restart_on_config_change("xl2tpd", ["/etc/xl2tpd/xl2tpd.conf", "/etc/ppp/options.xl2tpd"])
    restart_on_config_change("ocserv", ["/etc/ocserv/ocserv.conf"])
    if ensure_openvpn_limits():
        sh("systemctl", "daemon-reload")
        restart("openvpn-server@server")
    apply_port("/etc/openvpn/server/server.conf", {"port": cfg["protocols"].get("ovpn")}, "openvpn-server@server")
    # ocserv only creates the control socket `occtl` talks to when use-occtl is on (users and traffic come from it)
    changed = [ensure_conf_line("/etc/ocserv/ocserv.conf", k, v)
               for k, v in (("use-occtl", "true"), ("occtl-socket-file", "/run/occtl.socket"))]
    if any(changed):
        restart("ocserv")
    apply_port("/etc/ocserv/ocserv.conf", {"tcp-port": cfg["protocols"].get("anyc"),
                                           "udp-port": cfg["protocols"].get("anyc")}, "ocserv")
    write_if_changed("/etc/vpn-node/ovpn-users", render_ovpn_users(cfg), 0o644)  # checked per login
    write_if_changed("/etc/ocserv/ocpasswd", render_ocpasswd(cfg, crypt_hash), 0o600)  # checked per login
    return conflicts, errors, dnstt


def cert_sha256(path):
    """SHA-256 (hex) of the first certificate in a PEM file: what clients pin for a self-signed node."""
    import ssl
    try:
        pem = open(path).read().split("-----END CERTIFICATE-----")[0] + "-----END CERTIFICATE-----\n"
        return hashlib.sha256(ssl.PEM_cert_to_DER_cert(pem)).hexdigest()
    except (OSError, ValueError):
        return ""


def read_text(path):
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        return ""


def main():
    conf = load_json(CONF)
    if not conf:
        sys.exit(f"missing {CONF}")
    reality = load_json(f"{STATE_DIR}/reality.json", {"private": "", "public": "", "short_id": ""})
    wg = load_json(f"{STATE_DIR}/wg.json")
    tls = {"cert": f"{STATE_DIR}/tls.crt", "key": f"{STATE_DIR}/tls.key"}
    pending = {}
    while True:
        try:
            cfg = api(conf, "GET", "/api/node/config")
            self_update(conf, cfg.get("agent_sha256"))
            conflicts, errors, dnstt = apply(cfg, reality, tls, wg)
            for src in (xray_usage(), wg_usage(cfg) if wg else {}, session_usage()):
                for k, v in src.items():
                    pending[k] = pending.get(k, 0) + v
            api(conf, "POST", "/api/node/report", {
                "load": cpu_load_percent(), "usage": pending, "reality_pub": reality["public"],
                "reality_sid": reality["short_id"], "tls_self_signed": conf.get("tls_self_signed", True), "tls_pin": cert_sha256(tls["cert"]),
                "conflicts": conflicts, "errors": errors, "wg_pub": wg["public"] if wg else "", "ovpn_ca": read_text(f"{STATE_DIR}/ovpn/ca.crt"), **dnstt})
            pending = {}  # kept in memory until the panel accepted the report
        except Exception as e:  # keep running; the panel may be briefly unreachable
            print("agent error:", e, file=sys.stderr, flush=True)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
