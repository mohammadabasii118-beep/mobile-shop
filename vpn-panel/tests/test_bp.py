"""BackPack tunnels: config generation, the agent-side installer (fake systemctl), and - when BACKPACK_BIN points at the real
binary - the generated configs of every reverse transport carrying real traffic."""
import hashlib
import http.server
import json
import os
import re
import socket
import stat
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
from pathlib import Path
from types import SimpleNamespace as NS

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "panel"))
from app import bp  # noqa: E402

VT = str(ROOT / "agent" / "vtunnel.py")
BIN = os.environ.get("BACKPACK_BIN", "")


def mk(**kw):
    base = dict(id=3, kind="reverse", transport="stealth", port=9101, token="T" * 40, forwards=[{"proto": "tcp", "listen": 80, "target": 80},
                {"proto": "tcp", "listen": 81, "target": 80}], accept_udp=False, fallbacks=[], fec_data=0, fec_parity=0, net_n=0)
    base.update(kw)
    return NS(**base)


def test_render_reverse_and_direct():
    t = mk()
    s, c = bp.render(t, "iran", "1.2.3.4", "node.example"), bp.render(t, "node", "1.2.3.4", "node.example")
    assert '[server]' in s and 'bind_addr = "0.0.0.0:9101"' in s and 'transport = "stealth"' in s and 'ports = ["80", "81=80"]' in s and "accept_udp = false" in s
    assert '[client]' in c and 'remote_addr = "1.2.3.4:9101"' in c and f'token = "{"T" * 40}"' in c and "ports" not in c
    t2 = mk(transport="kcp", fallbacks=["wss", "tcp"], fec_data=10, fec_parity=3, accept_udp=True)
    s2 = bp.render(t2, "iran", "h", "n")
    assert 'fallback_transports = ["wss", "tcp"]' in s2 and "kcp_datashards = 10" in s2 and "kcp_parityshards = 3" in s2 and "accept_udp = true" in s2
    d = mk(kind="direct", transport="udp", port=9200, net_n=7, fec_data=4, fec_parity=2)
    di, dn = bp.render(d, "iran", "1.2.3.4", "node.example"), bp.render(d, "node", "1.2.3.4", "node.example")
    assert 'mode = "dial"' in di and 'addr = "node.example:9200"' in di and 'local_ip = "10.20.7.1/30"' in di and 'peer_ip = "10.20.7.2"' in di and 'iface = "pn3"' in di and "ports = " in di
    assert 'mode = "listen"' in dn and 'addr = "0.0.0.0:9200"' in dn and 'local_ip = "10.20.7.2/30"' in dn and "ports" not in dn and "fec_data = 4" in dn
    assert not any(x in (di + dn + s + c) for x in ("spoof", "sni"))                          # the spoofing carriers are never generated
    assert "spoof" not in bp.CARRIERS and "sni" not in bp.CARRIERS and set(bp.CARRIERS) == {"udp", "quic", "pck", "xdi"}
    assert len(bp.TRANSPORTS) == 12


class _Fake:
    """A fake `systemctl` / `journalctl` / `ping` on PATH, and a local web server standing in for the panel's /backpack route."""
    def __init__(self, tmp, tarball):
        self.tmp = Path(tmp)
        self.bin = self.tmp / "fakebin"
        self.bin.mkdir()
        self.log = self.tmp / "calls.log"
        self.journal = self.tmp / "journal.txt"
        (self.bin / "systemctl").write_text(f'#!/bin/sh\necho "systemctl $@" >> {self.log}\ncase "$1" in is-active) echo active;; esac\n')
        (self.bin / "journalctl").write_text(f'#!/bin/sh\ncat {self.journal}\n')
        (self.bin / "ping").write_text('#!/bin/sh\nexit 0\n')
        for f in self.bin.iterdir():
            f.chmod(0o755)
        data = Path(tarball).read_bytes()

        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path.endswith("linux-amd64.tar.gz") or self.path.endswith("linux-arm64.tar.gz"):
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(data)
                else:
                    self.send_error(404)

            def log_message(self, *a):
                pass
        self.srv = http.server.HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.srv.server_port}/backpack"
        self.sha = hashlib.sha256(data).hexdigest()

    def run(self, spec):
        env = {**os.environ, "PATH": f"{self.bin}:{os.environ['PATH']}", "VPNP_BIN_DIR": str(self.tmp / "lib"), "VPNP_CONF_DIR": str(self.tmp / "etc"),
               "VPNP_UNIT_DIR": str(self.tmp / "units")}
        (self.tmp / "units").mkdir(exist_ok=True)
        r = subprocess.run([sys.executable, VT, "bp", "apply"], input=json.dumps(spec), capture_output=True, text=True, env=env, timeout=60)
        assert r.returncode == 0, r.stderr
        return json.loads(r.stdout.strip().splitlines()[-1])


