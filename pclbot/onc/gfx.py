"""Builds graphic data from the database and renders it with the active template (built-in default as fallback)."""
import io

from aiogram import Bot

from . import algo, render, service, templates


async def _render(type_: str, data: dict) -> list[bytes]:
    tpl = await templates.active_template(type_)
    cfg = tpl["config"] if tpl else templates.default_config(type_)
    return render.render(type_, cfg, data, tpl["bg_path"] if tpl else None)


def _cells(m: dict, with_score: bool) -> list[str]:
    if with_score and m["goals_a"] is not None:
        return [m["name_a"], f"{m['goals_a']} - {m['goals_b']}", m["name_b"]]
    return [m["name_a"], "VS", m["name_b"]]


async def schedule(tid: int) -> list[bytes]:
    t = await service.get_tournament(tid)
    lines = []
    for r in await service.rounds_of(tid):
        ms = await service.matches_of_round(r["id"])
        if not ms:
            continue
        lines.append({"kind": "slot", "text": f"{r['start_at'][11:]} · " + (f"ROUND {r['number']}" if r["stage"] == "GROUP" else algo.STAGE_NAME[r["stage"]])})
        lines += [{"kind": "match", "text": f"{m['name_a']} vs {m['name_b']}"} for m in ms]
    return await _render("SCHEDULE", {"subtitle": f"{t['name']} · {service.fmt_date(t['start_date'])}", "rows": lines})


async def group_table(tid: int, gid: int) -> list[bytes]:
    tbl = next(t for t in await service.group_tables(tid) if t["group"]["id"] == gid)
    rows = [{"pos": r["pos"], "team": r["name"], "P": r["P"], "W": r["W"], "D": r["D"], "L": r["L"], "GF": r["GF"], "GA": r["GA"],
             "GD": f"{r['GD']:+d}" if r["GD"] else "0", "PTS": r["Pts"]} for r in tbl["rows"]]
    return await _render("GROUP_TABLE", {"subtitle": tbl["group"]["name"], "rows": rows})


async def round_results(rid: int) -> list[bytes]:
    r = await service.get_round(rid)
    ms = await service.matches_of_round(rid)
    label = await service.round_label(r)
    if r["stage"] == "GROUP":
        rows = [{"cells": [m["name_a"], f"{m['goals_a']} - {m['goals_b']}", m["name_b"]]} for m in ms]
        return await _render("ROUND_RESULTS", {"title": "RESULTS", "subtitle": label, "rows": rows})
    rows = []
    for m in ms:  # a level knockout match shows its manually chosen winner with a marker
        cells = [m["name_a"], f"{m['goals_a']} - {m['goals_b']}", m["name_b"]]
        if m["goals_a"] == m["goals_b"]:
            cells[0 if m["winner_team_id"] == m["team_a"] else 2] = "▶ " + cells[0 if m["winner_team_id"] == m["team_a"] else 2]
        rows.append({"cells": cells})
    sub = label
    return await _render("ROUND_RESULTS", {"title": "RESULTS", "subtitle": sub, "rows": rows})


async def qualified(tid: int) -> list[bytes]:
    q = await service.qualification(tid)
    if not q["ready"]:
        raise service.OncError("Qualification is not final:\n• " + "\n• ".join(q["blockers"]))
    rows = []
    for t in await service.group_tables(tid):
        for r in t["rows"]:
            if r["team"] in t["status"]["qualified"]:
                rows.append({"cells": [t["group"]["name"], str(r["pos"]), r["name"]]})
    return await _render("QUALIFIED", {"subtitle": "GROUP STAGE COMPLETED", "rows": rows})


async def ko_matches(rid: int) -> list[bytes]:
    r = await service.get_round(rid)
    ms = await service.matches_of_round(rid)
    rows = [{"cells": _cells(m, r["status"] == "CONFIRMED")} for m in ms]
    return await _render("KO_MATCHES", {"subtitle": algo.STAGE_NAME[r["stage"]], "rows": rows})


async def bracket(tid: int) -> list[bytes]:
    stages = []
    for r in await service.ko_rounds(tid):
        ms = []
        for m in await service.matches_of_round(r["id"]):
            done = m["rstatus"] == "CONFIRMED"
            win = None
            if done and m["winner_team_id"]:
                win = "a" if m["winner_team_id"] == m["team_a"] else "b"
            ms.append({"a": m["name_a"], "b": m["name_b"], "ga": m["goals_a"] if done else None,
                       "gb": m["goals_b"] if done else None, "win": win})
        stages.append({"name": algo.STAGE_NAME[r["stage"]], "matches": ms})
    return await _render("BRACKET", {"stages": stages})


async def champion(bot: Bot, tid: int) -> list[bytes]:
    t = await service.get_tournament(tid)
    team = await service.get_team(t["champion_team_id"]) if t["champion_team_id"] else None
    if not team:
        raise service.OncError("No champion yet.")
    logo = None
    if team["logo_file_id"]:  # the ONLY graphic that uses a team logo
        try:
            buf = io.BytesIO()
            await bot.download(team["logo_file_id"], destination=buf)
            logo = buf.getvalue()
        except Exception:
            logo = None
    return await _render("CHAMPION", {"team": team["name"], "logo": logo, "subtitle": t["name"]})
