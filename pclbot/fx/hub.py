"""Admin hub (`fx:a`) for the extra features + router list + background tasks + stale-callback fallback."""
import asyncio

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import appgfx, blacklist, core, draft, hwg, quiz, streamers, subs, themes_ui, xi
from .core import E
from .states import DestSt, TestSt

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
                  "یک پست از گروه فوروارد کن یا آیدی عددی (مثل -100…) بفرست:", okb([[ob("🧪 تست داخل ربات", "fx:aet")], [ob("✉️ پیام تست خودم", "fx:aem")], [ob("🗑 غیرفعال کردن", "fx:ar0")], [ob("❌ لغو", PANEL)]]))
    await c.answer()


async def _all_dests() -> list[str]:
    out: list[str] = []
    for k in ("plus_chat", "hwg_chat", "gfx_chat"):
        for ch in await core.dests(k):
            if ch not in out:
                out.append(ch)
    return out


@router.callback_query(F.data == "fx:aet")
async def test_pick(c: CallbackQuery, state: FSMContext, bot: Bot):
    await state.clear()
    from .. import emojis
    if not emojis.enabled or not emojis._ids:
        return await c.answer("اول در «✨ ایموجی‌ها» یک ایموجی پریمیوم ست و سیستم را روشن کن.", show_alert=True)
    chats = await _all_dests()
    rows = []
    for i, ch in enumerate(chats):
        try:
            rows.append([ob(f"📣 {(await bot.get_chat(ch)).title or ch}"[:50], f"fx:aet:{i}")])
        except Exception:
            rows.append([ob(f"📣 {ch}"[:50], f"fx:aet:{i}")])
    await show(c, "🧪 <b>تست ایموجی پریمیوم داخل ربات</b>\n\nکانالی را که می‌خواهی تست شود انتخاب کن (از مقصدهایی که برای بخش‌ها گذاشته‌ای). "
                  "ربات سه حالت را امتحان می‌کند و نتیجه را می‌گوید؛ پست‌های تست خودکار پاک می‌شوند." + ("" if chats else "\n\nهنوز مقصدی تنظیم نشده."),
               okb(rows + [[ob("🔙 بازگشت", "fx:ar")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:aet:\d+$"))
async def test_run(c: CallbackQuery, bot: Bot):
    from .. import emojis, outgoing
    chats = await _all_dests()
    i = int(c.data.split(":")[2])
    relay = outgoing.RELAY_CHAT
    if i >= len(chats):
        return await c.answer("فهرست قدیمی شده.", show_alert=True)
    if not relay:
        return await c.answer("اول گروه واسط را تنظیم کن.", show_alert=True)
    chan = chats[i]
    emo = next(iter(emojis._ids))
    text = f"تست ایموجی پریمیوم {emo}"
    await c.answer("⏳ در حال تست…")
    saved, outgoing.RELAY_CHAT = outgoing.RELAY_CHAT, None            # test each step exactly, without the automatic relay interfering
    lines, cleanup = [], []

    def has(m) -> bool:
        return any(e.type == "custom_emoji" for e in (m.entities or []) + (m.caption_entities or []))

    try:
        try:
            g = await bot.send_message(relay, text)
            cleanup.append((relay, g.message_id))
            lines.append(f"{'✅' if has(g) else '❌'} ارسال به گروه واسط: ایموجی {'پریمیوم ماند' if has(g) else 'معمولی شد'}")
        except Exception as ex:
            return await c.message.answer(f"❌ ارسال به گروه واسط نشد: {E(str(ex)[:150])}")
        try:
            d = await bot.send_message(chan, text)
            cleanup.append((chan, d.message_id))
            lines.append(f"{'✅' if has(d) else '❌'} ارسال مستقیم به کانال: ایموجی {'پریمیوم ماند' if has(d) else 'معمولی شد'}")
        except Exception as ex:
            lines.append(f"❌ ارسال مستقیم به کانال نشد: {E(str(ex)[:120])}")
        copied_ok = None
        try:
            cp = await bot.copy_message(chan, relay, g.message_id)
            cleanup.append((chan, cp.message_id))
            back = await bot.forward_message(relay, chan, cp.message_id)           # read back what the channel really stored
            cleanup.append((relay, back.message_id))
            copied_ok = has(back)
            lines.append(f"{'✅' if copied_ok else '❌'} کپی از گروه واسط به کانال (copyMessage): ایموجی {'پریمیوم ماند' if copied_ok else 'معمولی شد'}")
        except Exception as ex:
            lines.append(f"❌ copyMessage انجام نشد: {E(str(ex)[:120])}")
    finally:
        outgoing.RELAY_CHAT = saved
        for chat, mid in cleanup:
            try:
                await bot.delete_message(chat, mid)
            except Exception:
                pass
    verdict = ("✅ گروه واسط کار می‌کند؛ پست‌های کانال با ایموجی پریمیوم می‌روند." if copied_ok else
               "⚠️ copyMessage هم ایموجی پریمیوم را نگه نداشت؛ از این راه نمی‌شود." if copied_ok is False else "⚠️ تست کامل نشد.")
    await c.message.answer("🧪 <b>نتیجه‌ی تست</b>\n\n" + "\n".join(lines) + f"\n\n{verdict}", reply_markup=okb([[ob("🔁 دوباره", "fx:aet")], [ob("🔙 بازگشت", "fx:ar")]]))


@router.callback_query(F.data == "fx:aem")
async def own_pick(c: CallbackQuery, state: FSMContext, bot: Bot):
    await state.clear()
    chats = await _all_dests()
    rows = []
    for i, ch in enumerate(chats):
        try:
            rows.append([ob(f"📣 {(await bot.get_chat(ch)).title or ch}"[:50], f"fx:aem:{i}")])
        except Exception:
            rows.append([ob(f"📣 {ch}"[:50], f"fx:aem:{i}")])
    await show(c, "✉️ <b>پیام تست خودم</b>\n\nکانال را انتخاب کن؛ بعد خودت پیام را (با ایموجی‌های پریمیومی که می‌خواهی) بفرست تا همان‌طور که هست در آن کانال گذاشته شود."
                  + ("" if chats else "\n\nهنوز مقصدی تنظیم نشده."), okb(rows + [[ob("🔙 بازگشت", "fx:ar")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:aem:\d+$"))
async def own_ask(c: CallbackQuery, state: FSMContext):
    chats = await _all_dests()
    i = int(c.data.split(":")[2])
    if i >= len(chats):
        return await c.answer("فهرست قدیمی شده.", show_alert=True)
    await state.set_state(TestSt.msg)
    await state.update_data(chan=chats[i])
    await show(c, "✉️ پیام تست را بفرست (متن با ایموجی پریمیوم؛ همین‌طور که می‌فرستی در کانال گذاشته می‌شود):", okb([[ob("❌ لغو", "fx:aem")]]))
    await c.answer()


@router.message(TestSt.msg, F.text)
async def own_send(m: Message, state: FSMContext, bot: Bot):
    from .. import outgoing
    chan = (await state.get_data())["chan"]
    await state.clear()
    asked = [e for e in (m.entities or []) if e.type == "custom_emoji"]
    try:
        res = await bot.send_message(chan, m.text, entities=m.entities, parse_mode=None)
    except Exception as ex:
        return await m.answer(f"❌ ارسال نشد: {E(str(ex)[:150])}")
    kept = any(e.type == "custom_emoji" for e in (res.entities or []))
    relayed = bool(asked) and not kept and bool(outgoing.RELAY_CHAT)
    note = ("ℹ️ پیامت ایموجی پریمیوم نداشت (فقط ایموجی‌های پریمیوم واقعی را بفرست)." if not asked else
            "✅ ایموجی پریمیوم همان‌طور که هست در کانال ماند." if kept else
            "🔁 تلگرام ایموجی را حذف کرده بود؛ ربات از گروه واسط کپی کرد (اگر ایموجی در کانال پریمیوم است، گروه واسط کار می‌کند)." if relayed else
            "❌ تلگرام ایموجی پریمیوم را از پست کانال حذف کرد و گروه واسط تنظیم نیست.")
    await m.answer(f"✉️ پیام تست در کانال گذاشته شد.\n{note}", reply_markup=okb([[ob("✉️ پیام تست دیگر", "fx:aem")], [ob("🔙 بازگشت", "fx:ar")]]))


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
