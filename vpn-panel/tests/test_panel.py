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


ALL = ["vless", "vless_raw", "vless_tcp", "vmess_tcp", "vless_ws", "vless_grpc", "vmess_ws", "trojan", "trojan_ws", "ss", "hy2", "tuic",
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
        assert "security=none" in rows["vless_raw"]["link"] and ":80?" in rows["vless_raw"]["link"]
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


def test_service_restarts_once_per_config_change():
    root = Path(tempfile.mkdtemp())
    conf, state = root / "ipsec.conf", root / "state"
    restarted = []
    call = lambda: agent.restart_on_config_change("strongswan-starter", [str(conf)], str(state), restarted.append)
    assert call() is False and restarted == []                 # no config yet: nothing to do
    conf.write_text("conn l2tp-psk\n")
    assert call() is True and restarted == ["strongswan-starter"]   # first pass after the agent update
    assert call() is False and len(restarted) == 1             # unchanged: not restarted again
    conf.write_text("conn l2tp-psk\nconn ikev2-eap\n")
    assert call() is True and len(restarted) == 2              # changed: restarted once more


def test_pppd_options_that_break_l2tp_are_removed():
    path = Path(tempfile.mkdtemp()) / "options.xl2tpd"
    path.write_text("require-mschap-v2\nms-dns 1.1.1.1\nlock\nproxyarp\nconnect-delay 5000\nname l2tpd\n")
    assert agent.fix_ppp_options(str(path)) is True
    assert path.read_text() == "require-mschap-v2\nms-dns 1.1.1.1\nproxyarp\nname l2tpd\n"
    assert agent.fix_ppp_options(str(path)) is False               # idempotent
    assert agent.fix_ppp_options(str(path.parent / "missing")) is False
    # the installer no longer writes them
    installer = (ROOT / "agent" / "install.sh").read_text()
    section = installer.split("options.xl2tpd <<'EOF2'")[1].split("EOF2")[0]
    assert "lock" not in section.split() and "connect-delay" not in section


def test_ocserv_gets_the_occtl_switch():
    installer = (ROOT / "agent" / "install.sh").read_text()
    assert "use-occtl = true" in installer and "occtl-socket-file = /run/occtl.socket" in installer
    path = Path(tempfile.mkdtemp()) / "ocserv.conf"
    path.write_text("tcp-port = 4443\n")
    assert agent.ensure_conf_line(str(path), "use-occtl", "true") is True      # an old node's file is repaired
    assert agent.ensure_conf_line(str(path), "use-occtl", "true") is False
    assert "use-occtl = true" in path.read_text()


def test_outbounds_and_routing_rules_reach_the_node_config():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "Route", "cc": "de", "address": "6.6.6.6"}).json()
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        base = f"/api/nodes/{node['id']}"
        assert c.get(f"{base}/routing", headers=h).json()["outbounds"] == []

        # outbounds: validation, creation, secrets stay out of the listing
        assert c.post(f"{base}/outbounds", headers=h, json={"name": "Direct", "kind": "socks", "address": "1.1.1.1", "port": 1}).status_code == 422
        assert c.post(f"{base}/outbounds", headers=h, json={"name": "bad", "kind": "link", "link": "hysteria2://x@h:1"}).status_code == 422
        assert c.post(f"{base}/outbounds", headers=h, json={"name": "up", "kind": "socks", "address": "not a host!", "port": 1}).status_code == 422
        r = c.post(f"{base}/outbounds", headers=h, json={"name": "up", "kind": "socks", "address": "9.9.9.9", "port": 1080,
                                                          "username": "u", "password": "secret-pw"}).json()
        assert r["outbounds"][0]["summary"] == "socks → 9.9.9.9:1080" and "secret-pw" not in json.dumps(r)
        assert c.post(f"{base}/outbounds", headers=h, json={"name": "up", "kind": "socks", "address": "9.9.9.9", "port": 1}).status_code == 409
        link = "vless://11111111-1111-1111-1111-111111111111@5.6.7.8:443?encryption=none&security=reality&sni=www.apple.com&fp=chrome&pbk=AAAA&sid=ab&type=tcp&flow=xtls-rprx-vision#x"
        assert c.post(f"{base}/outbounds", headers=h, json={"name": "second", "kind": "link", "link": link}).json()["outbounds"][1]["summary"] == "vless → 5.6.7.8:443"

        # rules: a condition is required, ports and outbounds are checked
        post = lambda body: c.post(f"{base}/rules", headers=h, json=body)
        assert post({"outbound": "direct"}).status_code == 422
        assert post({"ports": "99999", "outbound": "block"}).status_code == 422
        assert post({"ports": "80;443", "outbound": "block"}).status_code == 422
        assert post({"inbounds": ["wg"], "outbound": "block"}).status_code == 422        # not an Xray inbound
        assert post({"ports": "443", "outbound": "ghost"}).status_code == 422
        assert post({"ports": "25", "outbound": "block", "note": "no smtp"}).status_code == 200
        assert post({"inbounds": ["vless", "trojan"], "domains": ["geosite:google"], "outbound": "up"}).status_code == 200
        assert post({"ips": ["geoip:ir"], "ports": "8000-9000", "outbound": "second"}).status_code == 200

        cfg = c.get("/api/node/config", headers=nh).json()
        assert [o["tag"] for o in cfg["outbounds"]] == ["out-up", "out-second"]
        assert cfg["outbounds"][0]["protocol"] == "socks"
        assert cfg["rules"][0] == {"type": "field", "outboundTag": "block", "port": "25"}
        assert cfg["rules"][1] == {"type": "field", "outboundTag": "out-up", "inboundTag": ["vless", "trojan"], "domain": ["geosite:google"]}
        assert cfg["rules"][2]["ip"] == ["geoip:ir"] and cfg["rules"][2]["port"] == "8000-9000"

        # order, switch, and deleting an outbound removes the rules that used it
        rules = c.get(f"{base}/routing", headers=h).json()["rules"]
        c.patch(f"/api/rules/{rules[2]['id']}", headers=h, json={"move": "up"})
        assert [r["outboundTag"] for r in c.get("/api/node/config", headers=nh).json()["rules"]] == ["block", "out-second", "out-up"]
        c.patch(f"/api/rules/{rules[0]['id']}", headers=h, json={"enabled": False})
        assert "block" not in [r["outboundTag"] for r in c.get("/api/node/config", headers=nh).json()["rules"]]
        out_id = c.get(f"{base}/routing", headers=h).json()["outbounds"][0]["id"]
        left = c.delete(f"/api/outbounds/{out_id}", headers=h).json()
        assert [o["name"] for o in left["outbounds"]] == ["second"] and all(r["outbound"] != "up" for r in left["rules"])


