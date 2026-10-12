"""Transfer ads go to EVERY introduced channel / group and are removed from all of them.   python -m tests.pub_test"""
import asyncio
import json
import os
import sys
import tempfile
import traceback

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["ADMIN_IDS"] = "1"

from pclbot import db, services, texts  # noqa: E402


class Msg:
    def __init__(self, mid):
        self.message_id = mid


class Bot:
    def __init__(self):
        self.sent, self.deleted, self.n, self.fail = [], [], 0, set()

    async def get_me(self):
        return type("Me", (), {"username": "pcl_bot"})()

    async def send_message(self, chat, text, **kw):
        if chat in self.fail:
            from aiogram.exceptions import TelegramForbiddenError
            raise TelegramForbiddenError(None, "Forbidden: bot was kicked")
        self.n += 1
        self.sent.append((chat, self.n))
        return Msg(self.n)

    send_photo = send_message

    async def delete_message(self, chat, mid):
        self.deleted.append((chat, mid))


async def run():
    await db.init()
    d = {"name": "Ali", "psn": "Ali_10", "pos1": "ST", "pos2": "CM", "history": "x", "honors": "y", "hours": "20-24"}
    aid = await db.execute("INSERT INTO ads(user_id,kind,data,status,special,created_at,fingerprint) VALUES(?,?,?,?,?,?,?)", 20, "player", json.dumps(d), "pending", 0, db.now(), texts.fingerprint("player", d))
    await db.execute("INSERT INTO users(id,name,username,joined_at) VALUES(20,'u','u',1)") if not await db.get_user(20) else None
    await db.set_setting("publish_chat", "-1001, -1002 ,-1003")
    bot = Bot()
    bot.fail = {"-1003"}                                                 # one destination is broken: the others still get the post
    assert await services.publish(bot, await db.get_ad(aid))
    assert [c for c, _ in bot.sent] == ["-1001", "-1002"], bot.sent
    assert len(await db.fetchall("SELECT * FROM ad_posts WHERE ad_id=?", aid)) == 2
    await services.publish(bot, await db.get_ad(aid))                    # re-publish replaces the earlier posts everywhere
    assert {c for c, _ in bot.deleted} == {"-1001", "-1002"} and len(bot.sent) == 4
    await services.unpublish(bot, await db.get_ad(aid))
    assert len(bot.deleted) == 4 and not await db.fetchall("SELECT * FROM ad_posts WHERE ad_id=?", aid)
    await db.set_setting("publish_chat", "")
    assert not await services.publish(bot, await db.get_ad(aid))         # no destination → nothing, no crash
    # an old single-chat setting keeps working
    await db.set_setting("publish_chat", "-1009")
    assert await services.publish(bot, await db.get_ad(aid)) and bot.sent[-1][0] == "-1009"
    print("PUB OK")


code = 0
try:
    asyncio.run(run())
except BaseException:
    traceback.print_exc()
    code = 1
sys.stdout.flush()
os._exit(code)
