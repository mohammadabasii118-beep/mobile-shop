from aiogram import Bot, F, Router
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

from .. import db, gate
from ..keyboards import back, btn, kb, main_menu
from ..texts import fmt_date, money
from ..utils import is_admin, parse_ref, show

router = Router()


class GiftSt(StatesGroup):
    code = State()


class SupportSt(StatesGroup):
    msg = State()


async def menu_text() -> str:
    text = await db.get_setting("welcome_text")
    ann = await db.get_setting("announce_text")
    return text + (f"\n\n📢 {ann}" if ann else "")


@router.message(CommandStart())
async def start(m: Message, state: FSMContext):
    await state.clear()
    await db.ensure_user(m.from_user.id, m.from_user.full_name, m.from_user.username, parse_ref(m.text))
    await m.answer(await menu_text(), reply_markup=main_menu(is_admin(m.from_user.id)))


@router.callback_query(F.data == "chk")
async def check_join(c: CallbackQuery, bot: Bot):
    gate.invalidate(c.from_user.id)
    if not is_admin(c.from_user.id) and await gate.missing(bot, c.from_user.id):
        return await c.answer("هنوز عضو همه کانال‌ها نشدی ❗️", show_alert=True)
    await c.answer("✅ تأیید شد")
    await show(c, await menu_text(), main_menu(is_admin(c.from_user.id)))