def test_agent_adds_routing_and_keeps_the_old_config_when_xray_rejects_it():
    cfg = sample_cfg()
    cfg["outbounds"] = [{"tag": "out-up", "protocol": "socks", "settings": {"servers": [{"address": "9.9.9.9", "port": 1080}]}}]
    cfg["rules"] = [{"type": "field", "outboundTag": "out-up", "port": "443"}]
    x = agent.render_xray(cfg, {"private": "P", "short_id": "ab"}, {"cert": "/c", "key": "/k"})
    assert [o["tag"] for o in x["outbounds"]] == ["direct", "block", "out-up"]          # direct stays the default
    assert x["routing"]["rules"][0]["outboundTag"] == "api" and x["routing"]["rules"][1]["port"] == "443"   # api rule first

    root = Path(tempfile.mkdtemp())
    agent.XRAY_CONFIG, agent.STATE_DIR = str(root / "config.json"), str(root)
    (root / "config.json").write_text("OLD")
    errors = []
    assert agent.install_xray_config("NEW", errors, test=lambda p: (False, "bad outbound")) is False
    assert (root / "config.json").read_text() == "OLD" and "previous one kept: bad outbound" in errors[0]
    assert agent.install_xray_config("NEW", errors, test=lambda p: (True, "")) is True
    assert (root / "config.json").read_text() == "NEW"
    assert agent.install_xray_config("NEW", errors, test=lambda p: (False, "never asked")) is False   # unchanged: no test, no restart
    assert len(errors) == 1


