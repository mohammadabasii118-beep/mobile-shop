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
        await show(c, "🏆 No tournament selected.\nCreate one or open MANAGE TOURNAMENTS.",
                   okb([[ob("➕ CREATE TOURNAMENT", "onc:cr")], [ob("🏆 MANAGE TOURNAMENTS", "onc:mt")], [ob("🔙 ADMIN PANEL", PANEL)]]))
        await c.answer()
    return t


# ----------------------------------------------------------------- panel
def panel_markup():
    return okb([
        [ob("➕ CREATE TOURNAMENT", "onc:cr"), ob("🏆 MANAGE TOURNAMENTS", "onc:mt")],
        [ob("🔴 LIVE MATCHES", "onc:lv:0"), ob("📊 STANDINGS", "onc:st:0")],
        [ob("🏆 KNOCKOUT", "onc:ko:0"), ob("👥 TEAMS & PLAYERS", "onc:tm:0")],
        [ob("🎨 GRAPHICS", "onc:gx"), ob("📢 CHANNEL", "onc:ch")],
        [ob("⚙️ SETTINGS", "onc:se")],
        [ob("🔙 ADMIN PANEL", "admhome")],
    ])


async def panel_text() -> str:
    t = await service.active_tournament()
    head = "🏆 <b>ONE NIGHT CHAMPION — ADMIN</b>"
    if t:
        head += f"\n\nActive: <b>{E(t['name'])}</b>  {ui.STATUS_ICON[t['status']]} {t['status']}"
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
        row.append(ob("🔙 BACK", back))
    row.append(ob("❌ CANCEL", PANEL))
    return okb([row])


