"""🎨 Graphics from the PCL app's data. The admin first picks a competition (league / cup / tournament), then a tab:

📊 table · ✅ results · 📅 daily schedule · 🗓 round (or stage) schedule · 🏆 bracket · 📈 player stats · ⭐ team of the round

Data comes from the app API, is drawn with the editable templates (🎨 قالب‌ها) and nothing is published until the admin presses «انتشار».
"""
import re
from collections import OrderedDict
from datetime import date, datetime, timedelta

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery, Message

from .. import outgoing
from ..onc import gfx
from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import appapi, core
from .core import E
from .states import DestSt, GfxSt

router = Router()
router.message.filter(lambda m: is_admin(m.from_user.id))
router.callback_query.filter(lambda c: is_admin(c.from_user.id))
PREVIEW: dict[int, tuple[list[bytes], str]] = {}
TYPE_FA = {"league": "🏅 لیگ", "cup": "🏆 جام", "champions": "🌐 تورنمنت"}
STAGES = (("thirdplace", "رده‌بندی"), ("3rdplace", "رده‌بندی"), ("semifinal", "نیمه‌نهایی"), ("quarterfinal", "یک‌چهارم نهایی"),
          ("roundof16", "یک‌هشتم نهایی"), ("roundof32", "یک‌شانزدهم نهایی"), ("final", "فینال"))


# ------------------------------------------------------------------ pure builders (API json → render data)
def stage_name(raw) -> str:
    raw = str(raw if raw is not None else "?")
    if raw.isdigit():
        return f"راند {int(raw)}"
    key = re.sub(r"[^a-z0-9]", "", raw.lower())
    return next((fa for k, fa in STAGES if key.endswith(k) or key == k), raw)


def rounds_of(matches: list[dict]) -> list[str]:
    seen = OrderedDict()
    for m in sorted(matches, key=lambda m: m.get("match_date") or ""):
        seen.setdefault(str(m.get("round") if m.get("round") is not None else "?"), None)
    keys = list(seen)
    nums = sorted((k for k in keys if k.isdigit()), key=int)
    return nums + [k for k in keys if not k.isdigit()]


def local(m: dict):
    return appapi.tehran(m["match_date"]) if m.get("match_date") else None


def _gd(n) -> str:
    n = int(n or 0)
    return f"{n:+d}" if n else "0"


def schedule_data(matches: list[dict], subtitle: str, label_with: str = "date", title: str | None = None) -> dict:
    """Rows grouped by kick-off time. label_with: 'date' (round schedule) or 'round' (daily schedule) → the little pill after the time."""
    rows, last = [], None
    for m in sorted(matches, key=lambda m: m.get("match_date") or "9"):
        t = local(m)
        slot = t.strftime("%H:%M") if t else "TBD"
        label = (t.strftime("%m/%d") if t else "") if label_with == "date" else stage_name(m.get("round"))
        key = (slot, label)
        if key != last:
            rows.append({"kind": "slot", "text": f"{slot} · {label}" if label else slot})
            last = key
        rows.append({"kind": "match", "text": f"{m['home_team_name']} × {m['away_team_name']}", "a": m["home_team_name"], "b": m["away_team_name"]})
    return {"subtitle": subtitle, "rows": rows, **({"title": title} if title else {})}


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


def results_data(subtitle: str, matches: list[dict], limit: int = 12) -> dict:
    done = [m for m in matches if m.get("status") == "finished" and m.get("home_score") is not None]
    done.sort(key=lambda m: m.get("match_date") or "", reverse=True)
    rows = []
    for m in done[:limit]:
        a, b = m["home_team_name"], m["away_team_name"]
        sc = f"{m['home_score']} - {m['away_score']}"
        if m["home_score"] == m["away_score"] and m.get("home_penalty") is not None:       # level after extra time → shown with the penalty winner mark
            a, b = ("▶ " + a, b) if (m["home_penalty"] or 0) > (m["away_penalty"] or 0) else (a, "▶ " + b)
        rows.append({"cells": [a, sc, b]})
    return {"title": "نتایج", "subtitle": subtitle, "rows": rows}


