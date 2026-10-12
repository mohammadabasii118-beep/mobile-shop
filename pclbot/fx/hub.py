"""Admin hub (`fx:a`) for the extra features + router list + background tasks + stale-callback fallback."""
import asyncio

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery

from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import appgfx, blacklist, core, draft, hwg, quiz, streamers, subs, themes_ui, xi
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
                    [ob("🎨 گرافیک‌های اپ", "fx:ag"), ob("🎭 تم‌های گرافیکی", "fx:th")],
                    [ob("⭐ تیم منتخب تورنمنت", "fx:xi"), ob("📍 کانال «پلاس»", "fx:ap")],
                    [ob("✨ گروه واسط ایموجی پریمیوم", "fx:ar")],
                    [ob("🔙 بازگشت", "admhome")]]))
    await c.answer()


@router.callback_query(F.data == "fx:ar")
async def relay_dest(c: CallbackQuery, state: FSMContext, bot: Bot):
    await state.set_state(DestSt.pick)
    await state.update_data(key="emoji_relay", back=PANEL)
    await show(c, f"✨ <b>گروه واسط ایموجی پریمیوم</b>\n\nفعلی: {await core.dest_status(bot, 'emoji_relay')}\n\n"
                  "گروهی که ایموجی پریمیوم در آن درست نمایش داده می‌شود (ربات ادمین با اجازه‌ی ارسال و حذف پیام). اگر تلگرام ایموجی پریمیوم را از پست کانال حذف کند، "
                  "ربات همان پست را در این گروه می‌سازد، با copyMessage به کانال می‌برد و پیام‌های موقت را پاک می‌کند.\n\n"
                  "یک پست از گروه فوروارد کن یا آیدی عددی (مثل -100…) بفرست:", okb([[ob("🗑 غیرفعال کردن", "fx:ar0")], [ob("❌ لغو", PANEL)]]))
    await c.answer()


@router.callback_query(F.data == "fx:ar0")
async def relay_off(c: CallbackQuery, state: FSMContext):
    from .. import outgoing
    await core.put("emoji_relay", "")
    outgoing.RELAY_CHAT = None
    await c.answer("غیرفعال شد")
    await panel(c, state)


async def load() -> None:
    from .. import outgoing
    outgoing.RELAY_CHAT = (await core.get("emoji_relay")) or None


@router.callback_query(F.data == "fx:ap")
async def plus_dest(c: CallbackQuery, state: FSMContext, bot: Bot):
    from .hwg import dest_screen
    await dest_screen(c.message, state, bot, "plus_chat", c)
    await c.answer()


@fallback.callback_query(F.data.startswith("fx:"))
async def stale(c: CallbackQuery):
    await c.answer("این دکمه منقضی شده یا دسترسی نداری — منوی اصلی را دوباره باز کن.", show_alert=True)


def routers() -> list[Router]:
    return [subs.router, blacklist.router, draft.router, quiz.router, streamers.router, subs.admin_router, blacklist.admin_router, draft.admin_router,
            quiz.admin_router, streamers.admin_router, router, themes_ui.router, xi.router, hwg.router, appgfx.router]


def start_tasks(bot: Bot) -> list[asyncio.Task]:
    return [asyncio.create_task(quiz.scheduler_loop(bot)), asyncio.create_task(hwg.hwg_loop(bot))]
