"""ONC viewer panel. Viewers only read; every query uses CONFIRMED results only."""
from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery

from ..utils import show
from . import algo, service, ui
from .ui import E, ob, okb

router = Router()

MENU = okb([
    [ob("🔴 پخش زنده", "onc:ul"), ob("📅 برنامه بازی‌ها", "onc:us")],
    [ob("⚽ نتایج", "onc:ur"), ob("📊 جدول", "onc:ust")],
    [ob("🏆 مرحله حذفی", "onc:uk"), ob("👥 تیم‌ها", "onc:ut")],
    [ob("👤 بازیکنان", "onc:up"), ob("👑 قهرمان", "onc:uc")],
    [ob("🔙 منوی اصلی", "home")],
])
BACK = [ob("🔙 بازگشت", "onc:u")]


async def _active(c: CallbackQuery):
    t = await service.active_tournament()
    if not t:
        await show(c, "🏆 <b>وان نایت چمپیون</b>\n\nهنوز تورنمنتی در جریان نیست. منتظر خبرها باش!", okb([[ob("🔙 منوی اصلی", "home")]]))
        await c.answer()
    return t


@router.callback_query(F.data == "onc:u")
async def home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    t = await service.active_tournament()
    head = "🏆 <b>وان نایت چمپیون</b>"
    if t:
        head += f"\n\n<b>{E(t['name'])}</b>\n📅 {service.fmt_date(t['start_date'])}  🕐 {t['start_time']}\n{ui.STATUS_ICON[t['status']]} {ui.STATUS_FA[t['status']]}"
    await show(c, head, MENU)
    await c.answer()


@router.callback_query(F.data == "onc:ul")
async def live(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    r = await service.current_round(t["id"])
    if not r:
        text = f"🔴 <b>پخش زنده</b>\n\n{E(t['name'])}\n\nالان راندی منتظر ثبت نتیجه نیست."
    else:
        ms = await service.matches_of_round(r["id"])
        text = (f"🔴 <b>پخش زنده</b>\n\n{ui.title(t)}\n<b>{await service.round_label(r)}</b> — 🕐 {r['start_at'][11:]}\n\n"
                + "\n".join(f"⏳ {E(m['name_a'])} 🆚 {E(m['name_b'])}" for m in ms)
                + "\n\n<i>نتایج بعد از تأیید راند منتشر می‌شود.</i>")
    await show(c, text, okb([BACK]))
    await c.answer()


@router.callback_query(F.data == "onc:us")
async def schedule(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    rounds = [r for r in await service.rounds_of(t["id"])]
    if not rounds:
        text = "📅 <b>برنامه بازی‌ها</b>\n\nهنوز برنامه‌ای ساخته نشده."
    else:
        parts = []
        for r in rounds:
            ms = await service.matches_of_round(r["id"])
            if not ms:
                continue
            parts.append(f"<b>{r['start_at'][11:]}</b> — {await service.round_label(r)}\n"
                         + "\n".join(f"• {ui.match_line(m, with_score=m['rstatus'] == 'CONFIRMED')}" for m in ms))
        text = f"📅 <b>برنامه بازی‌ها</b> — {E(t['name'])}\n\n" + "\n\n".join(parts)
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
    text = "⚽ <b>نتایج</b>\n\n" + ("\n\n".join(parts) if parts else "هنوز نتیجه‌ی تأییدشده‌ای نیست.")
    await show(c, text[-4000:], okb([BACK]))
    await c.answer()


@router.callback_query(F.data == "onc:ust")
async def standings(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    tables = await service.group_tables(t["id"])
    text = "📊 <b>جدول رده‌بندی</b>\n\n" + ("\n\n".join(ui.standings_block(x) for x in tables) if tables else "هنوز گروهی ساخته نشده.")
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
    text = "🏆 <b>مرحله حذفی</b>\n\n" + ("\n\n".join(parts) if parts else "مرحله‌ی حذفی هنوز شروع نشده.")
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
        await show(c, "هنوز تیمی ثبت نشده.", okb([BACK]))
        return await c.answer()
    lines, rows = [], []
    for g in await service.groups_of(t["id"]):
        lines.append(f"<b>{E(g['name'])}</b>: " + ", ".join(E(m["name"]) for m in g["members"]))
    un = [x for x in teams_ if not x["group_id"]]
    if un:
        lines.append("<i>بدون گروه:</i> " + ", ".join(E(x["name"]) for x in un))
    rows = ui.grid([ob(x["name"], f"onc:uv:{x['id']}") for x in teams_], 2)
    head = "👤 <b>بازیکنان</b> — یک تیم انتخاب کن" if only_players else "👥 <b>تیم‌ها</b> — " + str(len(teams_))
    await show(c, head + "\n\n" + "\n".join(lines), okb(rows + [BACK]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:uv:"))
async def team_page(c: CallbackQuery):
    team = await service.get_team(int(c.data.split(":")[2]))
    if not team:
        return await c.answer("تیم پیدا نشد", show_alert=True)
    players = await service.players_of(team["id"])
    text = (f"👥 <b>{E(team['name'])}</b>\n{E(team['group_name'] or 'بدون گروه')}\n\n"
            + ("\n".join(f"• <code>{E(p['player_id'])}</code>" for p in players) if players else "بازیکنی ثبت نشده."))
    await show(c, text, okb([[ob("🔙 بازگشت", "onc:ut")]]))
    await c.answer()


@router.callback_query(F.data == "onc:uc")
async def champion(c: CallbackQuery):
    t = await _active(c)
    if not t:
        return
    team = await service.get_team(t["champion_team_id"]) if t["champion_team_id"] else None
    text = (f"👑 <b>قهرمان</b>\n\n🏆 {E(t['name'])}\n\n<b>{E(team['name'])}</b>" if team
            else "👑 <b>قهرمان</b>\n\nهنوز قهرمانی مشخص نشده.")
    await show(c, text, okb([BACK]))
    await c.answer()
