"""Admin hub (`fx:a`) for the extra features + router list + background tasks + stale-callback fallback."""
import asyncio

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery

from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import appgfx, blacklist, core, draft, hwg, quiz, streamers, subs
from .states import DestSt

PANEL = "fx:a"
router = Router()
router.callback_query.filter(lambda c: is_admin(c.from_user.id))
fallback = Router()


@router.callback_query(F.data == PANEL)
async def panel(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show(c, "⚙️ <b>پنل ویژگی‌های جدید</b>\n\nکدام بخش را مدیریت می‌کنی؟",
               okb([[ob("🌍 اشتراک بین‌المللی", "fx:as"), ob("🚫 بلک‌لیست", "fx:ab")],
                    [ob("⚽ مسابقات فوتبالی", "fx:aq"), ob("📝 درفت", "fx:ad")],
                    [ob("🎥 Streamers", "fx:at"), ob("⚡ ترنسفر نیوز (HWG)", "fx:hw")],
                    [ob("🎨 گرافیک‌های اپ", "fx:ag"), ob("📍 کانال «پلاس»", "fx:ap")],
                    [ob("🔙 بازگشت", "admhome")]]))
    await c.answer()


@router.callback_query(F.data == "fx:ap")
async def plus_dest(c: CallbackQuery, state: FSMContext, bot: Bot):
    await state.set_state(DestSt.pick)
    await state.update_data(key="plus_chat", back=PANEL)
    await show(c, f"📍 <b>مقصد انتشار پست Streamerها («پلاس»)</b>\n\nفعلی: {await core.dest_status(bot, 'plus_chat')}\n\n"
                  "یک پست از آن کانال/گروه فوروارد کن یا @username / آیدی عددی بفرست.", okb([[ob("❌ لغو", PANEL)]]))
    await c.answer()


@fallback.callback_query(F.data.startswith("fx:"))
async def stale(c: CallbackQuery):
    await c.answer("این دکمه منقضی شده یا دسترسی نداری — منوی اصلی را دوباره باز کن.", show_alert=True)


def routers() -> list[Router]:
    return [subs.router, blacklist.router, draft.router, quiz.router, streamers.router, subs.admin_router, blacklist.admin_router, draft.admin_router,
            quiz.admin_router, streamers.admin_router, router, hwg.router, appgfx.router]


def start_tasks(bot: Bot) -> list[asyncio.Task]:
    return [asyncio.create_task(quiz.scheduler_loop(bot)), asyncio.create_task(hwg.hwg_loop(bot))]
