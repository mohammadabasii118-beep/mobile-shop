"""🚫 Player blacklist: everyone can read it; admins add an in-game ID + the reason, or remove an entry."""
from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from ..onc import dbx
from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import core
from .core import E
from .states import BlSt

router = Router()
admin_router = Router()
admin_router.message.filter(lambda m: is_admin(m.from_user.id))
admin_router.callback_query.filter(lambda c: is_admin(c.from_user.id))
PER = 15


async def page_text(page: int) -> tuple[str, int]:
    total = await dbx.scalar("SELECT COUNT(*) FROM fx_blacklist")
    pages = max((total + PER - 1) // PER, 1)
    page = min(max(page, 1), pages)
    rows = await dbx.fetchall("SELECT * FROM fx_blacklist ORDER BY added_at DESC, player_id LIMIT ? OFFSET ?", PER, (page - 1) * PER)
    body = "\n\n".join(f"🚫 <b>{E(r['player_id'])}</b>\n   علت: {E(r['reason'])}" for r in rows) or "لیست خالی است."
    return f"🚫 <b>بلک‌لیست بازیکنان</b> ({total})\n\n{body}" + (f"\n\n<i>صفحه {page} از {pages}</i>" if pages > 1 else ""), pages


def pager(prefix: str, page: int, pages: int, back: str) -> list[list]:
    nav = []
    if page > 1:
        nav.append(ob("◀️ قبلی", f"{prefix}:{page - 1}"))
    if page < pages:
        nav.append(ob("بعدی ▶️", f"{prefix}:{page + 1}"))
    return ([nav] if nav else []) + [[ob("🔙 بازگشت", back)]]


@router.callback_query(F.data.regexp(r"^fx:bl(:\d+)?$"))
async def view(c: CallbackQuery, state: FSMContext):
    await state.clear()
    page = int(c.data.split(":")[2]) if c.data.count(":") == 2 else 1
    text, pages = await page_text(page)
    await show(c, text, okb(pager("fx:bl", page, pages, "home")))
    await c.answer()


# ---- admin
@admin_router.callback_query(F.data == "fx:ab")
async def admin_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    n = await dbx.scalar("SELECT COUNT(*) FROM fx_blacklist")
    await show(c, f"🚫 <b>بلک‌لیست</b> — {n} نفر", okb([[ob("➕ افزودن به بلک‌لیست", "fx:aba")], [ob("➖ حذف از بلک‌لیست", "fx:abr:1")],
                                                  [ob("📋 مشاهده لیست", "fx:bl")], [ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@admin_router.callback_query(F.data == "fx:aba")
async def add_ask(c: CallbackQuery, state: FSMContext):
    await state.set_state(BlSt.pid)
    await show(c, "➕ <b>آیدی بازیکن</b> را بفرست (آیدی داخل بازی):", okb([[ob("❌ لغو", "fx:ab")]]))
    await c.answer()


@admin_router.message(BlSt.pid, F.text)
async def add_pid(m: Message, state: FSMContext):
    pid = m.text.strip()
    if not pid or len(pid) > 40:
        return await m.answer("⚠️ آیدی معتبر بفرست (حداکثر ۴۰ کاراکتر).")
    await state.update_data(pid=pid)
    await state.set_state(BlSt.reason)
    await m.answer(f"آیدی: <b>{E(pid)}</b>\n\n<b>علت محرومیت</b> را بنویس:", reply_markup=okb([[ob("❌ لغو", "fx:ab")]]))


@admin_router.message(BlSt.reason, F.text)
async def add_reason(m: Message, state: FSMContext):
    d = await state.get_data()
    reason = m.text.strip()[:300]
    await dbx.execute("INSERT INTO fx_blacklist(player_id,reason,added_by,added_at) VALUES(?,?,?,?) "
                      "ON CONFLICT(player_id) DO UPDATE SET reason=excluded.reason, added_by=excluded.added_by, added_at=excluded.added_at",
                      d["pid"], reason, m.from_user.id, core.now())
    await state.clear()
    await m.answer(f"✅ <b>{E(d['pid'])}</b> به بلک‌لیست اضافه شد.\nعلت: {E(reason)}", reply_markup=okb([[ob("➕ افزودن دیگر", "fx:aba")], [ob("🔙 بازگشت", "fx:ab")]]))


@admin_router.callback_query(F.data.regexp(r"^fx:abr:(\d+)$"))
async def remove_list(c: CallbackQuery):
    page = int(c.data.split(":")[2])
    total = await dbx.scalar("SELECT COUNT(*) FROM fx_blacklist")
    pages = max((total + PER - 1) // PER, 1)
    page = min(page, pages)
    rows = await dbx.fetchall("SELECT player_id FROM fx_blacklist ORDER BY added_at DESC, player_id LIMIT ? OFFSET ?", PER, (page - 1) * PER)
    btns = [[ob(f"➖ {r['player_id']}", f"fx:abd:{r['player_id']}")] for r in rows]
    await show(c, "➖ <b>حذف از بلک‌لیست</b>\nروی آیدی بزن تا حذف شود." + ("" if rows else "\n\nلیست خالی است."), okb(btns + pager("fx:abr", page, pages, "fx:ab")))
    await c.answer()


@admin_router.callback_query(F.data.startswith("fx:abd:"))
async def remove_do(c: CallbackQuery):
    pid = c.data.split(":", 2)[2]
    await dbx.execute("DELETE FROM fx_blacklist WHERE player_id=?", pid)
    await c.answer("حذف شد")
    rows = await dbx.fetchall("SELECT player_id FROM fx_blacklist ORDER BY added_at DESC, player_id LIMIT ?", PER)
    btns = [[ob(f"➖ {r['player_id']}", f"fx:abd:{r['player_id']}")] for r in rows]
    await show(c, f"✅ <b>{E(pid)}</b> حذف شد.\n\n➖ <b>حذف از بلک‌لیست</b>" + ("" if rows else "\n\nلیست خالی است."), okb(btns + [[ob("🔙 بازگشت", "fx:ab")]]))