@router.callback_query(F.data == "menu")
async def menu(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show(c, await menu_text(), main_menu(is_admin(c.from_user.id)))
    await c.answer()


# ---- profile -----------------------------------------------------------
@router.callback_query(F.data == "profile")
async def profile(c: CallbackQuery):
    u = await db.get_user(c.from_user.id)
    count = await db.counted_ads(u["id"])
    total = await db.scalar("SELECT COUNT(*) FROM ads WHERE user_id=?", u["id"])
    invited = await db.scalar("SELECT COUNT(*) FROM users WHERE referrer_id=? AND ref_rewarded=1", u["id"])
    cur, nxt = await db.badge_for(count)
    badge = f"{cur['emoji']} {cur['name']}" if cur else "— (هنوز نشانی نداری)"
    left = f"{nxt['min_ads'] - count} آگهی تا {nxt['emoji']} {nxt['name']}" if nxt else "🏁 به بالاترین نشان رسیدی"
    uname = f"@{u['username']}" if u["username"] else "—"
    text = (
        "👤 <b>مشخصات من</b>\n━━━━━━━━━━━━━━\n"
        f"🙍 نام: {u['name']}\n🆔 آیدی تلگرام: {uname}\n🔢 شناسه: <code>{u['id']}</code>\n"
        f"📅 عضویت: {fmt_date(u['joined_at'])}\n💰 موجودی: <b>{money(u['balance'])}</b>\n"
        f"📝 آگهی‌های ثبت‌شده: {total}\n✅ آگهی‌های معتبر: {count}\n"
        f"👥 دعوت‌های موفق: {invited}\n🏅 نشان فعلی: {badge}\n🎯 تا نشان بعدی: {left}"
    )
    await show(c, text, kb([[btn("💰 افزایش موجودی", "wallet"), btn("🏅 نشان‌ها", "badges")], back()]))
    await c.answer()


# ---- badges ------------------------------------------------------------
@router.callback_query(F.data == "badges")
async def badges(c: CallbackQuery):
    count = await db.counted_ads(c.from_user.id)
    cur, _ = await db.badge_for(count)
    lines = []
    for b in await db.fetchall("SELECT * FROM badges ORDER BY min_ads"):
        mark = "✅" if count >= b["min_ads"] else "🔒"
        lines.append(f"{mark} {b['emoji']} <b>{b['name']}</b> — ثبت {b['min_ads']} آگهی معتبر")
    text = (
        "🏅 <b>نشان‌های افتخار</b>\n━━━━━━━━━━━━━━\n" + "\n".join(lines) +
        f"\n\n📊 آگهی‌های معتبر تو: <b>{count}</b>\n"
        "ℹ️ فقط آگهی‌های تأییدشده و غیرتکراری حساب می‌شن؛ ویرایش و تمدید چیزی اضافه نمی‌کنه."
    )
    await show(c, text, kb([back()]))
    await c.answer()


# ---- invite ------------------------------------------------------------
@router.callback_query(F.data == "invite")
async def invite(c: CallbackQuery, bot: Bot):
    me = await bot.get_me()
    uid = c.from_user.id
    joined = await db.scalar("SELECT COUNT(*) FROM users WHERE referrer_id=?", uid)
    done = await db.scalar("SELECT COUNT(*) FROM users WHERE referrer_id=? AND ref_rewarded=1", uid)
    earned = await db.scalar("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE user_id=? AND type='referral'", uid)
    reward = await db.get_int("referral_reward")
    text = (
        "👥 <b>دعوت دوستان</b>\n━━━━━━━━━━━━━━\n"
        f"🔗 لینک اختصاصی تو:\n<code>https://t.me/{me.username}?start=ref_{uid}</code>\n\n"
        f"👤 دعوت‌شده‌ها: {joined}\n✅ دعوت‌های موفق: {done}\n💰 مجموع پاداش: <b>{money(earned)}</b>\n\n"
        f"🎁 به‌ازای هر دعوت موفق <b>{money(reward)}</b> اعتبار می‌گیری. دعوت وقتی موفق حساب می‌شه که دوستت "
        "اولین آگهی معتبرش رو ثبت کنه."
    )
    await show(c, text, kb([back()]))
    await c.answer()


# ---- gift card ---------------------------------------------------------
@router.callback_query(F.data == "gift")
async def gift(c: CallbackQuery, state: FSMContext):
    await state.set_state(GiftSt.code)
    await show(c, "🎁 <b>کارت هدیه</b>\n\nکد هدیه‌ات رو بفرست:", kb([back()]))
    await c.answer()


@router.message(GiftSt.code, F.text)
async def gift_code(m: Message, state: FSMContext):
    code = m.text.strip().upper()
    g = await db.fetchone("SELECT * FROM gift_codes WHERE code=?", code)
    err = None
    if not g:
        err = "❌ کد نامعتبره."
    elif g["expires_at"] and g["expires_at"] < db.now():
        err = "⌛️ این کد منقضی شده."
    elif g["used"] >= g["max_uses"]:
        err = "😕 ظرفیت استفاده از این کد تموم شده."
    elif await db.fetchone("SELECT 1 FROM gift_uses WHERE code=? AND user_id=?", code, m.from_user.id):
        err = "⚠️ قبلاً از این کد استفاده کردی."
    if not err:
        # Reserve a slot atomically so concurrent redemptions can't exceed max_uses.
        if not await db.execute("UPDATE gift_codes SET used=used+1 WHERE code=? AND used<max_uses", code):
            err = "😕 ظرفیت استفاده از این کد تموم شده."
        else:
            await db.execute("INSERT INTO gift_uses(code,user_id) VALUES(?,?)", code, m.from_user.id)
            await db.credit(m.from_user.id, g["amount"], "gift", code)
    if err:
        await m.answer(err + "\nدوباره امتحان کن یا برگرد.", reply_markup=kb([back()]))
        return
    await state.clear()
    await m.answer(f"🎉 <b>{money(g['amount'])}</b> به کیف پولت اضافه شد.", reply_markup=kb([[btn("👤 مشخصات من", "profile")], back()]))


# ---- support -----------------------------------------------------------
@router.callback_query(F.data == "support")
async def support(c: CallbackQuery):
    rows = [
        [btn("💳 مشکل پرداخت", "sup:pay"), btn("📝 سؤال درباره آگهی", "sup:ad")],
        [btn("💬 سایر موارد", "sup:other")],
        back(),
    ]
    text = "☎️ <b>ارتباط با ما</b>\n\nموضوع پیامت رو انتخاب کن:"
    uname = await db.get_setting("support_username")
    if uname:
        text += f"\n\n👨‍💻 پشتیبانی: @{uname.lstrip('@')}"
    await show(c, text, kb(rows))
    await c.answer()


@router.callback_query(F.data.startswith("sup:"))
async def support_cat(c: CallbackQuery, state: FSMContext):
    cat = {"pay": "مشکل پرداخت", "ad": "سؤال درباره آگهی", "other": "سایر موارد"}[c.data[4:]]
    await state.set_state(SupportSt.msg)
    await state.update_data(cat=cat)
    await show(c, f"✍️ پیامت رو برای «{cat}» بنویس و بفرست:", kb([back("support")]))
    await c.answer()


@router.message(SupportSt.msg)
async def support_msg(m: Message, state: FSMContext, bot: Bot):
    cat = (await state.get_data()).get("cat", "")
    await state.clear()
    u = m.from_user
    uname = f"@{u.username}" if u.username else "—"
    head = f"📨 <b>پیام پشتیبانی</b> — {cat}\n👤 {u.full_name} | {uname} | <code>{u.id}</code>\n━━━━━━━━━━━━━━\n"
    markup = kb([[btn("↩️ پاسخ", f"reply:{u.id}")]])
    from .. import admins
    for aid in admins.all_ids():
        try:
            if m.text:
                await bot.send_message(aid, head + m.html_text, reply_markup=markup)
            else:
                await bot.send_message(aid, head + "(پیوست)", reply_markup=markup)
                await m.copy_to(aid)
        except Exception:
            pass
    await m.answer("✅ پیامت برای پشتیبانی ارسال شد. به‌زودی جواب می‌گیری.", reply_markup=main_menu(is_admin(u.id)))
