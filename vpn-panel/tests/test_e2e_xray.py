"""Real end-to-end check: the agent's server config + the panel's share links, run through the actual Xray binary.
Skipped unless XRAY_BIN points at an xray executable (and port 443 on localhost is free for the fake Reality target):
    XRAY_BIN=/path/to/xray pytest tests/test_e2e_xray.py"""
import http.server
import importlib.util
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from pathlib import Path

import pytest

XRAY = os.environ.get("XRAY_BIN")
pytestmark = pytest.mark.skipif(not XRAY, reason="set XRAY_BIN to run")
ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault("PANEL_DB", f"sqlite:///{tempfile.mkdtemp()}/e2e.db")
os.environ.setdefault("PANEL_ADMIN_PASSWORD", "x")
sys.path.insert(0, str(ROOT / "panel"))


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "agent" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_every_xray_protocol_connects_end_to_end():
    agent, selftest = _load("agent"), _load("selftest")
    from app.db import Node, User
    from app.subscription import build_entry, user_ss_key

    d = Path(tempfile.mkdtemp())
    subprocess.run(["openssl", "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes",
                    "-days", "2", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost",
                    "-keyout", d / "k.pem", "-out", d / "c.pem"], capture_output=True, check=True)
    # stands in for microsoft.com as the Reality camouflage target, and for the internet
    target = subprocess.Popen(["openssl", "s_server", "-accept", "443", "-cert", d / "c.pem", "-key", d / "k.pem",
                               "-tls1_3", "-www", "-alpn", "h2,http/1.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(204)
            self.end_headers()

        def log_message(self, *a):
            pass

    import ssl
    web = http.server.ThreadingHTTPServer(("127.0.0.1", _free_port()), H)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(d / "c.pem", d / "k.pem")
    web.socket = ctx.wrap_socket(web.socket, server_side=True)
    threading.Thread(target=web.serve_forever, daemon=True).start()
    selftest.TEST_URL = f"https://localhost:{web.server_address[1]}/generate_204"   # TLS inside the tunnel, like a browser
    os.environ["SELFTEST_INSECURE"] = "1"   # curl accepts the throw-away certificate of this local target
    selftest.DEFAULT_PIN = agent.cert_sha256(str(d / "c.pem"))
    assert len(selftest.DEFAULT_PIN) == 64

    out = subprocess.run([XRAY, "x25519"], capture_output=True, text=True, check=True).stdout   # parsed like install.sh does
    priv = re.search(r"Private\s*Key:\s*(\S+)", out, re.I).group(1)
    pub = re.search(r"(?:Public\s*Key|Password[^:]*):\s*(\S+)", out, re.I).group(1)

    protos = ["vless", "vless_tcp", "vless_ws", "vless_grpc", "vmess_ws", "vmess_tcp", "trojan", "trojan_ws", "ss"]
    ports = {p: _free_port() for p in protos}
    uid = str(uuid.uuid4())
    node = Node(id=1, name="T", cc="de", address="localhost", token="t", ss_key="AAAAAAAAAAAAAAAAAAAAAA==", l2tp_psk="x",
                reality_pub=pub, reality_sid="ab12cd34", reality_sni="localhost", tls_self_signed=True,
                tls_pin=selftest.DEFAULT_PIN)   # the link must name the same camouflage site the server serves
    user = User(id=1, name="u1", sub_token="s", uuid=uid, password="pw-" + uid[:8], protos=protos, node_ids=[])
    cfg = {"node": {"reality_sni": "localhost", "ss_method": "2022-blake3-aes-128-gcm", "ss_key": node.ss_key, "l2tp_psk": "x"},
           "protocols": ports, "users": [{"name": "u1", "uuid": uid, "password": user.password,
                                          "ss_key": user_ss_key(uid), "protos": protos}]}
    server_cfg = d / "server.json"
    server_cfg.write_text(json.dumps(agent.render_xray(cfg, {"private": priv, "short_id": "ab12cd34"},
                                                       {"cert": str(d / "c.pem"), "key": str(d / "k.pem")})))
    server = subprocess.Popen([XRAY, "run", "-config", str(server_cfg)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        time.sleep(2)
        assert server.poll() is None, server.stdout.read()[-800:]
        failed = {}
        for proto in protos:
            ok, note = selftest.test_one(XRAY, selftest.outbound_for(build_entry(user, node, proto, ports[proto])["link"])[1])
            if not ok:
                failed[proto] = note
        assert not failed, failed
    finally:
        server.kill()
        target.kill()
        web.shutdown()


def _socks5_stub():
    """A minimal SOCKS5 proxy (no auth) that counts the connections it relays: the 'other outbound'."""
    import select
    import struct
    hits = []
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(16)

    def handle(c):
        try:
            c.recv(262)
            c.sendall(b"\x05\x00")
            req = c.recv(262)
            if req[3] == 1:
                host, port = socket.inet_ntoa(req[4:8]), struct.unpack(">H", req[8:10])[0]
            else:
                n = req[4]
                host, port = req[5:5 + n].decode(), struct.unpack(">H", req[5 + n:7 + n])[0]
            up = socket.create_connection((host, port), timeout=5)
            hits.append(port)
            c.sendall(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
            pair = [c, up]
            while True:
                ready, _, _ = select.select(pair, [], [], 5)
                if not ready:
                    break
                for s in ready:
                    data = s.recv(65536)
                    if not data:
                        return
                    (up if s is c else c).sendall(data)
        except OSError:
            pass
        finally:
            c.close()

    def loop():
        while True:
            try:
                conn, _ = srv.accept()
            except OSError:
                return
            threading.Thread(target=handle, args=(conn,), daemon=True).start()

    threading.Thread(target=loop, daemon=True).start()
    return srv, hits


def test_routing_rules_block_and_forward_real_traffic():
    agent, selftest = _load("agent"), _load("selftest")
    from app.db import Node, User
    from app.subscription import build_entry

    d = Path(tempfile.mkdtemp())
    subprocess.run(["openssl", "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes",
                    "-days", "2", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost",
                    "-keyout", d / "k.pem", "-out", d / "c.pem"], capture_output=True, check=True)
    selftest.DEFAULT_PIN = agent.cert_sha256(str(d / "c.pem"))

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(204)
            self.end_headers()

        def log_message(self, *a):
            pass

    webs = {}
    for name in ("plain", "blocked", "via_proxy"):   # three destination ports with different rules
        w = http.server.ThreadingHTTPServer(("127.0.0.1", _free_port()), H)
        threading.Thread(target=w.serve_forever, daemon=True).start()
        webs[name] = w.server_address[1]
    stub, hits = _socks5_stub()
    stub_port = stub.getsockname()[1]

    uid, port = str(uuid.uuid4()), _free_port()
    node = Node(id=1, name="T", cc="de", address="localhost", token="t", ss_key="x", l2tp_psk="x", tls_self_signed=True,
                tls_pin=selftest.DEFAULT_PIN)
    user = User(id=1, name="u1", sub_token="s", uuid=uid, password="pw", protos=["vless_tcp"], node_ids=[])
    from app.routing import build_outbound, tag_of
    xray_ob, _ = build_outbound("socks", {"address": "127.0.0.1", "port": stub_port})
    cfg = {"node": {"reality_sni": "localhost", "ss_method": "x", "ss_key": "x", "l2tp_psk": "x"},
           "protocols": {"vless_tcp": port},
           "users": [{"name": "u1", "uuid": uid, "password": "pw", "ss_key": "x", "protos": ["vless_tcp"]}],
           "outbounds": [{**xray_ob, "tag": tag_of("up")}],
           "rules": [{"type": "field", "outboundTag": "block", "port": str(webs["blocked"])},
                     {"type": "field", "outboundTag": "out-up", "port": str(webs["via_proxy"]), "inboundTag": ["vless_tcp"]}]}
    server_cfg = d / "server.json"
    server_cfg.write_text(json.dumps(agent.render_xray(cfg, {"private": "x", "short_id": "ab"},
                                                       {"cert": str(d / "c.pem"), "key": str(d / "k.pem")})))
    check = subprocess.run([XRAY, "run", "-test", "-config", str(server_cfg)], capture_output=True, text=True)
    assert check.returncode == 0, check.stdout + check.stderr           # what the agent's validation step runs
    server = subprocess.Popen([XRAY, "run", "-config", str(server_cfg)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        time.sleep(2)
        assert server.poll() is None, server.stdout.read()[-800:]
        client = selftest.outbound_for(build_entry(user, node, "vless_tcp", port)["link"])[1]

        def fetch(which):
            selftest.TEST_URL = f"http://127.0.0.1:{webs[which]}/generate_204"
            return selftest.test_one(XRAY, client)[0]

        assert fetch("plain") is True and hits == []              # no rule: straight out, the proxy sees nothing
        assert fetch("blocked") is False                          # port rule -> block
        assert fetch("via_proxy") is True and hits == [webs["via_proxy"]]   # port rule -> the SOCKS outbound
        assert fetch("plain") is True and len(hits) == 1          # other traffic still bypasses it
    finally:
        server.kill()
        stub.close()
