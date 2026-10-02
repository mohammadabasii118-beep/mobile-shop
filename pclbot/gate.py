"""Forced channel membership."""
import logging
import time

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError
from aiogram.types import InlineKeyboardButton as B, InlineKeyboardMarkup

from . import db
from .messages import T

log = logging.getLogger("pclbot")
_ok: dict[int, float] = {}  # uid -> time until which a positive check is trusted
TTL = 60


def invalidate(uid: int) -> None:
    _ok.pop(uid, None)


async def missing(bot: Bot, uid: int) -> list[dict]:
    """Channels the user has not joined. API errors fail open so a broken setup can't lock everyone out."""
    chans = await db.fetchall("SELECT * FROM channels ORDER BY id")
    if not chans or _ok.get(uid, 0) > time.time():
        return []
    miss = []
    for ch in chans:
        try:
            m = await bot.get_chat_member(ch["chat"], uid)
        except TelegramAPIError as ex:
            log.warning("membership check failed for %s: %s", ch["chat"], ex)
            continue
        if m.status in ("left", "kicked") or (m.status == "restricted" and not m.is_member):
            miss.append(ch)
    if not miss:
        _ok[uid] = time.time() + TTL
    return miss


def prompt(miss: list[dict]) -> tuple[str, InlineKeyboardMarkup]:
    text = T("join_required")
    rows = [[B(text=f"📢 {ch['title']}", url=ch["link"])] for ch in miss]
    rows.append([B(text="✅ عضو شدم", callback_data="chk")])
    return text, InlineKeyboardMarkup(inline_keyboard=rows)
