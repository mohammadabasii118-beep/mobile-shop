"""🎥 Streamers: admins appoint streamers; a streamer sends a photo + title and it is published to the configured «Plus» chat."""
import re
from urllib.parse import urlparse

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton as URLButton, Message

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


MAX_LINKS = 4
PLATFORMS = (("twitch.tv", "Twitch"), ("youtube.com", "YouTube"), ("youtu.be", "YouTube"), ("kick.com", "Kick"), ("aparat.com", "Aparat"),
             ("instagram.com", "Instagram"), ("tiktok.com", "TikTok"), ("facebook.com", "Facebook"), ("t.me", "Telegram"))


def caption(title: str, streamer: str) -> str:
    return f"🔴 <b>{E(title)}</b>\n\n🎥 Streamer: {E(streamer)}"


def clean_url(raw: str) -> str | None:
    raw = core.norm(raw or "").strip()
    if re.fullmatch(r"[\w.-]+\.[a-z]{2,}(/\S*)?", raw, re.I):
        raw = "https://" + raw
    u = urlparse(raw)
    return raw if u.scheme in ("http", "https") and "." in (u.hostname or "") and len(raw) <= 300 and " " not in raw else None


def link_buttons(links: list[str]) -> list[list]:
    """One glass button per link, named after the platform (Twitch, YouTube, …; numbered when repeated)."""
    names = []
    for url in links:
        host = (urlparse(url).hostname or "").lower().removeprefix("www.")
        names.append(next((n for h, n in PLATFORMS if host == h or host.endswith("." + h)), host))
    return [[URLButton(text=f"🔗 {n}" + (f" {names[:i + 1].count(n)}" if names.count(n) > 1 else ""), url=u)] for i, (n, u) in enumerate(zip(names, links))]


async def streamer_name(uid: int, fallback: str) -> str:
    return (await dbx.scalar("SELECT username FROM fx_streamers WHERE user_id=?", uid)) or fallback


# ================================================================= streamer side (re-checked on every step)
@router.callback_query(F.data == "fx:st")
async def panel(c: CallbackQuery, state: FSMContext):
    await state.clear()
    if not await is_streamer(c.from_user.id):
        return await c.answer("⛔ تو Streamer نیستی.", show_alert=True)
    await show(c, "🎥 <b>پنل Streamer</b>\n\nوقتی می‌خواهی استریم کنی، عکس، تایتل و لینک(های) پخش را بفرست تا منتشر شود.",
               okb([[ob("▶️ ارسال پست استریم", "fx:sts")], [ob("🔙 منوی اصلی", "home")]]))
    await c.answer()


@router.callback_query(F.data == "fx:sts")
async def start(c: CallbackQuery, state: FSMContext):
    if not await is_streamer(c.from_user.id):
        return await c.answer("⛔ تو Streamer نیستی.", show_alert=True)
    if not await core.get("plus_chat"):
        return await c.answer("مقصد انتشار هنوز توسط ادمین تنظیم نشده.", show_alert=True)
    await state.clear()
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
    await state.update_data(title=title, links=[])
    await state.set_state(StreamSt.link)
    await m.answer("🔗 <b>لینک استریم</b> را بفرست (مثلاً لینک Twitch / YouTube / Kick / آپارات):", reply_markup=okb([[ob("❌ لغو", "fx:st")]]))


@router.message(StreamSt.link, F.text)
async def got_link(m: Message, state: FSMContext):
    url = clean_url(m.text)
    if not url:
        return await m.answer("⚠️ لینک معتبر نیست؛ آدرس کامل را بفرست (مثلاً <code>https://twitch.tv/name</code>).")
    d = await state.get_data()
    links = [*d.get("links", []), url]
    await state.update_data(links=links)
    if len(links) >= MAX_LINKS:
        return await _preview(m, state)
    await state.set_state(StreamSt.more)
    await m.answer(f"✅ لینک {len(links)} ثبت شد.\n\n<b>لینک استریم دیگری هم داری؟</b>",
                   reply_markup=okb([[ob("➕ بله، لینک دیگر", "fx:stm:1"), ob("✅ نه، ادامه", "fx:stm:0")], [ob("❌ لغو", "fx:st")]]))


