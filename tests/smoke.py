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

    async def get_me(self):
        return type("Me", (), {"username": "pcl_bot"})()


async def new_ad(uid, psn, pos="ST"):
    d = {"name": "Ali", "psn": psn, "pos1": pos, "pos2": "CM", "history": "x", "honors": "y", "hours": "20-24"}
    return await db.execute(
        "INSERT INTO ads(user_id,kind,data,status,special,created_at,fingerprint) VALUES(?,?,?,?,?,?,?)",
        uid, "player", json.dumps(d), "pending", 0, db.now(), texts.fingerprint("player", d))


async def run():
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

    # ---- badge reward: 5th valid ad earns the bronze badge = 1 free ad (cumulative with later badges)
    assert (await db.get_user(20))["free_ads"] == 1, await db.get_user(20)
    for i in range(10):
        await services.approve(bot, await new_ad(20, f"q{i}"))          # 15 valid ads -> silver (+3)
    assert (await db.get_user(20))["free_ads"] == 4

    # ---- free ad: covers a normal ad, a special ad pays only the extra; reject gives everything back
    await db.set_setting("price_normal", "20000"); await db.set_setting("price_special", "50000")
    assert await services.ad_quote(20, 0) == (0, True) and await services.ad_quote(20, 1) == (30000, True)
    assert await services.ad_quote(10, 0) == (20000, False)             # user 10 has no free ads
    await db.execute("UPDATE users SET free_ads=1 WHERE id=20")
    aid = await new_ad(20, "free1")
    assert await db.execute("UPDATE users SET free_ads=free_ads-1 WHERE id=20 AND free_ads>0")
    await db.add_tx(20, 0, "free_ad", f"ad:{aid}")
    assert (await db.get_user(20))["free_ads"] == 0 and await services.ad_quote(20, 0) == (20000, False)
    money_back, free_back = await services.refund_ad(aid, 20)
    assert (money_back, free_back) == (0, True) and (await db.get_user(20))["free_ads"] == 1
    assert await services.refund_ad(aid, 20) == (0, False) and (await db.get_user(20))["free_ads"] == 1   # never twice

    # ---- every published ad gets the glass button that links to the bot
    published = []

    async def send_message(chat, text, **kw):
        published.append(kw.get("reply_markup"))
        return type("M", (), {"message_id": 1})()

    bot.send_message = send_message
    await services.publish(bot, await db.get_ad(a1))
    btn = published[-1].inline_keyboard[0][0]
    assert btn.text == "برای درج آگهیت کلیک کن" and btn.url == "https://t.me/pcl_bot", btn

    # ---- footer is bold and ends with "!"
    assert texts.AD_FOOTER.startswith("<b>🔮") and texts.AD_FOOTER.endswith("@ProClubs_Transfer!</b>")

    print(texts.render_ad(await db.get_ad(a1), await db.get_user(20)))
    print("OK")


async def main():
    try:
        await run()
    finally:
        await db.close()


asyncio.run(main())
