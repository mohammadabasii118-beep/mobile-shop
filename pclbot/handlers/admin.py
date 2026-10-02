import asyncio
import secrets

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

import html

from .. import admins, buttons, db, emojis, gate, messages, services
from ..keyboards import back, btn, kb, pairs
from ..texts import STATUS_TITLE, TX_TITLE, fmt_date, money, render_ad

L = "━━━━━━━━━━━━━━"
from ..utils import is_admin, show

router = Router()
router.message.filter(lambda m: is_admin(m.from_user.id))
router.callback_query.filter(lambda c: is_admin(c.from_user.id))

PANEL = "adm"

# setting key -> (title, numeric)
SETTINGS = {
    "price_normal": ("💰 تعرفه ثبت آگهی عادی (تومان)", True),
    "price_special": ("⭐️ تعرفه ثبت آگهی ویژه (تومان)", True),
    "renew_normal": ("🔁 تعرفه تمدید عادی (تومان)", True),
    "renew_special": ("🔁 تعرفه تمدید ویژه (تومان)", True),
    "upgrade_price": ("⬆️ تعرفه ارتقا به ویژه (تومان)", True),
    "days_normal": ("⏳ مدت اعتبار عادی (روز)", True),
    "days_special": ("⏳ مدت اعتبار ویژه (روز)", True),
    "min_topup": ("💳 حداقل شارژ (تومان)", True),
    "referral_reward": ("🎁 پاداش دعوت موفق (تومان)", True),
    "welcome_text": ("👋 متن خوشامدگویی (HTML مجاز)", False),
    "announce_text": ("📢 متن اطلاع‌رسانی منو (خالی = حذف)", False),
    "support_username": ("☎️ آیدی پشتیبانی (بدون @)", False),
}


class AdminSt(StatesGroup):
    setting = State()
    publish = State()
    broadcast = State()
    reply = State()
    reject = State()
    user = State()
    balance = State()
    gift = State()
    badge = State()
    admin_add = State()
    channel = State()
    emoji_new = State()
    emoji_set = State()
    emoji_id = State()
    btn_text = State()
    btn_emoji = State()
    msg_text = State()


def panel_menu(uid: int):
    items = [
        btn("📊 آمار", "adm:stats"), btn("👥 کاربران", "adm:users"),
        btn("📋 آگهی‌ها", "adm:ads"), btn("💵 تراکنش‌ها", "adm:tx"),
        btn("⚙️ تعرفه و تنظیمات", "adm:set"), btn("🎁 کارت‌های هدیه", "adm:gifts"),
        btn("🏅 نشان‌ها", "adm:badges"), btn("📡 گروه انتشار", "adm:pub"),
        btn("📣 پیام همگانی", "adm:bc"), btn("📢 جوین اجباری", "adm:ch"),
        btn("✨ ایموجی‌ها", "adm:emo"), btn("🔤 ویرایش دکمه‌ها", "adm:bt"), btn("✉️ ویرایش پیام‌ها", "adm:ms"),
    ]
    if admins.is_super(uid):
        items.append(btn("👮 مدیران", "adm:admins"))
    return kb(pairs(items) + [back("menu", "🔙 منوی اصلی")])


@router.message(Command("admin"))
async def admin_cmd(m: Message, state: FSMContext):
    await state.clear()
    await m.answer("🛠 <b>پنل مدیریت</b>", reply_markup=panel_menu(m.from_user.id))


