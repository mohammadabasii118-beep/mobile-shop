"""Offline smoke test: python -m tests.smoke  (no Telegram / ZarinPal needed)."""
import asyncio
import json
import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["ADMIN_IDS"] = "1"

from pclbot import db, services, texts  # noqa: E402


class FakeBot:
    def __init__(self):
        self.sent = []

    async def send_message(self, chat, text, **kw):
        self.sent.append((chat, text))
        return type("M", (), {"message_id": len(self.sent)})()

    async def send_photo(self, chat, photo, caption=None, **kw):
        return await self.send_message(chat, caption)

    async def delete_message(self, *a, **kw):
        pass


async def new_ad(uid, psn, pos="ST"):
    d = {"name": "Ali", "psn": psn, "pos1": pos, "pos2": "CM", "history": "x", "honors": "y", "hours": "20-24"}
    return await db.execute(
        "INSERT INTO ads(user_id,kind,data,status,special,created_at,fingerprint) VALUES(?,?,?,?,?,?,?)",
        uid, "player", json.dumps(d), "pending", 0, db.now(), texts.fingerprint("player", d))


async def main():
    await db.init()
    bot = FakeBot()
    await db.set_setting("publish_chat", "-100")
    await db.ensure_user(10, "Inviter", "inv")
    await db.ensure_user(20, "Friend", "fr", referrer=10)

    # wallet: atomic charge
    await db.credit(20, 1000, "admin")
    assert await db.charge(20, 600, "ad") and not await db.charge(20, 600, "ad")
    assert (await db.get_user(20))["balance"] == 400

    # first valid ad -> counted + referral reward once
    a1 = await new_ad(20, "ali_psn")
    await services.approve(bot, a1)
    assert await db.counted_ads(20) == 1
    assert (await db.get_user(10))["balance"] == 10000
    # duplicate (same fingerprint) approved: not counted, no double reward
    a2 = await new_ad(20, "ALI_psn")
    await services.approve(bot, a2)
    assert await db.counted_ads(20) == 1 and (await db.get_user(10))["balance"] == 10000
    # re-approving an edited, already-counted ad does not count again
    await db.execute("UPDATE ads SET status='pending' WHERE id=?", a1)
    await services.approve(bot, a1)
    assert await db.counted_ads(20) == 1

    # badges thresholds
    for i in range(4):
        await services.approve(bot, await new_ad(20, f"p{i}"))
    cur, nxt = await db.badge_for(await db.counted_ads(20))
    assert cur["name"] == "برنزی" and nxt["name"] == "نقره‌ای", (cur, nxt)

    # reject refunds
    a = await new_ad(20, "zzz")
    await db.charge(20, 100, "ad", f"ad:{a}")
    before = (await db.get_user(20))["balance"]
    await services.reject(bot, a, "test")
    assert (await db.get_user(20))["balance"] == before + 100

    print(texts.render_ad(await db.get_ad(a1), await db.get_user(20)))
    print("OK")
    await db.close()


asyncio.run(main())
