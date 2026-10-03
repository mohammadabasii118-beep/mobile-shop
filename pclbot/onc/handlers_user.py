"""ONC viewer panel. Viewers only read; every query uses CONFIRMED results only.

Entry: 🏆 → «🔴 مسابقات زنده» (tournaments being played) / «📁 سایر مسابقات» (finished ones) → a tournament → its menu.
Callbacks carry the tournament id (`onc:vl:<tid>` …); the older id-less ones (`onc:ul`, …) still work for the active tournament.
"""
import re

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery

from ..utils import show
from . import algo, service, ui
from .ui import E, ob, okb

router = Router()

LIVE_BTN, OTHER_BTN, CAPTAIN_BTN = "🔴 مسابقات زنده", "📁 سایر مسابقات", "🧢 پنل کاپیتان/منیجر"


def tournament_menu(tid: int):
    return okb([
        [ob("🔴 پخش زنده", f"onc:vl:{tid}"), ob("📅 برنامه بازی‌ها", f"onc:vs:{tid}")],
        [ob("⚽ نتایج", f"onc:vr:{tid}"), ob("📊 جدول", f"onc:vst:{tid}")],
        [ob("🏆 مرحله حذفی", f"onc:vk:{tid}"), ob("👥 تیم‌ها", f"onc:vt:{tid}")],
        [ob("👤 بازیکنان", f"onc:vp:{tid}"), ob("👑 قهرمان", f"onc:vc:{tid}")],
        [ob("🔙 بازگشت", "onc:u")],
    ])


async def entry_markup(uid: int):
    rows = [[ob(LIVE_BTN, "onc:ulv")], [ob(OTHER_BTN, "onc:uot")]]
    if await service.captain_teams(uid):
        rows.append([ob(CAPTAIN_BTN, "onc:cp")])
    rows.append([ob("🔙 منوی اصلی", "home")])
    return okb(rows)


ENTRY_TEXT = "🏆 <b>وان نایت چمپیون</b>\n\nیکی را انتخاب کن:"


async def home_text() -> str:  # used by the bottom-menu button too
    return ENTRY_TEXT


