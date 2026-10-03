"""ONC viewer panel. Viewers only read; every query uses CONFIRMED results only."""
from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery

from ..utils import show
from . import algo, service, ui
from .ui import E, ob, okb

router = Router()

MENU = okb([
    [ob("🔴 LIVE", "onc:ul"), ob("📅 SCHEDULE", "onc:us")],
    [ob("⚽ RESULTS", "onc:ur"), ob("📊 STANDINGS", "onc:ust")],
    [ob("🏆 KNOCKOUT", "onc:uk"), ob("👥 TEAMS", "onc:ut")],
    [ob("👤 PLAYERS", "onc:up"), ob("👑 CHAMPION", "onc:uc")],
    [ob("🔙 MAIN MENU", "home")],
])
BACK = [ob("🔙 BACK", "onc:u")]


async def _active(c: CallbackQuery):
    t = await service.active_tournament()
    if not t:
        await show(c, "🏆 <b>ONE NIGHT CHAMPION</b>\n\nNo tournament is running yet. Stay tuned!", okb([[ob("🔙 MAIN MENU", "home")]]))
        await c.answer()
    return t


@router.callback_query(F.data == "onc:u")
async def home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    t = await service.active_tournament()
    head = "🏆 <b>ONE NIGHT CHAMPION</b>"
    if t:
        head += f"\n\n<b>{E(t['name'])}</b>\n📅 {service.fmt_date(t['start_date'])}  🕐 {t['start_time']}\n{ui.STATUS_ICON[t['status']]} {t['status']}"
    await show(c, head, MENU)
    await c.answer()


@router.callback_query(F.data == "onc:ul")
async def live(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    r = await service.current_round(t["id"])
    if not r:
        text = f"🔴 <b>LIVE</b>\n\n{E(t['name'])}\n\nNo round is waiting for results right now."
    else:
        ms = await service.matches_of_round(r["id"])
        text = (f"🔴 <b>LIVE</b>\n\n{ui.title(t)}\n<b>{await service.round_label(r)}</b> — 🕐 {r['start_at'][11:]}\n\n"
                + "\n".join(f"⏳ {E(m['name_a'])} vs {E(m['name_b'])}" for m in ms)
                + "\n\n<i>Results are published after the round is confirmed.</i>")
    await show(c, text, okb([BACK]))
    await c.answer()


@router.callback_query(F.data == "onc:us")
async def schedule(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    rounds = [r for r in await service.rounds_of(t["id"])]
    if not rounds:
        text = f"📅 <b>SCHEDULE</b>\n\nThe schedule has not been published yet."
    else:
        parts = []
        for r in rounds:
            ms = await service.matches_of_round(r["id"])
            if not ms:
                continue
            parts.append(f"<b>{r['start_at'][11:]}</b> — {await service.round_label(r)}\n"
                         + "\n".join(f"• {ui.match_line(m, with_score=m['rstatus'] == 'CONFIRMED')}" for m in ms))
        text = f"📅 <b>SCHEDULE</b> — {E(t['name'])}\n\n" + "\n\n".join(parts)
    await show(c, text[:4000], okb([BACK]))
    await c.answer()


@router.callback_query(F.data == "onc:ur")
async def results(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    parts = []
    for r in await service.rounds_of(t["id"]):
        if r["status"] != "CONFIRMED":
            continue
        ms = await service.matches_of_round(r["id"])
        parts.append(f"<b>{await service.round_label(r)}</b>\n" + "\n".join(ui.match_line(m) for m in ms))
    text = "⚽ <b>RESULTS</b>\n\n" + ("\n\n".join(parts) if parts else "No confirmed results yet.")
    await show(c, text[-4000:], okb([BACK]))
    await c.answer()


@router.callback_query(F.data == "onc:ust")
async def standings(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    tables = await service.group_tables(t["id"])
    text = "📊 <b>STANDINGS</b>\n\n" + ("\n\n".join(ui.standings_block(x) for x in tables) if tables else "No groups yet.")
    await show(c, text[:4000], okb([BACK]))
    await c.answer()


@router.callback_query(F.data == "onc:uk")
async def knockout(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    parts = []
    for r in await service.ko_rounds(t["id"]):
        ms = await service.matches_of_round(r["id"])
        parts.append(f"<b>{algo.STAGE_NAME[r['stage']]}</b>\n" + "\n".join(
            f"• {ui.match_line(m, with_score=m['rstatus'] == 'CONFIRMED')}" for m in ms))
    text = "🏆 <b>KNOCKOUT</b>\n\n" + ("\n\n".join(parts) if parts else "The knockout stage has not started yet.")
    await show(c, text[:4000], okb([BACK]))
    await c.answer()


@router.callback_query(F.data.in_({"onc:ut", "onc:up"}))
async def teams(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    only_players = c.data == "onc:up"
    teams_ = await service.teams_of(t["id"])
    if not teams_:
        await show(c, "No teams registered yet.", okb([BACK]))
        return await c.answer()
    lines, rows = [], []
    for g in await service.groups_of(t["id"]):
        lines.append(f"<b>{E(g['name'])}</b>: " + ", ".join(E(m["name"]) for m in g["members"]))
    un = [x for x in teams_ if not x["group_id"]]
    if un:
        lines.append("<i>Not in a group:</i> " + ", ".join(E(x["name"]) for x in un))
    rows = ui.grid([ob(x["name"], f"onc:uv:{x['id']}") for x in teams_], 2)
    head = "👤 <b>PLAYERS</b> — choose a team" if only_players else "👥 <b>TEAMS</b> — " + str(len(teams_))
    await show(c, head + "\n\n" + "\n".join(lines), okb(rows + [BACK]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:uv:"))
async def team_page(c: CallbackQuery):
    team = await service.get_team(int(c.data.split(":")[2]))
    if not team:
        return await c.answer("Team not found", show_alert=True)
    players = await service.players_of(team["id"])
    text = (f"👥 <b>{E(team['name'])}</b>\n{E(team['group_name'] or 'No group')}\n\n"
            + ("\n".join(f"• <code>{E(p['player_id'])}</code>" for p in players) if players else "No players listed."))
    await show(c, text, okb([[ob("🔙 BACK", "onc:ut")]]))
    await c.answer()


@router.callback_query(F.data == "onc:uc")
async def champion(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    team = await service.get_team(t["champion_team_id"]) if t["champion_team_id"] else None
    text = (f"👑 <b>CHAMPION</b>\n\n🏆 {E(t['name'])}\n\n<b>{E(team['name'])}</b>" if team
            else "👑 <b>CHAMPION</b>\n\nThe champion has not been decided yet.")
    await show(c, text, okb([BACK]))
    await c.answer()
