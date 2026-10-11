"""📝 Draft: when an admin switches it on, players register their in-game ID, main position and (optionally) a second one."""
from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery, Message

from ..onc import dbx
from ..onc.ui import ob, okb, grid
from ..texts import POSITIONS
from ..utils import is_admin, show
from . import core
from .core import E
from .states import DraftSt

router = Router()
admin_router = Router()
admin_router.message.filter(lambda m: is_admin(m.from_user.id))
admin_router.callback_query.filter(lambda c: is_admin(c.from_user.id))


async def is_on() -> bool:
    return await core.get("draft_on", "0") == "1"


def pos_kb(prefix: str, exclude: str | None = None, skip: bool = False):
    rows = grid([ob(p, f"{prefix}:{i}") for i, p in enumerate(POSITIONS) if p != exclude], 4)
    if skip:
        rows.append([ob("⏭ بدون پست دوم", "fx:drs")])
    return okb(rows + [[ob("❌ لغو", "fx:dr")]])


@router.callback_query(F.data == "fx:dr")
async def entry(c: CallbackQuery, state: FSMContext):
    await state.clear()
    if not await is_on():
        return await c.answer("📝 ثبت‌نام درفت فعلاً بسته است.", show_alert=True)
    reg = await dbx.fetchone("SELECT * FROM fx_draft_regs WHERE user_id=?", c.from_user.id)
    cur = (f"\n\n✅ ثبت‌نام فعلی تو:\nآیدی: <b>{E(reg['gaming_id'])}</b>\nپست اصلی: <b>{E(reg['pos1'])}</b>"
           + (f"\nپست دوم: <b>{E(reg['pos2'])}</b>" if reg["pos2"] else "")) if reg else ""
    await show(c, f"📝 <b>درفت</b>{cur}", okb([[ob("✏️ ثبت‌نام / ویرایش" if reg else "📝 ثبت‌نام در درفت", "fx:drn")], [ob("🔙 منوی اصلی", "home")]]))
    await c.answer()


@router.callback_query(F.data == "fx:drn")
async def start(c: CallbackQuery, state: FSMContext):
    if not await is_on():
        return await c.answer("📝 ثبت‌نام درفت فعلاً بسته است.", show_alert=True)
    await state.set_state(DraftSt.gid)
    await show(c, "📝 <b>ثبت‌نام درفت</b> — ۱ از ۳\n\n<b>آیدی بازیکن</b> (آیدی داخل بازی) را بفرست:", okb([[ob("❌ لغو", "fx:dr")]]))
    await c.answer()


@router.message(DraftSt.gid, F.text)
async def got_id(m: Message, state: FSMContext):
    gid = m.text.strip()
    if not gid or len(gid) > 40 or " " in gid:
        return await m.answer("⚠️ آیدی معتبر بفرست (بدون فاصله، حداکثر ۴۰ کاراکتر).")
    await state.update_data(gid=gid)
    await state.set_state(DraftSt.pos1)
    await m.answer("📝 <b>ثبت‌نام درفت</b> — ۲ از ۳\n\n<b>پست اصلی</b> را انتخاب کن:", reply_markup=pos_kb("fx:dp1"))


@router.callback_query(F.data.regexp(r"^fx:dp1:(\d)$"), DraftSt.pos1)
async def got_pos1(c: CallbackQuery, state: FSMContext):
    p = POSITIONS[int(c.data.split(":")[2])]
    await state.update_data(pos1=p)
    await state.set_state(DraftSt.pos2)
    await show(c, f"پست اصلی: <b>{p}</b>\n\n📝 <b>ثبت‌نام درفت</b> — ۳ از ۳\n<b>پست دوم</b> را انتخاب کن (اختیاری؛ حداکثر ۲ پست):", pos_kb("fx:dp2", exclude=p, skip=True))
    await c.answer()


async def _save(c: CallbackQuery, state: FSMContext, pos2: str | None) -> None:
    d = await state.get_data()
    if not await is_on():
        await state.clear()
        return await c.answer("📝 ثبت‌نام درفت بسته شد.", show_alert=True)
    await dbx.execute("INSERT INTO fx_draft_regs(user_id,gaming_id,pos1,pos2,created_at) VALUES(?,?,?,?,?) "
                      "ON CONFLICT(user_id) DO UPDATE SET gaming_id=excluded.gaming_id, pos1=excluded.pos1, pos2=excluded.pos2, created_at=excluded.created_at",
                      c.from_user.id, d["gid"], d["pos1"], pos2, core.now())
    await state.clear()
    await c.answer("✅ ثبت شد")
    await show(c, f"✅ <b>ثبت‌نام درفت انجام شد</b>\n\nآیدی: <b>{E(d['gid'])}</b>\nپست اصلی: <b>{d['pos1']}</b>"
               + (f"\nپست دوم: <b>{pos2}</b>" if pos2 else ""), okb([[ob("🔙 منوی اصلی", "home")]]))


