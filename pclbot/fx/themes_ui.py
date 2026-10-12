"""🎭 Theme manager: ten graphic themes for the ten graphics. The admin previews a theme on any graphic, makes it the default
for the whole bot or for one section only, and can clear a default (→ the template exactly as it is today).

Nothing here touches match data: a theme only changes how the same data is drawn (see onc/themes.py).
"""
from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery

from ..onc import dbx, gfx, render, templates, themes
from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import core
from .core import E

router = Router()
router.callback_query.filter(lambda c: is_admin(c.from_user.id))
TYPES = templates.TYPES
_cache: dict[tuple[str, str], bytes] = {}


def tname(tid: str) -> str:
    return f"{themes.NAMES_FA[tid]} · {themes.NAMES[tid]}"


async def sample_png(theme_id: str, type_: str) -> bytes:
    key = (theme_id, type_)
    if key not in _cache:
        cfg = templates.default_config(type_, theme_id)
        _cache[key] = render.render(type_, cfg, {**core.APP_LOOK, **{"brand": "ONE NIGHT CHAMPION", "footer": "@Onenightchampion", "watermark": ("ONE NIGHT", "ONE CHAMPION")}, **render.sample(type_)})[0]
    return _cache[key]


async def current() -> tuple[str | None, dict[str, str]]:
    d = await core.get("theme_default") or None
    per = {}
    for t in TYPES:
        v = await core.get(f"theme_{t}")
        if v in templates.THEMES:
            per[t] = v
    return (d if d in templates.THEMES else None), per


def theme_grid(prefix: str) -> list[list]:
    btns = [ob(f"{i + 1}. {themes.NAMES[t]}", f"{prefix}:{i}") for i, t in enumerate(themes.ORDER)]
    return [btns[i:i + 2] for i in range(0, len(btns), 2)]


