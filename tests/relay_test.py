"""Premium-emoji relay: a channel post that comes back without custom_emoji is redone in the relay group and copied.   python -m tests.relay_test"""
import asyncio

from aiogram.methods import CopyMessage, DeleteMessage, SendPhoto
from aiogram.types import Message, MessageEntity

from pclbot import outgoing


class Req:
    def __init__(self, strip):
        self.calls, self.mid, self.strip = [], 100, strip

    async def __call__(self, bot, method):
        self.calls.append(method)
        self.mid += 1
        if isinstance(method, (SendPhoto,)):
            keep = (method.chat_id == "-1009") or not self.strip           # the relay group keeps the emoji, the channel strips it
            ents = [MessageEntity(type="custom_emoji", offset=0, length=2, custom_emoji_id="1")] if keep else None
            return Message.model_construct(message_id=self.mid, caption_entities=ents, entities=None)
        if isinstance(method, CopyMessage):
            return type("MI", (), {"message_id": self.mid})()
        return True


async def run():
    # drive the same logic the middleware uses
    m = SendPhoto(chat_id="-1001", photo="x", caption='<tg-emoji emoji-id="1">🔴</tg-emoji> hi')
    outgoing.RELAY_CHAT = "-1009"
    req = Req(strip=True)
    res = await req(None, m)
    assert outgoing._lost_premium(m, res)                                        # stripped in the channel → relay needed
    out = await outgoing._relay(req, None, m, res)
    kinds = [type(c).__name__ for c in req.calls]
    assert kinds == ["SendPhoto", "SendPhoto", "CopyMessage", "DeleteMessage", "DeleteMessage"], kinds
    assert req.calls[1].chat_id == "-1009" and req.calls[2].from_chat_id == "-1009" and req.calls[2].chat_id == "-1001"
    deleted = [(c.chat_id, c.message_id) for c in req.calls if isinstance(c, DeleteMessage)]
    assert ("-1001", res.message_id) in deleted and any(cid == "-1009" for cid, _ in deleted)   # plain original + temporary copy removed
    assert out.message_id != res.message_id
    # emoji kept → no relay; plain text → no relay; the relay group itself → no relay
    req2 = Req(strip=False)
    assert not outgoing._lost_premium(m, await req2(None, m))
    assert not outgoing._lost_premium(SendPhoto(chat_id="-1001", photo="x", caption="hi"), await req(None, m))
    assert not outgoing._lost_premium(m.model_copy(update={"chat_id": "-1009"}), await req(None, m))
    outgoing.RELAY_CHAT = None
    print("RELAY OK")


asyncio.run(run())
