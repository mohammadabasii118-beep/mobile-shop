"""ONC admin panel, part 2: live matches, result entry, round review, CONFIRM & PUBLISH, edits, standings, ties, knockout."""
import html

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from ..utils import is_admin, show
from . import algo, publish, service, ui
from .handlers_admin import PANEL, alert, tid_of
from .service import OncError
from .states import ResultSt, TieSt
from .ui import E, ob, okb

router = Router()
router.message.filter(lambda m: is_admin(m.from_user.id))
router.callback_query.filter(lambda c: is_admin(c.from_user.id))


# ----------------------------------------------------------------- live matches / rounds
async def live_screen(c, t: dict, rid: int | None = None) -> None:
    r = await service.get_round(rid) if rid else await service.current_round(t["id"])
    if not r:
        rows = [[ob("⚽ ALL ROUNDS", f"onc:rs:{t['id']}")], [ob("🔙 BACK", f"onc:t:{t['id']}")]]
        return await show(c, f"🔴 <b>LIVE MATCHES</b> — {E(t['name'])}\n\nNo open round with matches.\n(generate the schedule / create a knockout stage first)", okb(rows))
    await round_screen(c, r["id"], live=True)


@router.callback_query(F.data.startswith("onc:lv:"))
async def live(c: CallbackQuery, state: FSMContext):
    await state.clear()
    t = await tid_of(c, c.data.split(":")[2])
    if t:
        await live_screen(c, t)
        await c.answer()


@router.callback_query(F.data.startswith("onc:rs:"))
async def rounds_list(c: CallbackQuery, state: FSMContext):
    await state.clear()
    t = await tid_of(c, c.data.split(":")[2])
    if not t:
        return
    rows = []
    for r in await service.rounds_of(t["id"]):
        p = await service.round_progress(r["id"])
        if not p["total"]:
            continue
        icon = "✅" if r["status"] == "CONFIRMED" else ("🟡" if p["completed"] else "⏳")
        rows.append([ob(f"{icon} {r['start_at'][11:]} · {await service.round_label(r)} ({ui.progress(p)})", f"onc:rd:{r['id']}")])
    await show(c, f"⚽ <b>RESULTS</b> — {E(t['name'])}\n\n✅ confirmed · 🟡 completed, waiting for confirmation · ⏳ in progress",
               okb(rows + [[ob("🔙 BACK", f"onc:t:{t['id']}")]]))
    await c.answer()


async def round_screen(c, rid: int, live: bool = False, note: str = "") -> None:
    r = await service.get_round(rid)
    t = await service.get_tournament(r["tournament_id"])
    ms = await service.matches_of_round(rid)
    p = await service.round_progress(rid)
    label = await service.round_label(r)
    back = f"onc:rs:{t['id']}"
    if r["status"] == "CONFIRMED":
        pub = "📢 published" if r["published_version"] >= r["content_version"] and r["published_version"] else "⚠️ NOT published / changed since publishing"
        text = f"{note}{ui.title(t)}\n<b>{label}</b> — 🕐 {r['start_at'][11:]}\n✅ CONFIRMED · {pub}\n\n" + "\n".join(ui.match_line(m) for m in ms)
        rows = [[ob(f"✏️ {m['name_a']} {m['goals_a']}-{m['goals_b']} {m['name_b']}", f"onc:rm:{m['id']}")] for m in ms]
        if not (r["published_version"] and r["published_version"] >= r["content_version"]):
            rows.append([ob("📢 PUBLISH / UPDATE CHANNEL POST", f"onc:ru:{rid}")])
        rows.append([ob("🔙 BACK", back)])
        return await show(c, text, okb(rows))
    if p["completed"]:  # ROUND COMPLETED → text summary for the admin, nothing is published yet
        text = (f"{note}✅ <b>ROUND COMPLETED</b> — review before publishing\n\n" + ui.results_summary(t, label, ms)
                + "\n\n<i>Nothing has been published yet.</i>")
        rows = [[ob("✅ CONFIRM & PUBLISH", f"onc:rc:{rid}")], [ob("✏️ EDIT RESULTS", f"onc:re:{rid}")], [ob("❌ CANCEL", back)]]
        return await show(c, text, okb(rows))
    lines, rows = [], []
    for m in ms:
        score = f"{m['goals_a']}-{m['goals_b']}" if m["goals_a"] is not None else None
        lines.append(("✅ " if score else "⏳ ") + ui.match_line(m))
        rows.append([ob(f"{'✏️' if score else '▶️'} ENTER RESULT: {m['name_a']} vs {m['name_b']}" if not score else f"✏️ {m['name_a']} {score} {m['name_b']}",
                        f"onc:rm:{m['id']}")])
    head = "🔴 <b>LIVE MATCHES</b>\n\n" if live else ""
    text = f"{note}{head}{ui.title(t)}\n<b>{label.upper()}</b> — 🕐 {r['start_at'][11:]}  ({ui.progress(p)} entered)\n\n" + "\n".join(lines)
    if r["stage"] != "GROUP":
        rows.append([ob("⚔️ KNOCKOUT STAGE", f"onc:ks:{rid}")])
    rows.append([ob("⚽ ALL ROUNDS", f"onc:rs:{t['id']}"), ob("🔙 BACK", f"onc:t:{t['id']}")])
    await show(c, text[:4000], okb(rows))


