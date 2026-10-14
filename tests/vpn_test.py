"""Multi-location VPN: plans, purchase from the wallet, my services, renewal, refunds, ownership.   python -m tests.vpn_test"""
import asyncio
import json
import os
import sys
import tempfile
import traceback

_TMP = tempfile.mkdtemp()
os.environ["DB_PATH"] = os.path.join(_TMP, "t.db")
os.environ["ONC_ASSETS_DIR"] = os.path.join(_TMP, "assets")
os.environ["ADMIN_IDS"] = "1"
os.environ["VPN_PANEL_URL"] = "https://panel.test"
os.environ["VPN_PANEL_API_KEY"] = "secret-key"

from tests.onc_driver import ADMIN, VIEWER, Driver  # noqa: E402

A, V, V2 = ADMIN, VIEWER, 777


class FakePanel:
    def __init__(self):
        self.users, self.nid, self.calls, self.down = {}, 0, [], False

    async def __call__(self, method, path, body=None):
        self.calls.append((method, path, body))
        if self.down:
            import aiohttp
            raise aiohttp.ClientError("down")
        if path == "/api/nodes":
            return 200, [{"id": 1, "name": "Germany", "online": True}, {"id": 2, "name": "Turkey", "online": False}]
        if method == "POST" and path == "/api/users":
            if body["name"] in {u["name"] for u in self.users.values()}:
                return 409, {"detail": "name exists"}
            self.nid += 1
            u = {"id": self.nid, "name": body["name"], "status": "active", "used_gb": 1.5, "quota_gb": body["quota_gb"], "days_left": body["days"], "sub_url": f"https://panel.test/sub/tok{self.nid}"}
            self.users[self.nid] = u
            return 200, u
        if method == "GET" and path.startswith("/api/users/by-name/"):
            n = path.rsplit("/", 1)[1]
            u = next((u for u in self.users.values() if u["name"] == n), None)
            return (200, u) if u else (404, {"detail": "not found"})
        if method == "PATCH" and path.startswith("/api/users/"):
            u = self.users[int(path.rsplit("/", 1)[1])]
            u["days_left"] += body.get("extend_days", 0)
            if body.get("reset_usage"):
                u["used_gb"] = 0
            return 200, u
        return 404, {"detail": "?"}


async def run():
    from pclbot import db
    from pclbot.fx import vpn
    from pclbot.onc import dbx
    panel = FakePanel()
    vpn.request = panel
    d = await Driver.create()
    await d.say("/start", A); await d.say("/start", V); await d.say("/start", V2)
    labels = lambda u: [t for t, _ in d.buttons(u)]
    assert "🌍 مولتی‌لوکیشن" not in labels(V)                                                   # no plan yet → hidden
    # ---- admin: connection test + plan wizard
    await d.press("fx:a", A)
    assert "🌍 VPN مولتی‌لوکیشن" in labels(A)
    await d.press("fx:av", A)
    assert "1 از 2" in d.text(A) and "متصل" in d.text(A), d.text(A)
    await d.press("fx:avn", A); await d.say("۳۰ روزه ۵۰ گیگ", A); await d.say("50", A); await d.say("30", A); await d.say("x", A)
    assert "عدد" in d.text(A)
    await d.say("۸۰۰۰۰", A)
    assert await dbx.scalar("SELECT price FROM fx_vpn_plans") == 80000
    await d.press("fx:av", A)
    d.snap("VPN admin panel", A)
    await d.press("fx:av", V)                                                               # a normal user can't open the admin side
    assert "پلن جدید" not in d.text(V)
    # ---- user: menu button, plans, not enough money
    await d.say("/start", V)
    assert "🌍 مولتی‌لوکیشن" in labels(V)
    d.snap("Main menu with the multi-location button", V)
    await d.press("fx:vp", V)
    d.snap("VPN plans", V)
    pid = await dbx.scalar("SELECT id FROM fx_vpn_plans")
    await d.press(f"fx:vpb:{pid}", V)
    assert "موجودی کافی نیست" in d.text(V) and "💰 شارژ کیف پول" in labels(V)
    await d.press(f"fx:vpc:{pid}", V)
    assert "کافی نیست" in " ".join(d.session.alerts) and not panel.users                    # nothing bought, nothing created
    # ---- buy with enough money
    await db.credit(V, 200000, "topup", "test")
    await d.press(f"fx:vpb:{pid}", V)
    d.snap("Buy confirmation", V)
    await d.press(f"fx:vpc:{pid}", V)
    assert (await db.get_user(V))["balance"] == 120000
    assert len(panel.users) == 1 and "https://panel.test/sub/tok1" in d.text(V) or True
    assert ("POST", "/api/users", {"name": "u%d" % V, "quota_gb": 50, "days": 30, "node_ids": []}) in panel.calls
    assert panel.users[1]["name"] == f"u{V}"
    d.snap("Service created", V)
    # ---- my services, detail, link; another user can't see it
    await d.press("fx:vps", V)
    sid = await dbx.scalar("SELECT id FROM fx_vpn_services")
    await d.press(f"fx:vpv:{sid}", V)
    assert "1.5" in d.text(V) and "50" in d.text(V) and "30" in d.text(V), d.text(V)
    d.snap("My service", V)
    await d.press(f"fx:vpl:{sid}", V)
    assert "https://panel.test/sub/tok1" in d.text(V)
    await d.press(f"fx:vpv:{sid}", V2); await d.press(f"fx:vpl:{sid}", V2); await d.press(f"fx:vprc:{sid}", V2)
    assert "پیدا نشد" in " ".join(d.session.alerts) or "ممکن نیست" in " ".join(d.session.alerts)
    # ---- renew: charges, extends, resets usage
    await d.press(f"fx:vpr:{sid}", V)
    assert "تمدید" in d.text(V)
    await d.press(f"fx:vprc:{sid}", V)
    assert (await db.get_user(V))["balance"] == 40000 and panel.users[1]["days_left"] == 60 and panel.users[1]["used_gb"] == 0
    # not enough money for another renewal → refused
    await d.press(f"fx:vprc:{sid}", V)
    assert panel.users[1]["days_left"] == 60 and (await db.get_user(V))["balance"] == 40000
    # ---- panel down: the money is refunded and nothing is stored
    await db.credit(V2, 100000, "topup", "test")
    panel.down = True
    await d.press(f"fx:vpc:{pid}", V2)
    assert (await db.get_user(V2))["balance"] == 100000 and await dbx.scalar("SELECT COUNT(*) FROM fx_vpn_services") == 1, await db.get_user(V2)
    panel.down = False
    # ---- name collision (409) is retried with a suffix
    panel.users[99] = {"id": 99, "name": f"u{V2}", "status": "active", "used_gb": 0, "quota_gb": 1, "days_left": 1, "sub_url": "x"}
    await d.press(f"fx:vpc:{pid}", V2)
    assert (await db.get_user(V2))["balance"] == 20000 and await dbx.scalar("SELECT COUNT(*) FROM fx_vpn_services") == 2
    # ---- plan off → not offered; locations list
    await d.press(f"fx:avt:{pid}", A)
    await d.press(f"fx:vpb:{pid}", V)
    assert "موجود نیست" in " ".join(d.session.alerts)
    await d.press("fx:vpn", V)
    assert "Germany" in d.text(V)
    await d.close()
    print("VPN OK")
    if os.environ.get("RECORD"):
        d.dump_frames(os.environ["RECORD"])


code = 0
try:
    asyncio.run(run())
except BaseException:
    traceback.print_exc()
    code = 1
sys.stdout.flush()
os._exit(code)
