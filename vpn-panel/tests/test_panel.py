import base64
import importlib.util
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ["PANEL_DB"] = f"sqlite:///{tempfile.mkdtemp()}/t.db"
os.environ["PANEL_ADMIN_PASSWORD"] = "secret-pw"
os.environ["PANEL_PUBLIC_URL"] = "https://panel.test"
sys.path.insert(0, str(ROOT / "panel"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

spec = importlib.util.spec_from_file_location("agent", ROOT / "agent" / "agent.py")
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)


def admin(c):
    r = c.post("/api/login", json={"password": "secret-pw"})
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_full_flow():
    with TestClient(app) as c:
        assert c.post("/api/login", json={"password": "wrong"}).status_code == 401
        assert c.get("/api/nodes").status_code == 401
        h = admin(c)

        node = c.post("/api/nodes", headers=h, json={"name": "Germany", "cc": "de", "address": "de.example.com"}).json()
        assert node["online"] is False and "--token" in node["install_command"]
        assert node["install_command"].startswith("bash <(curl -sL https://panel.test/node-install.sh)")
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}

        user = c.post("/api/users", headers=h, json={"name": "ali_t", "quota_gb": 1, "days": 30,
                                                      "protos": ["vless", "l2tp", "hy2"]}).json()
        assert c.post("/api/users", headers=h, json={"name": "ali_t", "protos": ["vless"]}).status_code == 409
        assert c.post("/api/users", headers=h, json={"name": "bad name!", "protos": ["vless"]}).status_code == 422

        # agent pulls config
        cfg = c.get("/api/node/config", headers=nh).json()
        assert cfg["protocols"]["l2tp"] == 1701 and cfg["users"][0]["name"] == "ali_t"
        # before the node reports its Reality key there is no VLESS link
        links = c.get(f"/api/users/{user['id']}/configs", headers=h).json()
        assert {e["proto"] for e in links} == {"hy2", "l2tp"}

        # agent reports; VLESS appears, usage is counted
        c.post("/api/node/report", headers=nh, json={"load": 12, "usage": {"ali_t": 1024 ** 3 // 2},
                                                      "reality_pub": "PUBKEY", "reality_sid": "ab12cd34"})
        links = c.get(f"/api/users/{user['id']}/configs", headers=h).json()
        vless = next(e for e in links if e["proto"] == "vless")["link"]
        assert vless.startswith(f"vless://{cfg['users'][0]['uuid']}@de.example.com:443") and "pbk=PUBKEY" in vless
        l2tp = next(e for e in links if e["proto"] == "l2tp")["details"]
        assert l2tp["psk"] == cfg["node"]["l2tp_psk"] and l2tp["server"] == "de.example.com"
        assert c.get("/api/nodes", headers=h).json()[0]["online"] is True

        # subscription
        r = c.get(user["sub_url"].replace("https://panel.test", ""))
        assert "download=536870912" in r.headers["subscription-userinfo"]
        assert vless in base64.b64decode(r.text).decode()

        # quota exhausted -> removed from node config and subscription is empty
        c.post("/api/node/report", headers=nh, json={"usage": {"ali_t": 1024 ** 3}})
        assert c.get("/api/node/config", headers=nh).json()["users"] == []
        assert c.get(user["sub_url"].replace("https://panel.test", "")).text == ""

        # protocol toggle
        c.patch(f"/api/users/{user['id']}", headers=h, json={"reset_usage": True})
        c.put(f"/api/nodes/{node['id']}/protocols/l2tp", headers=h, json={"enabled": False})
        assert "l2tp" not in c.get("/api/node/config", headers=nh).json()["protocols"]

        assert c.get("/node-install.sh").text.count('PANEL_URL="https://panel.test"') == 1
        assert c.get("/node/agent.py").status_code == 200
        assert c.get("/").status_code == 200


def sample_cfg():
    return {"node": {"reality_sni": "www.microsoft.com", "ss_method": "2022-blake3-aes-128-gcm",
                     "ss_key": "AAAAAAAAAAAAAAAAAAAAAA==", "l2tp_psk": "psk123"},
            "protocols": {"vless": 443, "trojan": 8443, "ss": 8388, "hy2": 36712, "l2tp": 1701},
            "users": [{"name": "ali_t", "uuid": "u-1", "password": "pw1", "ss_key": "BBBBBBBBBBBBBBBBBBBBBB==",
                       "protos": ["vless", "trojan", "ss", "hy2", "l2tp"]},
                      {"name": "sara", "uuid": "u-2", "password": "pw2", "ss_key": "CCCCCCCCCCCCCCCCCCCCCC==",
                       "protos": ["l2tp"]}]}


def test_agent_renderers():
    cfg = sample_cfg()
    reality = {"private": "PRIV", "public": "PUB", "short_id": "ab12"}
    tls = {"cert": "/c", "key": "/k"}
    x = agent.render_xray(cfg, reality, tls)
    tags = {i["tag"]: i for i in x["inbounds"]}
    assert set(tags) == {"api", "vless", "trojan", "ss"}
    assert tags["vless"]["settings"]["clients"] == [{"id": "u-1", "email": "ali_t", "flow": "xtls-rprx-vision"}]
    assert tags["vless"]["streamSettings"]["realitySettings"]["privateKey"] == "PRIV"
    assert tags["ss"]["settings"]["clients"][0]["password"] == "BBBBBBBBBBBBBBBBBBBBBB=="
    s = agent.render_singbox(cfg, tls)
    assert s["inbounds"][0]["users"] == [{"name": "ali_t", "password": "pw1"}]
    l = agent.render_l2tp(cfg)
    assert l["chap_secrets"] == '"ali_t" l2tpd "pw1" *\n"sara" l2tpd "pw2" *\n'
    assert l["ipsec_secrets"] == ': PSK "psk123"\n: RSA /etc/ipsec.d/private/server.key\n'
    # an inbound with no users is omitted instead of rendered empty
    cfg["users"] = [u for u in cfg["users"] if u["name"] == "sara"]
    assert {i["tag"] for i in agent.render_xray(cfg, reality, tls)["inbounds"]} == {"api"}
    assert agent.render_singbox(cfg, tls)["inbounds"] == []


ALL = ["vless", "vless_tcp", "vmess_tcp", "vless_ws", "vless_grpc", "vmess_ws", "trojan", "trojan_ws", "ss", "hy2", "tuic",
       "wg", "ovpn", "l2tp", "ikev2", "anyc"]


def test_all_protocols_have_entries_and_node_config():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "NL", "cc": "nl", "address": "nl.example.com"}).json()
        assert {p["proto"] for p in node["protocols"]} == set(ALL)
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        user = c.post("/api/users", headers=h, json={"name": "full", "protos": ALL,
                                                      "node_ids": [node["id"]]}).json()

        cfg = c.get("/api/node/config", headers=nh).json()
        u = next(x for x in cfg["users"] if x["name"] == "full")
        assert u["wg_pub"] and u["wg_ip"].startswith("10.88.")

        # WireGuard and OpenVPN need data the node reports first
        before = {e["proto"] for e in c.get(f"/api/users/{user['id']}/configs", headers=h).json()}
        assert not {"vless", "wg", "ovpn"} & before
        c.post("/api/node/report", headers=nh, json={"reality_pub": "PUB", "reality_sid": "ab", "wg_pub": "WGPUB",
                                                      "ovpn_ca": "-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----"})
        rows = {e["proto"]: e for e in c.get(f"/api/users/{user['id']}/configs", headers=h).json()}
        assert set(rows) == set(ALL)
        assert "type=tcp" in rows["vless_tcp"]["link"] and "security=tls" in rows["vless_tcp"]["link"]
        assert json.loads(base64.b64decode(rows["vmess_tcp"]["link"][8:]))["net"] == "tcp"
        assert "type=ws" in rows["vless_ws"]["link"] and "path=%2Fvless" in rows["vless_ws"]["link"]
        assert "type=grpc" in rows["vless_grpc"]["link"] and "serviceName=grpc" in rows["vless_grpc"]["link"]
        vm = rows["vmess_ws"]["link"]
        assert json.loads(base64.b64decode(vm[len("vmess://"):]))["net"] == "ws"
        assert rows["tuic"]["link"].startswith(f"tuic://{u['uuid']}:")
        wgc = rows["wg"]["copy"]
        assert "PublicKey = WGPUB" in wgc and f"Address = {u['wg_ip']}/32" in wgc and "PrivateKey = " in wgc
        assert "<ca>" in rows["ovpn"]["copy"] and "remote nl.example.com 1194" in rows["ovpn"]["copy"]
        assert "full" in rows["ikev2"]["summary"] and "4443" in rows["anyc"]["summary"]