def _fake_tarball(tmp):
    exe = Path(tmp) / "backpack"
    exe.write_text("#!/bin/sh\necho fake backpack\n")
    path = Path(tmp) / "bp.tar.gz"
    with tarfile.open(path, "w:gz") as tf:
        tf.add(exe, arcname="backpack")
    return path


def test_agent_installs_verifies_writes_units_and_prunes_only_its_own(tmp_path):
    f = _Fake(tmp_path, _fake_tarball(tmp_path))
    f.journal.write_text("\x1b[32m22-Oct [INFO]\x1b[0m server started\n22-Oct [INFO] transport stealth is up\n")
    arch_key = "amd64" if os.uname().machine in ("x86_64", "amd64") else "arm64"
    spec = {"base_url": f.base, "sha256": {arch_key: f.sha}, "tunnels": [{"id": "3", "toml": '[server]\ntoken = "SECRET-TOKEN-VALUE"\n'}]}
    out = f.run(spec)
    assert out["errors"] == [] and out["tunnels"]["3"]["active"] is True and out["tunnels"]["3"]["up"] is True
    binary = tmp_path / "lib" / f"backpack-{f.sha[:12]}"
    assert binary.exists() and os.access(binary, os.X_OK)
    conf = tmp_path / "etc" / "bp-3.toml"
    assert stat.S_IMODE(conf.stat().st_mode) == 0o600 and "SECRET-TOKEN-VALUE" in conf.read_text()
    unit = (tmp_path / "units" / "vpnp-bp-3.service").read_text()
    assert f"ExecStart={binary} -c {conf}" in unit
    calls = f.log.read_text()
    assert "systemctl enable vpnp-bp-3" in calls and "systemctl restart vpnp-bp-3" in calls
    f.log.write_text("")
    f.run(spec)                                                                       # nothing changed: no restart
    assert "restart" not in f.log.read_text()
    # a log line that carries the token never reaches the panel
    f.journal.write_text("[INFO] the token SECRET-TOKEN-VALUE was refused\n")
    out = f.run(spec)
    assert "SECRET-TOKEN-VALUE" not in json.dumps(out) and out["tunnels"]["3"]["up"] is False
    # units that are not ours are never touched; our own unwanted ones are pruned when pruning is on
    (tmp_path / "units" / "backpack-manual.service").write_text("x")
    (tmp_path / "units" / "vpnp-bp-9.service").write_text("x")
    f.run({**spec, "prune": False})
    assert (tmp_path / "units" / "vpnp-bp-9.service").exists()                      # a relay agent never prunes its neighbours
    f.run(spec)
    assert not (tmp_path / "units" / "vpnp-bp-9.service").exists() and (tmp_path / "units" / "backpack-manual.service").exists()
    f.run({**spec, "tunnels": [], "prune": False, "remove": ["3"]})
    assert not (tmp_path / "units" / "vpnp-bp-3.service").exists()
    bad = f.run({**spec, "sha256": {arch_key: "0" * 64}, "tunnels": [{"id": "5", "toml": "[server]\n"}]})   # a download that does not match its hash
    assert any("SHA-256" in e for e in bad["errors"]) and not (tmp_path / "units" / "vpnp-bp-5.service").exists()


REVERSE_ALL = {"nodelay": True, "keepalive_period": 15, "max_connections": 100, "bandwidth_mbps": 200, "heartbeat": 5, "zero_copy": True, "log_level": "info",
               "mss": 1360, "connection_pool": 4, "aggressive_pool": True, "dial_timeout": 5, "retry_interval": 2}
KCP_ALL = {"kcp_nodelay": 1, "kcp_interval": 10, "kcp_resend": 2, "kcp_nocongestion": 1, "kcp_acknodelay": True, "kcp_sndwnd": 1024, "kcp_rcvwnd": 1024, "kcp_mtu": 1200}
CASES = [("reverse", t, {}) for t in ("tcp", "tcpmux", "stealth", "ws", "wsmux", "wss", "wssmux", "kcp", "quic")] + [
    ("reverse", "tcp", REVERSE_ALL), ("reverse", "stealth", {"nodelay": True, "connection_pool": 16}), ("reverse", "kcp", KCP_ALL),
    ("reverse", "tcpmux", {"mux_session": 2, "mux_con": 8, "mux_version": 2}), ("reverse", "wss", {"edge_ip": "127.0.0.1"}),
    ("direct4", "tcp", {}), ("direct4", "stealth", {"nodelay": True, "sessions": 2, "bandwidth_mbps": 100, "max_connections": 50, "keepalive_period": 10}),
    ("direct4", "ws", {"server_name": "cdn.example.com"}), ("direct4", "wss", {"sessions": 2})]


