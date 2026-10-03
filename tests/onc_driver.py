"""Drives the REAL dispatcher/handlers with a fake Telegram session (no network).

Used by the ONC integration test and by the demo recorder. `Driver.tap("📊 STANDINGS")` presses an inline button of the
screen currently shown to that user, `Driver.say("text")` sends a message, `Driver.photo(bytes)` sends a photo.
"""
import asyncio
import copy
import datetime as dt
import io
import os
import tempfile

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.base import BaseSession
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.methods import (AnswerCallbackQuery, DeleteMessage, EditMessageMedia, EditMessageText, GetChat, GetChatMember,
                             GetFile, GetMe, SendMessage, SendPhoto)
from aiogram.types import (CallbackQuery, Chat, ChatFullInfo, ChatMemberAdministrator, File, InlineKeyboardMarkup, Message,
                           PhotoSize, Update, User)

ADMIN, ADMIN2, VIEWER = 1, 2, 500
CHANNEL = -1001234567890


class FakeSession(BaseSession):
    def __init__(self):
        super().__init__()
        self.mid = 100
        self.screens: dict[tuple[int, int], dict] = {}      # (chat, message_id) -> screen
        self.order: dict[int, list[int]] = {}               # chat -> message ids
        self.log: list[tuple[str, dict]] = []
        self.files: dict[str, bytes] = {}
        self.channel_perms = {"can_post_messages": True, "can_edit_messages": True}
        self.fail_channel = False
        self.alerts: list[str] = []

    async def close(self): ...

    async def stream_content(self, url, headers=None, timeout=30, chunk_size=65536, raise_for_status=True):
        yield self.files.get(url.rsplit("/", 1)[-1], b"")

    def _msg(self, chat_id, text=None, caption=None, photo=None):
        self.mid += 1
        m = Message.model_construct(message_id=self.mid, date=dt.datetime.now(), chat=Chat(id=chat_id, type="channel" if chat_id < 0 else "private"),
                                    text=text, caption=caption)
        return m

    def _store(self, chat_id, m, text, markup, photo=None):
        key = (chat_id, m.message_id)
        self.screens[key] = {"chat": chat_id, "id": m.message_id, "text": text, "markup": markup, "photo": photo}
        self.order.setdefault(chat_id, []).append(m.message_id)

    async def make_request(self, bot, method, timeout=None):
        name = type(method).__name__
        cid = getattr(method, "chat_id", None)
        if isinstance(cid, str) and cid.lstrip("-").isdigit():
            method = method.model_copy(update={"chat_id": int(cid)})
        self.log.append((name, method.model_dump(exclude={"reply_markup"}) if not isinstance(method, (SendPhoto, EditMessageMedia)) else {"chat_id": getattr(method, "chat_id", None)}))
        if isinstance(method, SendMessage):
            m = self._msg(method.chat_id, method.text)
            self._store(method.chat_id, m, method.text, method.reply_markup)
            return m
        if isinstance(method, SendPhoto):
            if str(method.chat_id) == str(CHANNEL) and self.fail_channel:
                from aiogram.exceptions import TelegramForbiddenError
                raise TelegramForbiddenError(method, "Forbidden: bot is not a member of the channel chat")
            data = method.photo.data if hasattr(method.photo, "data") else b""
            m = self._msg(method.chat_id, caption=method.caption)
            self._store(method.chat_id, m, method.caption, method.reply_markup, data)
            return m
        if isinstance(method, EditMessageText):
            key = (method.chat_id, method.message_id)
            if key not in self.screens or self.screens[key]["photo"]:
                from aiogram.exceptions import TelegramBadRequest
                raise TelegramBadRequest(method, "Bad Request: there is no text in the message to edit")
            self.screens[key].update(text=method.text, markup=method.reply_markup)
            return Message.model_construct(message_id=method.message_id, chat=Chat(id=method.chat_id, type="private"), date=dt.datetime.now())
        if isinstance(method, EditMessageMedia):
            key = (method.chat_id, method.message_id)
            data = method.media.media.data if hasattr(method.media.media, "data") else b""
            self.screens[key].update(text=method.media.caption, photo=data, edited=True)
            return Message.model_construct(message_id=method.message_id, chat=Chat(id=method.chat_id, type="channel"), date=dt.datetime.now())
        if isinstance(method, DeleteMessage):
            self.screens.pop((method.chat_id, method.message_id), None)
            if method.message_id in self.order.get(method.chat_id, []):
                self.order[method.chat_id].remove(method.message_id)
            return True
        if isinstance(method, AnswerCallbackQuery):
            if method.text:
                self.alerts.append(method.text)
            return True
        if isinstance(method, GetMe):
            return User(id=999, is_bot=True, first_name="PCL", username="pcl_bot")
        if isinstance(method, GetChat):
            return ChatFullInfo.model_construct(id=CHANNEL if str(method.chat_id) in (str(CHANNEL), "@onc_news") else int(str(method.chat_id).lstrip("@") or 0) if str(method.chat_id).lstrip("-").isdigit() else CHANNEL,
                                                type="channel", title="ONE NIGHT CHAMPION | News", username="onc_news")
        if isinstance(method, GetChatMember):
            return ChatMemberAdministrator.model_construct(status="administrator", user=User(id=999, is_bot=True, first_name="PCL"), **self.channel_perms)
        if isinstance(method, GetFile):
            return File(file_id=method.file_id, file_unique_id=method.file_id, file_path=method.file_id)
        raise NotImplementedError(name)


