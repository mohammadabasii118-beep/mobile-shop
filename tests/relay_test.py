"""Premium-emoji relay for CHANNEL posts: made in the relay group, copied (copyMessage), verified by reading the copy back.   python -m tests.relay_test"""
import asyncio
import os
import sys
import tempfile
import traceback

_TMP = tempfile.mkdtemp()
os.environ["DB_PATH"] = os.path.join(_TMP, "t.db")
os.environ["ONC_ASSETS_DIR"] = os.path.join(_TMP, "assets")
os.environ["ADMIN_IDS"] = "1"

from aiogram.methods import CopyMessage, DeleteMessage, EditMessageReplyMarkup, ForwardMessage, GetChat, SendPhoto  # noqa: E402
from aiogram.types import Chat, Message, MessageEntity, MessageId  # noqa: E402

from pclbot import emojis, outgoing  # noqa: E402

ENT = [MessageEntity(type="custom_emoji", offset=0, length=2, custom_emoji_id="5368324170671202286")]


class Req:
    """Stub of Telegram: the relay group keeps custom emoji; the channel drops them from direct posts; copyMessage keeps them only if `copy_keeps`."""

    def __init__(self, copy_keeps=True, kinds=None, forward_keeps=True):
        self.calls, self.mid, self.copy_keeps, self.forward_keeps = [], 100, copy_keeps, forward_keeps
        self.kinds = kinds or {"-1001": "channel", "-1002": "supergroup"}
        self.stored: dict[tuple[str, int], bool] = {}

    async def __call__(self, bot, m):
        self.calls.append(m)
        self.mid += 1
        if isinstance(m, GetChat):
            return Chat(id=int(m.chat_id), type=self.kinds.get(str(m.chat_id), "supergroup"))
        if isinstance(m, SendPhoto):
            keep = str(m.chat_id) != "-1001"                                   # direct channel post → stripped
            self.stored[(str(m.chat_id), self.mid)] = keep
            return Message.model_construct(message_id=self.mid, caption_entities=ENT if keep else None, entities=None, chat=Chat(id=int(m.chat_id), type="x"))
        if isinstance(m, CopyMessage):
            self.stored[(str(m.chat_id), self.mid)] = self.copy_keeps and self.stored[(str(m.from_chat_id), m.message_id)]
            return MessageId(message_id=self.mid)
        if isinstance(m, ForwardMessage):
            keep = self.stored[(str(m.from_chat_id), m.message_id)] and self.forward_keeps
            self.stored[(str(m.chat_id), self.mid)] = keep
            return Message.model_construct(message_id=self.mid, caption_entities=ENT if keep else None, entities=None, chat=Chat(id=int(m.chat_id), type="x"))
        return True


CAP = '<tg-emoji emoji-id="5368324170671202286">🔴</tg-emoji> hi'


async def send(req, chat, caption=CAP):
    outgoing._KIND.clear()
    mw = outgoing.OutgoingMiddleware()
    await emojis.set_id("🔴", "5368324170671202286") if emojis.id_of("🔴") != "5368324170671202286" else None
    return await mw(req, None, SendPhoto(chat_id=chat, photo="x", caption=caption))


async def run():
    from pclbot import db
    await db.init()
    await emojis.load()
    outgoing.RELAY_CHAT = "-1009"
    # 1) forward mode (default): staged in the group and KEPT there, forwarded to the channel; no direct post, nothing deleted
    assert outgoing.RELAY_MODE == "copy"                                  # default: no Forwarded-from label
    outgoing.RELAY_MODE = "forward"
    req = Req()
    res = await send(req, "-1001")
    kinds = [type(c).__name__ for c in req.calls]
    assert kinds == ["GetChat", "SendPhoto", "ForwardMessage"], kinds
    assert req.calls[1].chat_id == "-1009" and req.calls[2].chat_id == "-1001" and req.calls[2].from_chat_id == "-1009"
    assert res.message_id > 100
    # forwarding does not keep the emoji either → the forward is removed and the post goes out directly
    req = Req(forward_keeps=False)
    await send(req, "-1001")
    k = [type(c).__name__ for c in req.calls]
    assert k[-1] == "SendPhoto" and req.calls[-1].chat_id == "-1001" and "DeleteMessage" in k, k
    # copy mode: clean post (copyMessage), verified by reading it back, temporary group messages removed
    outgoing.RELAY_MODE = "copy"
    req = Req()
    res = await send(req, "-1001")
    kinds = [type(c).__name__ for c in req.calls]
    assert kinds == ["GetChat", "SendPhoto", "CopyMessage", "ForwardMessage", "DeleteMessage", "DeleteMessage"], kinds
    assert all(str(c.chat_id) == "-1009" for c in req.calls if isinstance(c, DeleteMessage))
    outgoing.RELAY_MODE = "forward"
    # 2) a plain group (not a channel) is posted directly — it already works there
    req = Req()
    await send(req, "-1002")
    assert [type(c).__name__ for c in req.calls] == ["GetChat", "SendPhoto"] and req.calls[1].chat_id == "-1002"
    # 3) copyMessage does not keep the emoji → the copy is removed and the post is sent directly (never lost)
    outgoing.RELAY_MODE = "copy"
    req = Req(copy_keeps=False)
    await send(req, "-1001")
    assert [type(c).__name__ for c in req.calls][-1] == "SendPhoto" and req.calls[-1].chat_id == "-1001", [type(c).__name__ for c in req.calls]
    assert any(isinstance(c, DeleteMessage) and str(c.chat_id) == "-1001" for c in req.calls)         # the useless copy was deleted
    outgoing.RELAY_MODE = "copy"
    # 4) no premium emoji in the post → no relay; no relay group configured → direct post
    req = Req()
    await send(req, "-1001", caption="plain text")
    assert [type(c).__name__ for c in req.calls] == ["SendPhoto"]
    outgoing.RELAY_CHAT = None
    req = Req()
    await send(req, "-1001")
    assert [type(c).__name__ for c in req.calls] == ["SendPhoto"]
    print("RELAY OK")


code = 0
try:
    asyncio.run(run())
except BaseException:
    traceback.print_exc()
    code = 1
sys.stdout.flush()
os._exit(code)
