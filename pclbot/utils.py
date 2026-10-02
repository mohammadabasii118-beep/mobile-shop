from aiogram import BaseMiddleware
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, Message

from . import db, gate
from .admins import is_admin  # noqa: F401  (re-exported for handlers)


def parse_ref(text: str | None) -> int | None:
    parts = (text or "").split(maxsplit=1)
    if len(parts) == 2 and parts[1].startswith("ref_") and parts[1][4:].isdigit():
        return int(parts[1][4:])
    return None


async def show(event: CallbackQuery | Message, text: str, markup: InlineKeyboardMarkup | None = None) -> None:
    """Edit the current inline message when possible, otherwise send a fresh one."""
    if isinstance(event, CallbackQuery):
        msg = event.message
        try:
            await msg.edit_text(text, reply_markup=markup)
            return
        except TelegramBadRequest as ex:
            if "not modified" in str(ex):
                return
            try:
                await msg.delete()
            except TelegramBadRequest:
                pass
        await msg.answer(text, reply_markup=markup)
    else:
        await event.answer(text, reply_markup=markup)


class UserMiddleware(BaseMiddleware):
    """Registers users on first contact, blocks banned ones and enforces forced channel join."""

    async def __call__(self, handler, event, data):
        user = data.get("event_from_user")
        chat = data.get("event_chat")
        if not user or (chat and chat.type != "private"):
            return await handler(event, data)  # groups/channels: no registration, no gating
        is_start = isinstance(event, Message) and (event.text or "").startswith("/start")
        if is_start:
            row, _ = await db.ensure_user(user.id, user.full_name, user.username, parse_ref(event.text))
        else:
            row, _ = await db.ensure_user(user.id, user.full_name, user.username)
        if row and row["banned"] and not is_admin(user.id):
            if isinstance(event, CallbackQuery):
                await event.answer("⛔️ دسترسی شما محدود شده است.", show_alert=True)
            else:
                await event.answer("⛔️ دسترسی شما محدود شده است.")
            return
        exempt = isinstance(event, CallbackQuery) and event.data == "chk"
        if not is_admin(user.id) and not exempt:
            miss = await gate.missing(data["bot"], user.id)
            if miss:
                text, markup = gate.prompt(miss)
                if isinstance(event, CallbackQuery):
                    await event.answer()
                    await event.message.answer(text, reply_markup=markup)
                else:
                    await event.answer(text, reply_markup=markup)
                return
        return await handler(event, data)
