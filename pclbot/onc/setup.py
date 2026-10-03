"""Wiring for the ONC module: DB init, default templates, router list."""
import logging

from aiogram import F, Router
from aiogram.types import CallbackQuery

from ..utils import is_admin
from . import dbx, handlers_admin, handlers_gfx, handlers_play, handlers_user, templates

log = logging.getLogger("pclbot.onc")

# last router: anything under the onc: namespace that no handler took
fallback = Router()


@fallback.callback_query(F.data.startswith("onc:"))
async def stale(c: CallbackQuery):
    if not is_admin(c.from_user.id):
        return await c.answer("⛔️ فقط ادمین‌ها دسترسی دارند.", show_alert=True)
    await c.answer("این دکمه منقضی شده — پنل را دوباره باز کن (/admin).", show_alert=True)


def routers() -> list[Router]:
    return [handlers_user.router, handlers_admin.router, handlers_play.router, handlers_gfx.router]


async def init() -> None:
    backup = await dbx.init()
    if backup:
        log.info("ONC: database backed up to %s before the first migration", backup)
    await templates.ensure_defaults()
