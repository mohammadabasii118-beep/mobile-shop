"""⚡ HERE WE GO — new transfers from the PCL app are posted to a channel as a graphic + caption.

The poller reads GET /transfers every POLL seconds. The very first run only *remembers* what already exists (so enabling
the feature never floods the channel with old news); afterwards every unseen id is posted oldest-first.
"""
import asyncio
import logging

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery, Message

from .. import outgoing
from ..onc import dbx, gfx, render, templates
from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import appapi, core
from .core import E
from .states import DestSt

log = logging.getLogger("pclbot.fx.hwg")
POLL = 120
router = Router()
router.message.filter(lambda m: is_admin(m.from_user.id))
router.callback_query.filter(lambda c: is_admin(c.from_user.id))

TYPE_FA = {"transfer": "انتقال", "loan": "قرضی", "free": "آزاد (بدون تیم مبدا)", "release": "جدایی (بدون تیم مقصد)"}


def party(t: dict, side: str) -> str:
    return t.get(f"{side}_team_name") or ("آزاد" if side == "from" else "بدون تیم")


def data_of(t: dict) -> dict:
    return {**core.APP_LOOK, "eyebrow": "TRANSFER NEWS", "player": t["player_gaming_id"], "from": party(t, "from"), "to": party(t, "to"), "type_label": TYPE_FA.get(t["type"], "انتقال"),
            "date": (t.get("date") or "").replace("-", "/"), "subtitle": "TRANSFER NEWS · PCL", "title": "HERE WE GO"}


def caption(t: dict) -> str:
    return (f"🚨 <b>HERE WE GO</b>\n\n👤 بازیکن: <b>{E(t['player_gaming_id'])}</b>\n"
            f"🔄 {E(party(t, 'from'))}  ➜  <b>{E(party(t, 'to'))}</b>\n🏷 نوع: {TYPE_FA.get(t['type'], 'انتقال')}\n📅 {E((t.get('date') or '').replace('-', '/'))}")


async def card(t: dict) -> bytes:
    tpl = await templates.active_template("TRANSFER")
    cfg = tpl["config"] if tpl else templates.default_config("TRANSFER")
    return render.render("TRANSFER", cfg, data_of(t), tpl["bg_path"] if tpl else None)[0]


async def post(bot: Bot, t: dict, chats: list[str]) -> int:
    """Posts to every configured channel / group; returns how many accepted it."""
    png, ok = await card(t), 0
    for chat in chats:
        outgoing.EXEMPT_CHATS.discard(str(chat))                  # Premium emoji stay Premium in the channel
        try:
            await bot.send_photo(chat, BufferedInputFile(png, "here_we_go.png"), caption=caption(t))
            ok += 1
        except TelegramAPIError as ex:
            log.warning("HWG post to %s failed: %s", chat, ex)
    return ok


async def poll_once(bot: Bot) -> int:
    """One polling round; returns how many transfers were posted."""
    if await core.get("hwg_on") != "1":
        return 0
    chats = await core.dests("hwg_chat")
    items = await appapi.transfers(20)
    first = await core.get("hwg_seeded") != "1"
    seen = {r["id"] for r in await dbx.fetchall("SELECT id FROM fx_hwg_seen")}
    new = [t for t in items if t["id"] not in seen]
    if first:
        for t in new:
            await dbx.execute("INSERT OR IGNORE INTO fx_hwg_seen(id,posted_at) VALUES(?,?)", t["id"], 0)
        await core.put("hwg_seeded", "1")
        return 0
    n = 0
    for t in reversed(new):                       # oldest first
        if chats and not await post(bot, t, chats):
            break                                  # no destination accepted it → keep it unseen, retried next round
        await dbx.execute("INSERT OR IGNORE INTO fx_hwg_seen(id,posted_at) VALUES(?,?)", t["id"], core.now())
        n += 1
    return n


async def hwg_loop(bot: Bot) -> None:
    while True:
        try:
            await poll_once(bot)
        except appapi.AppApiError as ex:
            log.info("HWG poll skipped: %s", ex)
        except Exception:
            log.exception("HWG poll crashed")
        await asyncio.sleep(POLL)


# ================================================================= admin
async def _panel(c: CallbackQuery, bot: Bot, note: str = ""):
    on = await core.get("hwg_on") == "1"
    await show(c, f"⚡ <b>ترنسفر نیوز — Here We Go</b>\n\n{note}وضعیت: {'🟢 روشن' if on else '🔴 خاموش'}\n"
                  f"کانال انتشار: {await core.dest_status(bot, 'hwg_chat')}\n\n"
                  f"هر {POLL // 60} دقیقه ترنسفرهای جدید اپ بررسی و با گرافیک منتشر می‌شود. "
                  "اولین بررسی فقط ترنسفرهای فعلی را به‌خاطر می‌سپارد و چیزی منتشر نمی‌کند.",
               okb([[ob("🔴 خاموش کردن" if on else "🟢 روشن کردن", "fx:hw:t")], [ob("📍 تعیین کانال", "fx:hw:d")],
                    [ob("🧪 پیش‌نمایش آخرین ترنسفر", "fx:hw:p")], [ob("🔙 بازگشت", "fx:a")]]))