def test_api_key_and_lookup_by_name():
    import app.main as m
    with TestClient(app) as c:
        os.environ["PANEL_API_KEY"] = "k" * 32
        try:
            key = {"Authorization": "Bearer " + "k" * 32}
            assert c.get("/api/nodes", headers={"Authorization": "Bearer wrong"}).status_code == 401
            assert c.get("/api/nodes", headers=key).status_code == 200
            u = c.post("/api/users", headers=key, json={"name": "botuser", "quota_gb": 5, "days": 10, "protos": ["vless"]}).json()
            got = c.get("/api/users/by-name/botuser", headers=key).json()
            assert got["id"] == u["id"] and got["sub_url"] == u["sub_url"]
            assert c.get("/api/users/by-name/nobody", headers=key).status_code == 404
            assert c.patch(f"/api/users/{u['id']}", headers=key, json={"extend_days": 5}).json()["days_left"] in (14, 15)
            os.environ["PANEL_API_KEY"] = "short"          # a weak key is never accepted
            assert c.get("/api/nodes", headers={"Authorization": "Bearer short"}).status_code == 401
        finally:
            os.environ.pop("PANEL_API_KEY", None)


def test_location_can_be_renamed_with_emoji_and_links_follow():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "france", "cc": "fr", "address": "2.2.2.2"}).json()
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        c.post("/api/node/report", headers=nh, json={"reality_pub": "PUB", "reality_sid": "ab"})
        user = c.post("/api/users", headers=h, json={"name": "emojiuser", "protos": ["vless", "vmess_ws", "l2tp"],
                                                      "node_ids": [node["id"]]}).json()
        url = f"/api/nodes/{node['id']}"
        assert c.patch(url, headers=h, json={"name": ""}).status_code == 422
        assert c.patch(url, headers=h, json={"name": "x" * 61}).status_code == 422
        assert c.patch(url, headers=h, json={"cc": "france"}).status_code == 422
        assert c.patch(url, headers=h, json={"address": "bad address!"}).status_code == 422
        r = c.patch(url, headers=h, json={"name": "🇫🇷 France - Paris ⚡", "cc": "fr"}).json()
        assert r["name"] == "🇫🇷 France - Paris ⚡" and r["cc"] == "FR"

        rows = {e["proto"]: e for e in c.get(f"/api/users/{user['id']}/configs", headers=h).json()}
        from urllib.parse import quote, unquote
        assert quote("🇫🇷 France - Paris ⚡-VLESS + Reality") in rows["vless"]["link"]       # percent-encoded in the share link
        assert unquote(rows["vless"]["link"].split("#", 1)[1]) == "🇫🇷 France - Paris ⚡-VLESS + Reality"
        assert json.loads(base64.b64decode(rows["vmess_ws"]["link"][8:]))["ps"] == "🇫🇷 France - Paris ⚡-VMess + WebSocket (TLS)"
        assert rows["l2tp"]["node"] == "🇫🇷 France - Paris ⚡"
        page = c.get(user["sub_url"].replace("https://panel.test", ""), headers={"accept": "text/html"}).text
        assert "🇫🇷 France - Paris" in page

        # a new address changes the links, the node stays online with its token
        c.patch(url, headers=h, json={"address": "3.3.3.3"})
        assert "@3.3.3.3:" in c.get(f"/api/users/{user['id']}/configs", headers=h).json()[0]["link"]
        assert c.post("/api/node/report", headers=nh, json={}).status_code == 200