class Driver:
    def __init__(self):
        self.session = FakeSession()
        self.bot = Bot("123:ABC", session=self.session, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
        self.dp = None
        self.uid_seq = 0
        self.last_shown: dict[int, tuple[int, int]] = {}   # user -> (chat, message id) of the screen they interact with
        self.frames: list[dict] = []                         # demo recorder

    @classmethod
    async def create(cls, db_path: str | None = None):
        os.environ.setdefault("ADMIN_IDS", f"{ADMIN}")
        from pclbot import admins, buttons, config, db, emojis, messages, outgoing
        from pclbot.handlers import admin, ads, home, user, wallet
        from pclbot.onc import setup as onc_setup
        from pclbot.utils import UserMiddleware
        self = cls()
        if db_path:
            config.DB_PATH = db_path
        await db.init()
        await onc_setup.init()
        admins.load.__call__  # noqa
        await admins.load(); await emojis.load(); await buttons.load(); await messages.load()
        admins._ids.update({ADMIN, ADMIN2})
        self.bot.session.middleware(outgoing.OutgoingMiddleware())
        dp = Dispatcher(storage=MemoryStorage())
        dp.message.outer_middleware(UserMiddleware())
        dp.callback_query.outer_middleware(UserMiddleware())
        dp.include_routers(home.router, user.router, *onc_setup.routers(), admin.router, wallet.router, ads.router, onc_setup.fallback)
        self.dp = dp
        return self

    async def close(self):
        from pclbot import db
        from pclbot.onc import dbx
        await dbx.close(); await db.close()

    # ---- helpers
    def _user(self, uid):
        return User(id=uid, is_bot=False, first_name=f"User{uid}", username=f"user{uid}")

    async def _feed(self, **kw):
        self.uid_seq += 1
        await self.dp.feed_update(self.bot, Update(update_id=self.uid_seq, **kw))

    def screen(self, uid: int) -> dict | None:
        key = self.last_shown.get(uid)
        if key and key in self.session.screens:
            return self.session.screens[key]
        ids = self.session.order.get(uid, [])
        for mid in reversed(ids):
            if (uid, mid) in self.session.screens:
                return self.session.screens[(uid, mid)]
        return None

    def _track(self, uid, before):
        # the screen the user now looks at = newest message in their chat
        ids = [i for i in self.session.order.get(uid, []) if (uid, i) in self.session.screens]
        if ids:
            self.last_shown[uid] = (uid, ids[-1])

    async def say(self, text: str, uid: int = ADMIN):
        self.session.alerts.clear()
        self.uid_seq += 1
        m = Message.model_construct(message_id=self.uid_seq + 5000, date=dt.datetime.now(), chat=Chat(id=uid, type="private"), from_user=self._user(uid), text=text)
        await self._feed(message=m)
        self._track(uid, None)

    async def photo(self, data: bytes, uid: int = ADMIN):
        self.session.alerts.clear()
        fid = f"file{len(self.session.files)}"
        self.session.files[fid] = data
        self.uid_seq += 1
        m = Message.model_construct(message_id=self.uid_seq + 5000, date=dt.datetime.now(), chat=Chat(id=uid, type="private"), from_user=self._user(uid),
                                    photo=[PhotoSize(file_id=fid, file_unique_id=fid, width=10, height=10)])
        await self._feed(message=m)
        self._track(uid, None)

    def buttons(self, uid: int = ADMIN) -> list[tuple[str, str]]:
        s = self.screen(uid)
        if not s or not isinstance(s["markup"], InlineKeyboardMarkup):
            return []
        return [(b.text, b.callback_data) for row in s["markup"].inline_keyboard for b in row]

    async def press(self, data: str, uid: int = ADMIN):
        self.session.alerts.clear()
        s = self.screen(uid)
        key = self.last_shown.get(uid) or (uid, s["id"])
        self.uid_seq += 1
        msg = Message.model_construct(message_id=key[1], date=dt.datetime.now(), chat=Chat(id=uid, type="private"), from_user=User(id=999, is_bot=True, first_name="PCL"))
        cq = CallbackQuery(id=str(self.uid_seq), from_user=self._user(uid), chat_instance="x", data=data, message=msg)
        await self._feed(callback_query=cq)
        self._track_after_press(uid, key)

    def _track_after_press(self, uid, key):
        ids = [i for i in self.session.order.get(uid, []) if (uid, i) in self.session.screens]
        if key in self.session.screens and (not ids or ids[-1] == key[1] or True):
            # an edit keeps the same message; a delete+send moves to the newest one
            newest = ids[-1] if ids else key[1]
            self.last_shown[uid] = key if key in self.session.screens and newest == key[1] else (uid, newest)
        elif ids:
            self.last_shown[uid] = (uid, ids[-1])

    async def tap(self, label: str, uid: int = ADMIN):
        """Presses the button whose text contains `label` (exact match preferred)."""
        btns = self.buttons(uid)
        exact = [d for t, d in btns if t == label]
        part = [d for t, d in btns if label in t]
        pick = exact or part
        assert pick, f"no button {label!r} on screen: {[t for t, _ in btns]}"
        await self.press(pick[0], uid)

    def text(self, uid: int = ADMIN) -> str:
        s = self.screen(uid)
        return s["text"] if s else ""

    def channel(self) -> list[dict]:
        return [self.session.screens[(CHANNEL, i)] for i in self.session.order.get(CHANNEL, []) if (CHANNEL, i) in self.session.screens]

    def snap(self, title: str, uid: int = ADMIN, note: str = "", channel: bool = False, photo_msg: bool = False) -> None:
        """Records what `uid` currently sees (or the channel feed) for the demo / screenshots."""
        def pack(s):
            rows = []
            if s and isinstance(s["markup"], InlineKeyboardMarkup):
                rows = [[b.text for b in row] for row in s["markup"].inline_keyboard]
            return {"text": s["text"] if s else "", "rows": rows, "photo": s["photo"] if s else None}
        if channel:
            msgs = [pack(x) for x in self.channel()[-6:]]
            self.frames.append({"title": title, "kind": "channel", "messages": msgs, "note": note})
        else:
            ids = [i for i in self.session.order.get(uid, []) if (uid, i) in self.session.screens]
            msgs = [pack(self.session.screens[(uid, i)]) for i in ids[-1:]]
            self.frames.append({"title": title, "kind": "chat", "messages": msgs, "note": note})

    async def state(self, uid: int = ADMIN):
        return await self.dp.fsm.get_context(self.bot, chat_id=uid, user_id=uid).get_state()
