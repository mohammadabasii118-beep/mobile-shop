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
    selftest.DEFAULT_PIN = agent.cert_sha256(str(d / "c.pem"))
    assert len(selftest.DEFAULT_PIN) == 64

    out = subprocess.run([XRAY, "x25519"], capture_output=True, text=True, check=True).stdout   # parsed like install.sh does
    priv = re.search(r"Private\s*Key:\s*(\S+)", out, re.I).group(1)
    pub = re.search(r"(?:Public\s*Key|Password[^:]*):\s*(\S+)", out, re.I).group(1)

    protos = ["vless", "vless_tcp", "vless_ws", "vless_grpc", "vmess_ws", "vmess_tcp", "trojan", "trojan_ws", "ss"]
    ports = {p: _free_port() for p in protos}
    uid = str(uuid.uuid4())
    node = Node(id=1, name="T", cc="de", address="localhost", token="t", ss_key="AAAAAAAAAAAAAAAAAAAAAA==", l2tp_psk="x",
                reality_pub=pub, reality_sid="ab12cd34", tls_self_signed=True, tls_pin=selftest.DEFAULT_PIN)
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