def test_wireguard_keypair_is_valid():
    from app.subscription import new_wg_keypair, wg_ip
    priv, pub = new_wg_keypair()
    assert len(base64.b64decode(priv)) == 32 and len(base64.b64decode(pub)) == 32 and priv != pub
    assert wg_ip(1) != wg_ip(2) and wg_ip(1).startswith("10.88.")


def test_agent_renderers_new_protocols():
    cfg = sample_cfg()
    allp = ["vless_tcp", "vmess_tcp", "vless_ws", "vless_grpc", "vmess_ws", "trojan_ws", "tuic", "wg", "ovpn", "ikev2", "anyc"]
    cfg["protocols"].update({"vless_tcp": 2097, "vmess_tcp": 2098, "vless_ws": 2083, "vless_grpc": 2096, "vmess_ws": 2053, "trojan_ws": 2087,
                             "tuic": 8444, "wg": 51820, "ovpn": 1194, "ikev2": 500, "anyc": 4443})
    cfg["users"][0]["protos"] += allp
    cfg["users"][0].update({"wg_pub": "WGPUBU", "wg_ip": "10.88.0.2"})
    tls = {"cert": "/c", "key": "/k"}
    x = {i["tag"]: i for i in agent.render_xray(cfg, {"private": "P", "short_id": "ab"}, tls)["inbounds"]}
    assert x["vless_tcp"]["streamSettings"]["network"] == "tcp" and x["vmess_tcp"]["streamSettings"]["security"] == "tls"
    assert x["vless_ws"]["streamSettings"]["network"] == "ws"
    assert x["vless_ws"]["streamSettings"]["wsSettings"]["path"] == "/vless"
    assert x["vless_grpc"]["streamSettings"]["grpcSettings"]["serviceName"] == "grpc"
    assert x["vmess_ws"]["settings"]["clients"][0]["alterId"] == 0
    assert x["trojan_ws"]["streamSettings"]["wsSettings"]["path"] == "/trojan"
    assert [i["type"] for i in agent.render_singbox(cfg, tls)["inbounds"]] == ["hysteria2", "tuic"]
    wg = agent.render_wg(cfg, "SRVPRIV")
    assert "PrivateKey = SRVPRIV" in wg and "AllowedIPs = 10.88.0.2/32" in wg and wg.count("[Peer]") == 1
    assert agent.render_ovpn_users(cfg).startswith("ali_t:") and len(agent.render_ovpn_users(cfg).split(":")[1].strip()) == 64
    assert agent.render_ocpasswd(cfg, lambda p: "H(" + p + ")") == "ali_t:*:H(pw1)\n"
    sec = agent.render_ipsec_secrets(cfg)
    assert ': PSK "psk123"' in sec and 'ali_t : EAP "pw1"' in sec and "RSA" in sec


