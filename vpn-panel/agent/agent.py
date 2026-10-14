#!/usr/bin/env python3
"""Node agent. Pulls the desired state from the panel, renders configs for
Xray, sing-box and strongSwan/xl2tpd, reloads the services that changed, and
reports load and per-user traffic back. Standard library only."""
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
def users_for(cfg, proto):
    return [u for u in cfg["users"] if proto in u["protos"]]


def render_xray(cfg, reality, tls):
    ports = cfg["protocols"]
    inbounds = [{"tag": "api", "listen": "127.0.0.1", "port": 10085, "protocol": "dokodemo-door",
                 "settings": {"address": "127.0.0.1"}}]
    certs = [{"certificateFile": tls["cert"], "keyFile": tls["key"]}]
    if "vless" in ports and users_for(cfg, "vless"):
        inbounds.append({
            "tag": "vless", "port": ports["vless"], "protocol": "vless",
            "settings": {"decryption": "none", "clients": [
                {"id": u["uuid"], "email": u["name"], "flow": "xtls-rprx-vision"}
                for u in users_for(cfg, "vless")]},
            "streamSettings": {"network": "tcp", "security": "reality", "realitySettings": {
                "dest": cfg["node"]["reality_sni"] + ":443",
                "serverNames": [cfg["node"]["reality_sni"]],
                "privateKey": reality["private"], "shortIds": [reality["short_id"]]}}})
    if "trojan" in ports and users_for(cfg, "trojan"):
        inbounds.append({
            "tag": "trojan", "port": ports["trojan"], "protocol": "trojan",
            "settings": {"clients": [{"password": u["password"], "email": u["name"]}
                                     for u in users_for(cfg, "trojan")]},
            "streamSettings": {"network": "tcp", "security": "tls",
                               "tlsSettings": {"certificates": certs}}})
    if "ss" in ports and users_for(cfg, "ss"):
        inbounds.append({
            "tag": "ss", "port": ports["ss"], "protocol": "shadowsocks",
            "settings": {"method": cfg["node"]["ss_method"], "password": cfg["node"]["ss_key"],
                         "network": "tcp,udp",
                         "clients": [{"password": u["ss_key"], "email": u["name"]}
                                     for u in users_for(cfg, "ss")]}})
    return {
        "log": {"loglevel": "warning"},
        "stats": {},
        "api": {"tag": "api", "services": ["StatsService"]},
        "policy": {"levels": {"0": {"statsUserUplink": True, "statsUserDownlink": True}}},
        "inbounds": inbounds,
        "outbounds": [{"protocol": "freedom", "tag": "direct"},
                      {"protocol": "blackhole", "tag": "block"}],
        "routing": {"rules": [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]},
    }


def render_singbox(cfg, tls):
    inbounds = []
    if "hy2" in cfg["protocols"] and users_for(cfg, "hy2"):
        inbounds.append({
            "type": "hysteria2", "tag": "hy2", "listen": "::", "listen_port": cfg["protocols"]["hy2"],
            "users": [{"name": u["name"], "password": u["password"]} for u in users_for(cfg, "hy2")],
            "tls": {"enabled": True, "certificate_path": tls["cert"], "key_path": tls["key"],
                    "alpn": ["h3"]}})
    return {"log": {"level": "warn"}, "inbounds": inbounds, "outbounds": [{"type": "direct"}]}


def render_l2tp(cfg):
    lines = [f'"{u["name"]}" l2tpd "{u["password"]}" *' for u in users_for(cfg, "l2tp")]
    return {"chap_secrets": "\n".join(lines) + ("\n" if lines else ""),
            "ipsec_secrets": f': PSK "{cfg["node"]["l2tp_psk"]}"\n'}


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


def cpu_load_percent():
    return min(100, int(os.getloadavg()[0] / (os.cpu_count() or 1) * 100))


def apply(cfg, reality, tls):
    xray_cfg = json.dumps(render_xray(cfg, reality, tls), indent=1)
    if write_if_changed("/usr/local/etc/xray/config.json", xray_cfg, 0o644):
        sh("systemctl", "restart", "xray")
    if write_if_changed("/etc/sing-box/config.json", json.dumps(render_singbox(cfg, tls), indent=1), 0o644):
        sh("systemctl", "restart", "sing-box")
    l2 = render_l2tp(cfg)
    write_if_changed("/etc/ppp/chap-secrets", l2["chap_secrets"])  # read by pppd per login, no reload
    if write_if_changed("/etc/ipsec.secrets", l2["ipsec_secrets"]):
        sh("ipsec", "rereadsecrets")


def main():
    conf = load_json(CONF)
    if not conf:
        sys.exit(f"missing {CONF}")
    reality = load_json(f"{STATE_DIR}/reality.json", {"private": "", "public": "", "short_id": ""})
    tls = {"cert": f"{STATE_DIR}/tls.crt", "key": f"{STATE_DIR}/tls.key"}
    pending = {}
    while True:
        try:
            cfg = api(conf, "GET", "/api/node/config")
            apply(cfg, reality, tls)
            for k, v in xray_usage().items():
                pending[k] = pending.get(k, 0) + v
            api(conf, "POST", "/api/node/report", {
                "load": cpu_load_percent(), "usage": pending, "reality_pub": reality["public"],
                "reality_sid": reality["short_id"], "tls_self_signed": conf.get("tls_self_signed", True)})
            pending = {}  # kept in memory until the panel accepted the report
        except Exception as e:  # keep running; the panel may be briefly unreachable
            print("agent error:", e, file=sys.stderr, flush=True)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