def test_rotate_replaces_the_link_and_credentials_but_keeps_the_quota():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "Rot", "cc": "de", "address": "4.4.4.4"}).json()
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        user = c.post("/api/users", headers=h, json={"name": "rotme", "quota_gb": 7, "days": 20, "protos": ["vless_tcp", "l2tp"],
                                                      "node_ids": [node["id"]]}).json()
        old_path = user["sub_url"].replace("https://panel.test", "")
        old_cfg = next(u for u in c.get("/api/node/config", headers=nh).json()["users"] if u["name"] == "rotme")
        assert c.get(old_path).status_code == 200

        new = c.post(f"/api/users/{user['id']}/rotate", headers=h).json()
        assert new["sub_url"] != user["sub_url"] and new["name"] == "rotme" and new["quota_gb"] == 7.0
        assert c.get(old_path).status_code == 404                                # the old link is dead
        assert c.get(new["sub_url"].replace("https://panel.test", "")).status_code == 200
        new_cfg = next(u for u in c.get("/api/node/config", headers=nh).json()["users"] if u["name"] == "rotme")
        assert new_cfg["uuid"] != old_cfg["uuid"] and new_cfg["password"] != old_cfg["password"] and new_cfg["wg_pub"] != old_cfg["wg_pub"]
        assert c.post("/api/users/999999/rotate", headers=h).status_code == 404
        assert c.post(f"/api/users/{user['id']}/rotate").status_code == 401


def test_import_users_from_3xui_keeps_uuid_quota_expiry_and_usage():
    with TestClient(app) as c:
        h = admin(c)
        uid = "11111111-2222-4333-8444-555555555555"
        clients = [{"name": "ali@x", "uuid": uid, "quota_bytes": 5 * 1024**3, "used_bytes": 1024**3,
                    "expire_ms": 4102444800000, "enabled": True},
                   {"name": "trial", "uuid": "not-a-uuid", "expire_ms": -86400000 * 3, "enabled": False}]
        r = c.post("/api/import/users", headers=h, json={"clients": clients, "protos": ["vless"]}).json()
        assert r == {"created": 2, "skipped": []}
        users = {u["name"]: u for u in c.get("/api/users", headers=h).json()}
        assert users["ali_x"]["used_gb"] == 1.0 and users["ali_x"]["quota_gb"] == 5.0
        assert users["ali_x"]["expire_at"].startswith("2100-")
        assert users["trial"]["days_left"] in (2, 3) and users["trial"]["status"] == "disabled"
        cfg = c.get(f"/api/users/{users['ali_x']['id']}/configs", headers=h).text
        assert uid in cfg
        again = c.post("/api/import/users", headers=h, json={"clients": clients, "protos": ["vless"]}).json()
        assert again["created"] == 0 and len(again["skipped"]) == 2


def test_bulk_protocols_add_and_remove():
    with TestClient(app) as c:
        h = admin(c)
        for n in ("bulkaa", "bulkbb"):
            c.post("/api/users", headers=h, json={"name": n, "protos": ["vless"]})
        r = c.post("/api/users/bulk-protos", headers=h, json={"add": ["vless_raw"], "remove": ["vless"], "names": ["bulkaa"]}).json()
        assert r == {"changed": 1}
        got = {u["name"]: u["protos"] for u in c.get("/api/users", headers=h).json()}
        assert got["bulkaa"] == ["vless_raw"] and got["bulkbb"] == ["vless"]
        c.post("/api/users/bulk-protos", headers=h, json={"add": ["vless_raw"]})
        got = {u["name"]: u["protos"] for u in c.get("/api/users", headers=h).json()}
        assert all("vless_raw" in p for p in got.values())
        assert c.post("/api/users/bulk-protos", headers=h, json={"add": ["nope"]}).status_code == 422


def test_plain_vless_link_uses_the_raw_host_override():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "IR", "cc": "ir", "address": "5.5.5.5"}).json()
        c.put(f"/api/nodes/{node['id']}/cloudflare", headers=h, json={"raw_host": "tunnel.example.com"})
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        c.post("/api/node/report", headers=nh, json={"reality_pub": "PUB", "reality_sid": "ab"})
        u = c.post("/api/users", headers=h, json={"name": "rawu", "protos": ["vless_raw", "vless_tcp"], "node_ids": [node["id"]]}).json()
        links = c.get(f"/api/users/{u['id']}/configs", headers=h).text
        assert "@tunnel.example.com:80?encryption=none&security=none" in links
        assert "@5.5.5.5:2097?" in links   # other protocols keep the node address


