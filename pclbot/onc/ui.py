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


def nav(back_data: str, back_text: str = "🔙 بازگشت", home: bool = True) -> list[B]:
    row = [ob(back_text, back_data)]
    return row


STATUS_ICON = {"DRAFT": "📝", "READY": "🟢", "LIVE": "🔴", "FINISHED": "🏁", "ARCHIVED": "🗄"}
STATUS_FA = {"DRAFT": "پیش‌نویس", "READY": "آماده", "LIVE": "در حال برگزاری", "FINISHED": "پایان‌یافته", "ARCHIVED": "بایگانی"}

AUDIT_FA = {
    "CREATE TOURNAMENT": "ساخت تورنمنت", "SET ACTIVE TOURNAMENT": "انتخاب تورنمنت فعال", "EDIT TOURNAMENT": "ویرایش تورنمنت",
    "DELETE TOURNAMENT": "حذف تورنمنت", "STATUS": "تغییر وضعیت", "ADD TEAM": "افزودن تیم", "RENAME TEAM": "تغییر نام تیم",
    "CHANGE LOGO": "تغییر لوگو", "DELETE TEAM": "حذف تیم", "ADD PLAYER": "افزودن بازیکن", "REMOVE PLAYER": "حذف بازیکن",
    "CREATE GROUP": "ساخت گروه", "RENAME GROUP": "تغییر نام گروه", "DELETE GROUP": "حذف گروه", "SET QUALIFIERS": "تعیین صعودکننده‌ها",
    "REMOVE TEAM FROM GROUP": "خروج تیم از گروه", "MOVED TEAM": "جابه‌جایی تیم", "ASSIGN TEAM": "قرار دادن تیم در گروه",
    "AUTOMATIC DRAW": "قرعه‌کشی خودکار", "GENERATE SCHEDULE": "ساخت برنامه", "RESET RESULTS": "ریست نتایج",
    "SAVED RESULT": "ثبت نتیجه", "CONFIRMED ROUND": "تأیید راند", "CHANGED RESULT": "تغییر نتیجه", "TIE DECISION": "تصمیم تساوی",
    "CREATE KNOCKOUT STAGE": "ساخت مرحله حذفی", "KNOCKOUT MATCHUP": "تعیین بازی حذفی", "REMOVE MATCHUP": "حذف بازی حذفی",
    "DELETE KNOCKOUT STAGE": "حذف مرحله حذفی", "START TOURNAMENT": "شروع تورنمنت", "SET CHANNEL": "تنظیم کانال",
    "REMOVE CHANNEL": "حذف کانال", "SETTING auto_standings": "تنظیم انتشار خودکار جدول", "ADD TEMPLATE SET": "ساخت ست تمپلیت",
    "ACTIVATE TEMPLATE SET": "فعال‌سازی ست تمپلیت", "DUPLICATE TEMPLATE SET": "کپی ست تمپلیت", "DELETE TEMPLATE SET": "حذف ست تمپلیت",
    "ADD TEMPLATE": "افزودن تمپلیت", "ACTIVATE TEMPLATE": "فعال‌سازی تمپلیت", "DEACTIVATE TEMPLATE": "غیرفعال‌سازی تمپلیت",
    "DELETE TEMPLATE": "حذف تمپلیت", "TEMPLATE BACKGROUND": "پس‌زمینه تمپلیت",
    "ADD CAPTAIN": "افزودن کاپیتان", "REMOVE CAPTAIN": "حذف کاپیتان", "CAPTAIN TEAM LIST": "ثبت لیست تیم (کاپیتان)",
    "CAPTAIN RESULT SUBMITTED": "ارسال نتیجه (کاپیتان)", "RESULT APPROVED": "تأیید نتیجه", "RESULT REJECTED": "رد نتیجه",
}


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
    return f"{E(m['name_a'])} 🆚 {E(m['name_b'])}"


LRM = "\u200e"
TB_FA = {"H2H": "H2H", "GD": "GD", "GF": "GF", "ADMIN": "ADM", "UNRESOLVED": "⚠", "": ""}   # standings are English


def en_group(name: str) -> str:
    """Standings titles are English: «گروه A» → «GROUP A» (other names are left as typed)."""
    return "GROUP " + name[4:].strip() if name.startswith("گروه ") else name


def standings_block(tbl: dict) -> str:
    g, rows = tbl["group"], tbl["rows"]
    lines = [LRM + f" POS {'TEAM':<12} {'P':>2} {'W':>2} {'D':>2} {'L':>2} {'GF':>2} {'GA':>2} {'GD':>3} {'PTS':>3} TB"]
    q = g["qualifiers"] or 0
    used = set()
    for r in rows:
        mark = "✓" if q and r["pos"] <= q else " "
        used.add(r["tb"])
        lines.append(LRM + f" {r['pos']:>2}{mark} {r['name'][:12]:<12} {r['P']:>2} {r['W']:>2} {r['D']:>2} {r['L']:>2} {r['GF']:>2} {r['GA']:>2} {r['GD']:>+3} {r['Pts']:>3} {TB_FA[r['tb']]}")
    st = tbl["status"]["state"]
    note = {"PENDING": f"⏳ {tbl['played']} از {tbl['total']} بازی تأیید شده",
            "NEEDS ADMIN DECISION": "⚠️ نیاز به تصمیم ادمین (تساوی روی خط صعود)",
            "FINAL": "✅ نهایی" if tbl["complete"] else ""}[st]
    if tbl["unresolved"] and st != "NEEDS ADMIN DECISION":
        note += ("\n" if note else "") + "⚠ تساوی حل‌نشده (روی صعود اثری ندارد)"
    legend = [f"{TB_FA[k]} = {v}" for k, v in (("H2H", "head-to-head"), ("GD", "goal difference"), ("GF", "goals for"), ("ADMIN", "admin decision")) if k in used]
    qual = f"Qualifiers: {g['qualifiers']}" if g["qualifiers"] is not None else "Qualifiers: not set"
    return (f"<b>{E(en_group(g['name']))} — STANDINGS</b>  <i>({qual})</i>\n<pre>{E(chr(10).join(lines))}</pre>"
            + (f"<i>TB: {', '.join(legend)}</i>\n" if legend else "") + note)


def results_summary(t: dict, label: str, matches: list[dict], first_line: str | None = None) -> str:
    body = "\n".join(match_line(m) for m in matches)
    return f"🏆 <b>{E(t['name'])}</b>\n<b>{label}</b>\n\n<b>نتایج</b>\n\n{body}"


def progress(p: dict) -> str:
    return f"{p['entered']}/{p['total']}"


def when(r: dict) -> str:
    return f"{service.fmt_date(r['start_at'][:10])} {r['start_at'][11:]}"


async def dashboard_text(t: dict) -> str:
    teams = await service.teams_of(t["id"])
    groups = await service.groups_of(t["id"])
    mark = "⭐ فعال" if t["is_active"] else ""
    return (f"{title(t)}  {mark}\n\n"
            f"📅 {service.fmt_date(t['start_date'])}\n🕐 {t['start_time']}\n⏱ فاصله‌ی راندها: {t['round_interval']} دقیقه\n\n"
            f"تیم‌ها: {len(teams)}\nگروه‌ها: {len(groups)}\n\n"
            f"وضعیت: {STATUS_ICON[t['status']]} <b>{STATUS_FA[t['status']]}</b>")