def bracket_data(matches: list[dict]) -> dict:
    stages: "OrderedDict[str, list]" = OrderedDict()
    for m in sorted(matches, key=lambda m: m.get("match_date") or ""):
        ga, gb = m.get("home_score"), m.get("away_score")
        win = None
        if ga is not None and gb is not None:
            pa, pb = m.get("home_penalty"), m.get("away_penalty")
            win = "a" if (ga, pa or 0) > (gb, pb or 0) else "b" if (ga, pa or 0) < (gb, pb or 0) else None
        stages.setdefault(stage_name(m.get("round")), []).append({"a": m["home_team_name"], "b": m["away_team_name"], "ga": ga, "gb": gb, "win": win})
    return {"stages": [{"name": k, "matches": v} for k, v in stages.items()]}


def who(p: dict) -> str:
    return p.get("gamer_tag") or p.get("player_name") or "?"


def _val(v, rating=False) -> str:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    return f"{f:.2f}" if rating else str(int(f)) if f == int(f) else f"{f:g}"


def stats_card(label: str, rows: list[dict], rating: bool = False, suffix: str = "") -> dict | None:
    if not rows:
        return None
    top = rows[0]
    others = "   ·   ".join(f"{i}. {who(p)} — {_val(p.get('value'), rating)}" for i, p in enumerate(rows[1:3], 2))
    return {"label": label, "name": who(top), "team": top.get("team_name") or "", "value": _val(top.get("value"), rating) + suffix, "others": others}


def gk_card(xi: list[dict]) -> dict | None:
    gks = [p for p in xi if str(p.get("position") or "").upper().startswith("GK")]
    if not gks:
        return None
    g = max(gks, key=lambda p: (p.get("clean_sheets") or 0, p.get("rating") or 0))
    return {"label": "BEST GOALKEEPER", "name": who(g), "team": g.get("team_name") or "", "value": f"{int(g.get('clean_sheets') or 0)} CS", "others": ""}


def xi_data(comp: dict, xi: list[dict], stage: str | None) -> dict:
    formation = next((p.get("formation") for p in xi if p.get("formation")), None)
    return {"title": f"BEST XI · {formation}" if formation else "BEST XI", "subtitle": comp["name"] + (f" · {stage}" if stage else ""),
            "players": [{"name": who(p), "position": p.get("position") or "", "rating": _val(p.get("rating"), True) if p.get("rating") is not None else ""} for p in xi[:11]]}


# ------------------------------------------------------------------ screens
async def _render(type_: str, data: dict) -> list[bytes]:
    return await gfx._render(type_, {**core.APP_LOOK, **data})


async def _send_preview(target: Message, uid: int, images: list[bytes], caption: str):
    PREVIEW[uid] = (images, caption)
    for i, img in enumerate(images):
        await target.answer_photo(BufferedInputFile(img, f"app_{i}.png"), caption=caption if i == 0 else None)
    await target.answer("پیش‌نمایش بالاست. منتشر شود؟", reply_markup=okb([[ob("📣 انتشار", "fx:agp")], [ob("🔙 بازگشت به مسابقه", "fx:agm")]]))


async def _comp(state: FSMContext) -> dict | None:
    return (await state.get_data()).get("comp")


