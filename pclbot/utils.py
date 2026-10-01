from aiogram import BaseMiddleware
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, Message

from . import config, db


def is_admin(uid: int) -> bool:
    return uid in config.ADMIN_IDS


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
    """Registers users on first contact and blocks banned ones."""

    async def __call__(self, handler, event, data):
        user = data.get("event_from_user")
        if user:
            is_start = isinstance(event, Message) and (event.text or "").startswith("/start")
            if not is_start:
                row, _ = await db.ensure_user(user.id, user.full_name, user.username)
            else:
                row = await db.get_user(user.id)
            if row and row["banned"] and not is_admin(user.id):
                if isinstance(event, CallbackQuery):
                    await event.answer("⛔️ دسترسی شما محدود شده است.", show_alert=True)
                else:
                    await event.answer("⛔️ دسترسی شما محدود شده است.")
                return
        return await handler(event, data)