def test_plain_vless_may_use_port_80_but_others_may_not():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "P80", "cc": "tr", "address": "6.6.6.6"}).json()
        url = lambda p: f"/api/nodes/{node['id']}/protocols/{p}/port"
        assert c.put(url("vless_raw"), headers=h, json={"port": 80}).status_code == 200
        assert c.put(url("vless_ws"), headers=h, json={"port": 80}).status_code == 422


def test_bulk_users_delete_protocols_and_locations():
    with TestClient(app) as c:
        h = admin(c)
        n1 = c.post("/api/nodes", headers=h, json={"name": "B1", "cc": "de", "address": "7.7.7.1"}).json()
        ids = [c.post("/api/users", headers=h, json={"name": f"bk{i}", "protos": ["vless"], "node_ids": [n1["id"]]}).json()["id"] for i in range(3)]
        r = c.post("/api/users/bulk", headers=h, json={"ids": ids[:2], "add_protos": ["vless_raw"], "remove_protos": ["vless"], "node_ids": []}).json()
        assert r == {"affected": 2}
        got = {u["id"]: u for u in c.get("/api/users", headers=h).json()}
        assert got[ids[0]]["protos"] == ["vless_raw"] and got[ids[0]]["node_ids"] == []
        assert got[ids[2]]["protos"] == ["vless"] and got[ids[2]]["node_ids"] == [n1["id"]]
        # removing every protocol is refused silently: the user keeps its last one
        c.post("/api/users/bulk", headers=h, json={"ids": [ids[2]], "remove_protos": ["vless"]})
        assert {u["id"]: u for u in c.get("/api/users", headers=h).json()}[ids[2]]["protos"] == ["vless"]
        assert c.post("/api/users/bulk", headers=h, json={"ids": ids, "delete": True}).json() == {"affected": 3}
        assert not {u["id"] for u in c.get("/api/users", headers=h).json()} & set(ids)
        assert c.post("/api/users/bulk", headers=h, json={"ids": ids, "add_protos": ["nope"]}).status_code == 422


def test_per_protocol_address_overrides_only_the_connection_host():
    with TestClient(app) as c:
        h = admin(c)
        node = c.post("/api/nodes", headers=h, json={"name": "HostN", "cc": "de", "address": "hostn.example.com"}).json()
        nh = {"Authorization": "Bearer " + node["install_command"].split("--token ")[1].split()[0]}
        c.post("/api/node/report", headers=nh, json={"reality_pub": "PUB", "reality_sid": "ab"})
        u = c.post("/api/users", headers=h, json={"name": "hostu", "protos": ["vless_tcp", "vless_ws", "l2tp"], "node_ids": [node["id"]]}).json()
        r = c.put(f"/api/nodes/{node['id']}/protocols/vless_tcp/host", headers=h, json={"host": "Relay.Example.com"}).json()
        assert {p["proto"]: p["host"] for p in r["protocols"]}["vless_tcp"] == "relay.example.com"
        links = c.get(f"/api/users/{u['id']}/configs", headers=h).text
        assert "@relay.example.com:2097?" in links and "sni=hostn.example.com" in links   # TLS name stays the node's
        assert "@hostn.example.com:2083?" in links                                          # other protocols unchanged
        c.put(f"/api/nodes/{node['id']}/protocols/vless_tcp/host", headers=h, json={"host": ""})
        assert "@hostn.example.com:2097?" in c.get(f"/api/users/{u['id']}/configs", headers=h).text
        assert c.put(f"/api/nodes/{node['id']}/protocols/vless_tcp/host", headers=h, json={"host": "bad host!"}).status_code == 422


