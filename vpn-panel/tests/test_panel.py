import base64
import importlib.util
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
    assert l["ipsec_secrets"] == ': PSK "psk123"\n'
    # an inbound with no users is omitted instead of rendered empty
    cfg["users"] = [u for u in cfg["users"] if u["name"] == "sara"]
    assert {i["tag"] for i in agent.render_xray(cfg, reality, tls)["inbounds"]} == {"api"}
    assert agent.render_singbox(cfg, tls)["inbounds"] == []