@router.callback_query(F.data == "fx:ag")
async def pick_competition(c: CallbackQuery, state: FSMContext, bot: Bot):
    await state.clear()
    try:
        comps = await appapi.competitions()
    except appapi.AppApiError as ex:
        return await c.answer(str(ex), show_alert=True)
    comps = comps[:30]
    await state.update_data(comps=[{k: x.get(k) for k in ("id", "name", "type", "status")} for x in comps])
    rows = [[ob(f"{TYPE_FA.get(x.get('type'), '🏅')} · {x['name']}"[:60], f"fx:agc:{i}")] for i, x in enumerate(comps)]
    await show(c, "🎨 <b>گرافیک‌های اپ</b>\n\n<b>مسابقه</b> را انتخاب کن (لیگ / جام / تورنمنت):" + ("" if comps else "\n\nمسابقه‌ای در اپ پیدا نشد.")
               + f"\n\nکانال انتشار: {await core.dest_status(bot, 'gfx_chat')}",
               okb(rows + [[ob("📍 تعیین کانال انتشار", "fx:agdst")], [ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@router.callback_query(F.data == "fx:agdst")
async def dest(c: CallbackQuery, state: FSMContext):
    comps = (await state.get_data()).get("comps")
    await state.set_state(DestSt.pick)
    await state.update_data(key="gfx_chat", back="fx:ag", comps=comps)
    await show(c, "📍 کانال انتشار گرافیک‌ها: یک پست فوروارد کن یا @username / آیدی عددی بفرست.", okb([[ob("❌ لغو", "fx:ag")]]))
    await c.answer()


def menu_rows(comp: dict) -> list[list]:
    t = comp.get("type")
    tabs = []
    if t in ("league", "champions"):
        tabs.append(ob("📊 جدول" if t == "league" else "📊 جدول گروه‌ها", "fx:agtb"))
    tabs += [ob("✅ نتایج", "fx:agr:r"), ob("📅 برنامه روزانه", "fx:agd"), ob("🗓 برنامه راندی" if t != "cup" else "🗓 برنامه مرحله‌ای", "fx:agr:s")]
    if t in ("cup", "champions"):
        tabs.append(ob("🏆 براکت", "fx:agbr"))
    tabs += [ob("📈 آمار بازیکنان", "fx:agst"), ob("⭐ تیم منتخب", "fx:agxi")]
    rows = [tabs[i:i + 2] for i in range(0, len(tabs), 2)]
    return rows + [[ob("🔄 تغییر مسابقه", "fx:ag")], [ob("🔙 بازگشت", "fx:a")]]


async def _menu(c: CallbackQuery, state: FSMContext):
    await state.set_state(None)                                        # leave the "type a date" state, keep the chosen competition
    comp = await _comp(state)
    await show(c, f"🎨 <b>{E(comp['name'])}</b>\n{TYPE_FA.get(comp.get('type'), '')}\n\nکدام گرافیک را می‌خواهی؟", okb(menu_rows(comp)))


@router.callback_query(F.data.regexp(r"^fx:agc:\d+$"))
async def choose(c: CallbackQuery, state: FSMContext):
    comps = (await state.get_data()).get("comps") or []
    i = int(c.data.split(":")[2])
    if i >= len(comps):
        return await c.answer("فهرست قدیمی شده؛ دوباره انتخاب کن.", show_alert=True)
    await state.update_data(comp=comps[i])
    await _menu(c, state)
    await c.answer()


@router.callback_query(F.data == "fx:agm")
async def back_to_menu(c: CallbackQuery, state: FSMContext):
    if not await _comp(state):
        return await pick_competition(c, state, c.bot)
    await _menu(c, state)
    await c.answer()


async def _need(c: CallbackQuery, state: FSMContext) -> dict | None:
    comp = await _comp(state)
    if not comp:
        await c.answer("اول مسابقه را انتخاب کن.", show_alert=True)
    return comp


async def _build(c: CallbackQuery, state: FSMContext, fn):
    comp = await _need(c, state)
    if not comp:
        return
    await c.answer("⏳ در حال ساخت…")
    try:
        res = await fn(comp)
    except appapi.AppApiError as ex:
        return await c.message.answer(f"⚠️ {ex}")
    if isinstance(res, str):
        return await c.message.answer(res, reply_markup=okb([[ob("🔙 بازگشت به مسابقه", "fx:agm")]]))
    await _send_preview(c.message, c.from_user.id, *res)


# ---- 📊 table
@router.callback_query(F.data == "fx:agtb")
async def table(c: CallbackQuery, state: FSMContext):
    async def fn(comp):
        pages = table_data(comp, await appapi.standings(comp))
        if not pages:
            return "جدولی برای این مسابقه ثبت نشده."
        return [i for p in pages for i in await _render("GROUP_TABLE", p)], f"📊 <b>{E(comp['name'])}</b>"
    await _build(c, state, fn)


# ---- 🏆 bracket
@router.callback_query(F.data == "fx:agbr")
async def bracket(c: CallbackQuery, state: FSMContext):
    async def fn(comp):
        d = bracket_data(await appapi.bracket(comp))
        if not d["stages"]:
            return "براکتی برای این مسابقه ثبت نشده."
        return await _render("BRACKET", d), f"🏆 <b>{E(comp['name'])}</b>"
    await _build(c, state, fn)


# ---- 📈 player stats
@router.callback_query(F.data == "fx:agst")
async def player_stats(c: CallbackQuery, state: FSMContext):
    async def fn(comp):
        scorers = await appapi.stats(comp, "scorers")
        assists = await appapi.stats(comp, "assists")
        rating = await appapi.stats(comp, "avgRating")
        gk = None
        try:
            gk = stats_card("BEST GOALKEEPER", await appapi.stats(comp, "cleanSheets"), suffix=" CS")
        except appapi.AppApiError:
            pass
        if not gk:                                                                  # no clean-sheet table → the keeper of the team of the season
            try:
                gk = gk_card(await appapi.best_xi(comp))
            except appapi.AppApiError:
                gk = None
        cards = [x for x in (stats_card("TOP SCORER", scorers), stats_card("MOST ASSISTS", assists), gk, stats_card("BEST AVG RATING", rating, rating=True)) if x]
        if not cards:
            return "هنوز آماری ثبت نشده."
        done = [m for m in await appapi.all_matches(comp) if m.get("status") == "finished"]
        upto = rounds_of(done)[-1] if done else None
        sub = comp["name"] + (f" · تا {stage_name(upto)}" if upto else "")
        return await _render("PLAYER_STATS", {"subtitle": sub, "cards": cards}), f"📈 <b>آمار بازیکنان — {E(comp['name'])}</b>" + (f"\nتا {stage_name(upto)}" if upto else "")
    await _build(c, state, fn)


# ---- round pickers: schedule (s) / results (r) / team of the round (x)
async def _round_picker(c: CallbackQuery, state: FSMContext, mode: str):
    comp = await _need(c, state)
    if not comp:
        return
    try:
        matches = await appapi.all_matches(comp)
    except appapi.AppApiError as ex:
        return await c.answer(str(ex), show_alert=True)
    rs = rounds_of(matches)
    if mode == "r":                                   # only rounds that have a result
        rs = [r for r in rs if any(str(m.get("round")) == r and m.get("status") == "finished" for m in matches)]
    await state.update_data(rounds=rs)
    head = [[ob("⚡ آخرین نتایج", "fx:agp2:r:last")]] if mode == "r" else [[ob("🌟 تا همین‌جا (کل مسابقه)", "fx:agp2:x:all")]] if mode == "x" else []
    btns = [ob(stage_name(r), f"fx:agp2:{mode}:{i}") for i, r in enumerate(rs)]
    grid = [btns[i:i + 3] for i in range(0, len(btns), 3)]
    title = {"s": "🗓 <b>برنامه</b> — راند / مرحله را انتخاب کن:", "r": "✅ <b>نتایج</b> — راند / مرحله را انتخاب کن:", "x": "⭐ <b>تیم منتخب</b> — راند / مرحله را انتخاب کن:"}[mode]
    await show(c, title + ("" if rs or head else "\n\nهنوز بازی‌ای ثبت نشده."), okb(head + grid + [[ob("🔙 بازگشت به مسابقه", "fx:agm")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:agr:(s|r)$"))
async def round_menu(c: CallbackQuery, state: FSMContext):
    await _round_picker(c, state, c.data.split(":")[2])


@router.callback_query(F.data == "fx:agxi")
async def xi_menu(c: CallbackQuery, state: FSMContext):
    await _round_picker(c, state, "x")


@router.callback_query(F.data.regexp(r"^fx:agp2:(s|r|x):(\d+|last|all)$"))
async def round_pick(c: CallbackQuery, state: FSMContext):
    _, _, mode, idx = c.data.split(":")
    d = await state.get_data()
    rs = d.get("rounds") or []
    if idx.isdigit() and int(idx) >= len(rs):
        return await c.answer("فهرست قدیمی شده؛ دوباره انتخاب کن.", show_alert=True)
    raw = rs[int(idx)] if idx.isdigit() else None

    async def fn(comp):
        if mode == "x":
            xi = await appapi.best_xi(comp, raw)
            if not xi:
                return "برای این بازه تیم منتخبی ثبت نشده."
            return await _render("BEST_XI", xi_data(comp, xi, stage_name(raw) if raw else None)), f"⭐ <b>تیم منتخب — {E(comp['name'])}</b>" + (f"\n{stage_name(raw)}" if raw else "")
        matches = await appapi.all_matches(comp)
        if mode == "r":
            sel = matches if raw is None else [m for m in matches if str(m.get("round")) == raw]
            data = results_data(comp["name"] + (f" · {stage_name(raw)}" if raw else ""), sel)
            if not data["rows"]:
                return "نتیجه‌ای ثبت نشده."
            return await _render("ROUND_RESULTS", data), f"✅ <b>نتایج — {E(comp['name'])}</b>" + (f"\n{stage_name(raw)}" if raw else "")
        sel = [m for m in matches if str(m.get("round")) == raw]
        if not sel:
            return "بازی‌ای در این مرحله نیست."
        return await _render("SCHEDULE", schedule_data(sel, comp["name"], title=f"برنامه {stage_name(raw)}")), f"🗓 <b>برنامه {stage_name(raw)} — {E(comp['name'])}</b>"
    await _build(c, state, fn)


# ---- 📅 daily schedule
async def _day_graphic(c_or_m, uid: int, state: FSMContext, day: date, target: Message):
    await state.set_state(None)
    comp = await _comp(state)
    try:
        ms = [m for m in await appapi.all_matches(comp) if m.get("match_date") and local(m).date() == day]
    except appapi.AppApiError as ex:
        return await target.answer(f"⚠️ {ex}")
    if not ms:
        return await target.answer(f"برای {day.isoformat()} در «{E(comp['name'])}» بازی‌ای ثبت نشده.", reply_markup=okb([[ob("📅 روز دیگر", "fx:agd")], [ob("🔙 بازگشت به مسابقه", "fx:agm")]]))
    imgs = await _render("SCHEDULE", schedule_data(ms, f"{comp['name']} · {day.strftime('%Y/%m/%d')}", label_with="round"))
    await _send_preview(target, uid, imgs, f"📅 <b>برنامه بازی‌ها — {E(comp['name'])}</b>\n{day.strftime('%Y/%m/%d')}")


@router.callback_query(F.data == "fx:agd")
async def day_picker(c: CallbackQuery, state: FSMContext):
    comp = await _need(c, state)
    if not comp:
        return
    try:
        ms = await appapi.all_matches(comp)
    except appapi.AppApiError as ex:
        return await c.answer(str(ex), show_alert=True)
    today = core.local_now().date()
    count: dict[date, int] = {}
    for m in ms:
        if m.get("match_date"):
            d = local(m).date()
            count[d] = count.get(d, 0) + 1
    days = sorted(d for d in count if d >= today - timedelta(days=1))[:9] or sorted(count, reverse=True)[:9]
    await state.update_data(days=[d.isoformat() for d in days], counts=[count[d] for d in days])
    await state.set_state(GfxSt.date)
    btns = [ob(f"{d.strftime('%Y/%m/%d')} · {count[d]} بازی", f"fx:agdd:{i}") for i, d in enumerate(days)]
    await show(c, "📅 <b>روز</b> را انتخاب کن (از روزهایی که بازی دارند)، یا تاریخ را تایپ کن (مثلاً <code>2026-10-12</code>).",
               okb([btns[i:i + 2] for i in range(0, len(btns), 2)] + [[ob("🔙 بازگشت به مسابقه", "fx:agm")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:agdd:\d+$"))
async def day_pick(c: CallbackQuery, state: FSMContext):
    days = (await state.get_data()).get("days") or []
    i = int(c.data.split(":")[2])
    if i >= len(days):
        return await c.answer("فهرست قدیمی شده؛ دوباره انتخاب کن.", show_alert=True)
    await c.answer("⏳ در حال ساخت…")
    await _day_graphic(c, c.from_user.id, state, date.fromisoformat(days[i]), c.message)


@router.message(GfxSt.date)
async def day_typed(m: Message, state: FSMContext):
    if not await _comp(state):
        return await m.answer("اول مسابقه را انتخاب کن: /admin")
    try:
        day = date.fromisoformat(core.norm(m.text or "").strip().replace("/", "-"))
    except ValueError:
        return await m.answer("⚠️ فرمت تاریخ درست نیست؛ مثل <code>2026-10-12</code> بفرست.")
    await _day_graphic(m, m.from_user.id, state, day, m)


# ---- publish
@router.callback_query(F.data == "fx:agp")
async def publish(c: CallbackQuery, bot: Bot):
    chat = await core.get("gfx_chat")
    if not chat:
        return await c.answer("اول کانال انتشار را تعیین کن (📍 در فهرست مسابقه‌ها).", show_alert=True)
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
    await c.message.answer("✅ منتشر شد.", reply_markup=okb([[ob("🔙 بازگشت به مسابقه", "fx:agm")]]))
