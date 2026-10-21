#!/usr/bin/env python3
"""Agent of the Iran side of a vtunnel tunnel. Pulls its settings from the panel every 15 s and keeps the vtunnel server
running for them; reports how many connections from the foreign side are ready. Standard library only."""
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

CONF = os.environ.get("VTUNNEL_RELAY_CONF", "/etc/vtunnel/agent.json")
VTUNNEL = "/usr/local/bin/vtunnel.py"
STATE = "/var/lib/vtunnel"
INTERVAL = 15


def sh(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def api(conf, method, path, body=None):
    req = urllib.request.Request(conf["panel_url"].rstrip("/") + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + conf["token"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def fetch(conf, path, dest, expected_sha, mode=0o755):
    """Download `path` to `dest` unless it already has the expected hash; never install something that does not match."""
    try:
        if hashlib.sha256(open(dest, "rb").read()).hexdigest() == expected_sha:
            return False
    except FileNotFoundError:
        pass
    with urllib.request.urlopen(conf["panel_url"].rstrip("/") + path, timeout=30) as r:
        data = r.read()
    if hashlib.sha256(data).hexdigest() != expected_sha:
        return False
    compile(data, dest, "exec")
    with open(dest + ".new", "wb") as f:
        f.write(data)
    os.chmod(dest + ".new", mode)
    os.replace(dest + ".new", dest)
    return True


def write_if_changed(path, content, mode=0o644):
    try:
        if open(path).read() == content:
            return False
    except FileNotFoundError:
        pass
    with open(path, "w") as f:
        f.write(content)
    os.chmod(path, mode)
    return True


def forward_args(forwards):
    out = []
    for f in forwards:
        spec = ("udp:" if f["proto"] == "udp" else "") + str(f["listen"]) + (f"={f['target']}" if f["target"] != f["listen"] else "")
        out.append(f"--forward {spec}")
    return " ".join(out)


def unit_text(t, status_file, env_file):
    return f"""[Unit]
Description=vtunnel server {t['name']}
After=network-online.target

[Service]
EnvironmentFile={env_file}
ExecStart=/usr/bin/python3 {VTUNNEL} server --listen 0.0.0.0:{t['ctl_port']} --status-file {status_file} {forward_args(t['forwards'])}
Restart=always
RestartSec=2
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
"""


def apply(conf, cfg, errors):
    t = cfg["tunnel"]
    service = f"vtunnel-server-{t['id']}"
    unit = f"/etc/systemd/system/{service}.service"
    env_file = f"/etc/vtunnel/{t['id']}.env"
    status_file = f"{STATE}/{t['id']}.json"
    os.makedirs(STATE, exist_ok=True)
    os.makedirs(os.path.dirname(env_file), exist_ok=True)
    if not t["enabled"]:
        if os.path.exists(unit):
            sh("systemctl", "disable", "--now", service)
        return service, status_file
    changed = fetch(conf, "/vtunnel.py", VTUNNEL, cfg["vtunnel_sha256"])
    changed |= write_if_changed(env_file, f"VTUNNEL_TOKEN={t['token']}\n", 0o600)
    changed |= write_if_changed(unit, unit_text(t, status_file, env_file))
    if changed:
        sh("systemctl", "daemon-reload")
        sh("systemctl", "enable", service)
        sh("systemctl", "restart", service)
    elif sh("systemctl", "is-active", service).stdout.strip() != "active":
        sh("systemctl", "restart", service)
    if sh("systemctl", "is-active", service).stdout.strip() != "active":
        last = (sh("journalctl", "-u", service, "-n", "1", "--no-pager", "-o", "cat").stdout or "").strip()
        errors.append("vtunnel server is not running: " + last[-150:])
    return service, status_file


def remove_everything(conf, tunnel_id):
    """The tunnel was deleted in the panel: stop and remove what this agent created on the server."""
    service = f"vtunnel-server-{tunnel_id}"
    sh("systemctl", "disable", "--now", service)
    for path in (f"/etc/systemd/system/{service}.service", f"/etc/vtunnel/{tunnel_id}.env", f"{STATE}/{tunnel_id}.json"):
        try:
            os.remove(path)
        except OSError:
            pass
    sh("systemctl", "daemon-reload")
    sh("systemctl", "disable", "--now", "vtunnel-agent")
    for path in ("/etc/systemd/system/vtunnel-agent.service", CONF):
        try:
            os.remove(path)
        except OSError:
            pass
    sh("systemctl", "daemon-reload")


def self_update(conf, expected_sha):
    me = os.path.abspath(__file__)
    if not expected_sha or hashlib.sha256(open(me, "rb").read()).hexdigest() == expected_sha:
        return
    if fetch(conf, "/relay/agent.py", me, expected_sha):
        print("agent updated, restarting", flush=True)
        os.execv(sys.executable, [sys.executable, me])


def main():
    conf = json.load(open(CONF))
    gone = 0
    while True:
        errors = []
        try:
            cfg = api(conf, "GET", "/api/relay/config")
            gone = 0
            self_update(conf, cfg.get("agent_sha256"))
            service, status_file = apply(conf, cfg, errors)
            try:
                st = json.load(open(status_file))
                if time.time() - st.get("time", 0) > 30:
                    st = {}
            except (OSError, ValueError):
                st = {}
            api(conf, "POST", "/api/relay/report", {"pool": st.get("pool", 0), "udp_client": st.get("udp_client", False),
                                                    "failed": st.get("failed", []), "errors": errors})
        except urllib.error.HTTPError as e:
            if e.code == 401:                      # the tunnel no longer exists in the panel
                gone += 1
                if gone >= 3:
                    remove_everything(conf, conf.get("id", 0))
                    return
            print("agent error:", e, file=sys.stderr, flush=True)
        except Exception as e:
            print("agent error:", e, file=sys.stderr, flush=True)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
