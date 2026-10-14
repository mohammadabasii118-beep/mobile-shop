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
        body = base64.b64decode(c.get(user["sub_url"].replace("https://panel.test", "")).text).decode().splitlines()
        assert body and all("@127.0.0.1:1?" in line for line in body)   # no real config, only the usage remarks
        assert any("%E2%9B%94" in line for line in body)               # the ⛔ status line

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


def test_subscription_shows_usage_and_shares_one_quota():
    from urllib.parse import unquote
    with TestClient(app) as c:
        h = admin(c)
        n1 = c.post("/api/nodes", headers=h, json={"name": "A", "cc": "de", "address": "a.example.com"}).json()
        n2 = c.post("/api/nodes", headers=h, json={"name": "B", "cc": "nl", "address": "b.example.com"}).json()
        tok = lambda n: {"Authorization": "Bearer " + n["install_command"].split("--token ")[1].split()[0]}
        user = c.post("/api/users", headers=h, json={"name": "shared", "quota_gb": 10, "days": 30,
                                                      "protos": ["trojan", "l2tp"], "node_ids": [n1["id"], n2["id"]]}).json()
        # traffic reported by two different nodes adds up in the same user's quota
        gb = 1024 ** 3
        c.post("/api/node/report", headers=tok(n1), json={"usage": {"shared": 3 * gb}})
        c.post("/api/node/report", headers=tok(n2), json={"usage": {"shared": 2 * gb}})
        info = next(u for u in c.get("/api/users", headers=h).json() if u["name"] == "shared")
        assert info["used_gb"] == 5.0 and info["quota_gb"] == 10.0

        sub = user["sub_url"].replace("https://panel.test", "")
        r = c.get(sub)  # a client app
        assert r.headers["subscription-userinfo"].startswith(f"upload=0; download={5 * gb}; total={10 * gb}; expire=")
        assert r.headers["profile-title"].startswith("base64:")
        lines = base64.b64decode(r.text).decode().splitlines()
        remarks = [unquote(l.split("#", 1)[1]) for l in lines if "@127.0.0.1:1?" in l]
        assert any("5.00" in x and "10.00" in x for x in remarks) and any("30 روز" in x or "29 روز" in x for x in remarks)
        assert sum("trojan://" in l for l in lines) == 2           # one real link per node, same user

        page = c.get(sub, headers={"accept": "text/html,application/xhtml+xml"})  # a person in a browser
        assert page.status_code == 200 and "text/html" in page.headers["content-type"]
        assert "shared" in page.text and "5.00 GB" in page.text and "10.00 GB" in page.text and "trojan://" in page.text
        assert c.get("/api/protocols", headers=h).json()[0]["counted"] is True
        assert next(p for p in c.get("/api/protocols", headers=h).json() if p["id"] == "hy2")["counted"] is False


def test_agent_usage_parsers_and_counters():
    ovpn = ("OpenVPN CLIENT LIST\nUpdated,Tue Oct 14 10:00:00 2026\n"
            "Common Name,Real Address,Bytes Received,Bytes Sent,Connected Since\n"
            "ali_t,1.2.3.4:5555,1000,2000,Tue Oct 14 09:00:00 2026\nROUTING TABLE\nVirtual Address,Common Name,Real Address,Last Ref\n"
            "10.55.0.2,ali_t,1.2.3.4:5555,Tue\nGLOBAL STATS\nMax bcast/mcast queue length,0\nEND\n")
    assert agent.parse_openvpn_status(ovpn) == [("ali_t", "1.2.3.4:5555", 3000)]
    occ = '[{"id": 7, "username": "sara", "raw_rx": 10, "raw_tx": 5, "rx": "10 B"}, {"username": "bad", "rx": "1 KB", "tx": "2 KB"}]'
    assert agent.parse_occtl_users(occ) == [("7", "sara", 15)]
    assert agent.parse_occtl_users("not json") == []

    cn = agent.Counters()
    assert cn.delta("k", 100) == 0 and cn.delta("k", 160) == 60 and cn.delta("k", 10) == 10  # restart -> counts from zero

    # L2TP: live interface counters, then the final total logged by pppd on hang-up (no double counting)
    root = Path(tempfile.mkdtemp())
    run, sysd, closed = root / "run", root / "sys", root / "ppp-closed"
    (run).mkdir(); (sysd / "ppp0" / "statistics").mkdir(parents=True)
    (run / "ppp-ppp0").write_text("ali_t\n")
    def set_bytes(rx, tx):
        (sysd / "ppp0" / "statistics" / "rx_bytes").write_text(str(rx)); (sysd / "ppp0" / "statistics" / "tx_bytes").write_text(str(tx))
    cn = agent.Counters()
    call = lambda: agent.ppp_usage(cn, str(run), str(sysd), str(closed))
    set_bytes(100, 100); assert call() == {}                    # first sight
    set_bytes(500, 300); assert call() == {"ali_t": 600}        # 800 - 200
    closed.write_text("ppp0 ali_t 1000\n"); (run / "ppp-ppp0").unlink()
    assert call() == {"ali_t": 200} and not closed.exists()     # 1000 - 800 already counted
    closed.write_text("ppp1 sara 700\n")                         # a session shorter than one poll
    assert call() == {"sara": 700}