@router.callback_query(F.data == PANEL)
async def panel(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show(c, "🛠 <b>پنل مدیریت</b>", panel_menu(c.from_user.id))
    await c.answer()


# ---- stats -------------------------------------------------------------
@router.callback_query(F.data == "adm:stats")
async def stats(c: CallbackQuery):
    day = db.now() - 86400
    s = {
        "users": await db.scalar("SELECT COUNT(*) FROM users"),
        "new": await db.scalar("SELECT COUNT(*) FROM users WHERE joined_at>?", day),
        "ads": await db.scalar("SELECT COUNT(*) FROM ads"),
        "pending": await db.scalar("SELECT COUNT(*) FROM ads WHERE status='pending'"),
        "approved": await db.scalar("SELECT COUNT(*) FROM ads WHERE status='approved'"),
        "special": await db.scalar("SELECT COUNT(*) FROM ads WHERE special=1"),
        "income": await db.scalar("SELECT COALESCE(-SUM(amount),0) FROM transactions WHERE type IN ('ad','renew','upgrade')"),
        "refunds": await db.scalar("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='refund'"),
        "topup": await db.scalar("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='topup' AND status='done'"),
        "balances": await db.scalar("SELECT COALESCE(SUM(balance),0) FROM users"),
    }
    text = (
        "📊 <b>آمار ربات</b>\n━━━━━━━━━━━━━━\n"
        f"👥 کاربران: {s['users']} (۲۴ ساعت اخیر: {s['new']})\n"
        f"📝 کل آگهی‌ها: {s['ads']} | ⭐️ ویژه: {s['special']}\n"
        f"⏳ در انتظار: {s['pending']} | ✅ فعال: {s['approved']}\n\n"
        f"💰 درآمد خالص آگهی‌ها: <b>{money(s['income'] - s['refunds'])}</b>\n"
        f"💳 مجموع شارژهای موفق: {money(s['topup'])}\n"
        f"👛 مجموع موجودی کاربران: {money(s['balances'])}"
    )
    await show(c, text, kb([back(PANEL)]))
    await c.answer()


# ---- ads moderation ----------------------------------------------------
@router.callback_query(F.data == "adm:ads")
async def ads_menu(c: CallbackQuery):
    n = await db.scalar("SELECT COUNT(*) FROM ads WHERE status='pending'")
    await show(c, "📋 <b>مدیریت آگهی‌ها</b>", kb([
        [btn(f"⏳ در انتظار تأیید ({n})", "adm:al:pending"), btn("✅ فعال", "adm:al:approved")],
        [btn("⌛️ منقضی", "adm:al:expired"), btn("❌ ردشده", "adm:al:rejected")],
        back(PANEL),
    ]))
    await c.answer()


@router.callback_query(F.data.startswith("adm:al:"))
async def ads_list(c: CallbackQuery):
    status = c.data[7:]
    rows = await db.fetchall("SELECT * FROM ads WHERE status=? ORDER BY id DESC LIMIT 30", status)
    if not rows:
        await show(c, "📭 موردی نیست.", kb([back("adm:ads")]))
        return await c.answer()
    btns = [btn(f"{'⭐️' if r['special'] else '•'} #{r['id']} {'🎮' if r['kind'] == 'player' else '🛡'}", f"adm:ad:{r['id']}") for r in rows]
    await show(c, f"{STATUS_TITLE[status]} — یکی رو انتخاب کن:", kb(pairs(btns, 3) + [back("adm:ads")]))
    await c.answer()


@router.callback_query(F.data.startswith("adm:ad:"))
async def ad_view(c: CallbackQuery, bot: Bot, state: FSMContext):
    await state.clear()
    ad = await db.get_ad(int(c.data[7:]))
    if not ad:
        return await c.answer("پیدا نشد.", show_alert=True)
    user = await db.get_user(ad["user_id"])
    rows = []
    if ad["status"] == "pending":
        rows.append([btn("✅ تأیید", f"adm:ok:{ad['id']}"), btn("❌ رد", f"adm:no:{ad['id']}")])
    rows.append([btn("✏️ ویرایش", f"ad:ed:{ad['id']}"), btn("🗑 حذف", f"adm:del:{ad['id']}")])
    rows.append(back("adm:ads"))
    info = f"\n\n📌 {STATUS_TITLE[ad['status']]} | کاربر: {user['name']} (<code>{user['id']}</code>)\n🕒 {fmt_date(ad['created_at'])}"
    if ad["photo"]:
        await c.message.delete()
        await bot.send_photo(c.message.chat.id, ad["photo"], caption=render_ad(ad, user) + info, reply_markup=kb(rows))
    else:
        await show(c, render_ad(ad, user) + info, kb(rows))
    await c.answer()


async def respond(c: CallbackQuery, text: str) -> None:
    """Admin action results may arrive on a photo message, so always send a new message."""
    await c.answer(text, show_alert=False)
    try:
        await c.message.edit_reply_markup(reply_markup=kb([[btn(text, "adm:ads")]]))
    except TelegramAPIError:
        pass


@router.callback_query(F.data.startswith("adm:ok:"))
async def ad_ok(c: CallbackQuery, bot: Bot):
    await respond(c, await services.approve(bot, int(c.data[7:])))


@router.callback_query(F.data.startswith("adm:no:"))
async def ad_no(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.reject)
    await state.update_data(ad_id=int(c.data[7:]))
    await c.message.answer("✍️ دلیل رد رو بنویس (یا - بفرست برای بدون دلیل):", reply_markup=kb([back(PANEL, "🔙 انصراف")]))
    await c.answer()


@router.message(AdminSt.reject, F.text)
async def ad_no_reason(m: Message, state: FSMContext, bot: Bot):
    ad_id = (await state.get_data())["ad_id"]
    await state.clear()
    reason = "" if m.text.strip() == "-" else m.text.strip()
    await m.answer(await services.reject(bot, ad_id, reason), reply_markup=kb([back("adm:ads")]))


@router.callback_query(F.data.startswith("adm:del:"))
async def ad_del(c: CallbackQuery, bot: Bot):
    ad_id = int(c.data[8:])
    await services.delete_ad(bot, ad_id)
    await respond(c, "🗑 حذف شد")


# ---- users -------------------------------------------------------------
@router.callback_query(F.data == "adm:users")
async def users_menu(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.user)
    await show(c, "👥 آیدی عددی یا یوزرنیم کاربر رو بفرست:", kb([back(PANEL)]))
    await c.answer()


async def user_card(uid: int) -> tuple[str, object] | None:
    u = await db.get_user(uid)
    if not u:
        return None
    cnt = await db.counted_ads(uid)
    text = (f"👤 <b>{u['name']}</b> (@{u['username'] or '—'})\n🔢 <code>{uid}</code>\n📅 {fmt_date(u['joined_at'])}\n"
            f"💰 موجودی: {money(u['balance'])}\n✅ آگهی معتبر: {cnt}\n🚫 وضعیت: {'مسدود' if u['banned'] else 'فعال'}")
    markup = kb([
        [btn("➕ افزایش موجودی", f"adm:bal:{uid}:1"), btn("➖ کاهش موجودی", f"adm:bal:{uid}:-1")],
        [btn("✅ رفع مسدودی" if u["banned"] else "🚫 مسدود کردن", f"adm:ban:{uid}"), btn("💬 پیام", f"reply:{uid}")],
        back("adm:users"),
    ])
    return text, markup


@router.message(AdminSt.user, F.text)
async def user_lookup(m: Message, state: FSMContext):
    q = m.text.strip().lstrip("@")
    row = await db.fetchone("SELECT id FROM users WHERE id=? OR username=?", int(q) if q.isdigit() else -1, q)
    card = await user_card(row["id"]) if row else None
    if not card:
        return await m.answer("😕 کاربری پیدا نشد. دوباره بفرست.", reply_markup=kb([back(PANEL)]))
    await state.clear()
    await m.answer(card[0], reply_markup=card[1])


@router.callback_query(F.data.startswith("adm:ban:"))
async def ban(c: CallbackQuery):
    uid = int(c.data[8:])
    await db.execute("UPDATE users SET banned=1-banned WHERE id=?", uid)
    text, markup = await user_card(uid)
    await show(c, text, markup)
    await c.answer("انجام شد")


@router.callback_query(F.data.startswith("adm:bal:"))
async def bal_ask(c: CallbackQuery, state: FSMContext):
    _, _, uid, sign = c.data.split(":")
    await state.set_state(AdminSt.balance)
    await state.update_data(uid=int(uid), sign=int(sign))
    await show(c, "✍️ مبلغ (تومان) رو بفرست:", kb([back(PANEL)]))
    await c.answer()


@router.message(AdminSt.balance, F.text)
async def bal_do(m: Message, state: FSMContext, bot: Bot):
    if not m.text.strip().isdigit():
        return await m.answer("⚠️ فقط عدد بفرست.")
    d = await state.get_data()
    amount = int(m.text.strip())
    await state.clear()
    if d["sign"] > 0:
        await db.credit(d["uid"], amount, "admin", "مدیر")
    elif not await db.charge(d["uid"], amount, "admin", "مدیر"):
        return await m.answer("⚠️ موجودی کاربر کمتر از این مبلغه.", reply_markup=kb([back(PANEL)]))
    await services.notify(bot, d["uid"], f"💰 موجودی کیف پولت توسط مدیر {'افزایش' if d['sign'] > 0 else 'کاهش'} پیدا کرد: {money(amount)}")
    text, markup = await user_card(d["uid"])
    await m.answer("✅ انجام شد.\n\n" + text, reply_markup=markup)


# ---- transactions ------------------------------------------------------
@router.callback_query(F.data == "adm:tx")
async def tx_list(c: CallbackQuery):
    rows = await db.fetchall("SELECT * FROM transactions ORDER BY id DESC LIMIT 20")
    lines = [f"{'➕' if r['amount'] > 0 else '➖'} {money(abs(r['amount']))} | {TX_TITLE.get(r['type'], r['type'])} | "
             f"<code>{r['user_id']}</code> | {fmt_date(r['created_at'])}{'' if r['status'] == 'done' else ' | ' + r['status']}" for r in rows]
    await show(c, "💵 <b>۲۰ تراکنش اخیر</b>\n\n" + ("\n".join(lines) or "📭 خالیه"), kb([back(PANEL)]))
    await c.answer()


# ---- settings ----------------------------------------------------------
@router.callback_query(F.data == "adm:set")
async def settings_menu(c: CallbackQuery):
    btns = [btn(title.split(" (")[0], f"adm:s:{k}") for k, (title, _) in SETTINGS.items()]
    await show(c, "⚙️ <b>تعرفه و تنظیمات</b>\nیکی رو انتخاب کن:", kb(pairs(btns) + [back(PANEL)]))
    await c.answer()


@router.callback_query(F.data.startswith("adm:s:"))
async def setting_ask(c: CallbackQuery, state: FSMContext):
    key = c.data[6:]
    await state.set_state(AdminSt.setting)
    await state.update_data(key=key)
    cur = await db.get_setting(key)
    await show(c, f"{SETTINGS[key][0]}\n\nمقدار فعلی:\n<code>{cur or '—'}</code>\n\nمقدار جدید رو بفرست:", kb([back("adm:set")]))
    await c.answer()


@router.message(AdminSt.setting, F.text)
async def setting_set(m: Message, state: FSMContext):
    key = (await state.get_data())["key"]
    value = m.text.strip()
    if SETTINGS[key][1] and not value.isdigit():
        return await m.answer("⚠️ فقط عدد بفرست.")
    if key == "announce_text" and value == "-":
        value = ""
    await db.set_setting(key, value.lstrip("@") if key == "support_username" else value)
    await state.clear()
    await m.answer("✅ ذخیره شد.", reply_markup=kb([back("adm:set")]))


# ---- publish chat ------------------------------------------------------
@router.callback_query(F.data == "adm:pub")
async def pub_menu(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.publish)
    cur = await db.get_setting("publish_chat") or "تنظیم نشده"
    await show(c, f"📡 <b>گروه/کانال انتشار</b>\nفعلی: <code>{cur}</code>\n\nربات رو در گروه یا کانال ادمین کن (با دسترسی ارسال و حذف پیام) "
                  "و آیدی عددی (مثل <code>-100123…</code>) یا @یوزرنیم رو بفرست:", kb([back(PANEL)]))
    await c.answer()


@router.message(AdminSt.publish, F.text)
async def pub_set(m: Message, state: FSMContext, bot: Bot):
    ref = m.text.strip()
    try:
        chat = await bot.get_chat(int(ref) if ref.lstrip("-").isdigit() else ref)
        test = await bot.send_message(chat.id, "✅ اتصال ربات PCL Transfer برقرار شد.")
        await bot.delete_message(chat.id, test.message_id)
    except TelegramAPIError as ex:
        return await m.answer(f"⚠️ دسترسی ندارم یا آیدی اشتباهه: {ex}")
    await db.set_setting("publish_chat", str(chat.id))
    await state.clear()
    await m.answer(f"✅ آگهی‌ها در «{chat.title}» منتشر می‌شن.", reply_markup=kb([back(PANEL)]))


# ---- gift codes --------------------------------------------------------
@router.callback_query(F.data == "adm:gifts")
async def gifts(c: CallbackQuery, state: FSMContext):
    await state.clear()
    rows = await db.fetchall("SELECT * FROM gift_codes ORDER BY rowid DESC LIMIT 15")
    lines = [f"<code>{r['code']}</code> — {money(r['amount'])} — {r['used']}/{r['max_uses']} — انقضا: {fmt_date(r['expires_at']) if r['expires_at'] else 'ندارد'}" for r in rows]
    await show(c, "🎁 <b>کارت‌های هدیه</b>\n\n" + ("\n".join(lines) or "هنوز کدی نساختی."),
               kb([[btn("➕ ساخت کد جدید", "adm:gnew")], back(PANEL)]))
    await c.answer()


@router.callback_query(F.data == "adm:gnew")
async def gift_new(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.gift)
    await show(c, "✍️ اطلاعات کد رو در یک پیام و با این قالب بفرست:\n\n<code>مبلغ تعداد‌استفاده روز‌اعتبار [کد]</code>\n\n"
                  "مثال: <code>20000 50 30</code> (کد خودکار)\nیا: <code>20000 50 30 PCL2026</code>\nروز اعتبار = 0 یعنی بدون انقضا.", kb([back("adm:gifts")]))
    await c.answer()


@router.message(AdminSt.gift, F.text)
async def gift_create(m: Message, state: FSMContext):
    parts = m.text.split()
    if len(parts) < 3 or not all(p.isdigit() for p in parts[:3]):
        return await m.answer("⚠️ قالب اشتباهه. مثال: <code>20000 50 30</code>")
    amount, uses, days = map(int, parts[:3])
    code = (parts[3] if len(parts) > 3 else "PCL" + secrets.token_hex(3)).upper()
    if await db.fetchone("SELECT 1 FROM gift_codes WHERE code=?", code):
        return await m.answer("⚠️ این کد قبلاً وجود داره.")
    await db.execute("INSERT INTO gift_codes(code,amount,max_uses,expires_at) VALUES(?,?,?,?)",
                     code, amount, uses, db.now() + days * 86400 if days else None)
    await state.clear()
    await m.answer(f"✅ کد ساخته شد:\n<code>{code}</code>\n💰 {money(amount)} | 🔢 {uses} بار", reply_markup=kb([back("adm:gifts")]))


# ---- badges ------------------------------------------------------------
@router.callback_query(F.data == "adm:badges")
async def badges_menu(c: CallbackQuery, state: FSMContext):
    await state.clear()
    rows = await db.fetchall("SELECT * FROM badges ORDER BY min_ads")
    btns = [btn(f"{r['emoji']} {r['name']} ({r['min_ads']})", f"adm:b:{r['id']}") for r in rows]
    await show(c, "🏅 <b>نشان‌های افتخار</b>\nبرای ویرایش یا حذف روی نشان بزن:",
               kb(pairs(btns) + [[btn("➕ نشان جدید", "adm:bnew")], back(PANEL)]))
    await c.answer()


@router.callback_query(F.data == "adm:bnew")
async def badge_new(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.badge)
    await state.update_data(bid=0)
    await show(c, "✍️ با این قالب بفرست:\n<code>ایموجی تعداد_آگهی نام</code>\nمثال: <code>🏆 200 اسطوره</code>", kb([back("adm:badges")]))
    await c.answer()


@router.callback_query(F.data.startswith("adm:b:"))
async def badge_view(c: CallbackQuery):
    b = await db.fetchone("SELECT * FROM badges WHERE id=?", int(c.data[6:]))
    if not b:
        return await c.answer("پیدا نشد", show_alert=True)
    await show(c, f"{b['emoji']} <b>{b['name']}</b>\nتعداد آگهی موردنیاز: {b['min_ads']}", kb([
        [btn("✏️ ویرایش", f"adm:be:{b['id']}"), btn("🗑 حذف", f"adm:bd:{b['id']}")], back("adm:badges")]))
    await c.answer()


@router.callback_query(F.data.startswith("adm:be:"))
async def badge_edit(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.badge)
    await state.update_data(bid=int(c.data[7:]))
    await show(c, "✍️ با این قالب بفرست:\n<code>ایموجی تعداد_آگهی نام</code>\nمثال: <code>🥉 5 برنزی</code>", kb([back("adm:badges")]))
    await c.answer()


@router.callback_query(F.data.startswith("adm:bd:"))
async def badge_del(c: CallbackQuery):
    await db.execute("DELETE FROM badges WHERE id=?", int(c.data[7:]))
    await c.answer("حذف شد")
    await show(c, "🗑 حذف شد.", kb([back("adm:badges")]))


@router.message(AdminSt.badge, F.text)
async def badge_save(m: Message, state: FSMContext):
    parts = m.text.split(maxsplit=2)
    if len(parts) < 3 or not parts[1].isdigit():
        return await m.answer("⚠️ قالب اشتباهه. مثال: <code>🥉 5 برنزی</code>")
    emoji, n, name = parts[0], int(parts[1]), parts[2]
    bid = (await state.get_data())["bid"]
    if bid:
        await db.execute("UPDATE badges SET name=?, emoji=?, min_ads=? WHERE id=?", name, emoji, n, bid)
    else:
        await db.execute("INSERT INTO badges(name,emoji,min_ads) VALUES(?,?,?)", name, emoji, n)
    await state.clear()
    await m.answer("✅ ذخیره شد.", reply_markup=kb([back("adm:badges")]))


# ---- broadcast ---------------------------------------------------------
@router.callback_query(F.data == "adm:bc")
async def bc_ask(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.broadcast)
    await show(c, "📣 پیامی که می‌خوای برای همه کاربران ارسال بشه رو بفرست (متن، عکس و ...):", kb([back(PANEL)]))
    await c.answer()


@router.message(AdminSt.broadcast)
async def bc_send(m: Message, state: FSMContext):
    await state.clear()
    ids = [r["id"] for r in await db.fetchall("SELECT id FROM users WHERE banned=0")]
    status = await m.answer(f"⏳ در حال ارسال به {len(ids)} کاربر...")
    ok = 0
    for uid in ids:
        try:
            await m.copy_to(uid)
            ok += 1
        except TelegramAPIError:
            pass
        await asyncio.sleep(0.05)  # stay under Telegram's broadcast rate limit
    await status.edit_text(f"✅ ارسال شد: {ok} از {len(ids)}", reply_markup=kb([back(PANEL)]))


# ---- admins (super admins only) ---------------------------------------
async def display_name(uid: int) -> str:
    u = await db.get_user(uid)
    return f"{u['name']} ({uid})" if u else str(uid)


async def need_super(c: CallbackQuery) -> bool:
    if admins.is_super(c.from_user.id):
        return True
    await c.answer("فقط مدیر اصلی به این بخش دسترسی دارد.", show_alert=True)
    return False


@router.callback_query(F.data == "adm:admins")
async def admins_menu(c: CallbackQuery, state: FSMContext | None):
    if not await need_super(c):
        return
    if state:
        await state.clear()
    lines, btns = [], []
    for uid in admins.all_ids():
        name = await display_name(uid)
        if admins.is_super(uid):
            lines.append(f"🔒 {name} — مدیر اصلی")
        else:
            lines.append(f"👤 {name}")
            btns.append(btn(f"🗑 {name}"[:40], f"adm:arm:{uid}"))
    await show(c, "👮 <b>مدیران ربات</b>\n" + L + "\n" + "\n".join(lines) +
               "\n\n🔒 مدیران اصلی از فایل تنظیمات خوانده می‌شن و از اینجا حذف نمی‌شن.",
               kb([[btn("➕ افزودن مدیر", "adm:aadd")], *pairs(btns), [btn("🔙 بازگشت", PANEL)]]))
    await c.answer()


@router.callback_query(F.data == "adm:aadd")
async def admin_add_ask(c: CallbackQuery, state: FSMContext):
    if not await need_super(c):
        return
    await state.set_state(AdminSt.admin_add)
    await show(c, "✍️ آیدی عددی مدیر جدید رو بفرست.\n(یا @یوزرنیم، به شرطی که قبلاً ربات رو استارت کرده باشه)",
               kb([back("adm:admins")]))
    await c.answer()


@router.message(AdminSt.admin_add, F.text)
async def admin_add_do(m: Message, state: FSMContext, bot: Bot):
    if not admins.is_super(m.from_user.id):
        return
    q = m.text.strip().lstrip("@")
    uid = int(q) if q.lstrip("-").isdigit() else None
    if uid is None:
        row = await db.fetchone("SELECT id FROM users WHERE username=?", q)
        uid = row["id"] if row else None
    if not uid or uid <= 0:
        return await m.answer("😕 کاربری پیدا نشد. آیدی عددی بفرست یا از کاربر بخواه ربات رو استارت کنه.",
                              reply_markup=kb([back("adm:admins")]))
    await state.clear()
    if admins.is_admin(uid):
        return await m.answer("ℹ️ این کاربر از قبل مدیره.", reply_markup=kb([back("adm:admins")]))
    await admins.add(uid, m.from_user.id)
    await services.sync_admin_commands(bot, uid, True)
    await services.notify(bot, uid, "🛠 شما به‌عنوان مدیر ربات اضافه شدید. برای ورود به پنل /admin رو بزنید.")
    await m.answer(f"✅ {await display_name(uid)} به مدیران اضافه شد.", reply_markup=kb([back("adm:admins")]))


@router.callback_query(F.data.startswith("adm:arm:"))
async def admin_rm_ask(c: CallbackQuery):
    if not await need_super(c):
        return
    uid = int(c.data[8:])
    await show(c, f"🗑 {await display_name(uid)} از مدیران حذف بشه؟",
               kb([[btn("✅ بله، حذف کن", f"adm:ard:{uid}"), btn("🔙 نه", "adm:admins")]]))
    await c.answer()


@router.callback_query(F.data.startswith("adm:ard:"))
async def admin_rm_do(c: CallbackQuery, bot: Bot):
    if not await need_super(c):
        return
    uid = int(c.data[8:])
    if not await admins.remove(uid):
        return await c.answer("مدیر اصلی قابل حذف نیست.", show_alert=True)
    await services.sync_admin_commands(bot, uid, False)
    await services.notify(bot, uid, "ℹ️ دسترسی مدیریت شما برداشته شد.")
    await c.answer("حذف شد")
    await admins_menu(c, None)


# ---- forced join channels ----------------------------------------------
@router.callback_query(F.data == "adm:ch")
async def channels_menu(c: CallbackQuery, state: FSMContext):
    await state.clear()
    rows = await db.fetchall("SELECT * FROM channels ORDER BY id")
    lines = [f"📢 {r['title']} — {r['link']}" for r in rows]
    btns = [btn(f"🗑 {r['title']}"[:40], f"adm:chd:{r['id']}") for r in rows]
    await show(c, "📢 <b>جوین اجباری</b>\n" + L + "\n" + ("\n".join(lines) or "هیچ کانالی تنظیم نشده؛ ربات بدون عضویت اجباری کار می‌کنه.") +
               "\n\nربات باید در کانال یا گروه <b>ادمین</b> باشه تا بتونه عضویت رو چک کنه. مدیران از این شرط معافن.",
               kb([[btn("➕ افزودن کانال", "adm:chadd")], *pairs(btns), [btn("🔙 بازگشت", PANEL)]]))
    await c.answer()


@router.callback_query(F.data == "adm:chadd")
async def channel_add_ask(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.channel)
    await show(c, "✍️ یکی از این قالب‌ها رو بفرست:\n\n"
                  "• کانال عمومی: <code>@ProClubs_Transfer</code>\n"
                  "• کانال خصوصی: <code>-1001234567890 https://t.me/+لینک_دعوت</code>",
               kb([back("adm:ch")]))
    await c.answer()


@router.message(AdminSt.channel, F.text)
async def channel_add_do(m: Message, state: FSMContext, bot: Bot):
    parts = m.text.split()
    ref = parts[0]
    try:
        chat = await bot.get_chat(int(ref) if ref.lstrip("-").isdigit() else ref)
        me = await bot.get_chat_member(chat.id, bot.id)
    except TelegramAPIError as ex:
        return await m.answer(f"⚠️ کانال پیدا نشد یا ربات داخلش نیست: {ex}", reply_markup=kb([back("adm:ch")]))
    if me.status not in ("administrator", "creator"):
        return await m.answer("⚠️ اول ربات رو در این کانال ادمین کن، بعد دوباره بفرست.", reply_markup=kb([back("adm:ch")]))
    link = parts[1] if len(parts) > 1 else (f"https://t.me/{chat.username}" if chat.username else None)
    if not link:
        try:
            link = await bot.export_chat_invite_link(chat.id)
        except TelegramAPIError:
            return await m.answer("⚠️ این کانال خصوصیه؛ لینک دعوتش رو بعد از آیدی بفرست.", reply_markup=kb([back("adm:ch")]))
    if not link.startswith("https://"):
        return await m.answer("⚠️ لینک باید با https:// شروع بشه.", reply_markup=kb([back("adm:ch")]))
    if await db.fetchone("SELECT 1 FROM channels WHERE chat=?", str(chat.id)):
        return await m.answer("ℹ️ این کانال قبلاً اضافه شده.", reply_markup=kb([back("adm:ch")]))
    await db.execute("INSERT INTO channels(chat,title,link) VALUES(?,?,?)", str(chat.id), chat.title or ref, link)
    await state.clear()
    await m.answer(f"✅ «{chat.title}» به جوین اجباری اضافه شد.", reply_markup=kb([back("adm:ch")]))


@router.callback_query(F.data.startswith("adm:chd:"))
async def channel_del(c: CallbackQuery, state: FSMContext):
    await db.execute("DELETE FROM channels WHERE id=?", int(c.data[8:]))
    gate._ok.clear()
    await c.answer("حذف شد")
    await channels_menu(c, state)


# ---- premium / custom emoji --------------------------------------------------------------------------
EMO_PAGE = 12


def custom_emoji_ids(m: Message) -> list[tuple[str, str]]:
    """(fallback emoji, custom_emoji_id) pairs found in a message: custom emoji in the text, or an emoji sticker."""
    found: list[tuple[str, str]] = []
    for e in (m.entities or []) + (m.caption_entities or []):
        if e.type == "custom_emoji" and e.custom_emoji_id:
            source = m.text or m.caption or ""
            # offsets are UTF-16 code units
            raw = source.encode("utf-16-le")
            found.append((raw[e.offset * 2:(e.offset + e.length) * 2].decode("utf-16-le"), e.custom_emoji_id))
    if m.sticker and m.sticker.custom_emoji_id:
        found.append((m.sticker.emoji or "❓", m.sticker.custom_emoji_id))
    return found


@router.callback_query(F.data.regexp(r"^adm:emo(:\d+)?$"))
async def emoji_menu(c: CallbackQuery, state: FSMContext | None = None):
    if state:
        await state.clear()
    part = c.data.split(":")
    page = int(part[2]) if len(part) > 2 and part[2].isdigit() else 0
    slots = emojis.all_slots()
    pages = (len(slots) + EMO_PAGE - 1) // EMO_PAGE
    page = max(0, min(page, pages - 1))
    chunk = slots[page * EMO_PAGE:(page + 1) * EMO_PAGE]
    btns = [btn(("✅ " if emojis.id_of(e) else "⬜️ ") + f"{e} {label}"[:28], f"adm:emoset:{emojis.base(e)}") for e, label in chunk]
    nav = []
    if page > 0:
        nav.append(btn("◀️ قبلی", f"adm:emo:{page - 1}"))
    nav.append(btn(f"{page + 1}/{pages}", f"adm:emo:{page}"))
    if page < pages - 1:
        nav.append(btn("بعدی ▶️", f"adm:emo:{page + 1}"))
    text = (f"✨ <b>ایموجی‌های پرمیوم</b>\n{L}\nوضعیت: {'🟢 روشن' if emojis.enabled else '🔴 خاموش'}\n"
            f"تنظیم‌شده: {emojis.configured_count()} از {len(slots)}\n\n"
            "روی هر مورد بزن و ایموجی پرمیوم (یا استیکر ایموجی) رو بفرست. همون ایموجی توی همه پیام‌ها، آگهی‌ها و آیکون دکمه‌ها "
            "عوض می‌شه. تغییرها فوراً اعمال می‌شن.")
    await show(c, text, kb([
        [btn("🔴 خاموش کردن" if emojis.enabled else "🟢 روشن کردن", "adm:emotoggle")],
        [btn("👁 پیش‌نمایش", "adm:emopv"), btn("➕ افزودن ایموجی", "adm:emoadd")],
        *pairs(btns), nav,
        [btn("🔎 فقط گرفتن ID", "adm:eid"), btn("🧹 بازنشانی همه", "adm:emoresetall")],
        [btn("🔙 بازگشت", PANEL)],
    ]))
    await c.answer()


@router.callback_query(F.data == "adm:emotoggle")
async def emoji_toggle(c: CallbackQuery):
    await emojis.set_enabled(not emojis.enabled)
    await c.answer("روشن شد" if emojis.enabled else "خاموش شد")
    await emoji_menu(c)


@router.callback_query(F.data == "adm:emoresetall")
async def emoji_reset_all_ask(c: CallbackQuery):
    await show(c, "🧹 همه ایموجی‌های پرمیوم برگردن به ایموجی معمولی؟",
               kb([[btn("✅ بله", "adm:emoresetok"), btn("🔙 نه", "adm:emo")]]))
    await c.answer()


@router.callback_query(F.data == "adm:emoresetok")
async def emoji_reset_all(c: CallbackQuery):
    await emojis.reset()
    await c.answer("انجام شد")
    await emoji_menu(c)


@router.callback_query(F.data.startswith("adm:emoset:"))
async def emoji_slot(c: CallbackQuery, state: FSMContext):
    ch = c.data[len("adm:emoset:"):]
    await state.set_state(AdminSt.emoji_set)
    await state.update_data(ch=ch)
    cur = emojis.id_of(ch)
    label = dict(emojis.all_slots()).get(ch, "")
    rows = [[btn("🧹 برگرداندن به معمولی", f"adm:emoreset:{ch}")]] if cur else []
    await show(c, f"{ch} <b>{label}</b>\nایموجی فعلی: " + (f"پرمیوم ✅ <code>{cur}</code>" if cur else f"معمولی ({ch})") +
               "\n\n✍️ ایموجی پرمیوم جدید رو بفرست (یا یک استیکر ایموجی).", kb([*rows, [btn("🔙 بازگشت", "adm:emo")]]))
    await c.answer()


@router.message(AdminSt.emoji_set)
async def emoji_slot_save(m: Message, state: FSMContext):
    found = custom_emoji_ids(m)
    if not found:
        return await m.answer("😕 ایموجی سفارشی (Custom Emoji) پیدا نشد. یک ایموجی پرمیوم یا استیکر ایموجی بفرست.",
                              reply_markup=kb([[btn("🔙 بازگشت", "adm:emo")]]))
    ch = (await state.get_data())["ch"]
    await state.clear()
    await emojis.set_id(ch, found[0][1])
    await m.answer(f"✅ ایموجی {ch} ذخیره شد.\n<code>{found[0][1]}</code>\n\nپیام‌های جدید همین الان با آن ارسال می‌شن.",
                   reply_markup=kb([[btn("➡️ بقیه موردها", "adm:emo")], [btn("👁 پیش‌نمایش", "adm:emopv")]]))


@router.callback_query(F.data.startswith("adm:emoreset:"))
async def emoji_reset_one(c: CallbackQuery, state: FSMContext):
    await emojis.reset(c.data[len("adm:emoreset:"):])
    await c.answer("برگشت به معمولی")
    await emoji_menu(c, state)


@router.callback_query(F.data == "adm:emoadd")
async def emoji_add_ask(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.emoji_new)
    await show(c, "➕ <b>افزودن ایموجی</b>\n\nمرحله ۱: همون ایموجی <b>معمولی</b> که می‌خوای عوض بشه رو بفرست (مثلاً 🔥).",
               kb([[btn("🔙 بازگشت", "adm:emo")]]))
    await c.answer()


@router.message(AdminSt.emoji_new, F.text)
async def emoji_add_char(m: Message, state: FSMContext):
    mo = emojis.EMOJI_RX.search(m.text)
    if not mo:
        return await m.answer("😕 ایموجی معمولی پیدا نشد. فقط یک ایموجی بفرست.", reply_markup=kb([[btn("🔙 بازگشت", "adm:emo")]]))
    ch = emojis.base(mo.group(0))
    await state.set_state(AdminSt.emoji_set)
    await state.update_data(ch=ch)
    await m.answer(f"مرحله ۲: ایموجی پرمیوم جایگزین {ch} رو بفرست (یا استیکر ایموجی).", reply_markup=kb([[btn("🔙 بازگشت", "adm:emo")]]))


@router.callback_query(F.data == "adm:eid")
async def emoji_id_ask(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.emoji_id)
    await show(c, "🔎 یک ایموجی پرمیوم یا استیکر ایموجی بفرست تا فقط شناسه‌اش (custom_emoji_id) رو بگیری. چیزی ذخیره نمی‌شه.",
               kb([[btn("🔙 بازگشت", "adm:emo")]]))
    await c.answer()


@router.message(AdminSt.emoji_id)
async def emoji_id_show(m: Message):
    found = custom_emoji_ids(m)
    if not found:
        return await m.answer("😕 ایموجی سفارشی پیدا نشد. یک ایموجی پرمیوم یا استیکر ایموجی بفرست.",
                              reply_markup=kb([[btn("🔙 بازگشت", "adm:emo")]]))
    lines = "\n".join(f"{ch} ← <code>{cid}</code>" for ch, cid in found)
    await m.answer(f"✅ <b>{len(found)} ایموجی پیدا شد</b>\n{L}\n{lines}", reply_markup=kb([[btn("🔎 ایموجی بعدی", "adm:eid")], [btn("🔙 بازگشت", "adm:emo")]]))


@router.callback_query(F.data == "adm:emopv")
async def emoji_preview(c: CallbackQuery, bot: Bot):
    from ..keyboards import main_menu
    from ..texts import render_ad
    ad = {"kind": "player", "special": 1, "user_id": c.from_user.id, "photo": None, "data": {
        "name": "امیرحسین", "psn": "Amir_CAM10", "pos1": "CAM", "pos2": "CM، ST", "history": "Phoenix FC", "honors": "قهرمان لیگ",
        "days": "5", "hours": "21-24", "ping": "45", "stream": "بله", "country": "ایران", "party": "بله", "notes": "نمونه"}}
    await bot.send_message(c.message.chat.id, "👁 <b>پیش‌نمایش با تنظیم فعلی</b>\n\n" + render_ad(ad, {"username": c.from_user.username}))
    await bot.send_message(c.message.chat.id, "👆 منو و دکمه‌ها با آیکون جدید:", reply_markup=main_menu(True))
    await c.answer()


# ---- editable buttons -------------------------------------------------------------------------------
BTN_PAGE = 10


def scoped(scope: str) -> list[int]:
    return [i for i, (_, sc) in enumerate(buttons.REGISTRY) if sc == scope]


@router.callback_query(F.data == "adm:bt")
async def buttons_menu(c: CallbackQuery, state: FSMContext | None = None):
    if state:
        await state.clear()
    n_user, n_admin = len(scoped("user")), len(scoped("admin"))
    changed = sum(1 for o, _ in buttons.REGISTRY if buttons.effective(o)[0:2] != tuple(buttons.split(o)[::-1]) or buttons.effective(o)[2])
    await show(c, f"🔤 <b>ویرایش دکمه‌ها</b>\n{L}\nمتن و ایموجی هر دکمه رو می‌تونی عوض کنی. ایموجی می‌تونه پرمیوم باشه و به‌صورت "
                  f"آیکون کنار متن نمایش داده بشه. تغییرها فوراً اعمال می‌شن.\n\nتغییر داده‌شده: {changed}",
               kb([[btn(f"🧑 دکمه‌های کاربران ({n_user})", "adm:btl:user:0")], [btn(f"🛠 دکمه‌های مدیریت ({n_admin})", "adm:btl:admin:0")],
                   [btn("🧹 بازنشانی همه", "adm:btresetall")], [btn("🔙 بازگشت", PANEL)]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^adm:btl:(user|admin):\d+$"))
async def buttons_list(c: CallbackQuery, state: FSMContext | None = None):
    if state:
        await state.clear()
    _, _, scope, page = c.data.split(":")
    idxs = scoped(scope)
    pages = max(1, (len(idxs) + BTN_PAGE - 1) // BTN_PAGE)
    page = max(0, min(int(page), pages - 1))
    chunk = idxs[page * BTN_PAGE:(page + 1) * BTN_PAGE]
    btns = []
    for i in chunk:
        orig = buttons.REGISTRY[i][0]
        mark = " ✎" if orig in buttons._over else ""
        btns.append(btn(f"{buttons.label_of(orig)}{mark}"[:30], f"adm:bte:{i}"))
    nav = []
    if page > 0:
        nav.append(btn("◀️ قبلی", f"adm:btl:{scope}:{page - 1}"))
    nav.append(btn(f"{page + 1}/{pages}", f"adm:btl:{scope}:{page}"))
    if page < pages - 1:
        nav.append(btn("بعدی ▶️", f"adm:btl:{scope}:{page + 1}"))
    await show(c, f"🔤 <b>{'دکمه‌های کاربران' if scope == 'user' else 'دکمه‌های مدیریت'}</b>\nیکی رو انتخاب کن. ✎ یعنی تغییر داده شده.",
               kb([*pairs(btns), nav, [btn("🔙 بازگشت", "adm:bt")]]))
    await c.answer()


def button_card(i: int) -> tuple[str, object]:
    orig, scope = buttons.REGISTRY[i]
    text, emoji, emoji_id = buttons.effective(orig)
    changed = orig in buttons._over
    body = (f"🔤 <b>دکمه:</b> {buttons.label_of(orig)}\n{L}\nمتن: {html.escape(text)}\nایموجی: {emoji or '—'}"
            f"{' (پرمیوم ✅)' if emoji_id else ''}\nاصلی: {html.escape(orig)}")
    rows = [[btn("✏️ تغییر متن", f"adm:btt:{i}"), btn("😀 تغییر ایموجی", f"adm:btm:{i}")]]
    if changed:
        rows.append([btn("🧹 برگرداندن به پیش‌فرض", f"adm:btr:{i}")])
    rows.append([btn("👁 پیش‌نمایش دکمه", f"adm:btp:{i}")])
    rows.append([btn("🔙 بازگشت", f"adm:btl:{scope}:{scoped(scope).index(i) // BTN_PAGE}")])
    return body, kb(rows)


@router.callback_query(F.data.regexp(r"^adm:bte:\d+$"))
async def button_view(c: CallbackQuery, state: FSMContext):
    await state.clear()
    body, markup = button_card(int(c.data[8:]))
    await show(c, body, markup)
    await c.answer()


@router.callback_query(F.data.regexp(r"^adm:btt:\d+$"))
async def button_text_ask(c: CallbackQuery, state: FSMContext):
    i = int(c.data[8:])
    await state.set_state(AdminSt.btn_text)
    await state.update_data(i=i)
    await show(c, f"✏️ متن جدید دکمه «{buttons.label_of(buttons.REGISTRY[i][0])}» رو بنویس (حداکثر ۴۰ کاراکتر).\n"
                  "اگه اولش ایموجی بذاری، ایموجی دکمه هم عوض می‌شه.", kb([[btn("🔙 بازگشت", f"adm:bte:{i}")]]))
    await c.answer()


@router.message(AdminSt.btn_text, F.text)
async def button_text_save(m: Message, state: FSMContext):
    i = (await state.get_data())["i"]
    emoji, text = buttons.split(m.text.strip())
    if not text or len(text) > 40:
        return await m.answer("⚠️ متن باید بین ۱ تا ۴۰ کاراکتر باشه.", reply_markup=kb([[btn("🔙 بازگشت", f"adm:bte:{i}")]]))
    await state.clear()
    fields = {"text": text}
    if emoji:
        fields.update(emoji=emoji, emoji_id=None)
    await buttons.save(buttons.REGISTRY[i][0], **fields)
    body, markup = button_card(i)
    await m.answer("✅ ذخیره شد.\n\n" + body, reply_markup=markup)


@router.callback_query(F.data.regexp(r"^adm:btm:\d+$"))
async def button_emoji_ask(c: CallbackQuery, state: FSMContext):
    i = int(c.data[8:])
    await state.set_state(AdminSt.btn_emoji)
    await state.update_data(i=i)
    await show(c, f"😀 ایموجی جدید دکمه «{buttons.label_of(buttons.REGISTRY[i][0])}» رو بفرست.\n"
                  "ایموجی پرمیوم یا استیکر ایموجی = آیکون پرمیوم کنار دکمه. ایموجی معمولی = ایموجی ساده.",
               kb([[btn("🔙 بازگشت", f"adm:bte:{i}")]]))
    await c.answer()


@router.message(AdminSt.btn_emoji)
async def button_emoji_save(m: Message, state: FSMContext):
    i = (await state.get_data())["i"]
    found = custom_emoji_ids(m)
    if found:
        fields = {"emoji": emojis.base(found[0][0]), "emoji_id": found[0][1]}
    else:
        mo = emojis.EMOJI_RX.search(m.text or "")
        if not mo:
            return await m.answer("😕 ایموجی پیدا نشد. یک ایموجی (یا ایموجی پرمیوم) بفرست.", reply_markup=kb([[btn("🔙 بازگشت", f"adm:bte:{i}")]]))
        fields = {"emoji": emojis.base(mo.group(0)), "emoji_id": None}
    await state.clear()
    await buttons.save(buttons.REGISTRY[i][0], **fields)
    body, markup = button_card(i)
    await m.answer("✅ ذخیره شد.\n\n" + body, reply_markup=markup)


@router.callback_query(F.data.regexp(r"^adm:btr:\d+$"))
async def button_reset(c: CallbackQuery, state: FSMContext):
    i = int(c.data[8:])
    await buttons.reset(buttons.REGISTRY[i][0])
    await c.answer("برگشت به پیش‌فرض")
    body, markup = button_card(i)
    await show(c, body, markup)


@router.callback_query(F.data.regexp(r"^adm:btp:\d+$"))
async def button_preview(c: CallbackQuery, bot: Bot):
    from aiogram.types import InlineKeyboardButton
    orig = buttons.REGISTRY[int(c.data[8:])][0]
    await bot.send_message(c.message.chat.id, "👆 پیش‌نمایش دکمه (فقط نمایش؛ زدنش کاری نمی‌کنه):",
                           reply_markup=kb([[InlineKeyboardButton(text=orig, callback_data="noop")]]))
    await c.answer()


@router.callback_query(F.data == "noop")
async def noop(c: CallbackQuery):
    await c.answer()


@router.callback_query(F.data == "adm:btresetall")
async def buttons_reset_ask(c: CallbackQuery):
    await show(c, "🧹 متن و ایموجی همه دکمه‌ها برگرده به پیش‌فرض؟", kb([[btn("✅ بله", "adm:btresetok"), btn("🔙 نه", "adm:bt")]]))
    await c.answer()


@router.callback_query(F.data == "adm:btresetok")
async def buttons_reset_all(c: CallbackQuery):
    await buttons.reset()
    await c.answer("انجام شد")
    await buttons_menu(c)


# ---- editable messages ------------------------------------------------------------------------------
@router.callback_query(F.data == "adm:ms")
async def messages_menu(c: CallbackQuery, state: FSMContext | None = None):
    if state:
        await state.clear()
    btns = [btn(f"{label}{' ✎' if messages.is_changed(k) else ''}"[:30], f"adm:mse:{k}") for k, (label, _, _) in messages.DEFAULTS.items()]
    await show(c, f"✉️ <b>ویرایش پیام‌ها</b>\n{L}\nمتن پیام‌هایی که ربات خودکار برای کاربران می‌فرسته رو از اینجا عوض کن. "
                  "✎ یعنی تغییر داده شده. متن خوش‌آمد و اطلاعیه از «⚙️ تعرفه و تنظیمات» عوض می‌شن.",
               kb([*pairs(btns), [btn("🧹 بازنشانی همه", "adm:msresetall")], [btn("🔙 بازگشت", PANEL)]]))
    await c.answer()


def message_card(key: str) -> tuple[str, object]:
    label, _, ph = messages.DEFAULTS[key]
    hints = "\n".join(f"• <code>{{{n}}}</code> = {d}" for n, d in ph.items()) or "• (جای‌نگهدار ندارد)"
    body = f"✉️ <b>{label}</b>\n{L}\n<pre>{html.escape(messages.current(key))}</pre>\nجای‌نگهدارها:\n{hints}"
    rows = [[btn("✏️ ویرایش متن", f"adm:msw:{key}"), btn("👁 پیش‌نمایش", f"adm:msp:{key}")]]
    if messages.is_changed(key):
        rows.append([btn("🧹 برگرداندن به پیش‌فرض", f"adm:msr:{key}")])
    rows.append([btn("🔙 بازگشت", "adm:ms")])
    return body, kb(rows)


def sample_of(key: str, text: str | None = None) -> str:
    ph = messages.DEFAULTS[key][2]
    return messages.render(text or messages.current(key), **{k: messages.SAMPLES.get(k, "x") for k in ph})


@router.callback_query(F.data.regexp(r"^adm:mse:\w+$"))
async def message_view(c: CallbackQuery, state: FSMContext):
    await state.clear()
    key = c.data[8:]
    if key not in messages.DEFAULTS:
        return await c.answer("پیدا نشد", show_alert=True)
    body, markup = message_card(key)
    await show(c, body, markup)
    await c.answer()


@router.callback_query(F.data.regexp(r"^adm:msp:\w+$"))
async def message_preview(c: CallbackQuery, bot: Bot):
    key = c.data[8:]
    await bot.send_message(c.message.chat.id, "👁 <b>پیش‌نمایش</b> (با مقدارهای نمونه):\n\n" + sample_of(key))
    await c.answer()


@router.callback_query(F.data.regexp(r"^adm:msw:\w+$"))
async def message_edit_ask(c: CallbackQuery, state: FSMContext):
    key = c.data[8:]
    await state.set_state(AdminSt.msg_text)
    await state.update_data(key=key)
    ph = " ".join(f"{{{n}}}" for n in messages.DEFAULTS[key][2]) or "—"
    await show(c, f"✍️ متن جدید «{messages.DEFAULTS[key][0]}» رو بفرست.\n\nبرای پررنگ و ایتالیک از خود تلگرام استفاده کن، و ایموجی پرمیوم هم "
                  f"می‌تونی توی متن بذاری.\nجای‌نگهدارهای مجاز: {ph}", kb([[btn("🔙 بازگشت", f"adm:mse:{key}")]]))
    await c.answer()


@router.message(AdminSt.msg_text, F.text)
async def message_edit_save(m: Message, state: FSMContext, bot: Bot):
    key = (await state.get_data())["key"]
    text = m.html_text
    if len(text) > 3000:
        return await m.answer("⚠️ متن خیلی بلنده (حداکثر ۳۰۰۰ کاراکتر).")
    err = messages.check(key, text)
    if err:
        return await m.answer("⚠️ " + err, reply_markup=kb([[btn("🔙 بازگشت", f"adm:mse:{key}")]]))
    try:  # the preview doubles as a check that Telegram accepts the formatting
        await bot.send_message(m.chat.id, "👁 <b>پیش‌نمایش:</b>\n\n" + sample_of(key, text))
    except TelegramAPIError as ex:
        return await m.answer(f"⚠️ تلگرام این متن رو قبول نکرد: {ex}", reply_markup=kb([[btn("🔙 بازگشت", f"adm:mse:{key}")]]))
    await state.clear()
    await messages.save(key, text)
    body, markup = message_card(key)
    await m.answer("✅ ذخیره شد و از همین الان اعمال می‌شه.\n\n" + body, reply_markup=markup)


@router.callback_query(F.data.regexp(r"^adm:msr:\w+$"))
async def message_reset(c: CallbackQuery):
    key = c.data[8:]
    await messages.reset(key)
    await c.answer("برگشت به پیش‌فرض")
    body, markup = message_card(key)
    await show(c, body, markup)


@router.callback_query(F.data == "adm:msresetall")
async def messages_reset_ask(c: CallbackQuery):
    await show(c, "🧹 متن همه پیام‌ها برگرده به پیش‌فرض؟", kb([[btn("✅ بله", "adm:msresetok"), btn("🔙 نه", "adm:ms")]]))
    await c.answer()


@router.callback_query(F.data == "adm:msresetok")
async def messages_reset_all(c: CallbackQuery):
    await messages.reset()
    await c.answer("انجام شد")
    await messages_menu(c)


# ---- support replies ---------------------------------------------------
@router.callback_query(F.data.startswith("reply:"))
async def reply_ask(c: CallbackQuery, state: FSMContext):
    await state.set_state(AdminSt.reply)
    await state.update_data(uid=int(c.data[6:]))
    await c.message.answer("✍️ پاسخ رو بنویس:", reply_markup=kb([back(PANEL, "🔙 انصراف")]))
    await c.answer()


@router.message(AdminSt.reply)
async def reply_send(m: Message, state: FSMContext, bot: Bot):
    uid = (await state.get_data())["uid"]
    await state.clear()
    try:
        await bot.send_message(uid, "📩 <b>پاسخ پشتیبانی</b>\n━━━━━━━━━━━━━━")
        await m.copy_to(uid)
        await m.answer("✅ ارسال شد.")
    except TelegramAPIError:
        await m.answer("⚠️ ارسال نشد (کاربر ربات رو بلاک کرده).")
