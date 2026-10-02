"""Rewrites every outgoing request: editable button labels, custom (Premium) emoji in texts and as button icons.

Two versions of a request are prepared: "plain" (only button label overrides) and "full" (also custom emoji).
If Telegram rejects the full version, the plain one is sent instead, so a custom-emoji problem never loses a message.
"""
import logging

from aiogram.client.default import Default
from aiogram.client.session.middlewares.base import BaseRequestMiddleware
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import InlineKeyboardMarkup

from . import buttons, emojis

log = logging.getLogger("pclbot")


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
    if not hasattr(method, "parse_mode"):
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
            return await make_request(bot, first)
        except TelegramBadRequest as ex:
            if full is None:
                raise
            log.warning("custom emoji request failed (%s); retrying with plain emoji", ex)
            return await make_request(bot, plain or method)
