"""Shared UI helpers for the ONC handlers (English UI, inline keyboards, text views)."""
import html

from aiogram.types import InlineKeyboardButton as B, InlineKeyboardMarkup

from . import algo, service

E = html.escape


def ob(text: str, data: str) -> B:
    return B(text=text, callback_data=data)


def okb(rows: list[list[B]]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=rows)


def grid(buttons: list[B], per_row: int = 2) -> list[list[B]]:
    return [buttons[i:i + per_row] for i in range(0, len(buttons), per_row)]


def nav(back_data: str, back_text: str = "🔙 BACK", home: bool = True) -> list[B]:
    row = [ob(back_text, back_data)]
    return row


STATUS_ICON = {"DRAFT": "📝", "READY": "🟢", "LIVE": "🔴", "FINISHED": "🏁", "ARCHIVED": "🗄"}


def title(t: dict) -> str:
    return f"🏆 <b>{E(t['name'])}</b>"


def hr() -> str:
    return "━━━━━━━━━━━━━━"


def match_line(m: dict, with_score: bool = True) -> str:
    if with_score and m.get("goals_a") is not None:
        extra = ""
        if m.get("winner_team_id") and m["goals_a"] == m["goals_b"]:
            extra = f" ▶ {E(m['name_a'] if m['winner_team_id'] == m['team_a'] else m['name_b'])}"
        return f"{E(m['name_a'])} {m['goals_a']} - {m['goals_b']} {E(m['name_b'])}{extra}"
    return f"{E(m['name_a'])} vs {E(m['name_b'])}"


def standings_block(tbl: dict) -> str:
    g, rows = tbl["group"], tbl["rows"]
    tb = {"H2H": "H2H", "GD": "GD", "GF": "GF", "ADMIN": "ADM", "UNRESOLVED": "⚠", "": ""}
    head = " # TEAM         P W D L GF GA  GD PTS TB"
    lines = [head]
    q = g["qualifiers"] or 0
    for r in rows:
        mark = "✓" if q and r["pos"] <= q else " "
        lines.append(f"{r['pos']:>2}{mark}{r['name'][:12]:<12} {r['P']} {r['W']} {r['D']} {r['L']} {r['GF']:>2} {r['GA']:>2} {r['GD']:>+3} {r['Pts']:>3} {tb[r['tb']]}")
    st = tbl["status"]["state"]
    note = {"PENDING": f"⏳ {tbl['played']}/{tbl['total']} matches confirmed",
            "NEEDS ADMIN DECISION": "⚠️ NEEDS ADMIN DECISION (tie on the qualification line)",
            "FINAL": "✅ final" if tbl["complete"] else ""}[st]
    if tbl["unresolved"] and st != "NEEDS ADMIN DECISION":
        note += ("\n" if note else "") + "⚠ unresolved tie (does not affect qualification)"
    qual = f"Qualifiers: {g['qualifiers']}" if g["qualifiers"] is not None else "Qualifiers: not set"
    return f"<b>{E(g['name'])}</b>  <i>({qual})</i>\n<pre>{E(chr(10).join(lines))}</pre>{note}"


def results_summary(t: dict, label: str, matches: list[dict], first_line: str | None = None) -> str:
    body = "\n".join(match_line(m) for m in matches)
    return f"🏆 <b>{E(t['name'])}</b>\n<b>{label}</b>\n\n<b>RESULTS</b>\n\n{body}"


def progress(p: dict) -> str:
    return f"{p['entered']}/{p['total']}"


def when(r: dict) -> str:
    return f"{service.fmt_date(r['start_at'][:10])} {r['start_at'][11:]}"


async def dashboard_text(t: dict) -> str:
    teams = await service.teams_of(t["id"])
    groups = await service.groups_of(t["id"])
    mark = "⭐ ACTIVE" if t["is_active"] else ""
    return (f"{title(t)}  {mark}\n\n"
            f"📅 {service.fmt_date(t['start_date'])}\n🕐 {t['start_time']}\n⏱ ROUND INTERVAL: {t['round_interval']} MIN\n\n"
            f"TEAMS: {len(teams)}\nGROUPS: {len(groups)}\n\n"
            f"STATUS: {STATUS_ICON[t['status']]} <b>{t['status']}</b>")
