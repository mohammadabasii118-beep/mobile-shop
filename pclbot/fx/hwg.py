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


async def post(bot: Bot, t: dict, chat: str) -> None:
    outgoing.EXEMPT_CHATS.discard(str(chat))                      # Premium emoji stay Premium in the channel
    await bot.send_photo(chat, BufferedInputFile(await card(t), "here_we_go.png"), caption=caption(t))


async def poll_once(bot: Bot) -> int:
    """One polling round; returns how many transfers were posted."""
    if await core.get("hwg_on") != "1":
        return 0
    chat = await core.get("hwg_chat")
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
        if chat:
            try:
                await post(bot, t, chat)
            except TelegramAPIError as ex:
                log.warning("HWG post failed: %s", ex)
                break                              # keep it unseen → retried next round
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
    if not on and not await core.get("hwg_chat"):
        return await c.answer("اول کانال انتشار را تعیین کن.", show_alert=True)
    await core.put("hwg_on", "0" if on else "1")
    await _panel(c, bot)
    await c.answer("ذخیره شد")


@router.callback_query(F.data == "fx:hw:d")
async def dest(c: CallbackQuery, state: FSMContext):
    await state.set_state(DestSt.pick)
    await state.update_data(key="hwg_chat", back="fx:hw")
    await show(c, "📍 کانال انتشار را تعیین کن: یک پست از آن کانال <b>فوروارد</b> کن یا @username / آیدی عددی بفرست.\n"
                  "ربات باید ادمین کانال با دسترسی ارسال پیام باشد.", okb([[ob("❌ لغو", "fx:hw")]]))
    await c.answer()


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


# one handler for every "pick a destination chat" flow (plus_chat / hwg_chat / gfx_chat)
@router.message(DestSt.pick)
async def dest_got(m: Message, state: FSMContext, bot: Bot):
    d = await state.get_data()
    try:
        cid, title = await core.resolve_chat(bot, m)
    except ValueError as ex:
        return await m.answer(f"⚠️ {ex}")
    await core.put(d["key"], cid)
    await state.clear()
    await m.answer(f"✅ مقصد تنظیم شد: <b>{E(title)}</b>", reply_markup=okb([[ob("🔙 بازگشت", d.get("back", "fx:a"))]]))