@router.callback_query(F.data.startswith("onc:rd:"))
async def round_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await round_screen(c, int(c.data.split(":")[2]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:re:"))
async def round_edit_list(c: CallbackQuery):
    rid = int(c.data.split(":")[2])
    r = await service.get_round(rid)
    ms = await service.matches_of_round(rid)
    rows = [[ob(f"✏️ {m['name_a']} {m['goals_a']}-{m['goals_b']} {m['name_b']}", f"onc:rm:{m['id']}")] for m in ms]
    await show(c, f"✏️ <b>EDIT RESULTS</b> — {await service.round_label(r)}\nChoose the match to correct:", okb(rows + [[ob("🔙 BACK", f"onc:rd:{rid}")]]))
    await c.answer()


# ----------------------------------------------------------------- result entry (fast: "3" then "1", or "3-1" at once)
def _cancel_kb(mid: int, rid: int):
    return okb([[ob("❌ CANCEL", f"onc:rcx:{rid}")]])


@router.callback_query(F.data.startswith("onc:rm:"))
async def result_start(c: CallbackQuery, state: FSMContext):
    mid = int(c.data.split(":")[2])
    m = await service.get_match(mid)
    await state.clear()
    await state.set_state(ResultSt.ga)
    await state.update_data(mid=mid, rid=m["round_id"], confirmed=m["round_status"] == "CONFIRMED")
    warn = "\n⚠️ This round is already confirmed — changing it will recalculate standings." if m["round_status"] == "CONFIRMED" else ""
    await show(c, f"⚽ <b>{E(m['name_a'])} vs {E(m['name_b'])}</b>{warn}\n\n<b>{E(m['name_a']).upper()} GOALS:</b>\n<i>(send a number, or both as 3-1)</i>",
               _cancel_kb(mid, m["round_id"]))
    await c.answer()


def _parse_goals(text: str) -> tuple[int, int | None]:
    import re
    t = service.norm_digits(text)
    mm = re.fullmatch(r"(\d{1,2})\s*[-:–]\s*(\d{1,2})", t)
    if mm:
        return int(mm.group(1)), int(mm.group(2))
    if re.fullmatch(r"\d{1,2}", t):
        return int(t), None
    raise OncError("Send a whole number (0–99), e.g. 3 — or both goals like 3-1.")


@router.message(ResultSt.ga, F.text)
async def result_ga(m: Message, state: FSMContext):
    d = await state.get_data()
    match = await service.get_match(d["mid"])
    try:
        a, b = _parse_goals(m.text)
    except OncError as e:
        return await m.answer(f"⚠️ {e}", reply_markup=_cancel_kb(d["mid"], d["rid"]))
    await state.update_data(ga=a)
    if b is not None:
        await state.update_data(gb=b)
        return await _after_goals(m, state)
    await state.set_state(ResultSt.gb)
    await m.answer(f"<b>{E(match['name_b']).upper()} GOALS:</b>", reply_markup=_cancel_kb(d["mid"], d["rid"]))


@router.message(ResultSt.gb, F.text)
async def result_gb(m: Message, state: FSMContext):
    d = await state.get_data()
    try:
        b, extra = _parse_goals(m.text)
        if extra is not None:
            raise OncError("Send only the second team's goals (a number).")
    except OncError as e:
        return await m.answer(f"⚠️ {e}", reply_markup=_cancel_kb(d["mid"], d["rid"]))
    await state.update_data(gb=b)
    await _after_goals(m, state)


async def _after_goals(m: Message, state: FSMContext) -> None:
    d = await state.get_data()
    match = await service.get_match(d["mid"])
    if match["stage"] != "GROUP" and d["ga"] == d["gb"]:  # level knockout match: never guess the winner
        await state.set_state(ResultSt.winner)
        return await m.answer(f"🤝 Level: <b>{E(match['name_a'])} {d['ga']} - {d['gb']} {E(match['name_b'])}</b>\n\nWho won? (choose manually)",
                              reply_markup=okb([[ob(f"🏆 {match['name_a']}", "onc:rw:a"), ob(f"🏆 {match['name_b']}", "onc:rw:b")],
                                                [ob("❌ CANCEL", f"onc:rcx:{d['rid']}")]]))
    await _preview(m, state)


@router.callback_query(F.data.startswith("onc:rw:"), ResultSt.winner)
async def result_winner(c: CallbackQuery, state: FSMContext):
    d = await state.get_data()
    match = await service.get_match(d["mid"])
    await state.update_data(winner=match["team_a"] if c.data.endswith(":a") else match["team_b"])
    await c.answer()
    await _preview(c.message, state)


async def _preview(m: Message, state: FSMContext) -> None:
    d = await state.get_data()
    match = await service.get_match(d["mid"])
    await state.set_state(ResultSt.preview)
    extra = ""
    if d.get("winner"):
        extra = f"\n▶ Winner: <b>{E(match['name_a'] if d['winner'] == match['team_a'] else match['name_b'])}</b>"
    await m.answer(f"<b>{E(match['name_a'])} {d['ga']} - {d['gb']} {E(match['name_b'])}</b>{extra}",
                   reply_markup=okb([[ob("✅ SAVE RESULT", "onc:rsv")], [ob("✏️ EDIT", f"onc:rm:{d['mid']}"), ob("❌ CANCEL", f"onc:rcx:{d['rid']}")]]))


@router.callback_query(F.data.startswith("onc:rcx:"))
async def result_cancel(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await round_screen(c, int(c.data.split(":")[2]))
    await c.answer("Cancelled")


@router.callback_query(F.data == "onc:rsv", ResultSt.preview)
async def result_save(c: CallbackQuery, state: FSMContext, bot: Bot):
    d = await state.get_data()
    try:
        if d["confirmed"]:
            res = await service.edit_confirmed_result(c.from_user.id, d["mid"], d["ga"], d["gb"], d.get("winner"))
            return await _after_edit(c, state, res)
        await service.save_result(c.from_user.id, d["mid"], d["ga"], d["gb"], d.get("winner"))
    except OncError as e:
        return await alert(c, str(e))
    await state.clear()
    await c.answer("✅ Saved")
    await round_screen(c, d["rid"], note="✅ Result saved (not published).\n\n")


async def _after_edit(c: CallbackQuery, state: FSMContext, res: dict) -> None:
    m, rid = res["match"], res["round"]["id"]
    if not res["applied"]:  # dependency protection: knockout would silently break
        await state.set_state(ResultSt.impact)
        text = ("⚠️ <b>THIS CHANGE AFFECTS THE KNOCKOUT</b>\n\n" + f"{E(m['name_a'])} vs {E(m['name_b'])}: {res['old']} → {res['new']}\n\nInvalid after the change:\n"
                + "\n".join(f"• {E(x)}" for x in res["impact"])
                + "\n\nApplying removes the invalid knockout matchups (their stages reopen) — you then pick the matchups again.")
        return await show(c, text, okb([[ob("✅ APPLY & REBUILD KNOCKOUT", "onc:rrb")], [ob("❌ CANCEL CHANGE", f"onc:rcx:{rid}")]]))
    await state.clear()
    await c.answer("✅ Result changed — standings recalculated")
    if res["was_published"]:
        return await show(c, f"✅ Result changed: {E(m['name_a'])} vs {E(m['name_b'])}: {res['old']} → {res['new']}\n\n⚠️ <b>ROUND ALREADY PUBLISHED</b>\n\n<b>RESULT HAS BEEN CHANGED</b>",
                          okb([[ob("🔄 UPDATE CHANNEL POST", f"onc:ru:{rid}")], [ob("❌ KEEP CURRENT POST", f"onc:rk:{rid}")]]))
    await round_screen(c, rid, note="✅ Result changed (round was never published).\n\n")


@router.callback_query(F.data == "onc:rrb", ResultSt.impact)
async def result_rebuild(c: CallbackQuery, state: FSMContext):
    d = await state.get_data()
    try:
        res = await service.edit_confirmed_result(c.from_user.id, d["mid"], d["ga"], d["gb"], d.get("winner"), rebuild=True)
    except OncError as e:
        return await alert(c, str(e))
    await _after_edit(c, state, res)


@router.callback_query(F.data.startswith("onc:rk:"))
async def keep_post(c: CallbackQuery):
    rid = int(c.data.split(":")[2])
    await c.answer("Channel post kept as is")
    await round_screen(c, rid, note="Channel post kept as is (it no longer matches the confirmed results).\n\n")


# ----------------------------------------------------------------- CONFIRM & PUBLISH / update / retry
@router.callback_query(F.data.startswith("onc:rc:"))
async def confirm_publish(c: CallbackQuery, bot: Bot):
    rid = int(c.data.split(":")[2])
    try:
        await service.confirm_round(c.from_user.id, rid)
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("Confirmed — publishing…")
    await _publish_round(c, bot, rid)


async def _publish_round(c: CallbackQuery, bot: Bot, rid: int, update: bool = False) -> None:
    r = await service.get_round(rid)
    try:
        out = await publish.after_confirm(bot, rid, c.from_user.id) if not update else {"results": await publish.round_results(bot, rid, c.from_user.id, update=True)}
        if update and r["stage"] == "F":
            t = await service.get_tournament(r["tournament_id"])
            if t["champion_team_id"]:
                await publish.champion(bot, r["tournament_id"], c.from_user.id, update=True)
        res = out["results"]
        note = f"📢 Published to the ONC channel ({res['sent']} new, {res['edited']} updated).\n"
        if "champion" in out:
            note += "👑 Champion poster published.\n"
        if r["stage"] == "GROUP":
            q = await service.qualification(r["tournament_id"])
            note += "\n✅ Qualification is FINAL — you can create the knockout stage." if q["ready"] else ""
        await round_screen(c, rid, note=note + "\n")
    except (publish.PublishError, OncError) as e:
        await show(c, f"✅ Results are <b>confirmed</b> (standings updated) but the channel post FAILED:\n\n⚠️ {E(str(e))}\n\nFix the channel in CHANNEL and retry.",
                   okb([[ob("🔁 RETRY PUBLISH", f"onc:rp:{rid}")], [ob("📢 CHANNEL", "onc:ch")], [ob("🔙 BACK", f"onc:rd:{rid}")]]))


@router.callback_query(F.data.startswith("onc:rp:"))
async def retry_publish(c: CallbackQuery, bot: Bot):
    await c.answer("Publishing…")
    await _publish_round(c, bot, int(c.data.split(":")[2]))


@router.callback_query(F.data.startswith("onc:ru:"))
async def update_post(c: CallbackQuery, bot: Bot):
    """Edits the earlier channel message(s) in place (a new post is sent only when none exists)."""
    await c.answer("Updating…")
    await _publish_round(c, bot, int(c.data.split(":")[2]), update=True)


# ----------------------------------------------------------------- standings / qualification / tie decisions
async def standings_screen(c, t: dict) -> None:
    tables = await service.group_tables(t["id"])
    q = await service.qualification(t["id"])
    text = f"📊 <b>STANDINGS</b> — {E(t['name'])}\n<i>Confirmed results only</i>\n\n" + (
        "\n\n".join(ui.standings_block(x) for x in tables) if tables else "No groups yet.")
    rows = []
    for x in tables:
        if x["unresolved"]:
            rows.append([ob(f"⚖️ DECIDE ORDER — {x['group']['name']}", f"onc:tb:{x['group']['id']}")])
    names = await service.team_names(t["id"])
    if q["ready"]:
        text += "\n\n✅ <b>QUALIFIED</b>: " + ", ".join(E(names[i]) for i in q["teams"])
    elif tables:
        text += "\n\n⏳ <b>Qualification not final:</b>\n" + "\n".join(f"• {E(b)}" for b in q["blockers"])
    if tables:
        rows.append([ob("📢 PUBLISH STANDINGS", f"onc:stp:{t['id']}")])
        if q["ready"]:
            rows.append([ob("✅ PUBLISH QUALIFIED TEAMS", f"onc:qlp:{t['id']}"), ob("🏆 KNOCKOUT", f"onc:ko:{t['id']}")])
    rows.append([ob("🔙 BACK", f"onc:t:{t['id']}")])
    await show(c, text[:4000], okb(rows))


@router.callback_query(F.data.startswith("onc:st:"))
async def standings(c: CallbackQuery, state: FSMContext):
    await state.clear()
    t = await tid_of(c, c.data.split(":")[2])
    if t:
        await standings_screen(c, t)
        await c.answer()


@router.callback_query(F.data.startswith("onc:stp:"))
async def standings_publish(c: CallbackQuery, bot: Bot):
    tid = int(c.data.split(":")[2])
    try:
        last = await service.dbx.scalar("SELECT MAX(id) FROM onc_rounds WHERE tournament_id=? AND stage='GROUP' AND status='CONFIRMED'", tid) or 0
        n = 0
        for x in await service.group_tables(tid):
            await publish.group_standings(bot, tid, x["group"]["id"], last, c.from_user.id, update=True)
            n += 1
    except (publish.PublishError, OncError) as e:
        return await alert(c, str(e))
    await c.answer(f"📢 {n} group table(s) published to the ONC channel.")


@router.callback_query(F.data.startswith("onc:qlp:"))
async def qualified_publish(c: CallbackQuery, bot: Bot):
    tid = int(c.data.split(":")[2])
    try:
        await publish.qualified(bot, tid, c.from_user.id)
    except (publish.PublishError, OncError) as e:
        return await alert(c, str(e))
    await c.answer("📢 Qualified teams published to the ONC channel.")


@router.callback_query(F.data.startswith("onc:tb:"))
async def tie_start(c: CallbackQuery, state: FSMContext):
    gid = int(c.data.split(":")[2])
    g = await service.get_group(gid)
    tbl = next(x for x in await service.group_tables(g["tournament_id"]) if x["group"]["id"] == gid)
    if not tbl["unresolved"]:
        return await alert(c, "No unresolved tie in this group.")
    block = tbl["unresolved"][0]
    await state.set_state(TieSt.pick)
    await state.update_data(gid=gid, block=block, order=[])
    await _tie_screen(c, state)
    await c.answer()


async def _tie_screen(c: CallbackQuery, state: FSMContext) -> None:
    d = await state.get_data()
    g = await service.get_group(d["gid"])
    names = await service.team_names(g["tournament_id"])
    left = [t for t in d["block"] if t not in d["order"]]
    picked = "\n".join(f"{i}. {E(names[t])}" for i, t in enumerate(d["order"], 1))
    rows = ui.grid([ob(names[t], f"onc:tbp:{t}") for t in left], 2)
    rows.append([ob("🧹 CLEAR", f"onc:tb:{d['gid']}"), ob("❌ CANCEL", f"onc:st:{g['tournament_id']}")])
    await show(c, f"⚖️ <b>NEEDS ADMIN DECISION</b> — {E(g['name'])}\n\nThese teams are level on every rule (Pts, "
               f"{'H2H, ' if len(d['block']) == 2 else ''}GD, GF).\nTap the teams in the order they should finish (first = higher):\n\n{picked or '—'}", okb(rows))


@router.callback_query(F.data.startswith("onc:tbp:"), TieSt.pick)
async def tie_pick(c: CallbackQuery, state: FSMContext):
    team = int(c.data.split(":")[2])
    d = await state.get_data()
    order = d["order"] + [team]
    await state.update_data(order=order)
    if len(order) == len(d["block"]):
        try:
            await service.set_tie_decision(c.from_user.id, d["gid"], order)
        except OncError as e:
            await state.clear()
            return await alert(c, str(e))
        g = await service.get_group(d["gid"])
        await state.clear()
        await c.answer("✅ Order saved")
        return await standings_screen(c, await service.get_tournament(g["tournament_id"]))
    await _tie_screen(c, state)
    await c.answer()


# ----------------------------------------------------------------- knockout
async def ko_screen(c: CallbackQuery, raw: str) -> None:
    t = await tid_of(c, raw)
    if not t:
        return
    tid = t["id"]
    q = await service.qualification(tid)
    names = await service.team_names(tid)
    rounds = await service.ko_rounds(tid)
    lines = []
    if q["ready"]:
        lines.append("✅ <b>Qualified</b>: " + ", ".join(E(names[i]) for i in q["teams"]))
    else:
        lines.append("⏳ Group stage not final:\n" + "\n".join(f"• {E(b)}" for b in q["blockers"]))
    rows = []
    for r in rounds:
        ms = await service.matches_of_round(r["id"])
        lines.append(f"\n<b>{algo.STAGE_NAME[r['stage']]}</b> {'✅' if r['status'] == 'CONFIRMED' else ''}\n" + (
            "\n".join(f"• {ui.match_line(m, with_score=m['rstatus'] == 'CONFIRMED')}" for m in ms) or "<i>no matchups yet</i>"))
        rows.append([ob(f"⚔️ {algo.STAGE_NAME[r['stage']]}", f"onc:ks:{r['id']}")])
    if q["ready"]:
        rows.append([ob("➕ CREATE STAGE", f"onc:kc:{tid}")])
    if rounds:
        rows.append([ob("🧩 PUBLISH BRACKET", f"onc:kb:{tid}")])
        if t["champion_team_id"]:
            rows.append([ob("👑 PUBLISH CHAMPION POSTER", f"onc:kch:{tid}")])
    rows.append([ob("🔙 BACK", f"onc:t:{tid}")])
    await show(c, f"🏆 <b>KNOCKOUT</b> — {E(t['name'])}\n\n" + "\n".join(lines), okb(rows))


@router.callback_query(F.data.startswith("onc:ko:"))
async def ko_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await ko_screen(c, c.data.split(":")[2])
    await c.answer()


@router.callback_query(F.data.startswith("onc:kc:"))
async def ko_stage_pick(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    have = {r["stage"] for r in await service.ko_rounds(tid)}
    last = max((algo.STAGES.index(s) for s in have), default=-1)
    options = [s for s in algo.STAGES if s not in have and algo.STAGES.index(s) > last]
    rows = [[ob(algo.STAGE_NAME[s], f"onc:kcs:{tid}:{s}")] for s in options]
    await show(c, "➕ <b>CREATE KNOCKOUT STAGE</b>\n\nChoose the stage (only the stages you need):", okb(rows + [[ob("🔙 BACK", f"onc:ko:{tid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:kcs:"))
async def ko_stage_create(c: CallbackQuery):
    _, _, tid, stage = c.data.split(":")
    try:
        rid = await service.create_ko_stage(c.from_user.id, int(tid), stage)
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("Stage created")
    await ko_stage_screen(c, rid)


async def ko_stage_screen(c: CallbackQuery, rid: int) -> None:
    r = await service.get_round(rid)
    t = await service.get_tournament(r["tournament_id"])
    ms = await service.matches_of_round(rid)
    pool = await service.ko_pool(t["id"], rid)
    names = await service.team_names(t["id"])
    text = (f"⚔️ <b>{algo.STAGE_NAME[r['stage']]}</b> — {E(t['name'])}\n🕐 {ui.when(r)}\n\n<b>Matchups chosen by you</b>\n"
            + ("\n".join(f"• {ui.match_line(m, with_score=m['rstatus'] == 'CONFIRMED')}" for m in ms) or "—")
            + f"\n\n<b>Available teams</b>: " + (", ".join(E(names[i]) for i in pool) or "—"))
    rows = []
    if r["status"] != "CONFIRMED":
        if len(pool) >= 2 and not (r["stage"] == "F" and ms):
            rows.append([ob("➕ ADD MATCHUP", f"onc:kma:{rid}")])
        rows += [[ob(f"➖ {m['name_a']} vs {m['name_b']}", f"onc:kmd:{m['id']}")] for m in ms]
    if ms:
        rows.append([ob("⚽ ENTER RESULTS", f"onc:rd:{rid}"), ob("📢 PUBLISH MATCHUPS", f"onc:kp:{rid}")])
    if r["status"] != "CONFIRMED":
        rows.append([ob("🗑 DELETE STAGE", f"onc:cf:dks:{rid}")])
    rows.append([ob("🔙 BACK", f"onc:ko:{t['id']}")])
    await show(c, text, okb(rows))


@router.callback_query(F.data.startswith("onc:ks:"))
async def ko_stage_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await ko_stage_screen(c, int(c.data.split(":")[2]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:kma:"))
async def ko_add_a(c: CallbackQuery):
    rid = int(c.data.split(":")[2])
    r = await service.get_round(rid)
    names = await service.team_names(r["tournament_id"])
    pool = await service.ko_pool(r["tournament_id"], rid)
    rows = ui.grid([ob(names[i], f"onc:kmb:{rid}:{i}") for i in pool], 2)
    await show(c, "➕ <b>MATCHUP</b> — pick the FIRST team", okb(rows + [[ob("🔙 BACK", f"onc:ks:{rid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:kmb:"))
async def ko_add_b(c: CallbackQuery):
    _, _, rid, a = c.data.split(":")
    r = await service.get_round(int(rid))
    names = await service.team_names(r["tournament_id"])
    pool = [i for i in await service.ko_pool(r["tournament_id"], int(rid)) if i != int(a)]
    rows = ui.grid([ob(names[i], f"onc:kmc:{rid}:{a}:{i}") for i in pool], 2)
    await show(c, f"➕ <b>MATCHUP</b> — {E(names[int(a)])} vs ?\nPick the SECOND team", okb(rows + [[ob("🔙 BACK", f"onc:kma:{rid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:kmc:"))
async def ko_add_do(c: CallbackQuery):
    _, _, rid, a, b = c.data.split(":")
    try:
        await service.add_ko_match(c.from_user.id, int(rid), int(a), int(b))
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("Matchup added")
    await ko_stage_screen(c, int(rid))


@router.callback_query(F.data.startswith("onc:kmd:"))
async def ko_del(c: CallbackQuery):
    m = await service.get_match(int(c.data.split(":")[2]))
    try:
        await service.remove_ko_match(c.from_user.id, m["id"])
    except OncError as e:
        return await alert(c, str(e))
    await c.answer("Removed")
    await ko_stage_screen(c, m["round_id"])


@router.callback_query(F.data.startswith("onc:kp:"))
async def ko_publish(c: CallbackQuery, bot: Bot):
    rid = int(c.data.split(":")[2])
    try:
        await publish.ko_matches(bot, rid, c.from_user.id)
    except (publish.PublishError, OncError) as e:
        return await alert(c, str(e))
    await c.answer("📢 Matchups published to the ONC channel.")


@router.callback_query(F.data.startswith("onc:kb:"))
async def bracket_publish(c: CallbackQuery, bot: Bot):
    try:
        await publish.bracket(bot, int(c.data.split(":")[2]), c.from_user.id)
    except (publish.PublishError, OncError) as e:
        return await alert(c, str(e))
    await c.answer("📢 Bracket published to the ONC channel.")


@router.callback_query(F.data.startswith("onc:kch:"))
async def champion_publish(c: CallbackQuery, bot: Bot):
    try:
        await publish.champion(bot, int(c.data.split(":")[2]), c.from_user.id)
    except (publish.PublishError, OncError) as e:
        return await alert(c, str(e))
    await c.answer("📢 Champion poster published to the ONC channel.")