@router.callback_query(F.data == "fx:hw")
async def home(c: CallbackQuery, state: FSMContext, bot: Bot):
    await state.clear()
    await _panel(c, bot)
    await c.answer()


@router.callback_query(F.data == "fx:hw:t")
async def toggle(c: CallbackQuery, bot: Bot):
    on = await core.get("hwg_on") == "1"
    if not on and not await core.dests("hwg_chat"):
        return await c.answer("اول کانال انتشار را تعیین کن.", show_alert=True)
    await core.put("hwg_on", "0" if on else "1")
    await _panel(c, bot)
    await c.answer("ذخیره شد")


DEST_TITLE = {"hwg_chat": ("⚡ مقصدهای Here We Go", "fx:hw"), "gfx_chat": ("🎨 مقصدهای گرافیک‌های اپ", "fx:ag"), "plus_chat": ("🎥 مقصدهای پست Streamerها («پلاس»)", "fx:a")}


async def dest_screen(target, state: FSMContext, bot: Bot, key: str, edit_from: CallbackQuery | None = None) -> None:
    title, back = DEST_TITLE[key]
    chats = await core.dests(key)
    await state.set_state(DestSt.pick)
    await state.update_data(key=key, back=back)
    rows = [[ob(f"➖ حذف {i + 1}", f"fx:dd:{key[0]}:{i}")] for i in range(len(chats))]
    text = (f"<b>{title}</b>\n\n{await core.dest_status(bot, key)}\n\nبرای <b>افزودن</b> مقصد جدید یک پست از آن کانال/گروه فوروارد کن یا @username / آیدی عددی بفرست. "
            "می‌توانی چند مقصد بگذاری؛ هر پست به همه‌ی آن‌ها می‌رود. (ربات باید در هر کدام ادمین با اجازه‌ی ارسال باشد.)")
    kb = okb(rows + [[ob("🔙 بازگشت", back)]])
    if edit_from is not None:
        await show(edit_from, text, kb)
    else:
        await target.answer(text, reply_markup=kb)


@router.callback_query(F.data == "fx:hw:d")
async def dest(c: CallbackQuery, state: FSMContext, bot: Bot):
    await dest_screen(c.message, state, bot, "hwg_chat", c)
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:dd:[hgp]:\d+$"))
async def dest_remove(c: CallbackQuery, state: FSMContext, bot: Bot):
    _, _, k, i = c.data.split(":")
    key = {"h": "hwg_chat", "g": "gfx_chat", "p": "plus_chat"}[k]
    await core.del_dest(key, int(i))
    await c.answer("حذف شد")
    await dest_screen(c.message, state, bot, key, c)


@router.callback_query(F.data == "fx:hw:p")
async def preview(c: CallbackQuery):
    try:
        items = await appapi.transfers(1)
    except appapi.AppApiError as ex:
        return await c.answer(str(ex), show_alert=True)
    if not items:
        return await c.answer("هنوز ترنسفری در اپ ثبت نشده.", show_alert=True)
    await c.message.answer_photo(BufferedInputFile(await card(items[0]), "preview.png"), caption=caption(items[0]) + "\n\n<i>پیش‌نمایش — منتشر نشد.</i>")
    await c.answer()


# one handler for every "pick a destination chat" flow (plus_chat / hwg_chat / gfx_chat add to a list; emoji_relay is a single chat)
@router.message(DestSt.pick)
async def dest_got(m: Message, state: FSMContext, bot: Bot):
    d = await state.get_data()
    try:
        cid, title = await core.resolve_chat(bot, m)
    except ValueError as ex:
        return await m.answer(f"⚠️ {ex}")
    key = d["key"]
    if key in DEST_TITLE:
        await core.add_dest(key, cid)
        await m.answer(f"✅ «{E(title)}» به مقصدها اضافه شد.")
        return await dest_screen(m, state, bot, key)
    await core.put(key, cid)
    if key == "emoji_relay":
        from .. import outgoing
        outgoing.RELAY_CHAT = cid
    await state.clear()
    await m.answer(f"✅ مقصد تنظیم شد: <b>{E(title)}</b>", reply_markup=okb([[ob("🔙 بازگشت", d.get("back", "fx:a"))]]))
