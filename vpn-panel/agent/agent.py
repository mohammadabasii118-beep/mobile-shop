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

    sni = cfg["node"]["reality_sni"]
    add("vless", "vless",
        [{"id": u["uuid"], "email": u["name"], "flow": "xtls-rprx-vision"} for u in users_for(cfg, "vless")],
        {"network": "tcp", "security": "reality", "realitySettings": {
            "dest": sni + ":443", "serverNames": [sni],
            "privateKey": reality["private"], "shortIds": [reality["short_id"]]}},
        decryption="none")
    vless_plain = lambda p: [{"id": u["uuid"], "email": u["name"]} for u in users_for(cfg, p)]
    add("vless_tcp", "vless", vless_plain("vless_tcp"), tls_stream("tcp"), decryption="none")
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
        "outbounds": [{"protocol": "freedom", "tag": "direct"}, {"protocol": "blackhole", "tag": "block"}],
        "routing": {"rules": [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]},
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


OURS = {"xray", "sing-box", "openvpn", "ocserv", "ocserv-main", "ocserv-worker", "charon", "xl2tpd"}
TCP_PROTOS = {"vless", "vless_tcp", "vless_ws", "vless_grpc", "vmess_ws", "vmess_tcp", "trojan", "trojan_ws", "ss", "anyc"}
UDP_PROTOS = {"hy2", "tuic", "wg", "ovpn", "anyc"}


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


def cpu_load_percent():
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


def apply(cfg, reality, tls, wg):
    """Write configs and restart what changed. Returns the port conflicts found."""
    tcp_busy, udp_busy, conflicts = port_conflicts(cfg, foreign_listeners(sh("ss", "-H", "-ltnup").stdout))
    xray_cfg = json.dumps(render_xray(cfg, reality, tls, tcp_busy), indent=1)
    if write_if_changed("/usr/local/etc/xray/config.json", xray_cfg, 0o644):
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
    apply_port("/etc/openvpn/server/server.conf", {"port": cfg["protocols"].get("ovpn")}, "openvpn-server@server")
    if ensure_conf_line("/etc/ocserv/ocserv.conf", "occtl-socket-file", "/run/occtl.socket"):
        restart("ocserv")  # without this socket `occtl` (users, traffic) cannot talk to ocserv
    apply_port("/etc/ocserv/ocserv.conf", {"tcp-port": cfg["protocols"].get("anyc"),
                                           "udp-port": cfg["protocols"].get("anyc")}, "ocserv")
    write_if_changed("/etc/vpn-node/ovpn-users", render_ovpn_users(cfg), 0o644)  # checked per login
    write_if_changed("/etc/ocserv/ocpasswd", render_ocpasswd(cfg, crypt_hash), 0o600)  # checked per login
    return conflicts


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
            conflicts = apply(cfg, reality, tls, wg)
            for src in (xray_usage(), wg_usage(cfg) if wg else {}, session_usage()):
                for k, v in src.items():
                    pending[k] = pending.get(k, 0) + v
            api(conf, "POST", "/api/node/report", {
                "load": cpu_load_percent(), "usage": pending, "reality_pub": reality["public"],
                "reality_sid": reality["short_id"], "tls_self_signed": conf.get("tls_self_signed", True), "tls_pin": cert_sha256(tls["cert"]),
                "conflicts": conflicts, "wg_pub": wg["public"] if wg else "", "ovpn_ca": read_text(f"{STATE_DIR}/ovpn/ca.crt")})
            pending = {}  # kept in memory until the panel accepted the report
        except Exception as e:  # keep running; the panel may be briefly unreachable
            print("agent error:", e, file=sys.stderr, flush=True)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