@router.callback_query(F.data == "onc:cr")
async def create_start(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await state.set_state(CreateSt.name)
    await show(c, "➕ <b>CREATE TOURNAMENT</b> — 1/4\n\nSend the <b>TOURNAMENT NAME</b>\nExample: <code>ONE NIGHT CHAMPION #5</code>", wiz_kb(None))
    await c.answer()


@router.message(CreateSt.name, F.text)
async def create_name(m: Message, state: FSMContext):
    name = m.text.strip()
    if not name or len(name) > 60:
        return await m.answer("Name must be 1–60 characters. Try again.", reply_markup=wiz_kb(None))
    await state.update_data(name=name)
    await state.set_state(CreateSt.date)
    await m.answer("➕ <b>CREATE TOURNAMENT</b> — 2/4\n\nSend the <b>START DATE</b>\nExample: <code>2026/10/10</code>", reply_markup=wiz_kb("onc:cb:name"))


@router.message(CreateSt.date, F.text)
async def create_date(m: Message, state: FSMContext):
    try:
        date = service.parse_date(m.text)
    except OncError as e:
        return await m.answer(f"⚠️ {e}", reply_markup=wiz_kb("onc:cb:name"))
    await state.update_data(date=date)
    await state.set_state(CreateSt.time)
    await m.answer("➕ <b>CREATE TOURNAMENT</b> — 3/4\n\nSend the <b>START TIME</b>\nExample: <code>20:00</code>", reply_markup=wiz_kb("onc:cb:date"))


@router.message(CreateSt.time, F.text)
async def create_time(m: Message, state: FSMContext):
    try:
        tm = service.parse_time(m.text)
    except OncError as e:
        return await m.answer(f"⚠️ {e}", reply_markup=wiz_kb("onc:cb:date"))
    await state.update_data(time=tm)
    await state.set_state(CreateSt.interval)
    await m.answer("➕ <b>CREATE TOURNAMENT</b> — 4/4\n\nSend the <b>ROUND INTERVAL</b> in minutes (time from one ROUND to the next — "
                   "all matches of a round start together)\nExample: <code>30</code>", reply_markup=wiz_kb("onc:cb:time"))


@router.message(CreateSt.interval, F.text)
async def create_interval(m: Message, state: FSMContext):
    try:
        iv = service.parse_interval(m.text)
    except OncError as e:
        return await m.answer(f"⚠️ {e}", reply_markup=wiz_kb("onc:cb:time"))
    await state.update_data(interval=iv)
    await state.set_state(CreateSt.confirm)
    d = await state.get_data()
    await m.answer(f"🏆 <b>{E(d['name'])}</b>\n\n📅 {service.fmt_date(d['date'])}\n🕐 {d['time']}\n⏱ ROUND INTERVAL: {iv} MIN\n\n"
                   f"ROUND 1 — {d['time']}\nROUND 2 — {algo.round_time(d['date'], d['time'], iv, 1)[11:]}\nROUND 3 — {algo.round_time(d['date'], d['time'], iv, 2)[11:]}\n…\n\nCreate it?",
                   reply_markup=okb([[ob("✅ CREATE", "onc:crok")], [ob("🔙 BACK", "onc:cb:interval"), ob("❌ CANCEL", PANEL)]]))


@router.callback_query(F.data.startswith("onc:cb:"))
async def create_back(c: CallbackQuery, state: FSMContext):
    step = c.data.split(":")[2]
    prompts = {"name": (CreateSt.name, "1/4", "Send the <b>TOURNAMENT NAME</b>", None),
               "date": (CreateSt.date, "2/4", "Send the <b>START DATE</b> (2026/10/10)", "onc:cb:name"),
               "time": (CreateSt.time, "3/4", "Send the <b>START TIME</b> (20:00)", "onc:cb:date"),
               "interval": (CreateSt.interval, "4/4", "Send the <b>ROUND INTERVAL</b> in minutes (30)", "onc:cb:time")}
    st, n, text, back = prompts[step]
    await state.set_state(st)
    await show(c, f"➕ <b>CREATE TOURNAMENT</b> — {n}\n\n{text}", wiz_kb(back))
    await c.answer()


@router.callback_query(F.data == "onc:crok", CreateSt.confirm)
async def create_ok(c: CallbackQuery, state: FSMContext):
    d = await state.get_data()
    try:
        tid = await service.create_tournament(c.from_user.id, d["name"], d["date"], d["time"], d["interval"])
    except OncError as e:
        return await alert(c, str(e))
    await state.clear()
    await c.answer("✅ Tournament created")
    await show_dashboard(c, tid)


# ----------------------------------------------------------------- tournaments
@router.callback_query(F.data == "onc:mt")
async def manage(c: CallbackQuery, state: FSMContext):
    await state.clear()
    ts = await service.list_tournaments()
    rows = [[ob(f"{'⭐ ' if t['is_active'] else ''}{ui.STATUS_ICON[t['status']]} {t['name']}", f"onc:t:{t['id']}")] for t in ts]
    await show(c, "🏆 <b>MANAGE TOURNAMENTS</b>" + ("" if ts else "\n\nNo tournaments yet."),
               okb(rows + [[ob("➕ CREATE TOURNAMENT", "onc:cr")], [ob("🔙 BACK", PANEL)]]))
    await c.answer()


async def show_dashboard(c: CallbackQuery | Message, tid: int) -> None:
    await service.sync_ready_status(tid)
    t = await service.get_tournament(tid)
    checks = await service.validation(tid)
    ready = all(ok for ok, _ in checks) and t["status"] in ("DRAFT", "READY")
    rows = [
        [ob("👥 TEAMS", f"onc:tm:{tid}"), ob("📁 GROUPS", f"onc:gm:{tid}")],
        [ob("📅 SCHEDULE", f"onc:sc:{tid}"), ob("🔴 LIVE MATCHES", f"onc:lv:{tid}")],
        [ob("⚽ RESULTS", f"onc:rs:{tid}"), ob("📊 STANDINGS", f"onc:st:{tid}")],
        [ob("🏆 KNOCKOUT", f"onc:ko:{tid}"), ob("🎨 GRAPHICS", "onc:gx")],
        [ob("📢 CHANNEL", "onc:ch"), ob("⚙️ SETTINGS", f"onc:ts:{tid}")],
        [ob("✅ CHECKLIST", f"onc:v:{tid}")],
    ]
    if ready:
        rows.insert(0, [ob("🚀 START TOURNAMENT", f"onc:go:{tid}")])
    rows.append([ob("🔙 TOURNAMENTS", "onc:mt"), ob("🏠 PANEL", PANEL)])
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
    text = f"✅ <b>PRE-TOURNAMENT CHECKLIST</b>\n{E(t['name'])}\n\n" + "\n".join(("✓ " if ok else "✗ ") + E(txt) for ok, txt in checks)
    ready = all(ok for ok, _ in checks)
    rows = [[ob("🚀 START TOURNAMENT", f"onc:go:{tid}")]] if ready and t["status"] in ("DRAFT", "READY") else []
    text += "\n\n" + ("All set — you can start." if ready else "Fix the ✗ items to enable START.")
    await show(c, text, okb(rows + [[ob("🔙 BACK", f"onc:t:{tid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:go:"))
async def start_tournament(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    try:
        await service.start_tournament(c.from_user.id, tid)
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("🚀 Tournament is LIVE")
    await show_dashboard(c, tid)


# ----------------------------------------------------------------- tournament settings
@router.callback_query(F.data.startswith("onc:ts:"))
async def tour_settings(c: CallbackQuery, state: FSMContext):
    await state.clear()
    tid = int(c.data.split(":")[2])
    t = await service.get_tournament(tid)
    rows = [
        [ob("✏️ NAME", f"onc:tse:name:{tid}"), ob("📅 DATE", f"onc:tse:start_date:{tid}")],
        [ob("🕐 TIME", f"onc:tse:start_time:{tid}"), ob("⏱ INTERVAL", f"onc:tse:round_interval:{tid}")],
        [ob("⭐ SET ACTIVE" if not t["is_active"] else "⭐ ACTIVE ✓", f"onc:tsa:{tid}")],
        [ob("🗄 ARCHIVE" if t["status"] != "ARCHIVED" else "♻️ UNARCHIVE", f"onc:tsz:{tid}")],
        [ob("🔁 REBUILD SCHEDULE", f"onc:cf:sg:{tid}"), ob("♻️ RESET RESULTS", f"onc:cf:rr:{tid}")],
        [ob("🗑 DELETE TOURNAMENT", f"onc:cf:dtn:{tid}")],
        [ob("🔙 BACK", f"onc:t:{tid}")],
    ]
    await show(c, f"⚙️ <b>TOURNAMENT SETTINGS</b>\n\n{await ui.dashboard_text(t)}", okb(rows))
    await c.answer()


FIELD_PROMPT = {"name": "Send the new <b>TOURNAMENT NAME</b>", "start_date": "Send the new <b>START DATE</b> (2026/10/10)",
                "start_time": "Send the new <b>START TIME</b> (20:00)", "round_interval": "Send the new <b>ROUND INTERVAL</b> in minutes"}


@router.callback_query(F.data.startswith("onc:tse:"))
async def tour_edit(c: CallbackQuery, state: FSMContext):
    _, _, field, tid = c.data.split(":")
    await state.set_state(TourSt.edit)
    await state.update_data(field=field, tid=int(tid))
    await show(c, FIELD_PROMPT[field], okb([[ob("❌ CANCEL", f"onc:ts:{tid}")]]))
    await c.answer()


@router.message(TourSt.edit, F.text)
async def tour_edit_value(m: Message, state: FSMContext):
    d = await state.get_data()
    try:
        val = {"name": lambda s: s.strip(), "start_date": service.parse_date, "start_time": service.parse_time,
               "round_interval": service.parse_interval}[d["field"]](m.text)
        await service.update_tournament(m.from_user.id, d["tid"], **{d["field"]: val})
    except OncError as e:
        return await m.answer(f"⚠️ {e}", reply_markup=okb([[ob("❌ CANCEL", f"onc:ts:{d['tid']}")]]))
    await state.clear()
    await show_dashboard(m, d["tid"])


@router.callback_query(F.data.startswith("onc:tsa:"))
async def tour_active(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    await service.set_active(c.from_user.id, tid)
    await c.answer("⭐ Active tournament set")
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
    await c.answer("Done")
    await show_dashboard(c, tid)


# ----------------------------------------------------------------- dangerous operations: one confirmation screen
CONFIRM = {
    "dtn": ("DELETE TOURNAMENT", "All teams, groups, matches, results and publication records of this tournament will be deleted. Channel posts stay in the channel.", "onc:ts:{id}"),
    "dg": ("DELETE GROUP", "The group is deleted. Its teams are NOT deleted — they become unassigned.", "onc:gp:{id}"),
    "dt": ("DELETE TEAM", "The team and its players are deleted.", "onc:te:{id}"),
    "rr": ("RESET RESULTS", "ALL results, tie decisions and knockout stages of this tournament are deleted and every round reopens. Standings go back to zero.", "onc:ts:{id}"),
    "sg": ("REBUILD SCHEDULE", "All group rounds and matches are regenerated from the current groups. Refused while results exist.", "onc:sc:{id}"),
    "gd": ("AUTOMATIC DRAW", "ALL teams are re-distributed randomly over the existing groups (current assignment is replaced).", "onc:gm:{id}"),
    "dks": ("DELETE KNOCKOUT STAGE", "This (unconfirmed) knockout stage and its matchups are deleted.", "onc:ks:{id}"),
    "dss": ("DELETE TEMPLATE SET", "The set and all of its templates are deleted.", "onc:xsp:{id}"),
    "dtp": ("DELETE TEMPLATE", "The template is deleted.", "onc:xt:{id}"),
    "chx": ("REMOVE CHANNEL", "Publishing stops until a new ONC channel is configured.", "onc:ch"),
}


@router.callback_query(F.data.startswith("onc:cf:"))
async def confirm_screen(c: CallbackQuery):
    _, _, code, ident = c.data.split(":")
    title, why, back = CONFIRM[code]
    await show(c, f"⚠️ <b>ARE YOU SURE?</b>\n\n<b>{title}</b>\n{why}",
               okb([[ob("✅ CONFIRM", f"onc:cy:{code}:{ident}")], [ob("❌ CANCEL", back.format(id=ident))]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:cy:"))
async def confirm_do(c: CallbackQuery, bot: Bot):
    _, _, code, ident = c.data.split(":")
    uid, i = c.from_user.id, int(ident)
    try:
        if code == "dtn":
            await service.delete_tournament(uid, i)
            await c.answer("Deleted")
            return await _to_manage(c)
        if code == "dg":
            g = await service.get_group(i)
            await service.delete_group(uid, i)
            await c.answer("Group deleted")
            return await groups_screen(c, g["tournament_id"])
        if code == "dt":
            team = await service.get_team(i)
            await service.delete_team(uid, i)
            await c.answer("Team deleted")
            return await teams_screen(c, team["tournament_id"])
        if code == "rr":
            await service.reset_results(uid, i)
            await c.answer("Results reset")
            return await show_dashboard(c, i)
        if code == "sg":
            r = await service.generate_schedule(uid, i)
            await c.answer(f"✅ {r['rounds']} rounds, {r['matches']} matches")
            return await schedule_screen(c, i)
        if code == "gd":
            await service.auto_draw(uid, i)
            await c.answer("🎲 Draw done")
            return await groups_screen(c, i)
        if code == "dks":
            r = await service.get_round(i)
            await service.delete_ko_stage(uid, i)
            await c.answer("Stage deleted")
            from .handlers_play import ko_screen
            return await ko_screen(c, str(r["tournament_id"]))
        if code == "dss":
            await templates.delete_set(i)
            await service.audit(uid, "DELETE TEMPLATE SET", str(i))
            await c.answer("Deleted")
            from .handlers_gfx import sets_screen
            return await sets_screen(c)
        if code == "dtp":
            t = await templates.get_template(i)
            await templates.delete_template(i)
            await service.audit(uid, "DELETE TEMPLATE", t["name"])
            await c.answer("Deleted")
            from .handlers_gfx import set_screen
            return await set_screen(c, t["set_id"])
        if code == "chx":
            await service.set_setting("channel_id", "")
            await service.audit(uid, "REMOVE CHANNEL")
            await c.answer("Channel removed")
            from .handlers_gfx import channel_screen
            return await channel_screen(c, bot)
    except (OncError, ValueError) as e:
        await alert(c, str(e))


async def _to_manage(c):
    ts = await service.list_tournaments()
    rows = [[ob(f"{'⭐ ' if t['is_active'] else ''}{ui.STATUS_ICON[t['status']]} {t['name']}", f"onc:t:{t['id']}")] for t in ts]
    await show(c, "🏆 <b>MANAGE TOURNAMENTS</b>", okb(rows + [[ob("➕ CREATE TOURNAMENT", "onc:cr")], [ob("🔙 BACK", PANEL)]]))


# ----------------------------------------------------------------- teams
async def teams_screen(c, tid: int) -> None:
    t = await service.get_tournament(tid)
    teams = await service.teams_of(tid)
    lines = [f"• {E(x['name'])}  <i>{E(x['group_name'] or '— no group')}</i>" for x in teams]
    rows = ui.grid([ob(x["name"], f"onc:te:{x['id']}") for x in teams], 2)
    await show(c, f"👥 <b>TEAMS & PLAYERS</b> — {E(t['name'])}\n\n" + ("\n".join(lines) if lines else "No teams yet."),
               okb(rows + [[ob("➕ ADD TEAM", f"onc:ta:{tid}")], [ob("🔙 BACK", f"onc:t:{tid}")]]))


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
    await show(c, "➕ <b>ADD TEAM</b> — 1/2\n\nSend the <b>TEAM NAME</b>", okb([[ob("❌ CANCEL", f"onc:tm:{tid}")]]))
    await c.answer()


@router.message(TeamSt.name, F.text)
async def team_name(m: Message, state: FSMContext):
    d = await state.get_data()
    name = m.text.strip()
    if len(name) > 30 or not name:
        return await m.answer("Team name must be 1–30 characters.")
    if any(t["name"].lower() == name.lower() for t in await service.teams_of(d["tid"])):
        return await m.answer("⚠️ A team with this name already exists. Send another name.")
    await state.update_data(name=name)
    await state.set_state(TeamSt.logo)
    await m.answer(f"➕ <b>ADD TEAM</b> — 2/2\n\n<b>{E(name)}</b>\nSend the <b>TEAM LOGO</b> as a photo (used only for the champion poster).",
                   reply_markup=okb([[ob("⏭ SKIP LOGO", "onc:tasl")], [ob("🔙 BACK", f"onc:ta:{d['tid']}"), ob("❌ CANCEL", f"onc:tm:{d['tid']}")]]))


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
    await send_team_page(m, team_id, note="✅ Team added. Add its players now:")


@router.message(TeamSt.logo, F.photo | F.document)
async def team_logo(m: Message, state: FSMContext):
    fid = _file_id(m)
    if not fid:
        return await m.answer("Send an image (photo).")
    await _finish_team(m, state, m.from_user.id, fid)


@router.callback_query(F.data == "onc:tasl", TeamSt.logo)
async def team_logo_skip(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await _finish_team(c.message, state, c.from_user.id, None)


async def send_team_page(target, team_id: int, note: str = "") -> None:
    team = await service.get_team(team_id)
    players = await service.players_of(team_id)
    text = (f"{note}\n\n" if note else "") + (
        f"👥 <b>{E(team['name'])}</b>\n📁 {E(team['group_name'] or 'No group')}\n🖼 Logo: {'✅' if team['logo_file_id'] else '—'}\n\n"
        f"<b>Players ({len(players)})</b>\n" + ("\n".join(f"• <code>{E(p['player_id'])}</code>" for p in players) or "—"))
    tid = team["tournament_id"]
    rows = [
        [ob("✏️ RENAME", f"onc:ter:{team_id}"), ob("🖼 CHANGE LOGO", f"onc:tel:{team_id}")],
        [ob("👥 MANAGE PLAYERS", f"onc:tp:{team_id}")],
        [ob("📁 ASSIGN / MOVE GROUP", f"onc:tg:{team_id}")],
    ]
    if team["group_id"]:
        rows.append([ob("➖ REMOVE FROM GROUP", f"onc:tgx:{team_id}")])
    rows += [[ob("🗑 DELETE TEAM", f"onc:cf:dt:{team_id}")], [ob("🔙 TEAMS", f"onc:tm:{tid}")]]
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
    await show(c, "✏️ Send the new <b>TEAM NAME</b>", okb([[ob("❌ CANCEL", f"onc:te:{team_id}")]]))
    await c.answer()


@router.message(TeamSt.rename, F.text)
async def team_rename_do(m: Message, state: FSMContext):
    d = await state.get_data()
    try:
        await service.rename_team(m.from_user.id, d["team"], m.text)
    except OncError as e:
        return await m.answer(f"⚠️ {e}")
    await state.clear()
    await send_team_page(m, d["team"], "✅ Renamed")


@router.callback_query(F.data.startswith("onc:tel:"))
async def team_newlogo(c: CallbackQuery, state: FSMContext):
    team_id = int(c.data.split(":")[2])
    await state.set_state(TeamSt.newlogo)
    await state.update_data(team=team_id)
    await show(c, "🖼 Send the new <b>LOGO</b> as a photo", okb([[ob("❌ CANCEL", f"onc:te:{team_id}")]]))
    await c.answer()


@router.message(TeamSt.newlogo, F.photo | F.document)
async def team_newlogo_do(m: Message, state: FSMContext):
    fid = _file_id(m)
    if not fid:
        return await m.answer("Send an image (photo).")
    d = await state.get_data()
    await service.set_logo(m.from_user.id, d["team"], fid)
    await state.clear()
    await send_team_page(m, d["team"], "✅ Logo updated")


@router.callback_query(F.data.startswith("onc:tp:"))
async def players_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await players_screen(c, int(c.data.split(":")[2]))
    await c.answer()


async def players_screen(c, team_id: int) -> None:
    team = await service.get_team(team_id)
    players = await service.players_of(team_id)
    rows = [[ob(f"➖ {p['player_id']}", f"onc:tpd:{p['id']}")] for p in players]
    await show(c, f"👥 <b>{E(team['name'])}</b> — players ({len(players)})\n\nTap a player to remove them.",
               okb(rows + [[ob("➕ ADD PLAYER", f"onc:tpa:{team_id}")], [ob("🔙 BACK", f"onc:te:{team_id}")]]))


@router.callback_query(F.data.startswith("onc:tpd:"))
async def player_remove(c: CallbackQuery):
    p = await service.dbx.fetchone("SELECT * FROM onc_players WHERE id=?", int(c.data.split(":")[2]))
    if p:
        await service.remove_player(c.from_user.id, p["id"])
        await c.answer("Removed")
        await players_screen(c, p["team_id"])


@router.callback_query(F.data.startswith("onc:tpa:"))
async def player_add(c: CallbackQuery, state: FSMContext):
    team_id = int(c.data.split(":")[2])
    await state.set_state(TeamSt.players)
    await state.update_data(team=team_id)
    await show(c, "➕ <b>ADD PLAYER</b>\n\nSend one or more <b>PLAYER IDs</b> (one per line or separated by commas).\nSend /done or press DONE when finished.",
               okb([[ob("✅ DONE", f"onc:tp:{team_id}")]]))
    await c.answer()


@router.message(TeamSt.players, F.text)
async def player_add_do(m: Message, state: FSMContext):
    d = await state.get_data()
    if m.text.strip().lower() in ("/done", "done"):
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
    await m.answer(f"✅ Added {ok}" + ("\n⚠️ " + "\n⚠️ ".join(bad) if bad else "") + "\n\nSend more IDs or press DONE.",
                   reply_markup=okb([[ob("✅ DONE", f"onc:tp:{d['team']}")]]))


@router.callback_query(F.data.startswith("onc:tg:"))
async def team_group_pick(c: CallbackQuery):
    team_id = int(c.data.split(":")[2])
    team = await service.get_team(team_id)
    groups = await service.groups_of(team["tournament_id"])
    if not groups:
        return await alert(c, "Create a group first (GROUPS).")
    rows = ui.grid([ob(("✓ " if g["id"] == team["group_id"] else "") + g["name"], f"onc:tga:{team_id}:{g['id']}") for g in groups], 2)
    await show(c, f"📁 <b>{E(team['name'])}</b> — choose a group\nCurrent: {E(team['group_name'] or '—')}", okb(rows + [[ob("🔙 BACK", f"onc:te:{team_id}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:tga:"))
async def team_group_set(c: CallbackQuery):
    _, _, team_id, gid = c.data.split(":")
    try:
        await service.assign_team(c.from_user.id, int(team_id), int(gid))
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("✅ Done")
    await send_team_page(c, int(team_id))


@router.callback_query(F.data.startswith("onc:tgx:"))
async def team_group_remove(c: CallbackQuery):
    team_id = int(c.data.split(":")[2])
    try:
        await service.assign_team(c.from_user.id, team_id, None)
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("Removed from group")
    await send_team_page(c, team_id)


# ----------------------------------------------------------------- groups
async def groups_screen(c, tid: int) -> None:
    t = await service.get_tournament(tid)
    groups = await service.groups_of(tid)
    teams = await service.teams_of(tid)
    unassigned = [x for x in teams if not x["group_id"]]
    lines = [f"<b>{E(g['name'])}</b> — {len(g['members'])} teams · qualifiers: {g['qualifiers'] if g['qualifiers'] is not None else '—'}\n   "
             + (", ".join(E(m["name"]) for m in g["members"]) or "<i>empty</i>") for g in groups]
    if unassigned:
        lines.append(f"\n<i>Unassigned ({len(unassigned)}):</i> " + ", ".join(E(x["name"]) for x in unassigned))
    rows = ui.grid([ob(g["name"], f"onc:gp:{g['id']}") for g in groups], 2)
    rows += [[ob("➕ CREATE NEW GROUP", f"onc:gc:{tid}"), ob("🎲 AUTOMATIC DRAW", f"onc:cf:gd:{tid}")]]
    if unassigned:
        rows.append([ob("✋ ASSIGN UNASSIGNED TEAMS", f"onc:gu:{tid}")])
    rows.append([ob("🔙 BACK", f"onc:t:{tid}")])
    await show(c, f"📁 <b>GROUP MANAGEMENT</b> — {E(t['name'])}\n\n" + ("\n".join(lines) if lines else "No groups yet."), okb(rows))


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
    await c.answer("Group created")
    await groups_screen(c, tid)


@router.callback_query(F.data.startswith("onc:gu:"))
async def unassigned_pick(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    un = [x for x in await service.teams_of(tid) if not x["group_id"]]
    if not un:
        return await groups_screen(c, tid)
    rows = ui.grid([ob(x["name"], f"onc:tg:{x['id']}") for x in un], 2)
    await show(c, "✋ <b>MANUAL ASSIGNMENT</b>\nChoose a team, then its group.", okb(rows + [[ob("🔙 BACK", f"onc:gm:{tid}")]]))
    await c.answer()


async def group_page(c, gid: int) -> None:
    g = await service.get_group(gid)
    text = (f"📁 <b>{E(g['name'])}</b>\n\nTeams ({len(g['members'])}):\n" + ("\n".join(f"• {E(m['name'])}" for m in g["members"]) or "—")
            + f"\n\nQualifiers: <b>{g['qualifiers'] if g['qualifiers'] is not None else 'not set'}</b>")
    rows = [
        [ob("➕ ADD TEAM", f"onc:gat:{gid}"), ob("➖ REMOVE TEAM", f"onc:grt:{gid}")],
        [ob("🔄 MOVE TEAM", f"onc:gmt:{gid}"), ob("🔢 SET QUALIFIERS", f"onc:gq:{gid}")],
        [ob("✏️ RENAME", f"onc:gr:{gid}"), ob("🗑 DELETE GROUP", f"onc:cf:dg:{gid}")],
        [ob("🔙 GROUPS", f"onc:gm:{g['tournament_id']}")],
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
    await show(c, "✏️ Send the new <b>GROUP NAME</b>", okb([[ob("❌ CANCEL", f"onc:gp:{gid}")]]))
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
    await show(c, f"➕ Add a team to <b>{E(g['name'])}</b>" + ("" if un else "\n\nNo unassigned teams."), okb(rows + [[ob("🔙 BACK", f"onc:gp:{gid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:gaa:"))
async def group_add_do(c: CallbackQuery):
    _, _, gid, team_id = c.data.split(":")
    try:
        await service.assign_team(c.from_user.id, int(team_id), int(gid))
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("Added")
    await group_add_pick(c)


@router.callback_query(F.data.startswith("onc:grt:"))
async def group_remove_pick(c: CallbackQuery):
    gid = int(c.data.split(":")[2])
    g = await service.get_group(gid)
    rows = ui.grid([ob(f"➖ {m['name']}", f"onc:grx:{gid}:{m['id']}") for m in g["members"]], 2)
    await show(c, f"➖ Remove a team from <b>{E(g['name'])}</b>\n(the team stays in the tournament, unassigned)", okb(rows + [[ob("🔙 BACK", f"onc:gp:{gid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:grx:"))
async def group_remove_do(c: CallbackQuery):
    _, _, gid, team_id = c.data.split(":")
    try:
        await service.assign_team(c.from_user.id, int(team_id), None)
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("Removed")
    await group_page(c, int(gid))


@router.callback_query(F.data.startswith("onc:gmt:"))
async def group_move_pick(c: CallbackQuery):
    gid = int(c.data.split(":")[2])
    g = await service.get_group(gid)
    rows = ui.grid([ob(f"🔄 {m['name']}", f"onc:gmm:{gid}:{m['id']}") for m in g["members"]], 2)
    await show(c, f"🔄 Move which team out of <b>{E(g['name'])}</b>?", okb(rows + [[ob("🔙 BACK", f"onc:gp:{gid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:gmm:"))
async def group_move_target(c: CallbackQuery):
    _, _, gid, team_id = c.data.split(":")
    g = await service.get_group(int(gid))
    others = [x for x in await service.groups_of(g["tournament_id"]) if x["id"] != int(gid)]
    team = await service.get_team(int(team_id))
    if not others:
        return await alert(c, "There is no other group.")
    rows = ui.grid([ob(x["name"], f"onc:tga:{team_id}:{x['id']}") for x in others], 2)
    await show(c, f"🔄 Move <b>{E(team['name'])}</b> to…", okb(rows + [[ob("🔙 BACK", f"onc:gp:{gid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:gq:"))
async def qualifiers_pick(c: CallbackQuery):
    gid = int(c.data.split(":")[2])
    g = await service.get_group(gid)
    n = len(g["members"])
    rows = ui.grid([ob(("✓ " if g["qualifiers"] == i else "") + str(i), f"onc:gqs:{gid}:{i}") for i in range(0, n + 1)], 5)
    await show(c, f"🔢 <b>SET QUALIFIERS</b> — {E(g['name'])}\n\nHow many teams of this group advance?\nCurrent: {g['qualifiers'] if g['qualifiers'] is not None else 'not set'}",
               okb(rows + [[ob("🔙 BACK", f"onc:gp:{gid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:gqs:"))
async def qualifiers_set(c: CallbackQuery):
    _, _, gid, n = c.data.split(":")
    try:
        await service.set_qualifiers(c.from_user.id, int(gid), int(n))
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("Saved")
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
    text = f"📅 <b>SCHEDULE</b> — {E(t['name'])}\n⏱ interval {t['round_interval']} min (matches of a round are simultaneous)\n\n" + (
        "\n\n".join(parts) if parts else "Not generated yet.")
    rows = []
    has_group_rounds = any(r["stage"] == "GROUP" for r in rounds)
    rows.append([ob("🔁 REBUILD SCHEDULE" if has_group_rounds else "⚙️ GENERATE SCHEDULE",
                    f"onc:cf:sg:{tid}" if has_group_rounds else f"onc:cy:sg:{tid}")])
    if rounds:
        rows.append([ob("📢 PUBLISH SCHEDULE", f"onc:sp:{tid}")])
    rows.append([ob("🔙 BACK", f"onc:t:{tid}")])
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
    await c.answer(f"📢 Schedule published to the ONC channel ({res['sent']} new, {res['edited']} updated).")


# ----------------------------------------------------------------- settings / audit
@router.callback_query(F.data == "onc:se")
async def settings(c: CallbackQuery):
    auto = await service.get_setting("auto_standings", "0") == "1"
    await show(c, "⚙️ <b>SETTINGS</b>\n\nAfter CONFIRM & PUBLISH of a group round, also publish the updated standings graphics:\n"
               f"<b>{'ON' if auto else 'OFF'}</b>",
               okb([[ob(f"📊 AUTO-PUBLISH STANDINGS: {'ON ✅' if auto else 'OFF'}", "onc:seas")],
                    [ob("🧾 AUDIT LOG", "onc:au")], [ob("🔙 BACK", PANEL)]]))
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
        lines.append(f"<b>{E(r['action'])}</b> · admin {r['admin_id']} · {ts}" + (f"\n{E(r['details'])}" if r["details"] else ""))
    await show(c, "🧾 <b>AUDIT LOG</b>\n\n" + ("\n\n".join(lines) if lines else "Empty."), okb([[ob("🔙 BACK", "onc:se")]]))
    await c.answer()