@router.callback_query(F.data == "onc:u")
async def entry(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show(c, ENTRY_TEXT, await entry_markup(c.from_user.id))
    await c.answer()


async def _list(c: CallbackQuery, tournaments: list[dict], title: str, empty: str) -> None:
    if not tournaments:
        rows = [[ob(OTHER_BTN if "زنده" in title else LIVE_BTN, "onc:uot" if "زنده" in title else "onc:ulv")], [ob("🔙 بازگشت", "onc:u")]]
        return await show(c, f"{title}\n\n{empty}", okb(rows))
    rows = [[ob(f"{ui.STATUS_ICON[t['status']]} {t['name']}", f"onc:vh:{t['id']}")] for t in tournaments]
    await show(c, f"{title}\n\nیک تورنمنت را باز کن:", okb(rows + [[ob("🔙 بازگشت", "onc:u")]]))


@router.callback_query(F.data == "onc:ulv")
async def live_list(c: CallbackQuery):
    await _list(c, await service.live_tournaments(), "🔴 <b>مسابقات زنده</b>", "الان مسابقه‌ی زنده‌ای در جریان نیست. می‌توانی «سایر مسابقات» را ببینی.")
    await c.answer()


@router.callback_query(F.data == "onc:uot")
async def other_list(c: CallbackQuery):
    await _list(c, await service.finished_tournaments(), "📁 <b>سایر مسابقات</b>", "هنوز مسابقه‌ی تمام‌شده‌ای نداریم.")
    await c.answer()


async def _t(c: CallbackQuery, tid: str | None) -> dict | None:
    t = await service.get_tournament(int(tid)) if tid else await service.active_tournament()
    if not t or t["status"] in ("DRAFT", "READY") and tid:
        await show(c, "🏆 <b>وان نایت چمپیون</b>\n\nاین تورنمنت در دسترس نیست.", okb([[ob("🔙 بازگشت", "onc:u")]]))
        await c.answer()
        return None
    return t


def _back(t: dict) -> list:
    return [ob("🔙 بازگشت", f"onc:vh:{t['id']}")]


@router.callback_query(F.data.regexp(r"^onc:vh:(\d+)$"))
async def tournament_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    t = await _t(c, c.data.split(":")[2])
    if t:
        head = (f"🏆 <b>{E(t['name'])}</b>\n\n📅 {service.fmt_date(t['start_date'])}  🕐 {t['start_time']}\n"
                f"{ui.STATUS_ICON[t['status']]} {ui.STATUS_FA[t['status']]}")
        await show(c, head, tournament_menu(t["id"]))
        await c.answer()


# --- sub-screens: onc:v<x>:<tid>  (old id-less onc:u<x> keeps working for the active tournament)
SCREEN = re.compile(r"^onc:[uv](l|s|r|st|k|t|p|c)(?::(\d+))?$")


@router.callback_query(F.data.regexp(SCREEN))
async def screens(c: CallbackQuery):
    kind, tid = SCREEN.match(c.data).groups()
    t = await _t(c, tid)
    if not t:
        return
    back = okb([_back(t)])
    if kind == "l":
        r = await service.current_round(t["id"])
        if not r:
            text = f"🔴 <b>پخش زنده</b>\n\n{E(t['name'])}\n\nالان راندی منتظر ثبت نتیجه نیست."
        else:
            ms = await service.matches_of_round(r["id"])
            text = (f"🔴 <b>پخش زنده</b>\n\n{ui.title(t)}\n<b>{await service.round_label(r)}</b> — 🕐 {r['start_at'][11:]}\n\n"
                    + "\n".join(f"⏳ {E(m['name_a'])} 🆚 {E(m['name_b'])}" for m in ms)
                    + "\n\n<i>نتایج بعد از تأیید راند منتشر می‌شود.</i>")
    elif kind == "s":
        parts = []
        for r in await service.rounds_of(t["id"]):
            ms = await service.matches_of_round(r["id"])
            if ms:
                parts.append(f"<b>{r['start_at'][11:]}</b> — {await service.round_label(r)}\n"
                             + "\n".join(f"• {ui.match_line(m, with_score=m['rstatus'] == 'CONFIRMED' and r['status'] == 'CONFIRMED')}" for m in ms))
        text = f"📅 <b>برنامه بازی‌ها</b> — {E(t['name'])}\n\n" + ("\n\n".join(parts) if parts else "هنوز برنامه‌ای ساخته نشده.")
    elif kind == "r":
        parts = []
        for r in await service.rounds_of(t["id"]):
            if r["status"] == "CONFIRMED":
                ms = await service.matches_of_round(r["id"])
                parts.append(f"<b>{await service.round_label(r)}</b>\n" + "\n".join(ui.match_line(m) for m in ms))
        text = "⚽ <b>نتایج</b>\n\n" + ("\n\n".join(parts) if parts else "هنوز نتیجه‌ی تأییدشده‌ای نیست.")
    elif kind == "st":
        tables = await service.group_tables(t["id"])
        text = "📊 <b>GROUP STANDINGS</b>\n\n" + ("\n\n".join(ui.standings_block(x) for x in tables) if tables else "هنوز گروهی ساخته نشده.")
    elif kind == "k":
        parts = []
        for r in await service.ko_rounds(t["id"]):
            ms = await service.matches_of_round(r["id"])
            parts.append(f"<b>{algo.STAGE_NAME[r['stage']]}</b>\n" + "\n".join(
                f"• {ui.match_line(m, with_score=m['rstatus'] == 'CONFIRMED' and r['status'] == 'CONFIRMED')}" for m in ms))
        text = "🏆 <b>مرحله حذفی</b>\n\n" + ("\n\n".join(parts) if parts else "مرحله‌ی حذفی هنوز شروع نشده.")
    elif kind in ("t", "p"):
        teams = await service.teams_of(t["id"])
        if not teams:
            text, back = "هنوز تیمی ثبت نشده.", back
        else:
            lines = [f"<b>{E(g['name'])}</b>: " + ", ".join(E(m["name"]) for m in g["members"]) for g in await service.groups_of(t["id"])]
            un = [x for x in teams if not x["group_id"]]
            if un:
                lines.append("<i>بدون گروه:</i> " + ", ".join(E(x["name"]) for x in un))
            rows = ui.grid([ob(x["name"], f"onc:vv:{x['id']}") for x in teams], 2)
            back = okb(rows + [_back(t)])
            text = ("👤 <b>بازیکنان</b> — یک تیم انتخاب کن" if kind == "p" else f"👥 <b>تیم‌ها</b> — {len(teams)}") + "\n\n" + "\n".join(lines)
    else:  # champion
        team = await service.get_team(t["champion_team_id"]) if t["champion_team_id"] else None
        text = (f"👑 <b>قهرمان</b>\n\n🏆 {E(t['name'])}\n\n<b>{E(team['name'])}</b>" if team else "👑 <b>قهرمان</b>\n\nهنوز قهرمانی مشخص نشده.")
    await show(c, text[-4000:] if kind == "r" else text[:4000], back)
    await c.answer()


@router.callback_query(F.data.regexp(r"^onc:[uv]v:(\d+)$"))
async def team_page(c: CallbackQuery):
    team = await service.get_team(int(c.data.split(":")[2]))
    if not team:
        return await c.answer("تیم پیدا نشد", show_alert=True)
    players = await service.players_of(team["id"])
    text = (f"👥 <b>{E(team['name'])}</b>\n{E(team['group_name'] or 'بدون گروه')}\n\n"
            + ("\n".join(f"• <code>{E(p['player_id'])}</code>" for p in players) if players else "بازیکنی ثبت نشده."))
    await show(c, text, okb([[ob("🔙 بازگشت", f"onc:vt:{team['tournament_id']}")]]))
    await c.answer()
