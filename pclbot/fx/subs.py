"""🌍 International subscription paid in USDT: the user picks a plan, sends the payment receipt, an admin approves it."""
import time

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from ..onc import dbx
from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import core
from .core import E
from .states import SubSt

router = Router()                                   # user side (any user)
admin_router = Router()                             # admin side
admin_router.message.filter(lambda m: is_admin(m.from_user.id))
admin_router.callback_query.filter(lambda c: is_admin(c.from_user.id))

PLANS = {"std": ("⭐ اشتراک استاندارد", "اشتراک استاندارد + ورودی مسابقات"), "pro": ("💎 اشتراک پرو", "اشتراک پرو + ورودی مسابقات")}
DURATION = {6: "۶ ماهه", 12: "۱ ساله"}
DAYS = {6: 182, 12: 365}
DEFAULT_PRICES = {"std_6": "3", "std_12": "5", "pro_6": "4", "pro_12": "8"}     # USDT — editable in the admin panel


async def price(plan: str, months: int) -> str:
    return await core.get(f"sub_price_{plan}_{months}", DEFAULT_PRICES[f"{plan}_{months}"])


def fmt_date(ts: int) -> str:
    import datetime as dt
    return dt.datetime.fromtimestamp(ts).strftime("%Y/%m/%d")


async def active_sub(uid: int) -> dict | None:
    return await dbx.fetchone("SELECT * FROM fx_subs WHERE user_id=? AND status='ACTIVE' AND expires_at>? ORDER BY expires_at DESC LIMIT 1", uid, core.now())


