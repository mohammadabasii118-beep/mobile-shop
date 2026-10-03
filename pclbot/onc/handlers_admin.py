"""ONC admin panel, part 1: panel, create wizard, tournaments, teams/players, groups, schedule, confirmations, settings.

Every handler sits behind router-level `is_admin` filters (real permission checks, not just hidden buttons), and the
service layer re-checks `require_admin` for every mutation.
"""
from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from .. import admins
from ..utils import is_admin, show
from . import algo, publish, service, templates, ui
from .service import OncError
from .states import CreateSt, GroupSt, TeamSt, TourSt
from .ui import E, ob, okb

router = Router()
router.message.filter(lambda m: is_admin(m.from_user.id))
router.callback_query.filter(lambda c: is_admin(c.from_user.id))

PANEL = "onc:a"


async def alert(c: CallbackQuery, text: str) -> None:
    await c.answer(text[:190], show_alert=True)


async def tid_of(c: CallbackQuery, raw: str) -> dict | None:
    """Resolves the tournament of a callback (0 = the active one); tells the admin if there is none."""
    t = await (service.active_tournament() if raw == "0" else service.get_tournament(int(raw)))
    if not t:
        await show(c, "🏆 تورنمنتی انتخاب نشده.\nیکی بساز یا «مدیریت تورنمنت‌ها» را باز کن.",
                   okb([[ob("➕ ساخت تورنمنت", "onc:cr")], [ob("🏆 مدیریت تورنمنت‌ها", "onc:mt")], [ob("🔙 پنل مدیریت", PANEL)]]))
        await c.answer()
    return t


# ----------------------------------------------------------------- panel
def panel_markup():
    return okb([
        [ob("➕ ساخت تورنمنت", "onc:cr"), ob("🏆 مدیریت تورنمنت‌ها", "onc:mt")],
        [ob("🔴 بازی‌های زنده", "onc:lv:0"), ob("📊 جدول رده‌بندی", "onc:st:0")],
        [ob("🏆 مرحله حذفی", "onc:ko:0"), ob("👥 تیم‌ها و بازیکنان", "onc:tm:0")],
        [ob("⚽ نتایج", "onc:rs:0"), ob("🎨 گرافیک", "onc:gx")],
        [ob("📢 کانال", "onc:ch"), ob("⚙️ تنظیمات", "onc:se")],
        [ob("🔙 پنل مدیریت", "admhome")],
    ])


async def panel_text() -> str:
    t = await service.active_tournament()
    head = "🏆 <b>پنل مدیریت وان نایت چمپیون</b>"
    if t:
        head += f"\n\nتورنمنت فعال: <b>{E(t['name'])}</b>  {ui.STATUS_ICON[t['status']]} {t['status']}"
    return head


