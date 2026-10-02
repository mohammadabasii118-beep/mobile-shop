from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

from .. import db, payments
from ..keyboards import back, btn, kb, pairs
from ..texts import TX_TITLE, fmt_date, money
from ..utils import show

router = Router()

PRESETS = [50000, 100000, 200000, 500000]


class WalletSt(StatesGroup):
    amount = State()


@router.callback_query(F.data == "wallet")
async def wallet(c: CallbackQuery, state: FSMContext):
    # set_state(None) (not clear) so a half-finished ad draft survives a top-up.
    await state.set_state(None)
    u = await db.get_user(c.from_user.id)
    btns = [btn(money(a), f"wallet:pay:{a}") for a in PRESETS]
    await show(c, f"💰 <b>کیف پول</b>\n━━━━━━━━━━━━━━\nموجودی: <b>{money(u['balance'])}</b>\n\nمبلغ شارژ رو انتخاب کن:",
               kb(pairs(btns) + [[btn("✍️ مبلغ دلخواه", "wallet:custom"), btn("📜 تراکنش‌ها", "wallet:hist")], back()]))
    await c.answer()


@router.callback_query(F.data == "wallet:custom")
async def custom(c: CallbackQuery, state: FSMContext):
    await state.set_state(WalletSt.amount)
    mn = await db.get_int("min_topup")
    await show(c, f"✍️ مبلغ شارژ رو به تومان بفرست (حداقل {money(mn)}):", kb([back("wallet")]))
    await c.answer()


@router.message(WalletSt.amount, F.text)
async def custom_amount(m: Message, state: FSMContext):
    digits = m.text.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")).replace(",", "").strip()
    mn = await db.get_int("min_topup")
    if not digits.isdigit() or int(digits) < mn or int(digits) > 50_000_000:
        return await m.answer(f"⚠️ یه عدد معتبر بفرست (حداقل {money(mn)}).")
    await state.set_state(None)
    await send_link(m, int(digits))


async def send_link(event: Message | CallbackQuery, amount: int) -> None:
    url = await payments.create_payment(event.from_user.id, amount)
    if not url:
        return await show(event, "⚠️ اتصال به درگاه پرداخت برقرار نشد. کمی بعد دوباره تلاش کن یا با پشتیبانی تماس بگیر.",
                          kb([back("wallet")]))
    from aiogram.types import InlineKeyboardButton
    await show(event, f"💳 مبلغ <b>{money(amount)}</b>\nروی دکمه بزن تا به صفحه پرداخت بری. بعد از پرداخت، موجودی خودکار شارژ می‌شه.",
               kb([[InlineKeyboardButton(text="💳 پرداخت آنلاین", url=url)], back("wallet")]))


@router.callback_query(F.data.startswith("wallet:pay:"))
async def pay(c: CallbackQuery):
    amount = int(c.data.rsplit(":", 1)[1])
    mn = await db.get_int("min_topup")
    if amount < mn:
        return await c.answer(f"حداقل شارژ {money(mn)} است.", show_alert=True)
    await c.answer()
    await send_link(c, amount)


@router.callback_query(F.data == "wallet:hist")
async def history(c: CallbackQuery):
    rows = await db.fetchall("SELECT * FROM transactions WHERE user_id=? AND status<>'failed' ORDER BY id DESC LIMIT 15", c.from_user.id)
    if not rows:
        text = "📭 هنوز تراکنشی نداری."
    else:
        lines = []
        for r in rows:
            sign = "➕" if r["amount"] > 0 else "➖"
            pend = " ⏳" if r["status"] == "pending" else ""
            what = f"{sign} {money(abs(r['amount']))} — " if r["amount"] else ""
            lines.append(f"{what}{TX_TITLE.get(r['type'], r['type'])}{pend}\n   🕒 {fmt_date(r['created_at'])}")
        text = "📜 <b>۱۵ تراکنش اخیر</b>\n\n" + "\n".join(lines)
    await show(c, text, kb([back("wallet")]))
    await c.answer()