def test_cloudflare_entries():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "CF", "cc": "de", "address": "1.2.3.4"}).json()
        user = c.post("/api/users", headers=h, json={"name": "cfuser", "protos": ["vless_ws", "vmess_ws", "vless_tcp", "vless_grpc"],
                                                      "node_ids": [node["id"]]}).json()
        rows = c.get(f"/api/users/{user['id']}/configs", headers=h).json()
        assert not any("Cloudflare" in r["label"] for r in rows)
        assert c.put(f"/api/nodes/{node['id']}/cloudflare", headers=h, json={"cf_domain": "not a domain"}).status_code == 422
        r = c.put(f"/api/nodes/{node['id']}/cloudflare", headers=h,
                  json={"cf_domain": "CDN.Example.com", "cf_address": "104.16.1.1"})
        assert r.json()["cf_domain"] == "cdn.example.com"
        rows = c.get(f"/api/users/{user['id']}/configs", headers=h).json()
        cf = {r["proto"]: r for r in rows if "Cloudflare" in r["label"]}
        assert set(cf) == {"vless_ws", "vmess_ws", "vless_grpc"}  # TCP cannot go through Cloudflare
        link = cf["vless_ws"]["link"]
        assert "@104.16.1.1:2083" in link and "sni=cdn.example.com" in link and "host=cdn.example.com" in link
        assert "allowInsecure" not in link
        vm = json.loads(base64.b64decode(cf["vmess_ws"]["link"][8:]))
        assert vm["add"] == "104.16.1.1" and vm["host"] == "cdn.example.com" and vm["allowInsecure"] == 0
        # the direct entries still point at the node itself
        direct = next(r for r in rows if r["proto"] == "vless_ws" and "Cloudflare" not in r["label"])
        assert "@1.2.3.4:2083" in direct["link"]


