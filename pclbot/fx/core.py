"""Shared helpers for the fx features."""
import html
import re

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError
from aiogram.types import Message

from .. import admins, db as main_db
from ..onc import dbx, service as onc_service

E = html.escape

# graphics made from the PCL app data carry the PCL identity, not the One Night Champion one
APP_LOOK = {"brand": "PCL PRO CLUB", "eyebrow": "OFFICIAL", "footer": "pclproclub.ir", "watermark": ("PCL", "PRO CLUB")}


async def get(key: str, default: str = "") -> str:
    v = await dbx.scalar("SELECT value FROM fx_settings WHERE key=?", key)
    return v if v is not None else default


async def put(key: str, value: str) -> None:
    await dbx.execute("INSERT INTO fx_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, value)


def now() -> int:
    return main_db.now()


def local_now():
    return onc_service.now_local()


def norm(s: str) -> str:
    return onc_service.norm_digits(s)


async def user_label(uid: int) -> str:
    u = await main_db.fetchone("SELECT name, username FROM users WHERE id=?", uid)
    if not u:
        return str(uid)
    return f"{u['name'] or 'کاربر'}" + (f" (@{u['username']})" if u["username"] else "") + f" · {uid}"


async def notify_admins(bot: Bot, text: str, markup=None, photo: str | None = None) -> None:
    for aid in admins.all_ids():
        try:
            if photo:
                await bot.send_photo(aid, photo, caption=text, reply_markup=markup)
            else:
                await bot.send_message(aid, text, reply_markup=markup)
        except TelegramAPIError:
            pass  # that admin never started the bot


async def tell(bot: Bot, uid: int, text: str, markup=None) -> bool:
    try:
        await bot.send_message(uid, text, reply_markup=markup)
        return True
    except TelegramAPIError:
        return False


async def resolve_chat(bot: Bot, m: Message):
    """A destination chat from a forwarded post, @username or numeric id. Returns (chat_id:str, title) or raises ValueError."""
    raw = None
    fo = getattr(m, "forward_origin", None)
    if fo is not None and getattr(fo, "chat", None):
        raw = str(fo.chat.id)
    elif m.text:
        raw = m.text.strip()
    if not raw or not re.fullmatch(r"@[A-Za-z0-9_]{4,}|-?\d{5,}", raw):
        raise ValueError("@username، آیدی عددی مثل -1001234567890 یا یک پست فورواردشده از آن چت بفرست.")
    try:
        chat = await bot.get_chat(raw)
    except TelegramAPIError as ex:
        raise ValueError(f"تلگرام این چت را باز نکرد: {ex}") from ex
    return str(chat.id), chat.title or chat.username or str(chat.id)


def split_chats(v: str | None) -> list[str]:
    return [x.strip() for x in (v or "").split(",") if x.strip()]


async def dests(key: str) -> list[str]:
    """Every chat a section publishes to (several channels / groups can be set; a post goes to all of them)."""
    return split_chats(await get(key))


async def add_dest(key: str, cid: str) -> None:
    cur = await dests(key)
    if str(cid) not in cur:
        await put(key, ",".join(cur + [str(cid)]))


async def del_dest(key: str, idx: int | None = None) -> None:
    cur = await dests(key)
    if idx is None:
        cur = []
    elif 0 <= idx < len(cur):
        cur.pop(idx)
    await put(key, ",".join(cur))


async def dest_status(bot: Bot, key: str) -> str:
    chats = await dests(key)
    if not chats:
        return "⚪ تنظیم نشده"
    return "\n".join([await _one_status(bot, c) for c in chats])


async def _one_status(bot: Bot, cid: str) -> str:
    try:
        chat = await bot.get_chat(cid)
        me = await bot.get_me()
        mem = await bot.get_chat_member(cid, me.id)
        ok = mem.status == "creator" or (mem.status in ("administrator",) and getattr(mem, "can_post_messages", True) is not False)
        return f"{'✅' if ok else '⚠️ دسترسی ارسال ندارد'} {E(chat.title or str(cid))}"
    except TelegramAPIError:
        return f"❌ در دسترس نیست ({E(cid)})"