SS_SAMPLE = """udp   UNCONN 0      0            0.0.0.0:1194       0.0.0.0:*    users:(("openvpn",pid=3279693,fd=5))
udp   UNCONN 0      0                  *:36247            *:*    users:(("xray-linux-amd6",pid=1475374,fd=268))
tcp   LISTEN 0      4096       127.0.0.1:62789      0.0.0.0:*    users:(("xray-linux-amd6",pid=1475374,fd=4))
tcp   LISTEN 0      4096               *:443              *:*    users:(("xray-linux-amd6",pid=1475374,fd=7))
tcp   LISTEN 0      4096         0.0.0.0:4443       0.0.0.0:*    users:(("ocserv-main",pid=3279698,fd=3))
tcp   LISTEN 0      4096         0.0.0.0:8443       0.0.0.0:*    users:(("nginx",pid=77,fd=6))
tcp   LISTEN 0      4096         0.0.0.0:2083       0.0.0.0:*    users:(("xray",pid=99,fd=3))
tcp   LISTEN 0      511             [::]:2087          [::]:*    users:(("nginx",pid=5,fd=6))
udp   UNCONN 0      0            0.0.0.0:51820            *:*
"""


def test_busy_ports_skip_only_the_conflicting_inbounds():
    foreign = agent.foreign_listeners(SS_SAMPLE)
    assert foreign[("tcp", 443)] == "xray-linux-amd6" and foreign[("tcp", 8443)] == "nginx"
    assert ("tcp", 2083) not in foreign and ("tcp", 4443) not in foreign and ("udp", 1194) not in foreign  # our own services

    cfg = sample_cfg()
    cfg["protocols"].update({"vless_ws": 2083, "trojan_ws": 2087})
    cfg["users"][0]["protos"] += ["vless_ws", "trojan_ws"]
    tcp, udp, notes = agent.port_conflicts(cfg, foreign)
    assert tcp == {443, 8443, 2087} and not udp
    assert "tcp/443 xray-linux-amd6 (vless)" in notes and "tcp/8443 nginx (trojan)" in notes

    x = {i["tag"] for i in agent.render_xray(cfg, {"private": "P", "short_id": "ab"}, {"cert": "/c", "key": "/k"}, tcp)["inbounds"]}
    assert x == {"api", "ss", "vless_ws"}   # VLESS, Trojan and Trojan+WS skipped, the rest still starts
    # a port can be "busy" for UDP only: Hysteria2 is skipped, Xray's TCP inbounds are not
    s = agent.render_singbox(cfg, {"cert": "/c", "key": "/k"}, {36712})
    assert s["inbounds"] == []


def test_panel_stores_and_shows_port_conflicts():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "X", "cc": "de", "address": "x.example.com"}).json()
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        assert node["conflicts"] == []
        c.post("/api/node/report", headers=nh, json={"conflicts": ["tcp/443 xray-linux-amd6 (vless)"]})
        got = next(n for n in c.get("/api/nodes", headers=h).json() if n["id"] == node["id"])
        assert got["conflicts"] == ["tcp/443 xray-linux-amd6 (vless)"]
        c.post("/api/node/report", headers=nh, json={"conflicts": []})   # resolved -> cleared
        assert next(n for n in c.get("/api/nodes", headers=h).json() if n["id"] == node["id"])["conflicts"] == []


def test_self_signed_tls_links_carry_insecure_flags():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "SS", "cc": "de", "address": "9.9.9.9"}).json()
        user = c.post("/api/users", headers=h, json={"name": "insec", "protos": ["vmess_ws", "vless_ws", "trojan", "vless"],
                                                      "node_ids": [node["id"]]}).json()
        rows = {e["proto"]: e for e in c.get(f"/api/users/{user['id']}/configs", headers=h).json()}
        vm = json.loads(base64.b64decode(rows["vmess_ws"]["link"][8:]))
        assert vm["allowInsecure"] == 1 and vm["insecure"] == "1"
        for proto in ("vless_ws", "trojan"):
            assert "allowInsecure=1&insecure=1" in rows[proto]["link"]