def test_manual_and_random_ports():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "P", "cc": "fi", "address": "fi.example.com"}).json()
        url = lambda proto: f"/api/nodes/{node['id']}/protocols/{proto}/port"
        r = c.put(url("hy2"), headers=h, json={"port": 40123})
        assert next(p for p in r.json()["protocols"] if p["proto"] == "hy2")["port"] == 40123
        assert c.put(url("tuic"), headers=h, json={"port": 40123}).status_code == 409   # already used
        assert c.put(url("tuic"), headers=h, json={"port": 22}).status_code == 422      # reserved
        assert c.put(url("l2tp"), headers=h, json={"port": 1800}).status_code == 422    # fixed by IPsec
        assert c.put(url("tuic"), headers=h, json={"port": 70000}).status_code == 422
        seen = set()
        for _ in range(5):
            p = next(x for x in c.put(url("tuic"), headers=h, json={}).json()["protocols"] if x["proto"] == "tuic")["port"]
            assert 10000 <= p <= 60000 and p != 40123
            seen.add(p)
        assert len(seen) > 1

        # the new port reaches the node config and the user's link
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        user = c.post("/api/users", headers=h, json={"name": "portuser", "protos": ["hy2"], "node_ids": [node["id"]]}).json()
        assert c.get("/api/node/config", headers=nh).json()["protocols"]["hy2"] == 40123
        link = c.get(f"/api/users/{user['id']}/configs", headers=h).json()[0]["link"]
        assert "@fi.example.com:40123" in link


def test_agent_port_rewrite():
    assert agent.set_conf_value("port 1194\nproto udp\n", "port", 2222) == "port 2222\nproto udp\n"
    text = "tcp-port = 4443\nudp-port = 4443\nrun-as-user = nobody\n"
    out = agent.set_conf_value(agent.set_conf_value(text, "tcp-port", 5555), "udp-port", 5555)
    assert out == "tcp-port = 5555\nudp-port = 5555\nrun-as-user = nobody\n"


def test_edit_and_renew_user():
    with TestClient(app) as c:
        h = admin(c)
        u = c.post("/api/users", headers=h, json={"name": "renewme", "quota_gb": 1, "days": 10, "protos": ["vless"]}).json()
        patch = lambda body: c.patch(f"/api/users/{u['id']}", headers=h, json=body)

        r = patch({"extend_days": 30}).json()
        assert r["days_left"] in (39, 40)
        # an expired user renews from today, not from the old date
        patch({"days": 1})
        from app.db import Node, User, engine, utcnow
        from datetime import timedelta
        from sqlalchemy.orm import Session
        with Session(engine) as db:
            db.get(User, u["id"]).expire_at = utcnow() - timedelta(days=20)
            db.commit()
        assert c.get("/api/users", headers=h).json()[0]["status"] == "expired"
        r = patch({"extend_days": 30, "enabled": True}).json()
        assert r["status"] == "active" and r["days_left"] in (29, 30)

        # usage reset together with renewal restores a user who hit the quota
        c.post("/api/nodes", headers=h, json={"name": "Q", "cc": "us", "address": "q.example.com"})
        with Session(engine) as db:
            db.get(User, u["id"]).used_bytes = 2 * 1024 ** 3
            db.commit()
        assert next(x for x in c.get("/api/users", headers=h).json() if x["id"] == u["id"])["status"] == "quota"
        r = patch({"extend_days": 1, "reset_usage": True}).json()
        assert r["status"] == "active" and r["used_gb"] == 0

        # edit protocols and nodes; unknown protocols and node ids are rejected / dropped
        assert patch({"protos": ["nope"]}).status_code == 422
        r = patch({"protos": ["vless", "wg"], "node_ids": [999999]}).json()
        assert r["protos"] == ["vless", "wg"] and r["node_ids"] == []
        r = patch({"quota_gb": 0}).json()
        assert r["quota_gb"] == 0

        # unlimited users cannot be "extended" without setting a term first
        patch({"days": 0})
        assert patch({"extend_days": 5}).status_code == 422
        assert patch({"days": 3, "extend_days": 5}).json()["days_left"] in (7, 8)