def test_agent_cpu_percent_is_measured_from_proc_stat():
    import importlib.util, pathlib
    spec = importlib.util.spec_from_file_location("agent_mod", pathlib.Path(__file__).parent.parent / "agent" / "agent.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    first = m.cpu_load_percent()                      # primes the sampler (0.5 s window)
    assert 0 <= first <= 100 and 0 <= m.cpu_load_percent() <= 100
    busy, total = m._cpu_times()
    assert 0 <= busy <= total


def test_sub_admin_can_only_create_and_see_own_users():
    with TestClient(app) as c:
        h = admin(c)
        c.post("/api/nodes", headers=h, json={"name": "RS", "cc": "de", "address": "8.8.1.1"})
        a = c.post("/api/admins", headers=h, json={"username": "sara", "password": "longpass1", "max_users": 2, "max_quota_gb": 50, "max_days": 60}).json()
        assert c.post("/api/admins", headers=h, json={"username": "sara", "password": "longpass1"}).status_code == 409
        assert c.post("/api/login", json={"username": "sara", "password": "wrongpass"}).status_code == 401
        r = c.post("/api/login", json={"username": "sara", "password": "longpass1"}).json()
        assert r["role"] == "reseller"
        sh = {"Authorization": "Bearer " + r["token"]}
        assert c.get("/api/me", headers=sh).json()["username"] == "sara"
        assert c.get("/api/me", headers=h).json() == {"role": "sudo"}
        # not allowed: everything of the main admin (403, so the UI does not show the login box)
        for path in ("/api/users", "/api/nodes", "/api/admins", "/api/backup"):
            assert c.get(path, headers=sh).status_code == 403, path
        assert c.post("/api/users", headers=sh, json={"name": "x1", "protos": ["vless"]}).status_code == 403
        opts = c.get("/api/me/options", headers=sh).json()
        assert opts["nodes"] and "vless" in {p["id"] for p in opts["protocols"]}
        mk = lambda n, **kw: c.post("/api/me/users", headers=sh, json={"name": n, "protos": ["vless"], "quota_gb": 10, "days": 30, **kw})
        assert mk("rs_user1").status_code == 200
        assert mk("rs_user2", quota_gb=0).status_code == 422          # no unlimited volume under a cap
        assert mk("rs_user2", quota_gb=51).status_code == 422
        assert mk("rs_user2", days=90).status_code == 422
        assert mk("rs_user2").status_code == 200
        assert mk("rs_user3").status_code == 403                       # max_users reached
        assert mk("rs_user1").status_code in (403, 409)
        mine = c.get("/api/me/users", headers=sh).json()
        assert {u["name"] for u in mine} == {"rs_user1", "rs_user2"} and all(u["owner_id"] == a["id"] for u in mine)
        other = c.post("/api/users", headers=h, json={"name": "not_hers", "protos": ["vless"]}).json()
        assert c.get(f"/api/me/users/{other['id']}/configs", headers=sh).status_code == 404
        assert c.get(f"/api/me/users/{mine[0]['id']}/configs", headers=sh).status_code == 200
        assert [x["owner_id"] for x in c.get("/api/users", headers=h).json() if x["name"] == "not_hers"] == [None]
        # lifecycle: new password signs the old session out, disabling blocks it, deleting keeps the users
        c.patch(f"/api/admins/{a['id']}", headers=h, json={"password": "another-pass1"})
        assert c.get("/api/me", headers=sh).status_code == 401
        sh = {"Authorization": "Bearer " + c.post("/api/login", json={"username": "sara", "password": "another-pass1"}).json()["token"]}
        c.patch(f"/api/admins/{a['id']}", headers=h, json={"enabled": False})
        assert c.get("/api/me", headers=sh).status_code == 401
        assert c.post("/api/login", json={"username": "sara", "password": "another-pass1"}).status_code == 401
        assert c.delete(f"/api/admins/{a['id']}", headers=h).json() == {"ok": True}
        assert {u["name"]: u["owner_id"] for u in c.get("/api/users", headers=h).json()}["rs_user1"] is None


def test_branding_name_logo_color_public_read_admin_write():
    import base64 as b64
    png = "data:image/png;base64," + b64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 40).decode()
    with TestClient(app) as c:
        h = admin(c)
        assert c.get("/api/branding").json() == {"name": "پنل چندلوکیشن", "logo": "", "color": ""}   # public, with defaults
        assert c.put("/api/branding", json={"name": "X"}).status_code == 401
        r = c.put("/api/branding", headers=h, json={"name": " Sibdata VPN ", "color": "#7c3aed", "logo": png})
        assert r.json() == {"name": "Sibdata VPN", "logo": png, "color": "#7c3aed"}
        assert c.get("/api/branding").json()["name"] == "Sibdata VPN"
        for bad in ({"name": "x", "color": "red"}, {"name": "x", "logo": "https://evil.example/x.png"},
                    {"name": "x", "logo": "data:text/html;base64,PHNjcmlwdD4="}, {"name": ""}, {"name": "n" * 41}):
            assert c.put("/api/branding", headers=h, json=bad).status_code == 422, bad
        # sub-admins cannot change it
        c.post("/api/admins", headers=h, json={"username": "brandsub", "password": "longpass1"})
        sh = {"Authorization": "Bearer " + c.post("/api/login", json={"username": "brandsub", "password": "longpass1"}).json()["token"]}
        assert c.put("/api/branding", headers=sh, json={"name": "hijack"}).status_code == 403
        # the subscription page carries the brand
        u = c.post("/api/users", headers=h, json={"name": "brandu", "protos": ["vless_tcp"]}).json()
        page = c.get(u["sub_url"].replace("http://testserver", ""), headers={"accept": "text/html"}).text
        assert "Sibdata VPN" in page and png in page and "--acc:#7c3aed" in page
        c.put("/api/branding", headers=h, json={"name": "پنل چندلوکیشن"})   # leave defaults for later tests
        c.put("/api/branding", headers=h, json={"name": "پنل چندلوکیشن", "logo": "", "color": ""})