@router.callback_query(F.data == PANEL)
async def panel(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show(c, await panel_text(), panel_markup())
    await c.answer()


# ----------------------------------------------------------------- create tournament wizard
def wiz_kb(back: str | None):
    row = []
    if back:
        row.append(ob("🔙 بازگشت", back))
    row.append(ob("❌ لغو", PANEL))
    return okb([row])


@router.callback_query(F.data == "onc:cr")
async def create_start(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await state.set_state(CreateSt.name)
    await show(c, "➕ <b>ساخت تورنمنت</b> — ۱ از ۴\n\n<b>نام تورنمنت</b> را بفرست\nمثال: <code>وان نایت چمپیون #5</code>", wiz_kb(None))
    await c.answer()


@router.message(CreateSt.name, F.text)
async def create_name(m: Message, state: FSMContext):
    name = m.text.strip()
    if not name or len(name) > 60:
        return await m.answer("نام باید بین ۱ تا ۶۰ کاراکتر باشد. دوباره بفرست.", reply_markup=wiz_kb(None))
    await state.update_data(name=name)
    await state.set_state(CreateSt.date)
    await m.answer("➕ <b>ساخت تورنمنت</b> — ۲ از ۴\n\n<b>تاریخ شروع</b> را بفرست\nمثال: <code>2026/10/10</code>", reply_markup=wiz_kb("onc:cb:name"))


@router.message(CreateSt.date, F.text)
async def create_date(m: Message, state: FSMContext):
    try:
        date = service.parse_date(m.text)
    except OncError as e:
        return await m.answer(f"⚠️ {e}", reply_markup=wiz_kb("onc:cb:name"))
    await state.update_data(date=date)
    await state.set_state(CreateSt.time)
    await m.answer("➕ <b>ساخت تورنمنت</b> — ۳ از ۴\n\n<b>ساعت شروع</b> را بفرست\nمثال: <code>20:00</code>", reply_markup=wiz_kb("onc:cb:date"))


@router.message(CreateSt.time, F.text)
async def create_time(m: Message, state: FSMContext):
    try:
        tm = service.parse_time(m.text)
    except OncError as e:
        return await m.answer(f"⚠️ {e}", reply_markup=wiz_kb("onc:cb:date"))
    await state.update_data(time=tm)
    await state.set_state(CreateSt.interval)
    await m.answer("➕ <b>ساخت تورنمنت</b> — ۴ از ۴\n\n<b>فاصله‌ی راندها</b> را به دقیقه بفرست (فاصله‌ی یک راند تا راند بعدی — "
                   "همه‌ی بازی‌های یک راند هم‌زمان شروع می‌شوند)\nمثال: <code>30</code>", reply_markup=wiz_kb("onc:cb:time"))


@router.message(CreateSt.interval, F.text)
async def create_interval(m: Message, state: FSMContext):
    try:
        iv = service.parse_interval(m.text)
    except OncError as e:
        return await m.answer(f"⚠️ {e}", reply_markup=wiz_kb("onc:cb:time"))
    await state.update_data(interval=iv)
    await state.set_state(CreateSt.confirm)
    d = await state.get_data()
    await m.answer(f"🏆 <b>{E(d['name'])}</b>\n\n📅 {service.fmt_date(d['date'])}\n🕐 {d['time']}\n⏱ فاصله‌ی راندها: {iv} دقیقه\n\n"
                   f"راند ۱ — {d['time']}\nراند ۲ — {algo.round_time(d['date'], d['time'], iv, 1)[11:]}\nراند ۳ — {algo.round_time(d['date'], d['time'], iv, 2)[11:]}\n…\n\nساخته شود؟",
                   reply_markup=okb([[ob("✅ ساخت", "onc:crok")], [ob("🔙 بازگشت", "onc:cb:interval"), ob("❌ لغو", PANEL)]]))


@router.callback_query(F.data.startswith("onc:cb:"))
async def create_back(c: CallbackQuery, state: FSMContext):
    step = c.data.split(":")[2]
    prompts = {"name": (CreateSt.name, "۱ از ۴", "نام تورنمنت را بفرست", None),
               "date": (CreateSt.date, "۲ از ۴", "<b>تاریخ شروع</b> را بفرست (2026/10/10)", "onc:cb:name"),
               "time": (CreateSt.time, "۳ از ۴", "<b>ساعت شروع</b> را بفرست (20:00)", "onc:cb:date"),
               "interval": (CreateSt.interval, "۴ از ۴", "<b>فاصله‌ی راندها</b> را به دقیقه بفرست (30)", "onc:cb:time")}
    st, n, text, back = prompts[step]
    await state.set_state(st)
    await show(c, f"➕ <b>ساخت تورنمنت</b> — {n}\n\n{text}", wiz_kb(back))
    await c.answer()


@router.callback_query(F.data == "onc:crok", CreateSt.confirm)
async def create_ok(c: CallbackQuery, state: FSMContext):
    d = await state.get_data()
    try:
        tid = await service.create_tournament(c.from_user.id, d["name"], d["date"], d["time"], d["interval"])
    except OncError as e:
        return await alert(c, str(e))
    await state.clear()
    await c.answer("✅ تورنمنت ساخته شد")
    await show_dashboard(c, tid)


# ----------------------------------------------------------------- tournaments
@router.callback_query(F.data == "onc:mt")
async def manage(c: CallbackQuery, state: FSMContext):
    await state.clear()
    ts = await service.list_tournaments()
    rows = [[ob(f"{'⭐ ' if t['is_active'] else ''}{ui.STATUS_ICON[t['status']]} {t['name']}", f"onc:t:{t['id']}")] for t in ts]
    await show(c, "🏆 <b>مدیریت تورنمنت‌ها</b>" + ("" if ts else "\n\nهنوز تورنمنتی نیست."),
               okb(rows + [[ob("➕ ساخت تورنمنت", "onc:cr")], [ob("🔙 بازگشت", PANEL)]]))
    await c.answer()


async def show_dashboard(c: CallbackQuery | Message, tid: int) -> None:
    await service.sync_ready_status(tid)
    t = await service.get_tournament(tid)
    checks = await service.validation(tid)
    ready = all(ok for ok, _ in checks) and t["status"] in ("DRAFT", "READY")
    rows = [
        [ob("👥 تیم‌ها", f"onc:tm:{tid}"), ob("📁 گروه‌ها", f"onc:gm:{tid}")],
        [ob("📅 برنامه بازی‌ها", f"onc:sc:{tid}"), ob("🔴 بازی‌های زنده", f"onc:lv:{tid}")],
        [ob("⚽ نتایج", f"onc:rs:{tid}"), ob("📊 جدول رده‌بندی", f"onc:st:{tid}")],
        [ob("🏆 مرحله حذفی", f"onc:ko:{tid}"), ob("🎨 گرافیک", "onc:gx")],
        [ob("📢 کانال", "onc:ch"), ob("⚙️ تنظیمات", f"onc:ts:{tid}")],
        [ob("✅ چک‌لیست", f"onc:v:{tid}")],
    ]
    if ready:
        rows.insert(0, [ob("🚀 شروع تورنمنت", f"onc:go:{tid}")])
    rows.append([ob("🔙 تورنمنت‌ها", "onc:mt"), ob("🏠 پنل", PANEL)])
    await show(c, await ui.dashboard_text(t), okb(rows))


@router.callback_query(F.data.startswith("onc:t:"))
async def dashboard(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show_dashboard(c, int(c.data.split(":")[2]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:v:"))
async def checklist(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    t = await service.get_tournament(tid)
    checks = await service.validation(tid)
    text = f"✅ <b>چک‌لیست قبل از شروع تورنمنت</b>\n{E(t['name'])}\n\n" + "\n".join(("✓ " if ok else "✗ ") + E(txt) for ok, txt in checks)
    ready = all(ok for ok, _ in checks)
    rows = [[ob("🚀 شروع تورنمنت", f"onc:go:{tid}")]] if ready and t["status"] in ("DRAFT", "READY") else []
    text += "\n\n" + ("همه‌چیز آماده است — می‌توانی شروع کنی." if ready else "موارد ✗ را درست کن تا دکمه‌ی شروع فعال شود.")
    await show(c, text, okb(rows + [[ob("🔙 بازگشت", f"onc:t:{tid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:go:"))
async def start_tournament(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    try:
        await service.start_tournament(c.from_user.id, tid)
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("🚀 تورنمنت شروع شد")
    await show_dashboard(c, tid)


# ----------------------------------------------------------------- tournament settings
@router.callback_query(F.data.startswith("onc:ts:"))
async def tour_settings(c: CallbackQuery, state: FSMContext):
    await state.clear()
    tid = int(c.data.split(":")[2])
    t = await service.get_tournament(tid)
    rows = [
        [ob("✏️ نام", f"onc:tse:name:{tid}"), ob("📅 تاریخ", f"onc:tse:start_date:{tid}")],
        [ob("🕐 ساعت", f"onc:tse:start_time:{tid}"), ob("⏱ فاصله راندها", f"onc:tse:round_interval:{tid}")],
        [ob("⭐ انتخاب به‌عنوان فعال" if not t["is_active"] else "⭐ فعال ✓", f"onc:tsa:{tid}")],
        [ob("🗄 بایگانی" if t["status"] != "ARCHIVED" else "♻️ خروج از بایگانی", f"onc:tsz:{tid}")],
        [ob("🔁 ساخت دوباره برنامه", f"onc:cf:sg:{tid}"), ob("♻️ ریست نتایج", f"onc:cf:rr:{tid}")],
        [ob("🗑 حذف تورنمنت", f"onc:cf:dtn:{tid}")],
        [ob("🔙 بازگشت", f"onc:t:{tid}")],
    ]
    await show(c, f"⚙️ <b>تنظیمات تورنمنت</b>\n\n{await ui.dashboard_text(t)}", okb(rows))
    await c.answer()


FIELD_PROMPT = {"name": "<b>نام جدید تورنمنت</b> را بفرست", "start_date": "<b>تاریخ شروع جدید</b> را بفرست (2026/10/10)",
                "start_time": "<b>ساعت شروع جدید</b> را بفرست (20:00)", "round_interval": "<b>فاصله‌ی جدید راندها</b> را به دقیقه بفرست"}


@router.callback_query(F.data.startswith("onc:tse:"))
async def tour_edit(c: CallbackQuery, state: FSMContext):
    _, _, field, tid = c.data.split(":")
    await state.set_state(TourSt.edit)
    await state.update_data(field=field, tid=int(tid))
    await show(c, FIELD_PROMPT[field], okb([[ob("❌ لغو", f"onc:ts:{tid}")]]))
    await c.answer()


@router.message(TourSt.edit, F.text)
async def tour_edit_value(m: Message, state: FSMContext):
    d = await state.get_data()
    try:
        val = {"name": lambda s: s.strip(), "start_date": service.parse_date, "start_time": service.parse_time,
               "round_interval": service.parse_interval}[d["field"]](m.text)
        await service.update_tournament(m.from_user.id, d["tid"], **{d["field"]: val})
    except OncError as e:
        return await m.answer(f"⚠️ {e}", reply_markup=okb([[ob("❌ لغو", f"onc:ts:{d['tid']}")]]))
    await state.clear()
    await show_dashboard(m, d["tid"])


@router.callback_query(F.data.startswith("onc:tsa:"))
async def tour_active(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    await service.set_active(c.from_user.id, tid)
    await c.answer("⭐ تورنمنت فعال تغییر کرد")
    await show_dashboard(c, tid)


@router.callback_query(F.data.startswith("onc:tsz:"))
async def tour_archive(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    t = await service.get_tournament(tid)
    if t["status"] == "ARCHIVED":
        await service.set_status(c.from_user.id, tid, "FINISHED" if t["champion_team_id"] else "DRAFT")
        await service.sync_ready_status(tid)
    else:
        await service.set_status(c.from_user.id, tid, "ARCHIVED")
    await c.answer("انجام شد")
    await show_dashboard(c, tid)


# ----------------------------------------------------------------- dangerous operations: one confirmation screen
CONFIRM = {
    "dtn": ("حذف تورنمنت", "همه‌ی تیم‌ها، گروه‌ها، بازی‌ها، نتایج و سوابق انتشار این تورنمنت حذف می‌شود. پست‌های کانال در کانال می‌مانند.", "onc:ts:{id}"),
    "dg": ("حذف گروه", "گروه حذف می‌شود. تیم‌های آن حذف نمی‌شوند و بدون گروه می‌مانند.", "onc:gp:{id}"),
    "dt": ("حذف تیم", "تیم و بازیکنانش حذف می‌شوند.", "onc:te:{id}"),
    "rr": ("ریست نتایج", "همه‌ی نتایج، تصمیم‌های تساوی و مرحله‌های حذفی این تورنمنت پاک می‌شود و همه‌ی راندها دوباره باز می‌شوند. جدول صفر می‌شود.", "onc:ts:{id}"),
    "sg": ("ساخت دوباره برنامه", "همه‌ی راندها و بازی‌های گروهی از روی گروه‌های فعلی دوباره ساخته می‌شود. تا وقتی نتیجه‌ای ثبت شده، انجام نمی‌شود.", "onc:sc:{id}"),
    "gd": ("قرعه‌کشی خودکار", "همه‌ی تیم‌ها دوباره به‌صورت تصادفی بین گروه‌های موجود پخش می‌شوند (تقسیم فعلی عوض می‌شود).", "onc:gm:{id}"),
    "dks": ("حذف مرحله حذفی", "این مرحله‌ی حذفی (تأییدنشده) و بازی‌هایش حذف می‌شود.", "onc:ks:{id}"),
    "dss": ("حذف ست تمپلیت", "ست و همه‌ی تمپلیت‌هایش حذف می‌شوند.", "onc:xsp:{id}"),
    "dtp": ("حذف تمپلیت", "تمپلیت حذف می‌شود.", "onc:xt:{id}"),
    "chx": ("حذف کانال", "انتشار متوقف می‌شود تا کانال جدیدی تنظیم کنی.", "onc:ch"),
}


@router.callback_query(F.data.startswith("onc:cf:"))
async def confirm_screen(c: CallbackQuery):
    _, _, code, ident = c.data.split(":")
    title, why, back = CONFIRM[code]
    await show(c, f"⚠️ <b>مطمئنی؟</b>\n\n<b>{title}</b>\n{why}",
               okb([[ob("✅ تأیید", f"onc:cy:{code}:{ident}")], [ob("❌ لغو", back.format(id=ident))]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:cy:"))
async def confirm_do(c: CallbackQuery, bot: Bot):
    _, _, code, ident = c.data.split(":")
    uid, i = c.from_user.id, int(ident)
    try:
        if code == "dtn":
            await service.delete_tournament(uid, i)
            await c.answer("حذف شد")
            return await _to_manage(c)
        if code == "dg":
            g = await service.get_group(i)
            await service.delete_group(uid, i)
            await c.answer("گروه حذف شد")
            return await groups_screen(c, g["tournament_id"])
        if code == "dt":
            team = await service.get_team(i)
            await service.delete_team(uid, i)
            await c.answer("تیم حذف شد")
            return await teams_screen(c, team["tournament_id"])
        if code == "rr":
            await service.reset_results(uid, i)
            await c.answer("نتایج ریست شد")
            return await show_dashboard(c, i)
        if code == "sg":
            r = await service.generate_schedule(uid, i)
            await c.answer(f"✅ {r['rounds']} راند، {r['matches']} matches")
            return await schedule_screen(c, i)
        if code == "gd":
            await service.auto_draw(uid, i)
            await c.answer("🎲 قرعه‌کشی انجام شد")
            return await groups_screen(c, i)
        if code == "dks":
            r = await service.get_round(i)
            await service.delete_ko_stage(uid, i)
            await c.answer("مرحله حذف شد")
            from .handlers_play import ko_screen
            return await ko_screen(c, str(r["tournament_id"]))
        if code == "dss":
            await templates.delete_set(i)
            await service.audit(uid, "DELETE TEMPLATE SET", str(i))
            await c.answer("حذف شد")
            from .handlers_gfx import sets_screen
            return await sets_screen(c)
        if code == "dtp":
            t = await templates.get_template(i)
            await templates.delete_template(i)
            await service.audit(uid, "DELETE TEMPLATE", t["name"])
            await c.answer("حذف شد")
            from .handlers_gfx import set_screen
            return await set_screen(c, t["set_id"])
        if code == "chx":
            await service.set_setting("channel_id", "")
            await service.audit(uid, "REMOVE CHANNEL")
            await c.answer("کانال حذف شد")
            from .handlers_gfx import channel_screen
            return await channel_screen(c, bot)
    except (OncError, ValueError) as e:
        await alert(c, str(e))


async def _to_manage(c):
    ts = await service.list_tournaments()
    rows = [[ob(f"{'⭐ ' if t['is_active'] else ''}{ui.STATUS_ICON[t['status']]} {t['name']}", f"onc:t:{t['id']}")] for t in ts]
    await show(c, "🏆 <b>مدیریت تورنمنت‌ها</b>", okb(rows + [[ob("➕ ساخت تورنمنت", "onc:cr")], [ob("🔙 بازگشت", PANEL)]]))


# ----------------------------------------------------------------- teams
async def teams_screen(c, tid: int) -> None:
    t = await service.get_tournament(tid)
    teams = await service.teams_of(tid)
    lines = [f"• {E(x['name'])}  <i>{E(x['group_name'] or '— بدون گروه')}</i>" for x in teams]
    rows = ui.grid([ob(x["name"], f"onc:te:{x['id']}") for x in teams], 2)
    await show(c, f"👥 <b>تیم‌ها و بازیکنان</b> — {E(t['name'])}\n\n" + ("\n".join(lines) if lines else "هنوز تیمی نیست."),
               okb(rows + [[ob("➕ افزودن تیم", f"onc:ta:{tid}")], [ob("🔙 بازگشت", f"onc:t:{tid}")]]))


@router.callback_query(F.data.startswith("onc:tm:"))
async def teams_list(c: CallbackQuery, state: FSMContext):
    await state.clear()
    t = await tid_of(c, c.data.split(":")[2])
    if t:
        await teams_screen(c, t["id"])
        await c.answer()


@router.callback_query(F.data.startswith("onc:ta:"))
async def team_add(c: CallbackQuery, state: FSMContext):
    tid = int(c.data.split(":")[2])
    await state.clear()
    await state.set_state(TeamSt.name)
    await state.update_data(tid=tid)
    await show(c, "➕ <b>افزودن تیم</b> — ۱ از ۲\n\n<b>نام تیم</b> را بفرست", okb([[ob("❌ لغو", f"onc:tm:{tid}")]]))
    await c.answer()


@router.message(TeamSt.name, F.text)
async def team_name(m: Message, state: FSMContext):
    d = await state.get_data()
    name = m.text.strip()
    if len(name) > 30 or not name:
        return await m.answer("نام تیم باید بین ۱ تا ۳۰ کاراکتر باشد.")
    if any(t["name"].lower() == name.lower() for t in await service.teams_of(d["tid"])):
        return await m.answer("⚠️ تیمی با این نام وجود دارد. نام دیگری بفرست.")
    await state.update_data(name=name)
    await state.set_state(TeamSt.logo)
    await m.answer(f"➕ <b>افزودن تیم</b> — ۲ از ۲\n\n<b>{E(name)}</b>\n<b>لوگوی تیم</b> را به‌صورت عکس بفرست (فقط در پوستر قهرمان استفاده می‌شود).",
                   reply_markup=okb([[ob("⏭ بدون لوگو", "onc:tasl")], [ob("🔙 بازگشت", f"onc:ta:{d['tid']}"), ob("❌ لغو", f"onc:tm:{d['tid']}")]]))


def _file_id(m: Message) -> str | None:
    if m.photo:
        return m.photo[-1].file_id
    if m.document and (m.document.mime_type or "").startswith("image/"):
        return m.document.file_id
    return None


async def _finish_team(m, state: FSMContext, uid: int, logo: str | None):
    d = await state.get_data()
    try:
        team_id = await service.add_team(uid, d["tid"], d["name"], logo)
    except OncError as e:
        return await m.answer(f"⚠️ {e}")
    await state.clear()
    await send_team_page(m, team_id, note="✅ تیم اضافه شد. حالا بازیکن‌هایش را اضافه کن:")


@router.message(TeamSt.logo, F.photo | F.document)
async def team_logo(m: Message, state: FSMContext):
    fid = _file_id(m)
    if not fid:
        return await m.answer("یک تصویر (عکس) بفرست.")
    await _finish_team(m, state, m.from_user.id, fid)


@router.callback_query(F.data == "onc:tasl", TeamSt.logo)
async def team_logo_skip(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await _finish_team(c.message, state, c.from_user.id, None)


async def send_team_page(target, team_id: int, note: str = "") -> None:
    team = await service.get_team(team_id)
    players = await service.players_of(team_id)
    text = (f"{note}\n\n" if note else "") + (
        f"👥 <b>{E(team['name'])}</b>\n📁 {E(team['group_name'] or 'بدون گروه')}\n🖼 لوگو: {'✅' if team['logo_file_id'] else '—'}\n\n"
        f"<b>بازیکنان ({len(players)})</b>\n" + ("\n".join(f"• <code>{E(p['player_id'])}</code>" for p in players) or "—"))
    tid = team["tournament_id"]
    rows = [
        [ob("✏️ تغییر نام", f"onc:ter:{team_id}"), ob("🖼 تغییر لوگو", f"onc:tel:{team_id}")],
        [ob("👥 مدیریت بازیکنان", f"onc:tp:{team_id}")],
        [ob("📁 تعیین / تغییر گروه", f"onc:tg:{team_id}")],
        [ob("🧢 کاپیتان/منیجر", f"onc:tc:{team_id}"), ob("📢 انتشار لیست در کانال", f"onc:tpub:{team_id}")],
    ]
    if team["group_id"]:
        rows.append([ob("➖ خروج از گروه", f"onc:tgx:{team_id}")])
    rows += [[ob("🗑 حذف تیم", f"onc:cf:dt:{team_id}")], [ob("🔙 تیم‌ها", f"onc:tm:{tid}")]]
    await show(target, text, okb(rows))


@router.callback_query(F.data.startswith("onc:te:"))
async def team_page(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await send_team_page(c, int(c.data.split(":")[2]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:ter:"))
async def team_rename(c: CallbackQuery, state: FSMContext):
    team_id = int(c.data.split(":")[2])
    await state.set_state(TeamSt.rename)
    await state.update_data(team=team_id)
    await show(c, "✏️ <b>نام جدید تیم</b> را بفرست", okb([[ob("❌ لغو", f"onc:te:{team_id}")]]))
    await c.answer()


@router.message(TeamSt.rename, F.text)
async def team_rename_do(m: Message, state: FSMContext):
    d = await state.get_data()
    try:
        await service.rename_team(m.from_user.id, d["team"], m.text)
    except OncError as e:
        return await m.answer(f"⚠️ {e}")
    await state.clear()
    await send_team_page(m, d["team"], "✅ نام عوض شد")


@router.callback_query(F.data.startswith("onc:tel:"))
async def team_newlogo(c: CallbackQuery, state: FSMContext):
    team_id = int(c.data.split(":")[2])
    await state.set_state(TeamSt.newlogo)
    await state.update_data(team=team_id)
    await show(c, "🖼 <b>لوگوی جدید</b> را به‌صورت عکس بفرست", okb([[ob("❌ لغو", f"onc:te:{team_id}")]]))
    await c.answer()


@router.message(TeamSt.newlogo, F.photo | F.document)
async def team_newlogo_do(m: Message, state: FSMContext):
    fid = _file_id(m)
    if not fid:
        return await m.answer("یک تصویر (عکس) بفرست.")
    d = await state.get_data()
    await service.set_logo(m.from_user.id, d["team"], fid)
    await state.clear()
    await send_team_page(m, d["team"], "✅ لوگو عوض شد")


@router.callback_query(F.data.startswith("onc:tp:"))
async def players_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await players_screen(c, int(c.data.split(":")[2]))
    await c.answer()


async def players_screen(c, team_id: int) -> None:
    team = await service.get_team(team_id)
    players = await service.players_of(team_id)
    rows = [[ob(f"➖ {p['player_id']}", f"onc:tpd:{p['id']}")] for p in players]
    await show(c, f"👥 <b>{E(team['name'])}</b> — بازیکنان ({len(players)})\n\nروی بازیکن بزن تا حذف شود.",
               okb(rows + [[ob("➕ افزودن بازیکن", f"onc:tpa:{team_id}")], [ob("🔙 بازگشت", f"onc:te:{team_id}")]]))


@router.callback_query(F.data.startswith("onc:tpd:"))
async def player_remove(c: CallbackQuery):
    p = await service.dbx.fetchone("SELECT * FROM onc_players WHERE id=?", int(c.data.split(":")[2]))
    if p:
        await service.remove_player(c.from_user.id, p["id"])
        await c.answer("حذف شد")
        await players_screen(c, p["team_id"])


@router.callback_query(F.data.startswith("onc:tpa:"))
async def player_add(c: CallbackQuery, state: FSMContext):
    team_id = int(c.data.split(":")[2])
    await state.set_state(TeamSt.players)
    await state.update_data(team=team_id)
    await show(c, "➕ <b>افزودن بازیکن</b>\n\nیک یا چند <b>آیدی بازیکن</b> بفرست (هر خط یکی، یا با ویرگول جدا).\nوقتی تمام شد «تمام» را بزن.",
               okb([[ob("✅ تمام", f"onc:tp:{team_id}")]]))
    await c.answer()


@router.message(TeamSt.players, F.text)
async def player_add_do(m: Message, state: FSMContext):
    d = await state.get_data()
    if m.text.strip().lower() in ("/done", "done", "تمام"):
        await state.clear()
        return await send_team_page(m, d["team"])
    ids = [x.strip() for x in m.text.replace(",", "\n").splitlines() if x.strip()]
    ok, bad = 0, []
    for pid in ids:
        try:
            await service.add_player(m.from_user.id, d["team"], pid)
            ok += 1
        except OncError as e:
            bad.append(f"{pid}: {e}")
    await m.answer(f"✅ اضافه شد: {ok}" + ("\n⚠️ " + "\n⚠️ ".join(bad) if bad else "") + "\n\nآیدی بیشتری بفرست یا «تمام» را بزن.",
                   reply_markup=okb([[ob("✅ تمام", f"onc:tp:{d['team']}")]]))


@router.callback_query(F.data.startswith("onc:tg:"))
async def team_group_pick(c: CallbackQuery):
    team_id = int(c.data.split(":")[2])
    team = await service.get_team(team_id)
    groups = await service.groups_of(team["tournament_id"])
    if not groups:
        return await alert(c, "اول یک گروه بساز (بخش گروه‌ها).")
    rows = ui.grid([ob(("✓ " if g["id"] == team["group_id"] else "") + g["name"], f"onc:tga:{team_id}:{g['id']}") for g in groups], 2)
    await show(c, f"📁 <b>{E(team['name'])}</b> — یک گروه انتخاب کن\nگروه فعلی: {E(team['group_name'] or '—')}", okb(rows + [[ob("🔙 بازگشت", f"onc:te:{team_id}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:tga:"))
async def team_group_set(c: CallbackQuery):
    _, _, team_id, gid = c.data.split(":")
    try:
        await service.assign_team(c.from_user.id, int(team_id), int(gid))
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("✅ انجام شد")
    await send_team_page(c, int(team_id))


@router.callback_query(F.data.startswith("onc:tgx:"))
async def team_group_remove(c: CallbackQuery):
    team_id = int(c.data.split(":")[2])
    try:
        await service.assign_team(c.from_user.id, team_id, None)
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("از گروه خارج شد")
    await send_team_page(c, team_id)


# ----------------------------------------------------------------- groups
async def groups_screen(c, tid: int) -> None:
    t = await service.get_tournament(tid)
    groups = await service.groups_of(tid)
    teams = await service.teams_of(tid)
    unassigned = [x for x in teams if not x["group_id"]]
    lines = [f"<b>{E(g['name'])}</b> — {len(g['members'])} تیم · صعودکننده: {g['qualifiers'] if g['qualifiers'] is not None else '—'}\n   "
             + (", ".join(E(m["name"]) for m in g["members"]) or "<i>خالی</i>") for g in groups]
    if unassigned:
        lines.append(f"\n<i>بدون گروه ({len(unassigned)}):</i> " + ", ".join(E(x["name"]) for x in unassigned))
    rows = ui.grid([ob(g["name"], f"onc:gp:{g['id']}") for g in groups], 2)
    rows += [[ob("➕ ساخت گروه جدید", f"onc:gc:{tid}"), ob("🎲 قرعه‌کشی خودکار", f"onc:cf:gd:{tid}")]]
    if unassigned:
        rows.append([ob("✋ تعیین گروه تیم‌های بی‌گروه", f"onc:gu:{tid}")])
    rows.append([ob("🔙 بازگشت", f"onc:t:{tid}")])
    await show(c, f"📁 <b>مدیریت گروه‌ها</b> — {E(t['name'])}\n\n" + ("\n".join(lines) if lines else "هنوز گروهی نیست."), okb(rows))


@router.callback_query(F.data.startswith("onc:gm:"))
async def groups_list(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await groups_screen(c, int(c.data.split(":")[2]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:gc:"))
async def group_create(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    try:
        await service.create_group(c.from_user.id, tid)
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("گروه ساخته شد")
    await groups_screen(c, tid)


@router.callback_query(F.data.startswith("onc:gu:"))
async def unassigned_pick(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    un = [x for x in await service.teams_of(tid) if not x["group_id"]]
    if not un:
        return await groups_screen(c, tid)
    rows = ui.grid([ob(x["name"], f"onc:tg:{x['id']}") for x in un], 2)
    await show(c, "✋ <b>تعیین دستی گروه</b>\nیک تیم را انتخاب کن، بعد گروهش را.", okb(rows + [[ob("🔙 بازگشت", f"onc:gm:{tid}")]]))
    await c.answer()


async def group_page(c, gid: int) -> None:
    g = await service.get_group(gid)
    text = (f"📁 <b>{E(g['name'])}</b>\n\nتیم‌ها ({len(g['members'])}):\n" + ("\n".join(f"• {E(m['name'])}" for m in g["members"]) or "—")
            + f"\n\nصعودکننده‌ها: <b>{g['qualifiers'] if g['qualifiers'] is not None else 'not set'}</b>")
    rows = [
        [ob("➕ افزودن تیم", f"onc:gat:{gid}"), ob("➖ حذف تیم از گروه", f"onc:grt:{gid}")],
        [ob("🔄 جابه‌جایی تیم", f"onc:gmt:{gid}"), ob("🔢 تعداد صعودکننده", f"onc:gq:{gid}")],
        [ob("✏️ تغییر نام", f"onc:gr:{gid}"), ob("🗑 حذف گروه", f"onc:cf:dg:{gid}")],
        [ob("🔙 گروه‌ها", f"onc:gm:{g['tournament_id']}")],
    ]
    await show(c, text, okb(rows))


@router.callback_query(F.data.startswith("onc:gp:"))
async def group_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await group_page(c, int(c.data.split(":")[2]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:gr:"))
async def group_rename(c: CallbackQuery, state: FSMContext):
    gid = int(c.data.split(":")[2])
    await state.set_state(GroupSt.rename)
    await state.update_data(gid=gid)
    await show(c, "✏️ <b>نام جدید گروه</b> را بفرست", okb([[ob("❌ لغو", f"onc:gp:{gid}")]]))
    await c.answer()


@router.message(GroupSt.rename, F.text)
async def group_rename_do(m: Message, state: FSMContext):
    d = await state.get_data()
    try:
        await service.rename_group(m.from_user.id, d["gid"], m.text)
    except OncError as e:
        return await m.answer(f"⚠️ {e}")
    await state.clear()
    await group_page(m, d["gid"])


@router.callback_query(F.data.startswith("onc:gat:"))
async def group_add_pick(c: CallbackQuery):
    gid = int(c.data.split(":")[2])
    g = await service.get_group(gid)
    un = [x for x in await service.teams_of(g["tournament_id"]) if not x["group_id"]]
    rows = ui.grid([ob(x["name"], f"onc:gaa:{gid}:{x['id']}") for x in un], 2)
    await show(c, f"➕ افزودن تیم به <b>{E(g['name'])}</b>" + ("" if un else "\n\nتیم بدون گروهی نیست."), okb(rows + [[ob("🔙 بازگشت", f"onc:gp:{gid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:gaa:"))
async def group_add_do(c: CallbackQuery):
    _, _, gid, team_id = c.data.split(":")
    try:
        await service.assign_team(c.from_user.id, int(team_id), int(gid))
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("اضافه شد")
    await group_add_pick(c)


@router.callback_query(F.data.startswith("onc:grt:"))
async def group_remove_pick(c: CallbackQuery):
    gid = int(c.data.split(":")[2])
    g = await service.get_group(gid)
    rows = ui.grid([ob(f"➖ {m['name']}", f"onc:grx:{gid}:{m['id']}") for m in g["members"]], 2)
    await show(c, f"➖ حذف تیم از <b>{E(g['name'])}</b>\n(تیم در تورنمنت می‌ماند، فقط بدون گروه می‌شود)", okb(rows + [[ob("🔙 بازگشت", f"onc:gp:{gid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:grx:"))
async def group_remove_do(c: CallbackQuery):
    _, _, gid, team_id = c.data.split(":")
    try:
        await service.assign_team(c.from_user.id, int(team_id), None)
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("حذف شد")
    await group_page(c, int(gid))


@router.callback_query(F.data.startswith("onc:gmt:"))
async def group_move_pick(c: CallbackQuery):
    gid = int(c.data.split(":")[2])
    g = await service.get_group(gid)
    rows = ui.grid([ob(f"🔄 {m['name']}", f"onc:gmm:{gid}:{m['id']}") for m in g["members"]], 2)
    await show(c, f"🔄 کدام تیم از <b>{E(g['name'])}</b>?", okb(rows + [[ob("🔙 بازگشت", f"onc:gp:{gid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:gmm:"))
async def group_move_target(c: CallbackQuery):
    _, _, gid, team_id = c.data.split(":")
    g = await service.get_group(int(gid))
    others = [x for x in await service.groups_of(g["tournament_id"]) if x["id"] != int(gid)]
    team = await service.get_team(int(team_id))
    if not others:
        return await alert(c, "گروه دیگری وجود ندارد.")
    rows = ui.grid([ob(x["name"], f"onc:tga:{team_id}:{x['id']}") for x in others], 2)
    await show(c, f"🔄 انتقال <b>{E(team['name'])}</b> to…", okb(rows + [[ob("🔙 بازگشت", f"onc:gp:{gid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:gq:"))
async def qualifiers_pick(c: CallbackQuery):
    gid = int(c.data.split(":")[2])
    g = await service.get_group(gid)
    n = len(g["members"])
    rows = ui.grid([ob(("✓ " if g["qualifiers"] == i else "") + str(i), f"onc:gqs:{gid}:{i}") for i in range(0, n + 1)], 5)
    await show(c, f"🔢 <b>تعداد صعودکننده</b> — {E(g['name'])}\n\nچند تیم از این گروه صعود می‌کنند؟\nمقدار فعلی: {g['qualifiers'] if g['qualifiers'] is not None else 'not set'}",
               okb(rows + [[ob("🔙 بازگشت", f"onc:gp:{gid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:gqs:"))
async def qualifiers_set(c: CallbackQuery):
    _, _, gid, n = c.data.split(":")
    try:
        await service.set_qualifiers(c.from_user.id, int(gid), int(n))
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("ذخیره شد")
    await group_page(c, int(gid))


# ----------------------------------------------------------------- schedule
async def schedule_screen(c, tid: int) -> None:
    t = await service.get_tournament(tid)
    rounds = await service.rounds_of(tid)
    parts = []
    for r in rounds:
        ms = await service.matches_of_round(r["id"])
        if not ms:
            continue
        gl = {}
        for m in ms:
            gl.setdefault(m["group_name"] or "", []).append(f"{E(m['name_a'])} vs {E(m['name_b'])}")
        body = "\n".join((f"<i>{E(g)}</i>: " if g else "") + " · ".join(v) for g, v in gl.items())
        parts.append(f"<b>{r['start_at'][11:]}</b> — {await service.round_label(r)}\n{body}")
    text = f"📅 <b>برنامه بازی‌ها</b> — {E(t['name'])}\n⏱ فاصله‌ی راندها {t['round_interval']} دقیقه (بازی‌های هر راند هم‌زمان‌اند)\n\n" + (
        "\n\n".join(parts) if parts else "Not generated yet.")
    rows = []
    has_group_rounds = any(r["stage"] == "GROUP" for r in rounds)
    rows.append([ob("🔁 ساخت دوباره برنامه" if has_group_rounds else "⚙️ ساخت برنامه",
                    f"onc:cf:sg:{tid}" if has_group_rounds else f"onc:cy:sg:{tid}")])
    if rounds:
        rows.append([ob("📢 انتشار برنامه", f"onc:sp:{tid}")])
    rows.append([ob("🔙 بازگشت", f"onc:t:{tid}")])
    await show(c, text[:4000], okb(rows))


@router.callback_query(F.data.startswith("onc:sc:"))
async def schedule_open(c: CallbackQuery):
    await schedule_screen(c, int(c.data.split(":")[2]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:sp:"))
async def schedule_publish(c: CallbackQuery, bot: Bot):
    tid = int(c.data.split(":")[2])
    try:
        res = await publish.schedule(bot, tid, c.from_user.id)
    except (OncError, publish.PublishError) as e:
        return await alert(c, str(e))
    await c.answer(f"📢 برنامه در کانال منتشر شد ({res['sent']} جدید، {res['edited']} ویرایش‌شده).")


# ----------------------------------------------------------------- settings / audit
@router.callback_query(F.data == "onc:se")
async def settings(c: CallbackQuery):
    auto = await service.get_setting("auto_standings", "0") == "1"
    await show(c, "⚙️ <b>تنظیمات</b>\n\nبعد از «تأیید و انتشار» هر راند گروهی، گرافیک جدول به‌روز هم منتشر شود:\n"
               f"<b>{'روشن' if auto else 'خاموش'}</b>",
               okb([[ob(f"📊 انتشار خودکار جدول: {'روشن ✅' if auto else 'خاموش'}", "onc:seas")],
                    [ob("🧾 گزارش عملیات", "onc:au")], [ob("🔙 بازگشت", PANEL)]]))
    await c.answer()


@router.callback_query(F.data == "onc:seas")
async def settings_auto(c: CallbackQuery):
    cur = await service.get_setting("auto_standings", "0") == "1"
    await service.set_setting("auto_standings", "0" if cur else "1")
    await service.audit(c.from_user.id, "SETTING auto_standings", "OFF" if cur else "ON")
    await settings(c)


@router.callback_query(F.data == "onc:au")
async def audit_view(c: CallbackQuery):
    rows = await service.audit_log(limit=12)
    import datetime as dt
    lines = []
    for r in rows:
        ts = dt.datetime.fromtimestamp(r["ts"]).strftime("%m/%d %H:%M")
        lines.append(f"<b>{E(ui.AUDIT_FA.get(r['action'], r['action']))}</b> · ادمین {r['admin_id']} · {ts}" + (f"\n{E(r['details'])}" if r["details"] else ""))
    await show(c, "🧾 <b>گزارش عملیات</b>\n\n" + ("\n\n".join(lines) if lines else "Empty."), okb([[ob("🔙 بازگشت", "onc:se")]]))
    await c.answer()
