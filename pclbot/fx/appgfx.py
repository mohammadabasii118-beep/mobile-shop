"""🎨 Graphics from the PCL app's data: schedule of a day, league table, results, knockout bracket.

Only the *environment* is built here: the data comes from the app API and is drawn with the same editable templates as
ONC (🎨 template editor). Admin-only. Nothing is published until the admin presses «انتشار».
"""
from collections import OrderedDict
from datetime import date

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery, Message

from .. import outgoing
from ..onc import gfx, service
from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import appapi, core
from .core import E
from .states import DestSt, GfxSt

router = Router()
router.message.filter(lambda m: is_admin(m.from_user.id))
router.callback_query.filter(lambda c: is_admin(c.from_user.id))
PREVIEW: dict[int, tuple[list[bytes], str]] = {}
KINDS = {"tb": ("📊 جدول", "table"), "rs": ("✅ نتایج", "results"), "br": ("🏆 براکت", "bracket")}


# ------------------------------------------------------------------ pure builders (API json → render data)
def _gd(n) -> str:
    n = int(n or 0)
    return f"{n:+d}" if n else "0"


def schedule_data(matches: list[dict], day: date) -> dict:
    rows, last = [], None
    for m in matches:
        slot = m["tehran_time"].strftime("%H:%M")
        if slot != last:
            rows.append({"kind": "slot", "text": slot})
            last = slot
        rows.append({"kind": "match", "text": f"{m['home_team_name']} × {m['away_team_name']}", "a": m["home_team_name"], "b": m["away_team_name"]})
    return {"title": "برنامه بازی‌ها", "subtitle": day.strftime("%Y/%m/%d"), "rows": rows}


def table_data(comp: dict, rows: list[dict]) -> list[dict]:
    groups: "OrderedDict[str, list]" = OrderedDict()
    for r in rows:
        groups.setdefault(r.get("group_name") or "", []).append(r)
    out = []
    for g, rs in groups.items():
        rs = sorted(rs, key=lambda r: r.get("position") or 99)
        out.append({"title": (f"GROUP {g} — " if g else "") + "STANDINGS", "subtitle": comp["name"],
                    "rows": [{"pos": r.get("position") or i + 1, "team": r["team_name"], "P": r["played"], "W": r["won"], "D": r["drawn"], "L": r["lost"],
                              "GF": r["goals_for"], "GA": r["goals_against"], "GD": _gd(r["goal_difference"]), "PTS": r["points"], "qualified": False}
                             for i, r in enumerate(rs)]})
    return out


def results_data(comp: dict, matches: list[dict], limit: int = 12) -> dict:
    done = [m for m in matches if m.get("status") == "finished" and m.get("home_score") is not None]
    done.sort(key=lambda m: m["match_date"], reverse=True)
    done = done[:limit]
    return {"title": "نتایج", "subtitle": comp["name"],
            "rows": [{"cells": [m["home_team_name"], f"{m['home_score']} - {m['away_score']}", m["away_team_name"]]} for m in done]}


def bracket_data(matches: list[dict]) -> dict:
    stages: "OrderedDict[str, list]" = OrderedDict()
    for m in sorted(matches, key=lambda m: m["match_date"] or ""):
        ga, gb = m.get("home_score"), m.get("away_score")
        win = None
        if ga is not None and gb is not None:
            pa, pb = m.get("home_penalty"), m.get("away_penalty")
            win = "a" if (ga, pa or 0) > (gb, pb or 0) else "b" if (ga, pa or 0) < (gb, pb or 0) else None
        stages.setdefault(str(m.get("round") or "?"), []).append({"a": m["home_team_name"], "b": m["away_team_name"], "ga": ga, "gb": gb, "win": win})
    return {"stages": [{"name": k, "matches": v} for k, v in stages.items()]}