def test_sub_admin_permissions_delete_and_edit_are_granted_per_admin():
    with TestClient(app) as c:
        h = admin(c)
        mk = lambda name, **kw: c.post("/api/admins", headers=h, json={"username": name, "password": "longpass1", "max_quota_gb": 50, "max_days": 60, **kw}).json()
        plain, boss = mk("perm_plain"), mk("perm_boss", can_delete=True, can_edit=True)
        login = lambda n: {"Authorization": "Bearer " + c.post("/api/login", json={"username": n, "password": "longpass1"}).json()["token"]}
        ph, bh = login("perm_plain"), login("perm_boss")
        assert c.get("/api/me", headers=bh).json()["can_delete"] is True and c.get("/api/me", headers=ph).json()["can_delete"] is False
        mine = lambda hh, n: c.post("/api/me/users", headers=hh, json={"name": n, "protos": ["vless"], "quota_gb": 10, "days": 30}).json()["id"]
        pu, bu = mine(ph, "perm_pu"), mine(bh, "perm_bu")
        # without the permission: refused (403), user untouched
        assert c.delete(f"/api/me/users/{pu}", headers=ph).status_code == 403
        assert c.patch(f"/api/me/users/{pu}", headers=ph, json={"enabled": False}).status_code == 403
        # with it: edit within the caps, and only on their own users
        assert c.patch(f"/api/me/users/{bu}", headers=bh, json={"extend_days": 7, "reset_usage": True}).json()["days_left"] in (36, 37)
        assert c.patch(f"/api/me/users/{bu}", headers=bh, json={"enabled": False}).json()["status"] == "disabled"
        assert c.patch(f"/api/me/users/{bu}", headers=bh, json={"quota_gb": 0}).status_code == 422
        assert c.patch(f"/api/me/users/{bu}", headers=bh, json={"quota_gb": 51}).status_code == 422
        assert c.patch(f"/api/me/users/{bu}", headers=bh, json={"days": 61}).status_code == 422
        assert c.patch(f"/api/me/users/{bu}", headers=bh, json={"extend_days": 60}).status_code == 422   # would exceed 60 days left
        assert c.patch(f"/api/me/users/{pu}", headers=bh, json={"enabled": False}).status_code == 404      # not theirs
        assert c.delete(f"/api/me/users/{pu}", headers=bh).status_code == 404
        assert c.delete(f"/api/me/users/{bu}", headers=bh).json() == {"ok": True}
        assert "perm_bu" not in {u["name"] for u in c.get("/api/users", headers=h).json()}
        # the main admin can grant it later
        c.patch(f"/api/admins/{plain['id']}", headers=h, json={"can_delete": True})
        assert c.delete(f"/api/me/users/{pu}", headers=ph).json() == {"ok": True}
