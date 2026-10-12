"""Rewrites every outgoing request: editable button labels, custom (Premium) emoji in texts and as button icons.

Two versions of a request are prepared: "plain" (only button label overrides) and "full" (also custom emoji).
If Telegram rejects the full version, the plain one is sent instead, so a custom-emoji problem never loses a message.
"""
import logging

from aiogram.client.default import Default
from aiogram.client.session.middlewares.base import BaseRequestMiddleware
from aiogram.exceptions import TelegramBadRequest
from aiogram.methods import CopyMessage, DeleteMessage
from aiogram.types import InlineKeyboardMarkup, Message

from . import buttons, emojis

log = logging.getLogger("pclbot")

# chats that can't render custom (Premium) emoji — e.g. the ONC news channel; requests to them are never converted
EXEMPT_CHATS: set[str] = set()
# A group where Premium emoji work. When Telegram silently strips them from a channel post, the same post is made in this group
# and copied (copyMessage keeps the custom_emoji entities) into the channel, then both temporary messages are removed.
RELAY_CHAT: str | None = None


def _lost_premium(sent, res) -> bool:
    text = getattr(sent, "text", None) or getattr(sent, "caption", None) or ""
    chat = str(getattr(sent, "chat_id", ""))
    if not (isinstance(res, Message) and "<tg-emoji" in text and chat.startswith("-100") and chat != RELAY_CHAT):
        return False
    return not any(e.type == "custom_emoji" for e in (res.entities or []) + (res.caption_entities or []))


async def _relay(make_request, bot, sent, res):
    """Returns the Message of the copy in the channel, or None (then the plain post simply stays)."""
    staged = None
    try:
        staged = await make_request(bot, sent.model_copy(update={"chat_id": RELAY_CHAT}))
        copied = await make_request(bot, CopyMessage(chat_id=sent.chat_id, from_chat_id=RELAY_CHAT, message_id=staged.message_id,
                                                     reply_markup=getattr(sent, "reply_markup", None)))
        await make_request(bot, DeleteMessage(chat_id=sent.chat_id, message_id=res.message_id))        # the plain original
        return res.model_copy(update={"message_id": copied.message_id})
    except Exception as ex:
        log.warning("Premium emoji relay failed (%s) — the plain post stays", ex)
        return None
    finally:
        if staged is not None:
            try:
                await make_request(bot, DeleteMessage(chat_id=RELAY_CHAT, message_id=staged.message_id))
            except Exception:
                pass


def convert_markup(markup: InlineKeyboardMarkup, premium: bool) -> InlineKeyboardMarkup:
    rows = []
    for row in markup.inline_keyboard:
        new_row = []
        for b in row:
            b = buttons.apply(b, premium)
            if premium and b.icon_custom_emoji_id is None:
                label, icon = emojis.button_icon(b.text)
                if icon:
                    b = b.model_copy(update={"text": label, "icon_custom_emoji_id": icon})
            new_row.append(b)
        rows.append(new_row)
    return InlineKeyboardMarkup(inline_keyboard=rows)


def convert(method, premium: bool):
    """A converted copy of the request, or None when nothing changes."""
    if not hasattr(method, "parse_mode") or str(getattr(method, "chat_id", "")) in EXEMPT_CHATS:
        return None
    pm = method.parse_mode
    if not (isinstance(pm, Default) or pm == "HTML"):
        return None
    updates = {}
    if premium:
        for field in ("text", "caption"):
            value = getattr(method, field, None)
            if isinstance(value, str):
                converted = emojis.apply_html(value)
                if converted != value:
                    updates[field] = converted
    markup = getattr(method, "reply_markup", None)
    if isinstance(markup, InlineKeyboardMarkup) and (buttons.has_overrides() or premium):
        converted = convert_markup(markup, premium)
        if converted != markup:
            updates["reply_markup"] = converted
    return method.model_copy(update=updates) if updates else None


class OutgoingMiddleware(BaseRequestMiddleware):
    async def __call__(self, make_request, bot, method):
        plain = convert(method, premium=False)
        # premium needs the global switch on, and either mapped emoji or a button with its own custom emoji
        full = convert(method, premium=True) if emojis.enabled and (emojis.active() or buttons.has_premium()) else None
        first = full or plain
        if first is None:
            return await make_request(bot, method)
        try:
            res = await make_request(bot, first)
            if RELAY_CHAT and first is full and _lost_premium(first, res):
                res = await _relay(make_request, bot, first, res) or res
            return res
        except TelegramBadRequest as ex:
            if full is None:
                raise
            log.warning("custom emoji request failed (%s); retrying with plain emoji", ex)
            return await make_request(bot, plain or method)
