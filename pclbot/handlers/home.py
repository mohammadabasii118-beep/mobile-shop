"""Top-level chooser between the two independent sections: 🔄 TRANSFER and 🏆 ONE NIGHT CHAMPION.

Registered FIRST so /start and /admin always land here. The Transfer handlers themselves are untouched:
the 🔄 TRANSFER button simply opens Transfer's existing main menu (callback `menu`).
"""
import logging

from aiogram import BaseMiddleware, Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import (BotCommand, BotCommandScopeChat, CallbackQuery, KeyboardButton, MenuButtonCommands, Message,
                           ReplyKeyboardMarkup)

from .. import admins, db
from ..keyboards import btn, kb, main_menu
from ..onc import dbx, handlers_user as onc_user
from ..utils import is_admin, parse_ref, show

log = logging.getLogger("pclbot")

router = Router()

HOME_TEXT = "🏠 <b>منوی اصلی</b>\n\nیک بخش را انتخاب کن:"
ADMIN_TEXT = "🛠 <b>پنل مدیریت</b>\n\nکدام پنل را می‌خواهی؟"


def home_markup(uid: int):
    rows = [[btn("🔄 ترنسفر", "menu")], [btn("🏆 وان نایت چمپیون", "onc:u")]]
    if is_admin(uid):  # admins only; the panels behind it keep their own admin filters
        rows.append([btn("🛠 پنل مدیریت", "admhome")])
    return kb(rows)


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


# ---------------------------------------------------------------- always-visible bottom menu (no need to type /start)
BTN_HOME, BTN_TRANSFER, BTN_ONC, BTN_ADMIN = "🏠 منوی اصلی", "🔄 ترنسفر", "🏆 وان نایت چمپیون", "🛠 پنل مدیریت"
KEYBOARD_TEXT = "👇 منوی پایین فعال شد؛ دیگر لازم نیست /start بزنی."


def reply_keyboard(admin: bool) -> ReplyKeyboardMarkup:
    rows = [[KeyboardButton(text=BTN_HOME), KeyboardButton(text=BTN_TRANSFER), KeyboardButton(text=BTN_ONC)]]
    if admin:
        rows.append([KeyboardButton(text=BTN_ADMIN)])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True, is_persistent=True)


class BottomMenuMiddleware(BaseMiddleware):
    """Gives every private chat the persistent bottom keyboard once (again if the user's admin status changes)."""

    async def __call__(self, handler, event, data):
        result = await handler(event, data)
        user, chat = data.get("event_from_user"), data.get("event_chat")
        if not user or not chat or chat.type != "private":
            return result
        kind = "a" if is_admin(user.id) else "u"
        try:
            if await dbx.scalar("SELECT kind FROM ui_kb WHERE user_id=?", user.id) != kind:
                await data["bot"].send_message(chat.id, KEYBOARD_TEXT, reply_markup=reply_keyboard(kind == "a"))
                await dbx.execute("INSERT INTO ui_kb(user_id,kind) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET kind=excluded.kind", user.id, kind)
        except TelegramAPIError:
            pass  # user blocked the bot etc. — never break the actual handler
        return result


async def _clean(m: Message) -> None:
    try:
        await m.delete()  # keep the chat tidy: the pressed bottom button disappears
    except TelegramAPIError:
        pass


@router.message(F.text == BTN_HOME)
async def key_home(m: Message, state: FSMContext):
    await state.clear(); await _clean(m)
    await m.answer(HOME_TEXT, reply_markup=home_markup(m.from_user.id))


@router.message(F.text == BTN_TRANSFER)
@router.message(Command("transfer"))
async def key_transfer(m: Message, state: FSMContext):
    from .user import menu_text
    await state.clear(); await _clean(m)
    await m.answer(await menu_text(), reply_markup=main_menu(is_admin(m.from_user.id)))


@router.message(F.text == BTN_ONC)
@router.message(Command("onc"))
async def key_onc(m: Message, state: FSMContext):
    await state.clear(); await _clean(m)
    await m.answer(await onc_user.home_text(), reply_markup=onc_user.MENU)


@router.message(F.text == BTN_ADMIN, F.func(lambda m: is_admin(m.from_user.id)))
async def key_admin(m: Message, state: FSMContext):
    await state.clear(); await _clean(m)
    await m.answer(ADMIN_TEXT, reply_markup=admin_markup())


async def setup_menu(bot: Bot) -> None:
    """Telegram's «Menu» button with the command list (admins additionally get /admin)."""
    base = [BotCommand(command="start", description="منوی اصلی"), BotCommand(command="transfer", description="ترنسفر (ثبت آگهی)"),
            BotCommand(command="onc", description="وان نایت چمپیون")]
    try:
        await bot.set_my_commands(base)
        await bot.set_chat_menu_button(menu_button=MenuButtonCommands())
        for uid in admins.all_ids():
            try:
                await bot.set_my_commands(base + [BotCommand(command="admin", description="پنل مدیریت")], scope=BotCommandScopeChat(chat_id=uid))
            except TelegramAPIError:
                pass  # that admin never started the bot yet
    except TelegramAPIError as ex:
        log.warning("could not set the bot menu: %s", ex)