def test_login_lockout():
    with TestClient(app) as c:
        h = {"x-forwarded-for": "203.0.113.9"}
        for _ in range(5):
            assert c.post("/api/login", headers=h, json={"password": "bad"}).status_code == 401
        # locked, even with the right password
        assert c.post("/api/login", headers=h, json={"password": "secret-pw"}).status_code == 429
        # another address is unaffected
        assert c.post("/api/login", headers={"x-forwarded-for": "198.51.100.1"}, json={"password": "secret-pw"}).status_code == 200


def test_backup_is_a_valid_sqlite_copy():
    with TestClient(app) as c:
        h = admin(c)
        c.post("/api/users", headers=h, json={"name": "backed_up", "protos": ["vless"]})
        assert c.get("/api/backup").status_code == 401
        r = c.get("/api/backup", headers=h)
        assert r.status_code == 200 and r.content.startswith(b"SQLite format 3")
        import sqlite3
        path = Path(tempfile.mkdtemp()) / "copy.db"
        path.write_bytes(r.content)
        assert ("backed_up",) in sqlite3.connect(path).execute("select name from users").fetchall()


def test_migration_adds_missing_columns():
    import sqlite3
    from sqlalchemy import create_engine
    import app.db as dbm
    path = Path(tempfile.mkdtemp()) / "old.db"
    old = sqlite3.connect(path)  # a database from before WireGuard/Cloudflare/OpenVPN columns existed
    old.execute("CREATE TABLE nodes (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, cc VARCHAR NOT NULL, address VARCHAR NOT NULL,"
                " token VARCHAR NOT NULL, ss_key VARCHAR NOT NULL, l2tp_psk VARCHAR NOT NULL, last_seen DATETIME, load INTEGER,"
                " reality_pub VARCHAR, reality_sid VARCHAR, tls_self_signed BOOLEAN)")
    old.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, sub_token VARCHAR NOT NULL, uuid VARCHAR NOT NULL,"
                " password VARCHAR NOT NULL, quota_bytes INTEGER, used_bytes INTEGER, expire_at DATETIME, enabled BOOLEAN,"
                " protos JSON, node_ids JSON)")
    old.execute("INSERT INTO users (name, sub_token, uuid, password, protos, node_ids) VALUES ('old','t','u','p','[\"vless\"]','[]')")
    old.commit(); old.close()
    saved = dbm.engine
    dbm.engine = create_engine(f"sqlite:///{path}")
    try:
        dbm.init_db()
        cols = {r[1] for r in sqlite3.connect(path).execute("pragma table_info(users)")}
        ncols = {r[1] for r in sqlite3.connect(path).execute("pragma table_info(nodes)")}
        assert {"wg_private", "wg_public"} <= cols and {"cf_domain", "cf_address", "wg_pub", "ovpn_ca"} <= ncols
        from sqlalchemy.orm import Session
        with Session(dbm.engine) as s:
            u = s.query(dbm.User).one()
            assert u.name == "old" and u.wg_private == "" and u.protos == ["vless"]
        dbm.init_db()  # running it again changes nothing
    finally:
        dbm.engine = saved


def test_node_config_advertises_agent_hash():
    import hashlib
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "H", "cc": "de", "address": "h.example.com"}).json()
        assert node["install_command"].endswith(" --letsencrypt")   # domain -> real certificate
        ip_node = c.post("/api/nodes", headers=h, json={"name": "I", "cc": "de", "address": "5.6.7.8"}).json()
        assert "--letsencrypt" not in ip_node["install_command"]
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        sha = c.get("/api/node/config", headers=nh).json()["agent_sha256"]
        assert sha == hashlib.sha256((ROOT / "agent" / "agent.py").read_bytes()).hexdigest()
        assert hashlib.sha256(c.get("/node/agent.py").content).hexdigest() == sha