@router.callback_query(F.data.regexp(r"^fx:stm:[01]$"), StreamSt.more)
async def more_links(c: CallbackQuery, state: FSMContext):
    await c.answer()
    if c.data.endswith("1"):
        await state.set_state(StreamSt.link)
        return await c.message.answer("🔗 لینک بعدی را بفرست:", reply_markup=okb([[ob("❌ لغو", "fx:st")]]))
    await _preview(c.message, state, c.from_user)


async def _preview(m: Message, state: FSMContext, user=None):
    user = user or m.from_user
    d = await state.get_data()
    await state.set_state(StreamSt.preview)
    name = await streamer_name(user.id, user.full_name)
    await m.answer_photo(d["photo"], caption=caption(d["title"], name) + "\n\n<i>پیش‌نمایش — منتشر شود؟</i>",
                         reply_markup=okb(link_buttons(d["links"]) + [[ob("✅ انتشار", "fx:stp")], [ob("❌ لغو", "fx:st")]]))


@router.callback_query(F.data == "fx:stp", StreamSt.preview)
async def publish(c: CallbackQuery, state: FSMContext, bot: Bot):
    if not await is_streamer(c.from_user.id):                              # backend check: role may have been removed meanwhile
        await state.clear()
        return await c.answer("⛔ تو Streamer نیستی.", show_alert=True)
    d = await state.get_data()
    chat = await core.get("plus_chat")
    if not chat:
        return await c.answer("مقصد انتشار تنظیم نشده.", show_alert=True)
    try:                                                                   # not exempt: Premium emoji are allowed here (plain fallback is automatic)
        msg = await bot.send_photo(chat, d["photo"], caption=caption(d["title"], await streamer_name(c.from_user.id, c.from_user.full_name)),
                                   reply_markup=okb(link_buttons(d["links"])))
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
    rows = await dbx.fetchall("SELECT user_id, username FROM fx_streamers ORDER BY added_at")
    btns = [[ob(f"➖ {r['username'] or ''} · {await core.user_label(r['user_id'])}", f"fx:atd:{r['user_id']}")] for r in rows]
    await show(c, f"🎥 <b>Streamers ({len(rows)})</b>\n\nمقصد انتشار (پلاس): {await core.dest_status(c.bot, 'plus_chat')}\n\nروی اسم هر Streamer بزن تا حذف شود.",
               okb(btns + [[ob("➕ افزودن Streamer", "fx:ata")], [ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@admin_router.callback_query(F.data == "fx:ata")
async def add_ask(c: CallbackQuery, state: FSMContext):
    await state.set_state(StreamSt.add)
    await show(c, "➕ <b>آیدی عددی تلگرام</b> Streamer را بفرست، یا یک پیام از او فوروارد کن، یا @username (اگر قبلاً ربات را استارت کرده).",
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
    await state.update_data(uid=uid)
    await state.set_state(StreamSt.uname)
    await m.answer(f"👤 {E(await core.user_label(uid))}\n\n<b>Streamer Username</b>:", reply_markup=okb([[ob("❌ لغو", "fx:at")]]))


@admin_router.message(StreamSt.uname, F.text)
async def add_username(m: Message, state: FSMContext, bot: Bot):
    name = m.text.strip().lstrip("@")
    if not 2 <= len(name) <= 40:
        return await m.answer("⚠️ Streamer Username باید بین ۲ تا ۴۰ کاراکتر باشد.")
    uid = (await state.get_data())["uid"]
    await dbx.execute("INSERT INTO fx_streamers(user_id,added_by,added_at,username) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username",
                      uid, m.from_user.id, core.now(), name)
    await state.clear()
    await core.tell(bot, uid, "🎥 تو Streamer شدی! از منوی اصلی ← «🎥 پنل Streamer» می‌توانی پست استریم بفرستی.")
    await m.answer(f"✅ {E(await core.user_label(uid))} Streamer شد — Username: <b>{E(name)}</b>", reply_markup=okb([[ob("🔙 بازگشت", "fx:at")]]))


@admin_router.callback_query(F.data.regexp(r"^fx:atd:(\d+)$"))
async def remove(c: CallbackQuery, state: FSMContext):
    await dbx.execute("DELETE FROM fx_streamers WHERE user_id=?", int(c.data.split(":")[2]))
    await c.answer("حذف شد")
    await admin_home(c, state)