@router.callback_query(F.data == "fx:th")
async def home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    d, per = await current()
    lines = [f"• تم پیش‌فرض کل ربات: <b>{E(themes.NAMES[d]) if d else 'طرح فعلی (بدون تغییر)'}</b>"]
    lines += [f"• {templates.TYPE_LABEL[t]}: <b>{themes.NAMES[v]}</b>" for t, v in per.items()]
    await show(c, "🎭 <b>تم‌های گرافیکی</b>\n\n۱۰ تم کاملاً متفاوت برای هر ۱۰ بخش. تم فقط ظاهر را عوض می‌کند، اطلاعات مسابقه همان می‌ماند.\n\n" + "\n".join(lines),
               okb([[ob("🖼 پیش‌نمایش تم‌ها", "fx:thv")], [ob("🌐 تم پیش‌فرض کل ربات", "fx:thd")], [ob("🧩 تم هر بخش (جداگانه)", "fx:thx")],
                    [ob("♻️ بازگشت به طرح فعلی (حذف همه‌ی پیش‌فرض‌ها)", "fx:thrs")], [ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@router.callback_query(F.data == "fx:thrs")
async def reset_all(c: CallbackQuery, state: FSMContext):
    await dbx.execute("DELETE FROM fx_settings WHERE key LIKE 'theme\\_%' ESCAPE '\\'")
    await c.answer("همه‌ی پیش‌فرض‌های تم حذف شد")
    await home(c, state)


# ---- preview a theme on any graphic
@router.callback_query(F.data == "fx:thv")
async def view_list(c: CallbackQuery):
    await show(c, "🖼 <b>پیش‌نمایش</b> — یک تم را انتخاب کن:", okb(theme_grid("fx:tht") + [[ob("🔙 بازگشت", "fx:th")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:tht:\d+(:\d+)?$"))
async def view_theme(c: CallbackQuery):
    parts = c.data.split(":")
    i = int(parts[2])
    if i >= len(themes.ORDER):
        return await c.answer()
    j = int(parts[3]) if len(parts) > 3 else 1                       # default sample: the group table
    if j >= len(TYPES):
        return await c.answer()
    await c.answer("⏳ در حال ساخت نمونه…")
    tid, ty = themes.ORDER[i], TYPES[j]
    kb = [[ob(f"{k + 1}. {templates.TYPE_LABEL[t]}"[:30], f"fx:tht:{i}:{k}")] for k, t in enumerate(TYPES)]
    kb = [kb[x][0:1] + (kb[x + 1][0:1] if x + 1 < len(kb) else []) for x in range(0, len(kb), 2)]
    kb += [[ob("✅ پیش‌فرض کل ربات", f"fx:thsd:{i}"), ob("🧩 فقط این بخش", f"fx:thst:{j}:{i}")], [ob("🔙 فهرست تم‌ها", "fx:thv")]]
    await c.message.answer_photo(BufferedInputFile(await sample_png(tid, ty), f"{tid}_{ty}.png"),
                                 caption=f"🎭 <b>{E(tname(tid))}</b>\n{templates.TYPE_LABEL[ty]}", reply_markup=okb(kb))


async def _set(key: str, val: str | None):
    if val:
        await core.put(key, val)
    else:
        await dbx.execute("DELETE FROM fx_settings WHERE key=?", key)


@router.callback_query(F.data.regexp(r"^fx:thsd:\d+$"))
async def set_default(c: CallbackQuery):
    i = int(c.data.split(":")[2])
    await _set("theme_default", themes.ORDER[i])
    await c.answer(f"✅ تم پیش‌فرض: {themes.NAMES[themes.ORDER[i]]}", show_alert=True)


@router.callback_query(F.data.regexp(r"^fx:thst:\d+:\d+$"))
async def set_for_type(c: CallbackQuery):
    _, _, j, i = c.data.split(":")
    await _set(f"theme_{TYPES[int(j)]}", themes.ORDER[int(i)])
    await c.answer(f"✅ {templates.TYPE_LABEL[TYPES[int(j)]]}: {themes.NAMES[themes.ORDER[int(i)]]}", show_alert=True)


# ---- default for the whole bot
@router.callback_query(F.data == "fx:thd")
async def default_pick(c: CallbackQuery):
    await show(c, "🌐 <b>تم پیش‌فرض کل ربات</b>\n\nهمه‌ی گرافیک‌هایی که ربات می‌سازد با این تم ساخته می‌شود (مگر برای بخشی تم جدا گذاشته باشی).",
               okb(theme_grid("fx:thsd2") + [[ob("♻️ حذف پیش‌فرض (طرح فعلی)", "fx:thdc")], [ob("🔙 بازگشت", "fx:th")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:thsd2:\d+$"))
async def default_set(c: CallbackQuery, state: FSMContext):
    await _set("theme_default", themes.ORDER[int(c.data.split(":")[2])])
    await c.answer("ذخیره شد")
    await home(c, state)


@router.callback_query(F.data == "fx:thdc")
async def default_clear(c: CallbackQuery, state: FSMContext):
    await _set("theme_default", None)
    await c.answer("پیش‌فرض حذف شد")
    await home(c, state)


# ---- per section
@router.callback_query(F.data == "fx:thx")
async def per_type(c: CallbackQuery):
    d, per = await current()
    rows = [[ob(f"{templates.TYPE_LABEL[t]} — {themes.NAMES[per[t]] if t in per else 'پیش‌فرض'}"[:60], f"fx:thxs:{k}")] for k, t in enumerate(TYPES)]
    await show(c, "🧩 <b>تم هر بخش</b>\n\nبرای هر بخش می‌توانی تم جدا بگذاری:", okb(rows + [[ob("🔙 بازگشت", "fx:th")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:thxs:\d+$"))
async def per_type_pick(c: CallbackQuery):
    j = int(c.data.split(":")[2])
    await show(c, f"🧩 <b>{templates.TYPE_LABEL[TYPES[j]]}</b> — تم را انتخاب کن:",
               okb(theme_grid(f"fx:thxt:{j}") + [[ob("♻️ استفاده از پیش‌فرض", f"fx:thxc:{j}")], [ob("🔙 بازگشت", "fx:thx")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:thxt:\d+:\d+$"))
async def per_type_set(c: CallbackQuery):
    _, _, j, i = c.data.split(":")
    await _set(f"theme_{TYPES[int(j)]}", themes.ORDER[int(i)])
    await c.answer("ذخیره شد")
    await per_type(c)


@router.callback_query(F.data.regexp(r"^fx:thxc:\d+$"))
async def per_type_clear(c: CallbackQuery):
    await _set(f"theme_{TYPES[int(c.data.split(':')[2])]}", None)
    await c.answer("پاک شد")
    await per_type(c)
