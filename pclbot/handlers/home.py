"""Top-level chooser between the two independent sections: 🔄 TRANSFER and 🏆 ONE NIGHT CHAMPION.

Registered FIRST so /start and /admin always land here. The Transfer handlers themselves are untouched:
the 🔄 TRANSFER button simply opens Transfer's existing main menu (callback `menu`).
"""
from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from .. import db
from ..keyboards import btn, kb
from ..utils import is_admin, parse_ref, show

router = Router()

HOME_TEXT = "🏠 <b>منوی اصلی</b>\n\nیک بخش را انتخاب کن:"
ADMIN_TEXT = "🛠 <b>پنل مدیریت</b>\n\nکدام پنل را می‌خواهی؟"


def home_markup(uid: int):
    return kb([[btn("🔄 ترنسفر", "menu")], [btn("🏆 وان نایت چمپیون", "onc:u")]])


def admin_markup():
    return kb([[btn("🔄 پنل ترنسفر", "adm")], [btn("🏆 پنل وان نایت چمپیون", "onc:a")], [btn("🔙 منوی اصلی", "home")]])


@router.message(CommandStart())
async def start(m: Message, state: FSMContext):
    await state.clear()
    await db.ensure_user(m.from_user.id, m.from_user.full_name, m.from_user.username, parse_ref(m.text))
    await m.answer(HOME_TEXT, reply_markup=home_markup(m.from_user.id))


@router.callback_query(F.data == "home")
async def home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show(c, HOME_TEXT, home_markup(c.from_user.id))
    await c.answer()


@router.message(Command("admin"), F.func(lambda m: is_admin(m.from_user.id)))
async def admin_cmd(m: Message, state: FSMContext):
    await state.clear()
    await m.answer(ADMIN_TEXT, reply_markup=admin_markup())


@router.callback_query(F.data == "admhome", F.func(lambda c: is_admin(c.from_user.id)))
async def admin_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show(c, ADMIN_TEXT, admin_markup())
    await c.answer()
