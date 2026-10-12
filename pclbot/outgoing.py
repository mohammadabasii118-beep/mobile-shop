"""Rewrites every outgoing request: editable button labels, custom (Premium) emoji in texts and as button icons.

Two versions of a request are prepared: "plain" (only button label overrides) and "full" (also custom emoji).
If Telegram rejects the full version, the plain one is sent instead, so a custom-emoji problem never loses a message.
"""
import logging

from aiogram.client.default import Default
from aiogram.client.session.middlewares.base import BaseRequestMiddleware
from aiogram.exceptions import TelegramBadRequest
from aiogram.methods import CopyMessage, DeleteMessage, EditMessageReplyMarkup, ForwardMessage, GetChat
from aiogram.types import InlineKeyboardMarkup, Message

from . import buttons, emojis

log = logging.getLogger("pclbot")

# chats that can't render custom (Premium) emoji — e.g. the ONC news channel; requests to them are never converted
EXEMPT_CHATS: set[str] = set()
# A group where Premium emoji work. Telegram drops a bot's custom emoji from CHANNEL posts, so a channel post that carries Premium emoji
# is made in this group first, copied into the channel with copyMessage (which keeps the custom_emoji entities), checked by reading the
# copy back, and the temporary group message is removed. If anything fails the normal direct post is sent instead.
RELAY_CHAT: str | None = None
RELAY_MODE = "copy"             # copy: = "hide sender name" (no Forwarded-from label), the group copy is removed · forward: post stays in the group, label shown
_KIND: dict[str, str] = {}


def _wants(method) -> bool:
    text = getattr(method, "text", None) or getattr(method, "caption", None) or ""
    ents = (getattr(method, "entities", None) or []) + (getattr(method, "caption_entities", None) or [])
    return "<tg-emoji" in text or any(e.type == "custom_emoji" for e in ents)


def _kept(msg) -> bool:
    return any(e.type == "custom_emoji" for e in (getattr(msg, "entities", None) or []) + (getattr(msg, "caption_entities", None) or []))


async def _is_channel(make_request, bot, chat) -> bool:
    chat = str(chat)
    if not chat.startswith("-100"):
        return False
    if chat not in _KIND:
        try:
            _KIND[chat] = (await make_request(bot, GetChat(chat_id=chat))).type
        except Exception:
            return False
    return _KIND[chat] == "channel"


async def _relay_first(make_request, bot, sent):
    """The channel Message of the relayed post, or None (the caller then posts directly)."""
    chan, staged, out = sent.chat_id, None, None
    try:
        staged = await make_request(bot, sent.model_copy(update={"chat_id": RELAY_CHAT}))              # made where Premium emoji survive
        markup = getattr(sent, "reply_markup", None)
        if RELAY_MODE == "forward":
            fwd = await make_request(bot, ForwardMessage(chat_id=chan, from_chat_id=RELAY_CHAT, message_id=staged.message_id))
            if not _kept(fwd):
                log.warning("Premium emoji relay: forwarding did not keep the emoji in %s — sending the post directly", chan)
                await make_request(bot, DeleteMessage(chat_id=chan, message_id=fwd.message_id))
                return None
            if markup is not None and not getattr(fwd, "reply_markup", None):                           # buttons don't always survive a forward
                try:
                    await make_request(bot, EditMessageReplyMarkup(chat_id=chan, message_id=fwd.message_id, reply_markup=markup))
                except Exception as ex:
                    log.info("buttons could not be re-attached to the forwarded post: %s", ex)
            out = staged.model_copy(update={"message_id": fwd.message_id})
            staged = None                                                                              # forward mode keeps the post in the group
            return out
        copied = await make_request(bot, CopyMessage(chat_id=chan, from_chat_id=RELAY_CHAT, message_id=staged.message_id, reply_markup=markup))
        back = await make_request(bot, ForwardMessage(chat_id=RELAY_CHAT, from_chat_id=chan, message_id=copied.message_id))   # what the channel really stored
        try:
            await make_request(bot, DeleteMessage(chat_id=RELAY_CHAT, message_id=back.message_id))
        except Exception:
            pass
        if not _kept(back):
            log.warning("Premium emoji relay: copyMessage did not keep the emoji in %s — sending the post directly", chan)
            await make_request(bot, DeleteMessage(chat_id=chan, message_id=copied.message_id))
            return None
        return staged.model_copy(update={"message_id": copied.message_id})
    except Exception as ex:
        log.warning("Premium emoji relay failed (%s) — sending the post directly", ex)
        return None
    finally:
        if staged is not None:                                                                         # copy mode / failures: remove the temporary group message
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
        target = full or (method if _wants(method) else None)
        if (RELAY_CHAT and target is not None and _wants(target) and str(getattr(target, "chat_id", "")) != RELAY_CHAT
                and hasattr(target, "chat_id") and await _is_channel(make_request, bot, target.chat_id)):
            res = await _relay_first(make_request, bot, target)
            if res is not None:
                return res
        if first is None:
            return await make_request(bot, method)
        try:
            return await make_request(bot, first)
        except TelegramBadRequest as ex:
            if full is None:
                raise
            log.warning("custom emoji request failed (%s); retrying with plain emoji", ex)
            return await make_request(bot, plain or method)