# ------------------------------------------------------------------ screens
@router.callback_query(F.data == "fx:ag")
async def home(c: CallbackQuery, state: FSMContext, bot: Bot):
    await state.clear()
    await show(c, "🎨 <b>گرافیک‌های اپ</b>\n\nداده از API اپ PCL گرفته می‌شود و با قالب‌های قابل‌ویرایش (🎨 قالب‌ها در پنل وان نایت چمپیون) ساخته می‌شود.\n"
                  f"کانال انتشار: {await core.dest_status(bot, 'gfx_chat')}",
               okb([[ob("📅 برنامه بازی‌های یک روز", "fx:agd")], [ob("📊 جدول", "fx:agc:tb"), ob("✅ نتایج", "fx:agc:rs")], [ob("🏆 براکت", "fx:agc:br")],
                    [ob("📍 تعیین کانال انتشار", "fx:agt")], [ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@router.callback_query(F.data == "fx:agt")
async def dest(c: CallbackQuery, state: FSMContext):
    await state.set_state(DestSt.pick)
    await state.update_data(key="gfx_chat", back="fx:ag")
    await show(c, "📍 کانال انتشار گرافیک‌ها: یک پست فوروارد کن یا @username / آیدی عددی بفرست.", okb([[ob("❌ لغو", "fx:ag")]]))
    await c.answer()


async def _render(type_: str, data: dict) -> list[bytes]:
    return await gfx._render(type_, {**core.APP_LOOK, **data})


async def _send_preview(target: Message, uid: int, images: list[bytes], caption: str):
    PREVIEW[uid] = (images, caption)
    for i, img in enumerate(images):
        await target.answer_photo(BufferedInputFile(img, f"app_{i}.png"), caption=caption if i == 0 else None)
    await target.answer("پیش‌نمایش بالاست. منتشر شود؟", reply_markup=okb([[ob("📣 انتشار", "fx:agp")], [ob("🔙 بازگشت", "fx:ag")]]))


@router.callback_query(F.data == "fx:agd")
async def ask_day(c: CallbackQuery, state: FSMContext):
    await state.set_state(GfxSt.date)
    today = core.local_now().date()
    await show(c, "📅 تاریخ را بفرست (مثلاً <code>2026-10-12</code>) یا دکمه «امروز» را بزن.",
               okb([[ob(f"امروز ({today.isoformat()})", "fx:agdt")], [ob("❌ لغو", "fx:ag")]]))
    await c.answer()


async def _do_day(target: Message, uid: int, day: date):
    try:
        ms = await appapi.day_matches(day)
    except appapi.AppApiError as ex:
        return await target.answer(f"⚠️ {ex}")
    if not ms:
        return await target.answer(f"برای {day.isoformat()} بازی‌ای ثبت نشده.", reply_markup=okb([[ob("🔙 بازگشت", "fx:ag")]]))
    imgs = await _render("SCHEDULE", schedule_data(ms, day))
    await _send_preview(target, uid, imgs, f"📅 <b>برنامه بازی‌ها</b> — {day.strftime('%Y/%m/%d')}")


@router.callback_query(F.data == "fx:agdt")
async def day_today(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await c.answer()
    await _do_day(c.message, c.from_user.id, core.local_now().date())


@router.message(GfxSt.date)
async def day_typed(m: Message, state: FSMContext):
    try:
        day = date.fromisoformat(core.norm(m.text or "").strip().replace("/", "-"))
    except ValueError:
        return await m.answer("⚠️ فرمت تاریخ درست نیست؛ مثل <code>2026-10-12</code> بفرست.")
    await state.clear()
    await _do_day(m, m.from_user.id, day)


@router.callback_query(F.data.startswith("fx:agc:"))
async def pick_comp(c: CallbackQuery, state: FSMContext):
    kind = c.data.split(":")[2]
    try:
        comps = await appapi.competitions()
    except appapi.AppApiError as ex:
        return await c.answer(str(ex), show_alert=True)
    if kind == "br":
        comps = [x for x in comps if x.get("type") in ("cup", "champions")]
    else:
        comps = [x for x in comps if x.get("type") in ("league", "champions", "cup")]
    comps = comps[:20]
    await state.update_data(comps=comps)
    rows = [[ob(f"{x['name']}", f"fx:agm:{kind}:{i}")] for i, x in enumerate(comps)]
    await show(c, f"{KINDS[kind][0]} — <b>مسابقه</b> را انتخاب کن:" + ("" if comps else "\n\nمسابقه‌ای پیدا نشد."), okb(rows + [[ob("🔙 بازگشت", "fx:ag")]]))
    await c.answer()


@router.callback_query(F.data.startswith("fx:agm:"))
async def build(c: CallbackQuery, state: FSMContext):
    _, _, kind, idx = c.data.split(":")
    comps = (await state.get_data()).get("comps") or []
    if not idx.isdigit() or int(idx) >= len(comps):
        return await c.answer("فهرست قدیمی شده؛ دوباره انتخاب کن.", show_alert=True)
    comp = comps[int(idx)]
    await c.answer("⏳ در حال ساخت…")
    try:
        if kind == "tb":
            pages = table_data(comp, await appapi.standings(comp))
            if not pages:
                return await c.message.answer("جدولی برای این مسابقه ثبت نشده.")
            imgs = [i for p in pages for i in await _render("GROUP_TABLE", p)]
        elif kind == "rs":
            d = results_data(comp, await appapi.comp_matches(comp))
            if not d["rows"]:
                return await c.message.answer("هنوز نتیجه‌ای ثبت نشده.")
            imgs = await _render("ROUND_RESULTS", d)
        else:
            d = bracket_data(await appapi.bracket(comp))
            if not d["stages"]:
                return await c.message.answer("براکتی برای این مسابقه ثبت نشده.")
            imgs = await _render("BRACKET", d)
    except appapi.AppApiError as ex:
        return await c.message.answer(f"⚠️ {ex}")
    await _send_preview(c.message, c.from_user.id, imgs, f"{KINDS[kind][0]} — <b>{E(comp['name'])}</b>")


@router.callback_query(F.data == "fx:agp")
async def publish(c: CallbackQuery, bot: Bot):
    chat = await core.get("gfx_chat")
    if not chat:
        return await c.answer("اول کانال انتشار را تعیین کن.", show_alert=True)
    pv = PREVIEW.get(c.from_user.id)
    if not pv:
        return await c.answer("پیش‌نمایشی نیست؛ دوباره بساز.", show_alert=True)
    outgoing.EXEMPT_CHATS.add(str(chat))
    try:
        for i, img in enumerate(pv[0]):
            await bot.send_photo(chat, BufferedInputFile(img, f"app_{i}.png"), caption=pv[1] if i == 0 else None)
    except TelegramAPIError as ex:
        return await c.answer(f"انتشار ناموفق: {str(ex)[:120]}", show_alert=True)
    PREVIEW.pop(c.from_user.id, None)
    await c.answer("✅ منتشر شد")
    await c.message.answer("✅ منتشر شد.", reply_markup=okb([[ob("🔙 گرافیک‌های اپ", "fx:ag")]]))
