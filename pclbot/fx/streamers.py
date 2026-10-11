"""🎥 Streamers: admins appoint streamers; a streamer sends a photo + title and it is published to the configured «Plus» chat."""
import re

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from .. import db as main_db
from ..onc import dbx, ui
from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import core
from .core import E
from .states import StreamSt

router = Router()
admin_router = Router()
admin_router.message.filter(lambda m: is_admin(m.from_user.id))
admin_router.callback_query.filter(lambda c: is_admin(c.from_user.id))


async def is_streamer(uid: int) -> bool:
    return bool(await dbx.scalar("SELECT 1 FROM fx_streamers WHERE user_id=?", uid))


def caption(title: str, streamer: str) -> str:
    return f"🔴 <b>{E(title)}</b>\n\n🎥 استریمر: {E(streamer)}"


# ================================================================= streamer side (re-checked on every step)
@router.callback_query(F.data == "fx:st")
async def panel(c: CallbackQuery, state: FSMContext):
    await state.clear()
    if not await is_streamer(c.from_user.id):
        return await c.answer("⛔ تو استریمر نیستی.", show_alert=True)
    await show(c, "🎥 <b>پنل استریمر</b>\n\nوقتی می‌خواهی استریم کنی، عکس و تایتل را بفرست تا منتشر شود.",
               okb([[ob("▶️ ارسال پست استریم", "fx:sts")], [ob("🔙 منوی اصلی", "home")]]))
    await c.answer()


@router.callback_query(F.data == "fx:sts")
async def start(c: CallbackQuery, state: FSMContext):
    if not await is_streamer(c.from_user.id):
        return await c.answer("⛔ تو استریمر نیستی.", show_alert=True)
    if not await core.get("plus_chat"):
        return await c.answer("مقصد انتشار هنوز توسط ادمین تنظیم نشده.", show_alert=True)
    await state.set_state(StreamSt.photo)
    await show(c, "🖼 <b>عکس استریم</b> را بفرست:", okb([[ob("❌ لغو", "fx:st")]]))
    await c.answer()


@router.message(StreamSt.photo, F.photo)
async def got_photo(m: Message, state: FSMContext):
    if not await is_streamer(m.from_user.id):
        return await state.clear()
    await state.update_data(photo=m.photo[-1].file_id)
    await state.set_state(StreamSt.title)
    await m.answer("✏️ <b>تایتل استریم</b> را بفرست:", reply_markup=okb([[ob("❌ لغو", "fx:st")]]))


@router.message(StreamSt.title, F.text)
async def got_title(m: Message, state: FSMContext):
    title = m.text.strip()
    if not title or len(title) > 150:
        return await m.answer("⚠️ تایتل باید بین ۱ تا ۱۵۰ کاراکتر باشد.")
    d = await state.get_data()
    await state.update_data(title=title)
    await state.set_state(StreamSt.preview)
    name = m.from_user.full_name
    await m.answer_photo(d["photo"], caption=caption(title, name) + "\n\n<i>پیش‌نمایش — منتشر شود؟</i>",
                         reply_markup=okb([[ob("✅ انتشار", "fx:stp")], [ob("❌ لغو", "fx:st")]]))


@router.callback_query(F.data == "fx:stp", StreamSt.preview)
async def publish(c: CallbackQuery, state: FSMContext, bot: Bot):
    if not await is_streamer(c.from_user.id):                              # backend check: role may have been removed meanwhile
        await state.clear()
        return await c.answer("⛔ تو استریمر نیستی.", show_alert=True)
    d = await state.get_data()
    chat = await core.get("plus_chat")
    if not chat:
        return await c.answer("مقصد انتشار تنظیم نشده.", show_alert=True)
    from .. import outgoing
    outgoing.EXEMPT_CHATS.add(str(chat))
    try:
        msg = await bot.send_photo(chat, d["photo"], caption=caption(d["title"], c.from_user.full_name))
    except TelegramAPIError as ex:
        return await c.answer(f"انتشار ناموفق بود: {str(ex)[:120]}", show_alert=True)
    await dbx.execute("INSERT INTO fx_stream_posts(user_id,title,chat_id,message_id,created_at) VALUES(?,?,?,?,?)",
                      c.from_user.id, d["title"], str(chat), msg.message_id, core.now())
    await state.clear()
    await c.answer("✅ منتشر شد")
    await c.message.answer("✅ پست استریم منتشر شد.", reply_markup=okb([[ob("▶️ پست دیگر", "fx:sts")], [ob("🔙 منوی اصلی", "home")]]))


# ================================================================= admin side
@admin_router.callback_query(F.data == "fx:at")
async def admin_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    rows = await dbx.fetchall("SELECT user_id FROM fx_streamers ORDER BY added_at")
    btns = [[ob(f"➖ {await core.user_label(r['user_id'])}", f"fx:atd:{r['user_id']}")] for r in rows]
    await show(c, f"🎥 <b>استریمرها ({len(rows)})</b>\n\nمقصد انتشار (پلاس): {await core.dest_status(c.bot, 'plus_chat')}\n\nروی اسم هر استریمر بزن تا حذف شود.",
               okb(btns + [[ob("➕ افزودن استریمر", "fx:ata")], [ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@admin_router.callback_query(F.data == "fx:ata")
async def add_ask(c: CallbackQuery, state: FSMContext):
    await state.set_state(StreamSt.add)
    await show(c, "➕ <b>آیدی عددی تلگرام</b> استریمر را بفرست، یا یک پیام از او فوروارد کن، یا @username (اگر قبلاً ربات را استارت کرده).",
               okb([[ob("❌ لغو", "fx:at")]]))
    await c.answer()


@admin_router.message(StreamSt.add)
async def add_do(m: Message, state: FSMContext, bot: Bot):
    uid = None
    fo = getattr(m, "forward_origin", None)
    if fo is not None and getattr(fo, "sender_user", None):
        uid = fo.sender_user.id
    elif m.text and re.fullmatch(r"\d{5,15}", core.norm(m.text)):
        uid = int(core.norm(m.text))
    elif m.text and re.fullmatch(r"@[A-Za-z0-9_]{4,}", m.text.strip()):
        row = await main_db.fetchone("SELECT id FROM users WHERE lower(username)=lower(?)", m.text.strip()[1:])
        uid = row["id"] if row else None
        if uid is None:
            return await m.answer("⚠️ این یوزرنیم در ربات پیدا نشد. آیدی عددی را بفرست.")
    if uid is None:
        return await m.answer("⚠️ آیدی عددی، پیام فورواردشده یا @username بفرست.")
    await dbx.execute("INSERT OR IGNORE INTO fx_streamers(user_id,added_by,added_at) VALUES(?,?,?)", uid, m.from_user.id, core.now())
    await state.clear()
    await core.tell(bot, uid, "🎥 تو استریمر شدی! از منوی اصلی ← «🎥 پنل استریمر» می‌توانی پست استریم بفرستی.")
    await m.answer(f"✅ {E(await core.user_label(uid))} استریمر شد.", reply_markup=okb([[ob("🔙 بازگشت", "fx:at")]]))


@admin_router.callback_query(F.data.regexp(r"^fx:atd:(\d+)$"))
async def remove(c: CallbackQuery, state: FSMContext):
    await dbx.execute("DELETE FROM fx_streamers WHERE user_id=?", int(c.data.split(":")[2]))
    await c.answer("حذف شد")
    await admin_home(c, state)