def test_links_pin_the_self_signed_certificate():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "Pin", "cc": "de", "address": "8.8.4.4"}).json()
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        c.post("/api/node/report", headers=nh, json={"tls_pin": "ab" * 32, "tls_self_signed": True})
        user = c.post("/api/users", headers=h, json={"name": "pinned", "protos": ["vless_ws", "vmess_ws", "trojan"],
                                                      "node_ids": [node["id"]]}).json()
        rows = {e["proto"]: e for e in c.get(f"/api/users/{user['id']}/configs", headers=h).json()}
        assert "&pcs=" + "ab" * 32 in rows["vless_ws"]["link"] and "&pcs=" + "ab" * 32 in rows["trojan"]["link"]
        assert json.loads(base64.b64decode(rows["vmess_ws"]["link"][8:]))["pcs"] == "ab" * 32
        # a real certificate (not self-signed) needs no pin
        c.post("/api/node/report", headers=nh, json={"tls_self_signed": False})
        rows = {e["proto"]: e for e in c.get(f"/api/users/{user['id']}/configs", headers=h).json()}
        assert "pcs=" not in rows["trojan"]["link"] and "insecure" not in rows["trojan"]["link"]
        assert c.post("/api/node/report", headers=nh, json={"tls_pin": "not hex!"}).status_code == 422


def test_reality_camouflage_site_is_configurable_per_node():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "R", "cc": "fr", "address": "7.7.7.7"}).json()
        assert node["reality_sni"] == "www.apple.com"
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        user = c.post("/api/users", headers=h, json={"name": "realuser", "protos": ["vless"], "node_ids": [node["id"]]}).json()
        c.post("/api/node/report", headers=nh, json={"reality_pub": "PUB", "reality_sid": "ab"})
        assert c.put(f"/api/nodes/{node['id']}/reality", headers=h, json={"sni": "not a host"}).status_code == 422
        r = c.put(f"/api/nodes/{node['id']}/reality", headers=h, json={"sni": "Addons.Mozilla.org"})
        assert r.json()["reality_sni"] == "addons.mozilla.org"
        assert c.get("/api/node/config", headers=nh).json()["node"]["reality_sni"] == "addons.mozilla.org"
        link = c.get(f"/api/users/{user['id']}/configs", headers=h).json()[0]["link"]
        assert "sni=addons.mozilla.org" in link


def test_openvpn_status_v2_and_ocserv_socket_line():
    v2 = ("TITLE,OpenVPN 2.6.19\nTIME,2026-10-14 11:00:00,1791975600\n"
          "HEADER,CLIENT_LIST,Common Name,Real Address,Virtual Address,Virtual IPv6 Address,Bytes Received,Bytes Sent,Connected Since,Connected Since (time_t),Username,Client ID,Peer ID,Data Channel Cipher\n"
          "CLIENT_LIST,ali_t,1.2.3.4:5555,10.55.0.2,,1500,2500,2026-10-14 10:59:00,1791975540,ali_t,0,0,AES-256-GCM\n"
          "HEADER,ROUTING_TABLE,Virtual Address,Common Name,Real Address,Last Ref,Last Ref (time_t)\n"
          "ROUTING_TABLE,10.55.0.2,ali_t,1.2.3.4:5555,2026-10-14 11:00:00,1791975600\nGLOBAL_STATS,Max bcast/mcast queue length,0\nEND\n")
    assert agent.parse_openvpn_status(v2) == [("ali_t", "1.2.3.4:5555", 4000)]
    empty = "HEADER,CLIENT_LIST,Common Name,Real Address,Bytes Received,Bytes Sent\nEND\n"   # what the node showed with nobody connected
    assert agent.parse_openvpn_status(empty) == []
    v3 = "HEADER\tCLIENT_LIST\tCommon Name\tReal Address\tBytes Received\tBytes Sent\nCLIENT_LIST\tsara\t5.6.7.8:1\t10\t20\n"
    assert agent.parse_openvpn_status(v3) == [("sara", "5.6.7.8:1", 30)]
    assert agent.parse_occtl_users('[{"ID": 3, "Username": "ali", "Raw_RX": "100", "Raw_TX": "50"}]') == [("3", "ali", 150)]

    path = Path(tempfile.mkdtemp()) / "ocserv.conf"
    path.write_text("tcp-port = 4443\nsocket-file = /run/ocserv.socket\n")
    assert agent.ensure_conf_line(str(path), "occtl-socket-file", "/run/occtl.socket") is True
    assert path.read_text().endswith("occtl-socket-file = /run/occtl.socket\n")
    assert agent.ensure_conf_line(str(path), "occtl-socket-file", "/run/occtl.socket") is False   # idempotent
    assert agent.ensure_conf_line(str(path.parent / "missing.conf"), "x", "y") is False