@router.callback_query(F.data.regexp(r"^fx:dp2:(\d)$"), DraftSt.pos2)
async def got_pos2(c: CallbackQuery, state: FSMContext):
    await _save(c, state, POSITIONS[int(c.data.split(":")[2])])


@router.callback_query(F.data == "fx:drs", DraftSt.pos2)
async def skip_pos2(c: CallbackQuery, state: FSMContext):
    await _save(c, state, None)


# ---- admin
@admin_router.callback_query(F.data == "fx:ad")
async def admin_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    on = await is_on()
    n = await dbx.scalar("SELECT COUNT(*) FROM fx_draft_regs")
    await show(c, f"📝 <b>درفت</b>\n\nثبت‌نام: <b>{'🟢 باز' if on else '🔴 بسته'}</b>\nتعداد ثبت‌نامی‌ها: {n}",
               okb([[ob("🔴 بستن ثبت‌نام" if on else "🟢 باز کردن ثبت‌نام", "fx:adt")], [ob(f"👥 لیست ثبت‌نامی‌ها ({n})", "fx:adl")],
                    [ob("📄 دریافت فایل لیست", "fx:adf")], [ob("🗑 پاک کردن همه", "fx:adc")], [ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@admin_router.callback_query(F.data == "fx:adt")
async def toggle(c: CallbackQuery, state: FSMContext):
    await core.put("draft_on", "0" if await is_on() else "1")
    await c.answer("انجام شد")
    await admin_home(c, state)


def _line(r: dict) -> str:
    return f"{r['gaming_id']} — {r['pos1']}" + (f" / {r['pos2']}" if r["pos2"] else "")


@admin_router.callback_query(F.data == "fx:adl")
async def listing(c: CallbackQuery):
    rows = await dbx.fetchall("SELECT * FROM fx_draft_regs ORDER BY pos1, created_at")
    by: dict[str, list[str]] = {}
    for r in rows:
        by.setdefault(r["pos1"], []).append(_line(r))
    text = f"👥 <b>ثبت‌نامی‌های درفت ({len(rows)})</b>\n\n" + "\n\n".join(
        f"<b>{p}</b> ({len(v)})\n" + "\n".join(f"• {E(x)}" for x in v) for p, v in by.items()) if rows else "👥 <b>ثبت‌نامی‌های درفت</b>\n\nهنوز کسی ثبت‌نام نکرده."
    await show(c, text[:4000], okb([[ob("🔙 بازگشت", "fx:ad")]]))
    await c.answer()


@admin_router.callback_query(F.data == "fx:adf")
async def export(c: CallbackQuery):
    rows = await dbx.fetchall("SELECT * FROM fx_draft_regs ORDER BY pos1, created_at")
    if not rows:
        return await c.answer("لیست خالی است.", show_alert=True)
    lines = ["telegram_id,gaming_id,main_position,second_position"] + [f"{r['user_id']},{r['gaming_id']},{r['pos1']},{r['pos2'] or ''}" for r in rows]
    await c.message.answer_document(BufferedInputFile("\n".join(lines).encode("utf-8-sig"), "draft.csv"), caption=f"📄 {len(rows)} ثبت‌نامی")
    await c.answer()


@admin_router.callback_query(F.data == "fx:adc")
async def clear_ask(c: CallbackQuery):
    await show(c, "⚠️ <b>مطمئنی؟</b>\nهمه‌ی ثبت‌نامی‌های درفت پاک می‌شود.", okb([[ob("✅ تأیید", "fx:adcy")], [ob("❌ لغو", "fx:ad")]]))
    await c.answer()


@admin_router.callback_query(F.data == "fx:adcy")
async def clear_do(c: CallbackQuery, state: FSMContext):
    await dbx.execute("DELETE FROM fx_draft_regs")
    await c.answer("پاک شد")
    await admin_home(c, state)