@pytest.mark.skipif(not BIN or not os.access(BIN, os.X_OK), reason="set BACKPACK_BIN to the real binary to run the real-traffic test")
@pytest.mark.parametrize("kind,transport,opts", CASES, ids=[f"{k}-{t}-{'opts' if o else 'plain'}{i}" for i, (k, t, o) in enumerate(CASES)])
def test_generated_configs_carry_real_traffic(kind, transport, opts, tmp_path):
    def free():
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        p = s.getsockname()[1]
        s.close()
        return p
    ctl, user, target = free(), free(), free()
    echo = socket.socket()
    echo.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    echo.bind(("127.0.0.1", target))
    echo.listen(8)

    def serve():
        while True:
            c, _ = echo.accept()
            threading.Thread(target=lambda c=c: [c.sendall(d) for d in iter(lambda: c.recv(65536), b"")], daemon=True).start()
    threading.Thread(target=serve, daemon=True).start()
    opts = bp.clean_opts(kind, transport, opts)
    t = mk(id=1, kind=kind, transport=transport, port=ctl, token="real-traffic-token-" + "x" * 30, forwards=[{"proto": "tcp", "listen": user, "target": target}],
           opts=opts, preset="turbo" if opts else "", fec_data=10 if transport == "kcp" and opts else 0, fec_parity=3 if transport == "kcp" and opts else 0)
    listener = "iran" if kind == "reverse" else "node"          # the end that binds 0.0.0.0
    (tmp_path / "s.toml").write_text(bp.render(t, "iran", "127.0.0.1", "127.0.0.1").replace("0.0.0.0:", "127.0.0.1:") if listener == "iran" else bp.render(t, "iran", "127.0.0.1", "127.0.0.1"))
    (tmp_path / "c.toml").write_text(bp.render(t, "node", "127.0.0.1", "127.0.0.1").replace("0.0.0.0:", "127.0.0.1:") if listener == "node" else bp.render(t, "node", "127.0.0.1", "127.0.0.1"))
    first, second = ("s.toml", "c.toml") if listener == "iran" else ("c.toml", "s.toml")
    p1 = subprocess.Popen([BIN, "-c", str(tmp_path / first)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    p2 = subprocess.Popen([BIN, "-c", str(tmp_path / second)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ok = False
        for _ in range(15):
            time.sleep(1)
            try:
                k = socket.create_connection(("127.0.0.1", user), 2)
                k.settimeout(3)
                k.sendall(b"hello")
                ok = k.recv(16) == b"hello"
                k.close()
                if ok:
                    break
            except OSError:
                pass
        assert ok, f"{kind}/{transport}: no traffic through the generated config"
    finally:
        p1.kill()
        p2.kill()


def test_direct_status_uses_ping_but_falls_back_to_the_log_when_ping_is_missing(monkeypatch):
    import importlib.util
    spec = importlib.util.spec_from_file_location("vt_status", VT)
    vt = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(vt)
    log = "22-Oct [INFO] l3: dial up on pn7, gre over udp, mtu 1400\n22-Oct [INFO] l3: handshake complete with 1.2.3.4\n"

    def fake(ping_rc):
        def _sh(*cmd, timeout=30):
            out = "active\n" if cmd[:2] == ("systemctl", "is-active") else log if cmd[0] == "journalctl" else ""
            return subprocess.CompletedProcess(cmd, ping_rc if cmd[0] == "ping" else 0, out, "")
        return _sh
    monkeypatch.setattr(vt, "_sh", fake(1))
    assert vt.bp_status("u", "", "10.20.7.2")["up"] is False                       # ping says the far end is not answering
    monkeypatch.setattr(vt, "_sh", fake(0))
    assert vt.bp_status("u", "", "10.20.7.2")["up"] is True
    monkeypatch.setattr(vt, "_sh", fake(127))                                      # no ping binary on this server: the log decides
    assert vt.bp_status("u", "", "10.20.7.2")["up"] is True
    assert bp.render(mk(transport="kcp"), "iran", "h", "n").count("accept_udp = false") == 1

    # a healthy tunnel whose only recent line is the routine rekey (the handshake has scrolled out of the journal) is still up
    for line in ("23-Oct [INFO] l3: rekeyed to session 38c3ca58 (routine, every 2m0s — the tunnel did not drop)",
                 "23-Oct [INFO] l3: listen up on pn1, gre over udp, mtu 1400 (a 1500-byte path fits 1439)"):
        globals_log = line + "\n"

        def only(line=line):
            def _sh(*cmd, timeout=30):
                out = "active\n" if cmd[:2] == ("systemctl", "is-active") else (line + "\n") if cmd[0] == "journalctl" else ""
                return subprocess.CompletedProcess(cmd, 127 if cmd[0] == "ping" else 0, out, "")
            return _sh
        monkeypatch.setattr(vt, "_sh", only())
        assert vt.bp_status("u", "", "10.20.7.2")["up"] is True, line

    def failing(*cmd, timeout=30):     # the retry line is still a failure
        bad = "23-Oct [WARNING] l3: handshake did not complete: 1.2.3.4:9100 did not answer in 6 attempts — retrying\n"
        out = "active\n" if cmd[:2] == ("systemctl", "is-active") else bad if cmd[0] == "journalctl" else ""
        return subprocess.CompletedProcess(cmd, 127 if cmd[0] == "ping" else 0, out, "")
    monkeypatch.setattr(vt, "_sh", failing)
    assert vt.bp_status("u", "", "10.20.7.2")["up"] is False


def test_extra_settings_validate_render_and_drop_what_a_transport_does_not_read():
    ok = bp.clean_opts("reverse", "stealth", {"nodelay": True, "max_connections": 500, "bandwidth_mbps": 100, "mss": 1360, "proxy_protocol": True,
                        "edge_ip": "104.16.1.1", "fallback_addrs": "5.6.7.8:443, [2001:db8::1]:443", "load_balance": True,
                        "kcp_interval": 10, "mux_session": 4, "paths": 3})
    assert ok == {"nodelay": True, "max_connections": 500, "bandwidth_mbps": 100, "mss": 1360, "proxy_protocol": True,
                  "fallback_addrs": ["5.6.7.8:443", "[2001:db8::1]:443"], "load_balance": True}      # edge_ip needs ws; kcp/mux/paths need their transport
    t = mk(opts=ok, preset="turbo")
    s, c = bp.render(t, "iran", "1.2.3.4", "n"), bp.render(t, "node", "1.2.3.4", "n")
    assert 'preset = "turbo"' in s and "max_connections = 500" in s and "bandwidth_mbps = 100" in s and "proxy_protocol = true" in s and "nodelay = true" in s
    assert "max_connections" not in c and "proxy_protocol" not in c and 'fallback_addrs = ["5.6.7.8:443", "[2001:db8::1]:443"]' in c and "load_balance = true" in c
    assert "fallback_addrs" not in s and "mss = 1360" in s and "mss = 1360" in c
    assert bp.clean_opts("reverse", "wss", {"edge_ip": "104.16.1.1"}) == {"edge_ip": "104.16.1.1"}
    assert bp.clean_opts("reverse", "kcp", {"kcp_interval": 10, "kcp_sndwnd": 1024}) == {"kcp_interval": 10, "kcp_sndwnd": 1024}
    assert bp.clean_opts("direct", "udp", {"paths": 4, "qdisc": "fq_codel", "txqueuelen": 300}) == {"paths": 4, "qdisc": "fq_codel", "txqueuelen": 300}
    assert bp.clean_opts("direct", "quic", {"paths": 4}) == {}
    for bad in ({"nope": 1}, {"mss": 5}, {"nodelay": "yes"}, {"edge_ip": "a b"}, {"qdisc": "x"}, {"load_balance": True}, {"mtu": 99999}):
        with pytest.raises(ValueError):
            bp.clean_opts("reverse" if "mtu" not in bad and "qdisc" not in bad else "direct", "wss", bad)
    with pytest.raises(ValueError):
        bp.clean_opts("reverse", "tcp", {"fallback_addrs": ["a:1"], "load_balance": True, "health_failover": True})
    for name in bp.PRESETS:
        for kind, tr in (("reverse", "kcp"), ("reverse", "tcp"), ("direct", "udp")):
            assert bp.clean_opts(kind, tr, bp.preset_opts(kind, tr, name), name)
    assert not any("spoof" in k or "sni" in k for k in bp.OPTIONS)


def test_direct_layer4_render():
    t = mk(kind="direct4", transport="ws", port=9300, opts={"sessions": 2, "bandwidth_mbps": 50, "server_name": "cdn.example.com", "nodelay": True}, preset="balance")
    i, k = bp.render(t, "iran", "1.2.3.4", "node.example"), bp.render(t, "node", "1.2.3.4", "node.example")
    assert '[direct]' in i and 'role = "iran"' in i and 'addr = "node.example:9300"' in i and 'ports = ["80", "81=80"]' in i and "sessions = 2" in i and "bandwidth_mbps = 50" in i
    assert 'role = "kharej"' in k and 'addr = "0.0.0.0:9300"' in k and "ports" not in k and "sessions" not in k and "bandwidth" not in k and "nodelay = true" in k
    assert 'server_name = "cdn.example.com"' in i and 'preset = "balance"' in i
    assert bp.describe(t).startswith("Direct L4")