def test_wireguard_and_openvpn_files_download():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "فرانسه france", "cc": "fr", "address": "4.3.2.1"}).json()
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        c.post("/api/node/report", headers=nh, json={"wg_pub": "WGPUB", "ovpn_ca": "-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----"})
        user = c.post("/api/users", headers=h, json={"name": "filer", "protos": ["wg", "ovpn", "l2tp"], "node_ids": [node["id"]]}).json()
        base = user["sub_url"].replace("https://panel.test", "")
        wg = c.get(f"{base}/file/{node['id']}/wg")
        assert wg.status_code == 200 and wg.text.startswith("[Interface]") and "PublicKey = WGPUB" in wg.text
        assert wg.headers["content-disposition"] == 'attachment; filename="france-wg.conf"'
        ov = c.get(f"{base}/file/{node['id']}/ovpn")
        assert ov.text.startswith("client\n") and "<ca>" in ov.text and ov.headers["content-disposition"].endswith('france-ovpn.ovpn"')
        assert not ov.text.startswith("#")   # the file itself has no credential comments
        assert c.get(f"{base}/file/{node['id']}/l2tp").status_code == 404      # not a file protocol
        assert c.get(f"/sub/wrong-token/file/{node['id']}/wg").status_code == 404
        # the browser subscription page offers the download, and the admin API tells the UI which entries are files
        page = c.get(base, headers={"accept": "text/html"}).text
        assert f"/file/{node['id']}/wg" in page and "دانلود فایل" in page
        rows = {e["proto"]: e for e in c.get(f"/api/users/{user['id']}/configs", headers=h).json()}
        assert rows["wg"]["file_ext"] == "conf" and rows["ovpn"]["file_ext"] == "ovpn" and rows["l2tp"]["file_ext"] is None
        # a disabled user gets nothing
        c.patch(f"/api/users/{user['id']}", headers=h, json={"enabled": False})
        assert c.get(f"{base}/file/{node['id']}/wg").status_code == 404


def test_openvpn_nproc_dropin_is_installed_once():
    root = Path(tempfile.mkdtemp())
    conf, drop = root / "server.conf", root / "d" / "vpn-node.conf"
    assert agent.ensure_openvpn_limits(str(drop), str(conf)) is False          # OpenVPN not installed: do nothing
    conf.write_text("port 1194\n")
    assert agent.ensure_openvpn_limits(str(drop), str(conf)) is True
    assert "LimitNPROC=infinity" in drop.read_text()
    assert agent.ensure_openvpn_limits(str(drop), str(conf)) is False          # already there: no restart loop


def test_forwarding_rules_are_added_once_and_use_docker_user_when_present():
    class R:  # minimal subprocess result
        def __init__(self, code=0, out=""):
            self.returncode, self.stdout = code, out

    def make(has_docker_user, existing=()):
        calls = []

        def run(*cmd):
            calls.append(cmd)
            if cmd[:3] == ("iptables", "-S", "DOCKER-USER"):
                return R(0 if has_docker_user else 1)
            if cmd[:3] == ("ip", "route", "show"):
                return R(0, "default via 10.0.0.1 dev ens3 proto dhcp")
            if "-C" in cmd:
                return R(0 if cmd in existing else 1)
            return R()
        return run, calls

    run, calls = make(False)
    agent.ensure_forwarding(run)
    inserted = [c for c in calls if "-I" in c or "-A" in c]
    assert ("iptables", "-t", "filter", "-I", "FORWARD", "1", "-s", "10.55.0.0/24", "-j", "ACCEPT") in inserted
    assert ("iptables", "-t", "nat", "-A", "POSTROUTING", "-s", "10.55.0.0/24", "-o", "ens3", "-j", "MASQUERADE") in inserted
    assert len(inserted) == 3 * len(agent.VPN_SUBNETS)

    run, calls = make(True)
    agent.ensure_forwarding(run)
    assert any(c[:5] == ("iptables", "-t", "filter", "-I", "DOCKER-USER") for c in calls)

    # when every rule already exists nothing is inserted
    have = tuple(("iptables", "-t", t, "-C", ch, *r) for t, ch, r in agent.forwarding_rules(agent.VPN_SUBNETS, "FORWARD", "ens3"))
    run, calls = make(False, existing=have)
    agent.ensure_forwarding(run)
    assert not [c for c in calls if "-I" in c or "-A" in c]