# ================================================================= user flow
@router.callback_query(F.data == "fx:sb")
async def entry(c: CallbackQuery, state: FSMContext):
    await state.clear()
    sub = await active_sub(c.from_user.id)
    cur = f"\n\n✅ اشتراک فعال: <b>{PLANS[sub['plan']][0]}</b> تا {fmt_date(sub['expires_at'])}" if sub else ""
    await show(c, f"🌍 <b>اشتراک بین‌المللی</b>\n\nبرای کاربران خارج از ایران؛ پرداخت با تتر (USDT).{cur}\n\nنوع اشتراک را انتخاب کن:",
               okb([[ob(PLANS["pro"][0], "fx:sbp:pro"), ob(PLANS["std"][0], "fx:sbp:std")],       # right = standard, left = pro
                    [ob("📋 اشتراک من", "fx:sbm")], [ob("🔙 منوی اصلی", "home")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:sbp:(std|pro)$"))
async def plan_page(c: CallbackQuery):
    plan = c.data.split(":")[2]
    rows = [[ob(f"{DURATION[m]} — {await price(plan, m)} USDT", f"fx:sbo:{plan}:{m}")] for m in (6, 12)]
    await show(c, f"{PLANS[plan][0]}\n<i>{PLANS[plan][1]}</i>\n\nمدت اشتراک را انتخاب کن:", okb(rows + [[ob("🔙 بازگشت", "fx:sb")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:sbo:(std|pro):(6|12)$"))
async def option(c: CallbackQuery):
    _, _, plan, m = c.data.split(":")
    m = int(m)
    wallet, net = await core.get("sub_wallet"), await core.get("sub_network", "TRC20 (Tron)")
    amount = await price(plan, m)
    if not wallet:
        return await c.answer("آدرس ولت هنوز توسط ادمین تنظیم نشده.", show_alert=True)
    text = (f"{PLANS[plan][0]}\n<i>{PLANS[plan][1]}</i>\n\n⏳ مدت: <b>{DURATION[m]}</b>\n💰 مبلغ: <b>{E(amount)} USDT</b>\n🌐 شبکه: <b>{E(net)}</b>\n\n"
            f"آدرس مقصد (برای کپی روی آن بزن):\n<code>{E(wallet)}</code>\n\n"
            "⚠️ دقیقاً همین مبلغ را فقط روی همین شبکه واریز کن، بعد «ارسال رسید» را بزن و عکس رسید یا TxID را بفرست.")
    await show(c, text, okb([[ob("📤 ارسال رسید", f"fx:sbr:{plan}:{m}")], [ob("🔙 بازگشت", f"fx:sbp:{plan}")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:sbr:(std|pro):(6|12)$"))
async def ask_receipt(c: CallbackQuery, state: FSMContext):
    _, _, plan, m = c.data.split(":")
    m = int(m)
    amount = await price(plan, m)                                           # price frozen at this moment
    sid = await dbx.execute("INSERT INTO fx_subs(user_id,plan,months,amount,status,created_at) VALUES(?,?,?,?, 'AWAITING',?)",
                            c.from_user.id, plan, m, amount, core.now())
    await state.set_state(SubSt.receipt)
    await state.update_data(sid=sid)
    await show(c, "📤 <b>ارسال رسید</b>\n\nعکس رسید پرداخت (اسکرین‌شات) یا <b>TxID</b> تراکنش را بفرست.", okb([[ob("❌ لغو", f"fx:sbo:{plan}:{m}")]]))
    await c.answer()


@router.message(SubSt.receipt, F.photo | F.text)
async def got_receipt(m: Message, state: FSMContext, bot: Bot):
    d = await state.get_data()
    sub = await dbx.fetchone("SELECT * FROM fx_subs WHERE id=? AND user_id=? AND status='AWAITING'", d["sid"], m.from_user.id)
    if not sub:
        await state.clear()
        return await m.answer("این درخواست دیگر معتبر نیست. دوباره از «اشتراک بین‌المللی» شروع کن.")
    file_id = m.photo[-1].file_id if m.photo else None
    text = (m.caption if m.photo else m.text) or ""
    if not file_id and len(text.strip()) < 8:
        return await m.answer("⚠️ عکس رسید یا TxID کامل را بفرست.")
    await dbx.execute("UPDATE fx_subs SET status='PENDING', receipt_file=?, receipt_text=? WHERE id=?", file_id, text.strip() or None, sub["id"])
    await state.clear()
    await m.answer("✅ رسید ثبت شد و برای ادمین فرستاده شد. بعد از تأیید، اینجا خبرت می‌کنیم.", reply_markup=okb([[ob("🔙 منوی اصلی", "home")]]))
    await notify_new(bot, sub["id"])


@router.callback_query(F.data == "fx:sbm")
async def mine(c: CallbackQuery):
    rows = await dbx.fetchall("SELECT * FROM fx_subs WHERE user_id=? AND status<>'AWAITING' ORDER BY id DESC LIMIT 8", c.from_user.id)
    lab = {"PENDING": "⏳ در انتظار تأیید", "ACTIVE": "✅ فعال", "REJECTED": "❌ رد شد"}
    lines = [f"{PLANS[r['plan']][0]} · {DURATION[r['months']]} · {E(r['amount'])} USDT — {lab[r['status']]}"
             + (f" تا {fmt_date(r['expires_at'])}" if r["status"] == "ACTIVE" and r["expires_at"] else "") for r in rows]
    await show(c, "📋 <b>اشتراک من</b>\n\n" + ("\n".join(lines) if lines else "هنوز اشتراکی نداری."), okb([[ob("🔙 بازگشت", "fx:sb")]]))
    await c.answer()


# ================================================================= admin: approve / reject
async def detail_text(sub: dict) -> str:
    return (f"🌍 <b>درخواست اشتراک</b>\n\n👤 {E(await core.user_label(sub['user_id']))}\n{PLANS[sub['plan']][0]} · {DURATION[sub['months']]}\n"
            f"💰 {E(sub['amount'])} USDT\n"
            + (f"\n🧾 رسید: <code>{E(sub['receipt_text'])}</code>" if sub["receipt_text"] else ""))


def decision_markup(sid: int):
    return okb([[ob("✅ تایید", f"fx:sba:{sid}"), ob("❌ رد", f"fx:sbn:{sid}")]])


async def notify_new(bot: Bot, sid: int) -> None:
    sub = await dbx.fetchone("SELECT * FROM fx_subs WHERE id=?", sid)
    await core.notify_admins(bot, await detail_text(sub), decision_markup(sid), photo=sub["receipt_file"])


@admin_router.callback_query(F.data.regexp(r"^fx:sba:(\d+)$"))
async def approve(c: CallbackQuery, bot: Bot):
    sid = int(c.data.split(":")[2])
    async with dbx.tx():
        sub = await dbx.fetchone("SELECT * FROM fx_subs WHERE id=?", sid)
        if not sub or sub["status"] != "PENDING":
            return await c.answer("این درخواست قبلاً بررسی شده.", show_alert=True)
        cur = await active_sub(sub["user_id"])
        start = max(core.now(), cur["expires_at"]) if cur else core.now()            # renewing extends the current period
        exp = start + DAYS[sub["months"]] * 86400
        await dbx.execute("UPDATE fx_subs SET status='ACTIVE', decided_at=?, decided_by=?, starts_at=?, expires_at=? WHERE id=?",
                          core.now(), c.from_user.id, start, exp, sid)
    await c.answer("✅ تأیید شد")
    note = f"\n\n✅ تأیید شد — فعال تا {fmt_date(exp)}"
    await _edit(c, (await detail_text(sub)) + note)
    await core.tell(bot, sub["user_id"], f"✅ اشتراک <b>{PLANS[sub['plan']][1]}</b> ({DURATION[sub['months']]}) فعال شد.\n📅 اعتبار تا: {fmt_date(exp)}")


async def _edit(c: CallbackQuery, text: str) -> None:
    try:
        if c.message.photo:
            await c.message.edit_caption(caption=text)
        else:
            await c.message.edit_text(text)
    except Exception:
        await c.message.answer(text)


@admin_router.callback_query(F.data.regexp(r"^fx:sbn:(\d+)$"))
async def reject_ask(c: CallbackQuery, state: FSMContext):
    sid = int(c.data.split(":")[2])
    sub = await dbx.fetchone("SELECT * FROM fx_subs WHERE id=?", sid)
    if not sub or sub["status"] != "PENDING":
        return await c.answer("این درخواست قبلاً بررسی شده.", show_alert=True)
    await state.set_state(SubSt.reject)
    await state.update_data(sid=sid)
    await c.message.answer("❌ دلیل رد را بنویس (یا «بدون دلیل» را بزن):", reply_markup=okb([[ob("بدون دلیل", f"fx:sbx:{sid}")]]))
    await c.answer()


async def _reject(bot: Bot, admin: int, sid: int, reason: str | None) -> dict | None:
    async with dbx.tx():
        sub = await dbx.fetchone("SELECT * FROM fx_subs WHERE id=?", sid)
        if not sub or sub["status"] != "PENDING":
            return None
        await dbx.execute("UPDATE fx_subs SET status='REJECTED', decided_at=?, decided_by=?, reject_reason=? WHERE id=?", core.now(), admin, reason, sid)
    await core.tell(bot, sub["user_id"], "❌ رسید پرداخت تأیید نشد." + (f"\nدلیل: {E(reason)}" if reason else "") + "\nدر صورت اشتباه، دوباره رسید درست را بفرست.")
    return sub


@admin_router.callback_query(F.data.regexp(r"^fx:sbx:(\d+)$"))
async def reject_noreason(c: CallbackQuery, state: FSMContext, bot: Bot):
    await state.clear()
    sub = await _reject(bot, c.from_user.id, int(c.data.split(":")[2]), None)
    await c.answer("رد شد" if sub else "قبلاً بررسی شده")
    await c.message.answer("❌ رد شد." if sub else "این درخواست قبلاً بررسی شده.")


@admin_router.message(SubSt.reject, F.text)
async def reject_reason(m: Message, state: FSMContext, bot: Bot):
    d = await state.get_data()
    await state.clear()
    sub = await _reject(bot, m.from_user.id, d["sid"], m.text.strip()[:200])
    await m.answer("❌ رد شد و به کاربر خبر داده شد." if sub else "این درخواست قبلاً بررسی شده.")


# ================================================================= admin panel pieces
@admin_router.callback_query(F.data == "fx:as")
async def admin_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    pend = await dbx.scalar("SELECT COUNT(*) FROM fx_subs WHERE status='PENDING'")
    act = await dbx.scalar("SELECT COUNT(*) FROM fx_subs WHERE status='ACTIVE' AND expires_at>?", core.now())
    await show(c, f"🌍 <b>اشتراک بین‌المللی</b>\n\nمشترکان فعال: {act}",
               okb([[ob(f"⏳ رسیدهای در انتظار ({pend})", "fx:asp")], [ob("👥 مشترکان فعال", "fx:asa")], [ob("⚙️ قیمت‌ها و آدرس ولت", "fx:ass")],
                    [ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@admin_router.callback_query(F.data == "fx:asp")
async def pending_list(c: CallbackQuery):
    rows = await dbx.fetchall("SELECT * FROM fx_subs WHERE status='PENDING' ORDER BY id")
    btns = [[ob(f"{await core.user_label(r['user_id'])} · {PLANS[r['plan']][0]} {DURATION[r['months']]}", f"fx:asv:{r['id']}")] for r in rows]
    await show(c, f"⏳ <b>رسیدهای در انتظار تأیید ({len(rows)})</b>" + ("" if rows else "\n\nموردی نیست."), okb(btns + [[ob("🔙 بازگشت", "fx:as")]]))
    await c.answer()


@admin_router.callback_query(F.data.regexp(r"^fx:asv:(\d+)$"))
async def pending_view(c: CallbackQuery):
    sub = await dbx.fetchone("SELECT * FROM fx_subs WHERE id=?", int(c.data.split(":")[2]))
    if not sub or sub["status"] != "PENDING":
        return await c.answer("قبلاً بررسی شده.", show_alert=True)
    await c.answer()
    if sub["receipt_file"]:
        await c.message.answer_photo(sub["receipt_file"], caption=await detail_text(sub), reply_markup=decision_markup(sub["id"]))
    else:
        await c.message.answer(await detail_text(sub), reply_markup=decision_markup(sub["id"]))


@admin_router.callback_query(F.data == "fx:asa")
async def active_list(c: CallbackQuery):
    rows = await dbx.fetchall("SELECT * FROM fx_subs WHERE status='ACTIVE' AND expires_at>? ORDER BY expires_at LIMIT 60", core.now())
    lines = [f"{E(await core.user_label(r['user_id']))} — {PLANS[r['plan']][0]} تا {fmt_date(r['expires_at'])}" for r in rows]
    await show(c, f"👥 <b>مشترکان فعال ({len(rows)})</b>\n\n" + ("\n".join(lines) or "—"), okb([[ob("🔙 بازگشت", "fx:as")]]))
    await c.answer()


SETTINGS = {"sub_wallet": "آدرس ولت (USDT)", "sub_network": "شبکه (مثلاً TRC20)", "sub_price_std_6": "قیمت استاندارد ۶ ماهه (USDT)",
            "sub_price_std_12": "قیمت استاندارد ۱ ساله (USDT)", "sub_price_pro_6": "قیمت پرو ۶ ماهه (USDT)", "sub_price_pro_12": "قیمت پرو ۱ ساله (USDT)"}


@admin_router.callback_query(F.data == "fx:ass")
async def settings(c: CallbackQuery, state: FSMContext):
    await state.clear()
    lines, rows = [], []
    for i, (k, label) in enumerate(SETTINGS.items()):
        d = DEFAULT_PRICES.get(k.replace("sub_price_", ""), "") if k.startswith("sub_price") else ""
        v = await core.get(k, d or ("TRC20 (Tron)" if k == "sub_network" else ""))
        lines.append(f"• {label}: <code>{E(v) if v else '—'}</code>")
        rows.append([ob(f"✏️ {label}", f"fx:asm:{i}")])
    await show(c, "⚙️ <b>تنظیمات اشتراک بین‌المللی</b>\n\n" + "\n".join(lines), okb(rows + [[ob("🔙 بازگشت", "fx:as")]]))
    await c.answer()


@admin_router.callback_query(F.data.regexp(r"^fx:asm:(\d)$"))
async def setting_ask(c: CallbackQuery, state: FSMContext):
    key = list(SETTINGS)[int(c.data.split(":")[2])]
    await state.set_state(SubSt.setting)
    await state.update_data(key=key)
    await show(c, f"✏️ مقدار جدید «{SETTINGS[key]}» را بفرست:", okb([[ob("❌ لغو", "fx:ass")]]))
    await c.answer()


@admin_router.message(SubSt.setting, F.text)
async def setting_save(m: Message, state: FSMContext):
    d = await state.get_data()
    val = core.norm(m.text).strip()
    if d["key"].startswith("sub_price") and not val.replace(".", "", 1).isdigit():
        return await m.answer("⚠️ یک عدد بفرست (مثلاً 3 یا 4.5).")
    await core.put(d["key"], val)
    await state.clear()
    await m.answer("✅ ذخیره شد.", reply_markup=okb([[ob("⚙️ تنظیمات", "fx:ass")]]))
