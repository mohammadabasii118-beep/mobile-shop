"""ONC domain services: tournaments, teams/players, groups, schedule, results, standings, qualification, knockout, audit.

Everything that must stay consistent runs inside `dbx.tx()`. Match results are the single source of truth:
standings and qualification are computed on demand from CONFIRMED results, never stored.
"""
import json
import random
import re
from datetime import datetime

from .. import admins, db as main_db
from . import algo, dbx


class OncError(Exception):
    """A rule violation that is safe to show to the admin."""


class _Rollback(Exception):
    pass


def now() -> int:
    return main_db.now()


def require_admin(uid: int) -> None:
    if not admins.is_admin(uid):
        raise OncError("فقط ادمین‌ها دسترسی دارند.")


# ----------------------------------------------------------------- settings / audit
async def get_setting(key: str, default: str = "") -> str:
    v = await dbx.scalar("SELECT value FROM onc_settings WHERE key=?", key)
    return v if v is not None else default


async def set_setting(key: str, value: str) -> None:
    await dbx.execute("INSERT INTO onc_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, value)


async def audit(admin_id: int | None, action: str, details: str = "", tid: int | None = None) -> None:
    await dbx.execute("INSERT INTO onc_audit(ts,admin_id,tournament_id,action,details) VALUES(?,?,?,?,?)",
                      now(), admin_id, tid, action, details)


async def audit_log(tid: int | None = None, limit: int = 15) -> list[dict]:
    if tid:
        return await dbx.fetchall("SELECT * FROM onc_audit WHERE tournament_id=? ORDER BY id DESC LIMIT ?", tid, limit)
    return await dbx.fetchall("SELECT * FROM onc_audit ORDER BY id DESC LIMIT ?", limit)


# ----------------------------------------------------------------- input parsing
_FA = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def norm_digits(s: str) -> str:
    return (s or "").translate(_FA).strip()


def parse_date(s: str) -> str:
    s = norm_digits(s).replace("/", "-").replace(".", "-")
    try:
        return datetime.strptime(s, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        raise OncError("فرمت تاریخ باید YYYY/MM/DD باشد، مثلاً 2026/10/10") from None


def parse_time(s: str) -> str:
    s = norm_digits(s)
    try:
        return datetime.strptime(s, "%H:%M").strftime("%H:%M")
    except ValueError:
        raise OncError("فرمت ساعت باید HH:MM باشد، مثلاً 20:00") from None


def parse_interval(s: str) -> int:
    m = re.match(r"^\s*(\d{1,4})\s*(m|min|mins|minutes?|دقیقه)?\s*$", norm_digits(s), re.I)
    if not m or int(m.group(1)) <= 0:
        raise OncError("فاصله را به دقیقه بفرست، مثلاً 30")
    return int(m.group(1))


def fmt_date(s: str) -> str:
    return s.replace("-", "/")


# ----------------------------------------------------------------- tournaments
async def create_tournament(admin: int, name: str, date: str, time: str, interval: int) -> int:
    require_admin(admin)
    name = name.strip()
    if not name or len(name) > 60:
        raise OncError("نام تورنمنت باید بین ۱ تا ۶۰ کاراکتر باشد.")
    async with dbx.tx():
        tid = await dbx.execute(
            "INSERT INTO onc_tournaments(name,start_date,start_time,round_interval,created_at,created_by) VALUES(?,?,?,?,?,?)",
            name, date, time, interval, now(), admin)
        if not await dbx.scalar("SELECT 1 FROM onc_tournaments WHERE is_active=1"):
            await dbx.execute("UPDATE onc_tournaments SET is_active=1 WHERE id=?", tid)
        await audit(admin, "CREATE TOURNAMENT", name, tid)
    return tid


async def get_tournament(tid: int) -> dict | None:
    return await dbx.fetchone("SELECT * FROM onc_tournaments WHERE id=?", tid)


async def active_tournament() -> dict | None:
    return await dbx.fetchone("SELECT * FROM onc_tournaments WHERE is_active=1")


async def list_tournaments() -> list[dict]:
    return await dbx.fetchall("SELECT * FROM onc_tournaments ORDER BY id DESC")


async def set_active(admin: int, tid: int) -> None:
    require_admin(admin)
    async with dbx.tx():
        await dbx.execute("UPDATE onc_tournaments SET is_active=0")
        await dbx.execute("UPDATE onc_tournaments SET is_active=1 WHERE id=?", tid)
        await audit(admin, "SET ACTIVE TOURNAMENT", str(tid), tid)


async def set_status(admin: int, tid: int, status: str) -> None:
    require_admin(admin)
    await dbx.execute("UPDATE onc_tournaments SET status=? WHERE id=?", status, tid)
    await audit(admin, "STATUS", status, tid)


async def update_tournament(admin: int, tid: int, **fields) -> None:
    require_admin(admin)
    t = await get_tournament(tid)
    if ("start_date" in fields or "start_time" in fields or "round_interval" in fields) and await dbx.scalar(
            "SELECT 1 FROM onc_rounds WHERE tournament_id=?", tid):
        raise OncError("برنامه قبلاً ساخته شده. بعد از تغییر تاریخ/ساعت/فاصله، «ساخت دوباره برنامه» را بزن.")
    async with dbx.tx():
        for k, v in fields.items():
            assert k in {"name", "start_date", "start_time", "round_interval"}
            await dbx.execute(f"UPDATE onc_tournaments SET {k}=? WHERE id=?", v, tid)
        await audit(admin, "EDIT TOURNAMENT", ", ".join(f"{k}: {t[k]} → {v}" for k, v in fields.items()), tid)


async def delete_tournament(admin: int, tid: int) -> None:
    require_admin(admin)
    t = await get_tournament(tid)
    async with dbx.tx():
        was_active = t["is_active"]
        await dbx.execute("DELETE FROM onc_tournaments WHERE id=?", tid)
        if was_active:
            nxt = await dbx.scalar("SELECT id FROM onc_tournaments ORDER BY id DESC LIMIT 1")
            if nxt:
                await dbx.execute("UPDATE onc_tournaments SET is_active=1 WHERE id=?", nxt)
        await audit(admin, "DELETE TOURNAMENT", t["name"], None)


# ----------------------------------------------------------------- teams / players
async def teams_of(tid: int) -> list[dict]:
    return await dbx.fetchall(
        "SELECT t.*, g.id AS group_id, g.name AS group_name FROM onc_teams t "
        "LEFT JOIN onc_group_members m ON m.team_id=t.id LEFT JOIN onc_groups g ON g.id=m.group_id "
        "WHERE t.tournament_id=? ORDER BY t.name", tid)


async def get_team(team_id: int) -> dict | None:
    return await dbx.fetchone(
        "SELECT t.*, g.id AS group_id, g.name AS group_name FROM onc_teams t "
        "LEFT JOIN onc_group_members m ON m.team_id=t.id LEFT JOIN onc_groups g ON g.id=m.group_id WHERE t.id=?", team_id)


async def team_names(tid: int) -> dict[int, str]:
    return {r["id"]: r["name"] for r in await dbx.fetchall("SELECT id,name FROM onc_teams WHERE tournament_id=?", tid)}


def _clean_name(s: str, what: str = "نام") -> str:
    s = re.sub(r"\s+", " ", (s or "").strip())
    if not s or len(s) > 30:
        raise OncError(f"{what} باید بین ۱ تا ۳۰ کاراکتر باشد.")
    return s


async def add_team(admin: int, tid: int, name: str, logo: str | None = None) -> int:
    require_admin(admin)
    name = _clean_name(name, "نام تیم")
    if await dbx.scalar("SELECT 1 FROM onc_teams WHERE tournament_id=? AND name=?", tid, name):
        raise OncError("تیمی با این نام در این تورنمنت وجود دارد.")
    async with dbx.tx():
        team_id = await dbx.execute("INSERT INTO onc_teams(tournament_id,name,logo_file_id) VALUES(?,?,?)", tid, name, logo)
        await audit(admin, "ADD TEAM", name, tid)
    return team_id


async def rename_team(admin: int, team_id: int, name: str) -> None:
    require_admin(admin)
    t = await get_team(team_id)
    name = _clean_name(name, "نام تیم")
    if await dbx.scalar("SELECT 1 FROM onc_teams WHERE tournament_id=? AND name=? AND id<>?", t["tournament_id"], name, team_id):
        raise OncError("تیمی با این نام در این تورنمنت وجود دارد.")
    await dbx.execute("UPDATE onc_teams SET name=? WHERE id=?", name, team_id)
    await audit(admin, "RENAME TEAM", f"{t['name']} → {name}", t["tournament_id"])


async def set_logo(admin: int, team_id: int, file_id: str) -> None:
    require_admin(admin)
    t = await get_team(team_id)
    await dbx.execute("UPDATE onc_teams SET logo_file_id=? WHERE id=?", file_id, team_id)
    await audit(admin, "CHANGE LOGO", t["name"], t["tournament_id"])


async def delete_team(admin: int, team_id: int) -> None:
    require_admin(admin)
    t = await get_team(team_id)
    if await dbx.scalar("SELECT 1 FROM onc_matches WHERE team_a=? OR team_b=?", team_id, team_id):
        raise OncError("این تیم بازی برنامه‌ریزی‌شده دارد. اول برنامه را دوباره بساز (یا نتایج را ریست کن).")
    async with dbx.tx():
        await dbx.execute("DELETE FROM onc_teams WHERE id=?", team_id)
        await audit(admin, "DELETE TEAM", t["name"], t["tournament_id"])


async def players_of(team_id: int) -> list[dict]:
    return await dbx.fetchall("SELECT * FROM onc_players WHERE team_id=? ORDER BY id", team_id)


async def add_player(admin: int, team_id: int, player_id: str) -> None:
    require_admin(admin)
    player_id = _clean_name(player_id, "آیدی بازیکن")
    t = await get_team(team_id)
    if await dbx.scalar("SELECT 1 FROM onc_players WHERE team_id=? AND player_id=?", team_id, player_id):
        raise OncError("این آیدی قبلاً در تیم ثبت شده.")
    await dbx.execute("INSERT INTO onc_players(team_id,player_id) VALUES(?,?)", team_id, player_id)
    await audit(admin, "ADD PLAYER", f"{player_id} → {t['name']}", t["tournament_id"])


async def remove_player(admin: int, pid: int) -> None:
    require_admin(admin)
    p = await dbx.fetchone("SELECT p.*, t.name AS tname, t.tournament_id FROM onc_players p JOIN onc_teams t ON t.id=p.team_id WHERE p.id=?", pid)
    if p:
        await dbx.execute("DELETE FROM onc_players WHERE id=?", pid)
        await audit(admin, "REMOVE PLAYER", f"{p['player_id']} ✕ {p['tname']}", p["tournament_id"])


# ----------------------------------------------------------------- groups
async def groups_of(tid: int) -> list[dict]:
    gs = await dbx.fetchall("SELECT * FROM onc_groups WHERE tournament_id=? ORDER BY name", tid)
    for g in gs:
        g["members"] = await dbx.fetchall(
            "SELECT t.id, t.name FROM onc_group_members m JOIN onc_teams t ON t.id=m.team_id WHERE m.group_id=? ORDER BY t.name", g["id"])
    return gs


async def get_group(gid: int) -> dict | None:
    g = await dbx.fetchone("SELECT * FROM onc_groups WHERE id=?", gid)
    if g:
        g["members"] = await dbx.fetchall(
            "SELECT t.id, t.name FROM onc_group_members m JOIN onc_teams t ON t.id=m.team_id WHERE m.group_id=? ORDER BY t.name", gid)
    return g


async def _locked(tid: int) -> None:
    """Group membership can't change once the schedule has been generated."""
    if await dbx.scalar("SELECT 1 FROM onc_rounds WHERE tournament_id=? AND stage='GROUP'", tid):
        raise OncError("برنامه‌ی گروهی قبلاً ساخته شده. بعد از تغییر گروه‌ها «ساخت دوباره برنامه» را بزن "
                       "(اگر نتیجه‌ای ثبت شده، اول ریست کن).")


async def create_group(admin: int, tid: int, name: str | None = None) -> int:
    require_admin(admin)
    await _locked(tid)
    if not name:
        used = {g["name"].upper() for g in await groups_of(tid)}
        i = 0
        while True:
            cand = f"گروه {chr(65 + i % 26)}{'' if i < 26 else i // 26}"
            if cand not in used:
                name = cand
                break
            i += 1
    name = _clean_name(name, "نام گروه")
    if await dbx.scalar("SELECT 1 FROM onc_groups WHERE tournament_id=? AND name=?", tid, name):
        raise OncError("گروهی با این نام وجود دارد.")
    async with dbx.tx():
        gid = await dbx.execute("INSERT INTO onc_groups(tournament_id,name) VALUES(?,?)", tid, name)
        await audit(admin, "CREATE GROUP", name, tid)
    return gid


async def rename_group(admin: int, gid: int, name: str) -> None:
    require_admin(admin)
    g = await get_group(gid)
    name = _clean_name(name, "نام گروه")
    if await dbx.scalar("SELECT 1 FROM onc_groups WHERE tournament_id=? AND name=? AND id<>?", g["tournament_id"], name, gid):
        raise OncError("گروهی با این نام وجود دارد.")
    await dbx.execute("UPDATE onc_groups SET name=? WHERE id=?", name, gid)
    await audit(admin, "RENAME GROUP", f"{g['name']} → {name}", g["tournament_id"])


async def delete_group(admin: int, gid: int) -> None:
    require_admin(admin)
    g = await get_group(gid)
    await _locked(g["tournament_id"])
    async with dbx.tx():
        await dbx.execute("DELETE FROM onc_groups WHERE id=?", gid)  # members are released (cascade), teams stay
        await audit(admin, "DELETE GROUP", f"{g['name']} ({len(g['members'])} تیم آزاد شد)", g["tournament_id"])


async def set_qualifiers(admin: int, gid: int, n: int) -> None:
    require_admin(admin)
    g = await get_group(gid)
    if n < 0 or n > max(len(g["members"]), 0):
        raise OncError(f"تعداد صعودکننده باید بین ۰ و {len(g['members'])} (تعداد تیم‌های گروه) باشد.")
    await dbx.execute("UPDATE onc_groups SET qualifiers=? WHERE id=?", n, gid)
    await audit(admin, "SET QUALIFIERS", f"{g['name']}: {g['qualifiers']} → {n}", g["tournament_id"])


async def assign_team(admin: int, team_id: int, gid: int | None) -> None:
    """Add / move / remove (gid=None) a team. The team row and its data are never touched."""
    require_admin(admin)
    t = await get_team(team_id)
    await _locked(t["tournament_id"])
    new = await get_group(gid) if gid else None
    if new and new["tournament_id"] != t["tournament_id"]:
        raise OncError("این گروه مال تورنمنت دیگری است.")
    async with dbx.tx():
        if gid is None:
            await dbx.execute("DELETE FROM onc_group_members WHERE team_id=?", team_id)
            await audit(admin, "REMOVE TEAM FROM GROUP", f"{t['name']} ✕ {t['group_name']}", t["tournament_id"])
        else:
            await dbx.execute("INSERT INTO onc_group_members(team_id,group_id) VALUES(?,?) "
                              "ON CONFLICT(team_id) DO UPDATE SET group_id=excluded.group_id", team_id, gid)
            if t["group_name"] and t["group_id"] != gid:
                await audit(admin, "MOVED TEAM", f"{t['name']}: {t['group_name']} → {new['name']}", t["tournament_id"])
            elif not t["group_name"]:
                await audit(admin, "ASSIGN TEAM", f"{t['name']} → {new['name']}", t["tournament_id"])


async def auto_draw(admin: int, tid: int, seed: int | None = None) -> dict[str, list[str]]:
    """Randomly distributes ALL teams over the existing groups as evenly as possible (replaces current assignment)."""
    require_admin(admin)
    await _locked(tid)
    groups = await groups_of(tid)
    teams = await teams_of(tid)
    if not groups:
        raise OncError("اول گروه‌ها را بساز.")
    if len(teams) < len(groups):
        raise OncError("تعداد تیم‌ها از تعداد گروه‌ها کمتر است.")
    rnd = random.Random(seed)
    ids = [t["id"] for t in teams]
    rnd.shuffle(ids)
    async with dbx.tx():
        await dbx.execute("DELETE FROM onc_group_members WHERE group_id IN (SELECT id FROM onc_groups WHERE tournament_id=?)", tid)
        for i, team_id in enumerate(ids):  # round-robin dealing = sizes differ by at most 1
            await dbx.execute("INSERT INTO onc_group_members(team_id,group_id) VALUES(?,?)", team_id, groups[i % len(groups)]["id"])
        await audit(admin, "AUTOMATIC DRAW", f"{len(ids)} تیم → {len(groups)} گروه", tid)
    names = await team_names(tid)
    out: dict[str, list[str]] = {g["name"]: [] for g in groups}
    for i, team_id in enumerate(ids):
        out[groups[i % len(groups)]["name"]].append(names[team_id])
    return out


# ----------------------------------------------------------------- schedule
async def rounds_of(tid: int, stage: str | None = None) -> list[dict]:
    sql = "SELECT * FROM onc_rounds WHERE tournament_id=?"
    args: list = [tid]
    if stage:
        sql += " AND stage=?"; args.append(stage)
    return await dbx.fetchall(sql + " ORDER BY start_at, id", *args)


async def get_round(rid: int) -> dict | None:
    return await dbx.fetchone("SELECT * FROM onc_rounds WHERE id=?", rid)


async def round_label(r: dict) -> str:
    if r["stage"] == "GROUP":
        return f"مرحله گروهی — راند {r['number']}"
    return algo.STAGE_NAME[r["stage"]]


async def matches_of_round(rid: int) -> list[dict]:
    return await dbx.fetchall(
        "SELECT m.*, a.name AS name_a, b.name AS name_b, g.name AS group_name, "
        "r.goals_a, r.goals_b, r.winner_team_id, r.status AS rstatus "
        "FROM onc_matches m JOIN onc_teams a ON a.id=m.team_a JOIN onc_teams b ON b.id=m.team_b "
        "LEFT JOIN onc_groups g ON g.id=m.group_id LEFT JOIN onc_results r ON r.match_id=m.id "
        "WHERE m.round_id=? ORDER BY g.name, m.id", rid)


async def get_match(mid: int) -> dict | None:
    return await dbx.fetchone(
        "SELECT m.*, a.name AS name_a, b.name AS name_b, rd.stage, rd.number, rd.status AS round_status, "
        "r.goals_a, r.goals_b, r.winner_team_id, r.status AS rstatus "
        "FROM onc_matches m JOIN onc_teams a ON a.id=m.team_a JOIN onc_teams b ON b.id=m.team_b "
        "JOIN onc_rounds rd ON rd.id=m.round_id LEFT JOIN onc_results r ON r.match_id=m.id WHERE m.id=?", mid)


async def has_results(tid: int) -> bool:
    return bool(await dbx.scalar("SELECT 1 FROM onc_results r JOIN onc_matches m ON m.id=r.match_id WHERE m.tournament_id=?", tid))


async def generate_schedule(admin: int, tid: int) -> dict:
    """(Re)builds the single-round-robin group schedule. Refuses while results exist."""
    require_admin(admin)
    t = await get_tournament(tid)
    groups = await groups_of(tid)
    if not groups:
        raise OncError("اول گروه‌ها را بساز.")
    if any(len(g["members"]) < 2 for g in groups):
        raise OncError("هر گروه حداقل ۲ تیم لازم دارد.")
    if await has_results(tid):
        raise OncError("نتیجه ثبت شده است. اول «ریست نتایج» را بزن.")
    plans = {g["id"]: algo.round_robin([m["id"] for m in g["members"]]) for g in groups}
    n_rounds = max(len(p) for p in plans.values())
    async with dbx.tx():
        await dbx.execute("DELETE FROM onc_rounds WHERE tournament_id=?", tid)  # also drops knockout rounds (none can have results)
        for i in range(n_rounds):
            rid = await dbx.execute(
                "INSERT INTO onc_rounds(tournament_id,stage,number,start_at) VALUES(?,?,?,?)",
                tid, "GROUP", i + 1, algo.round_time(t["start_date"], t["start_time"], t["round_interval"], i))
            for g in groups:
                if i >= len(plans[g["id"]]):
                    continue
                for a, b in plans[g["id"]][i]:
                    mid = await dbx.execute("INSERT INTO onc_matches(round_id,tournament_id,group_id,team_a,team_b) VALUES(?,?,?,?,?)",
                                            rid, tid, g["id"], a, b)
                    for team in (a, b):
                        await dbx.execute("INSERT INTO onc_match_participants(round_id,team_id,match_id) VALUES(?,?,?)", rid, team, mid)
        if t["status"] == "DRAFT":
            pass
        await audit(admin, "GENERATE SCHEDULE", f"{n_rounds} راند", tid)
    total = await dbx.scalar("SELECT COUNT(*) FROM onc_matches WHERE tournament_id=?", tid)
    return {"rounds": n_rounds, "matches": total}


async def reset_results(admin: int, tid: int) -> None:
    require_admin(admin)
    async with dbx.tx():
        await dbx.execute("DELETE FROM onc_results WHERE match_id IN (SELECT id FROM onc_matches WHERE tournament_id=?)", tid)
        await dbx.execute("DELETE FROM onc_tie_decisions WHERE group_id IN (SELECT id FROM onc_groups WHERE tournament_id=?)", tid)
        await dbx.execute("DELETE FROM onc_rounds WHERE tournament_id=? AND stage<>'GROUP'", tid)  # knockout depends on results
        await dbx.execute("UPDATE onc_rounds SET status='OPEN', content_version=content_version+1 WHERE tournament_id=?", tid)
        await dbx.execute("UPDATE onc_tournaments SET champion_team_id=NULL, status=CASE WHEN status='FINISHED' THEN 'LIVE' ELSE status END WHERE id=?", tid)
        await audit(admin, "RESET RESULTS", "", tid)


# ----------------------------------------------------------------- results
def _validate_goals(n) -> int:
    if not isinstance(n, int) or n < 0 or n > 99:
        raise OncError("گل باید عدد صحیح بین ۰ تا ۹۹ باشد.")
    return n


async def _resolve_winner(m: dict, ga: int, gb: int, winner: int | None) -> int | None:
    if m["stage"] == "GROUP":
        return None
    if ga != gb:
        return m["team_a"] if ga > gb else m["team_b"]
    if winner not in (m["team_a"], m["team_b"]):
        raise OncError("بازی حذفی مساوی شده — برنده را دستی انتخاب کن.")
    return winner


async def save_result(admin: int, mid: int, ga: int, gb: int, winner: int | None = None) -> dict:
    """Stores a result for a match of a round that is not confirmed yet. Never publishes anything."""
    require_admin(admin)
    ga, gb = _validate_goals(ga), _validate_goals(gb)
    m = await get_match(mid)
    if not m:
        raise OncError("بازی پیدا نشد.")
    if m["round_status"] == "CONFIRMED":
        raise OncError("این راند قبلاً تأیید شده — از ویرایش نتیجه استفاده کن.")
    win = await _resolve_winner(m, ga, gb, winner)
    async with dbx.tx():
        old = f"{m['goals_a']}-{m['goals_b']}" if m["goals_a"] is not None else "—"
        await dbx.execute(
            "INSERT INTO onc_results(match_id,goals_a,goals_b,winner_team_id,status,updated_at,updated_by) VALUES(?,?,?,?, 'SAVED',?,?) "
            "ON CONFLICT(match_id) DO UPDATE SET goals_a=excluded.goals_a, goals_b=excluded.goals_b, "
            "winner_team_id=excluded.winner_team_id, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
            mid, ga, gb, win, now(), admin)
        await audit(admin, "SAVED RESULT", f"{m['name_a']} 🆚 {m['name_b']}: {old} → {ga}-{gb}", m["tournament_id"])
    return await round_progress(m["round_id"])


async def round_progress(rid: int) -> dict:
    ms = await matches_of_round(rid)
    done = [x for x in ms if x["goals_a"] is not None]
    return {"total": len(ms), "entered": len(done), "completed": bool(ms) and len(done) == len(ms)}


async def confirm_round(admin: int, rid: int) -> dict:
    """ROUND COMPLETED → admin confirmed. Marks results CONFIRMED (standings now count them). Publishing is separate."""
    require_admin(admin)
    r = await get_round(rid)
    async with dbx.tx():
        prog = await round_progress(rid)
        if not prog["completed"]:
            raise OncError(f"فقط {prog['entered']} از {prog['total']} نتیجه ثبت شده.")
        if r["status"] == "CONFIRMED":
            raise OncError("این راند قبلاً تأیید شده.")
        await dbx.execute("UPDATE onc_results SET status='CONFIRMED' WHERE match_id IN (SELECT id FROM onc_matches WHERE round_id=?)", rid)
        await dbx.execute("UPDATE onc_rounds SET status='CONFIRMED', content_version=content_version+1 WHERE id=?", rid)
        await dbx.execute("UPDATE onc_tournaments SET status='LIVE' WHERE id=? AND status IN ('DRAFT','READY')", r["tournament_id"])
        await _refresh_champion(r["tournament_id"])
        await audit(admin, "CONFIRMED ROUND", await round_label(r), r["tournament_id"])
    return await get_round(rid)


async def mark_published(rid: int) -> None:
    await dbx.execute("UPDATE onc_rounds SET published_version=content_version WHERE id=?", rid)


async def _refresh_champion(tid: int) -> None:
    final = await dbx.fetchone(
        "SELECT r.winner_team_id FROM onc_rounds rd JOIN onc_matches m ON m.round_id=rd.id JOIN onc_results r ON r.match_id=m.id "
        "WHERE rd.tournament_id=? AND rd.stage='F' AND rd.status='CONFIRMED' AND r.status='CONFIRMED'", tid)
    if final:
        await dbx.execute("UPDATE onc_tournaments SET champion_team_id=?, status='FINISHED' WHERE id=?", final["winner_team_id"], tid)
    else:
        await dbx.execute("UPDATE onc_tournaments SET champion_team_id=NULL, status=CASE WHEN status='FINISHED' THEN 'LIVE' ELSE status END WHERE id=?", tid)


# ----------------------------------------------------------------- standings / qualification
async def _confirmed_group_matches(gid: int) -> tuple[list[tuple], int, int]:
    rows = await dbx.fetchall(
        "SELECT m.team_a, m.team_b, r.goals_a, r.goals_b FROM onc_matches m JOIN onc_results r ON r.match_id=m.id "
        "WHERE m.group_id=? AND r.status='CONFIRMED'", gid)
    total = await dbx.scalar("SELECT COUNT(*) FROM onc_matches WHERE group_id=?", gid)
    return [(r["team_a"], r["team_b"], r["goals_a"], r["goals_b"]) for r in rows], len(rows), total


async def group_tables(tid: int) -> list[dict]:
    """Per group: rows (ordered), unresolved ties, status, qualified team ids. Computed from CONFIRMED results only."""
    names = await team_names(tid)
    out = []
    for g in await groups_of(tid):
        ms, done, total = await _confirmed_group_matches(g["id"])
        decisions = {d["signature"]: json.loads(d["order_json"])
                     for d in await dbx.fetchall("SELECT * FROM onc_tie_decisions WHERE group_id=?", g["id"])}
        rows, unresolved = algo.rank_group([m["id"] for m in g["members"]], ms, decisions)
        for r in rows:
            r["name"] = names[r["team"]]
        complete = total > 0 and done == total
        status = algo.group_status(rows, unresolved, g["qualifiers"], complete)
        out.append({"group": g, "rows": rows, "unresolved": unresolved, "status": status, "played": done, "total": total,
                    "complete": complete})
    return out


async def set_tie_decision(admin: int, gid: int, order: list[int]) -> None:
    require_admin(admin)
    g = await get_group(gid)
    tables = await group_tables(g["tournament_id"])
    tbl = next(t for t in tables if t["group"]["id"] == gid)
    block = next((b for b in tbl["unresolved"] if sorted(b) == sorted(order)), None)
    if block is None:
        raise OncError("این تساوی دیگر باز نیست (نتایج عوض شده).")
    async with dbx.tx():
        await dbx.execute("INSERT OR REPLACE INTO onc_tie_decisions(group_id,signature,order_json) VALUES(?,?,?)",
                          gid, algo.signature(order), json.dumps(order))
        names = await team_names(g["tournament_id"])
        await audit(admin, "TIE DECISION", f"{g['name']}: " + " > ".join(names[t] for t in order), g["tournament_id"])


async def qualification(tid: int) -> dict:
    """{'ready': bool, 'teams': [ids in group order], 'blockers': [text]} — only final when EVERY group is final."""
    tables = await group_tables(tid)
    blockers, teams = [], []
    if not tables:
        blockers.append("گروهی وجود ندارد.")
    for t in tables:
        g = t["group"]
        if g["qualifiers"] is None:
            blockers.append(f"{g['name']}: تعداد صعودکننده تعیین نشده")
        elif t["status"]["state"] == "PENDING":
            blockers.append(f"{g['name']}: {t['played']} از {t['total']} بازی تأیید شده")
        elif t["status"]["state"] == "NEEDS ADMIN DECISION":
            blockers.append(f"{g['name']}: نیاز به تصمیم ادمین (تساوی روی خط صعود)")
        else:
            teams += t["status"]["qualified"]
    return {"ready": not blockers, "teams": teams if not blockers else [], "blockers": blockers}


# ----------------------------------------------------------------- knockout
async def ko_rounds(tid: int) -> list[dict]:
    return await dbx.fetchall("SELECT * FROM onc_rounds WHERE tournament_id=? AND stage<>'GROUP' ORDER BY start_at, id", tid)


async def create_ko_stage(admin: int, tid: int, stage: str) -> int:
    require_admin(admin)
    t = await get_tournament(tid)
    if stage not in algo.STAGES:
        raise OncError("مرحله نامعتبر است.")
    q = await qualification(tid)
    if not q["ready"]:
        raise OncError("مرحله گروهی هنوز نهایی نشده:\n• " + "\n• ".join(q["blockers"]))
    existing = await ko_rounds(tid)
    have = [r["stage"] for r in existing]
    if stage in have:
        raise OncError("این مرحله قبلاً ساخته شده.")
    if have and algo.STAGES.index(stage) <= max(algo.STAGES.index(s) for s in have):
        raise OncError("مرحله‌ها باید به ترتیب باشند (مثلاً یک‌چهارم → نیمه‌نهایی → فینال).")
    if have and not all(r["status"] == "CONFIRMED" for r in existing):
        raise OncError("اول مرحله‌ی حذفی قبلی را تأیید کن.")
    n_group = await dbx.scalar("SELECT COUNT(*) FROM onc_rounds WHERE tournament_id=? AND stage='GROUP'", tid)
    idx = n_group + len(existing)
    async with dbx.tx():
        rid = await dbx.execute("INSERT INTO onc_rounds(tournament_id,stage,number,start_at) VALUES(?,?,1,?)",
                                tid, stage, algo.round_time(t["start_date"], t["start_time"], t["round_interval"], idx))
        await audit(admin, "CREATE KNOCKOUT STAGE", algo.STAGE_NAME[stage], tid)
    return rid


async def ko_pool(tid: int, rid: int) -> list[int]:
    """Teams that may still be drawn into this knockout round: qualified teams (first stage) or previous winners."""
    prev = await dbx.fetchall(
        "SELECT * FROM onc_rounds WHERE tournament_id=? AND stage<>'GROUP' AND id<>? AND start_at < (SELECT start_at FROM onc_rounds WHERE id=?) "
        "ORDER BY start_at DESC LIMIT 1", tid, rid, rid)
    if prev:
        pool = [r["winner_team_id"] for r in await dbx.fetchall(
            "SELECT r.winner_team_id FROM onc_matches m JOIN onc_results r ON r.match_id=m.id "
            "WHERE m.round_id=? AND r.status='CONFIRMED'", prev[0]["id"])]
    else:
        pool = (await qualification(tid))["teams"]
    used = {r["team_id"] for r in await dbx.fetchall("SELECT team_id FROM onc_match_participants WHERE round_id=?", rid)}
    return [t for t in pool if t not in used]


async def add_ko_match(admin: int, rid: int, a: int, b: int) -> int:
    require_admin(admin)
    r = await get_round(rid)
    if r["stage"] == "GROUP":
        raise OncError("این راند حذفی نیست.")
    if r["status"] == "CONFIRMED":
        raise OncError("این مرحله قبلاً تأیید شده.")
    if r["stage"] == "F" and await dbx.scalar("SELECT 1 FROM onc_matches WHERE round_id=?", rid):
        raise OncError("فینال فقط یک بازی دارد.")
    pool = await ko_pool(r["tournament_id"], rid)
    if a == b or a not in pool or b not in pool:
        raise OncError("دو تیم متفاوت از تیم‌های در دسترس انتخاب کن.")
    async with dbx.tx():
        mid = await dbx.execute("INSERT INTO onc_matches(round_id,tournament_id,group_id,team_a,team_b) VALUES(?,?,NULL,?,?)",
                                rid, r["tournament_id"], a, b)
        for team in (a, b):
            await dbx.execute("INSERT INTO onc_match_participants(round_id,team_id,match_id) VALUES(?,?,?)", rid, team, mid)
        names = await team_names(r["tournament_id"])
        await audit(admin, "KNOCKOUT MATCHUP", f"{algo.STAGE_NAME[r['stage']]}: {names[a]} 🆚 {names[b]}", r["tournament_id"])
    return mid


async def remove_ko_match(admin: int, mid: int) -> None:
    require_admin(admin)
    m = await get_match(mid)
    if m["round_status"] == "CONFIRMED":
        raise OncError("این مرحله قبلاً تأیید شده.")
    await dbx.execute("DELETE FROM onc_matches WHERE id=?", mid)
    await audit(admin, "REMOVE MATCHUP", f"{m['name_a']} 🆚 {m['name_b']}", m["tournament_id"])


async def delete_ko_stage(admin: int, rid: int) -> None:
    require_admin(admin)
    r = await get_round(rid)
    if r["status"] == "CONFIRMED":
        raise OncError("مرحله‌ی تأییدشده حذف نمی‌شود؛ نتایج را ویرایش کن.")
    later = await dbx.scalar("SELECT 1 FROM onc_rounds WHERE tournament_id=? AND stage<>'GROUP' AND start_at>?", r["tournament_id"], r["start_at"])
    if later:
        raise OncError("اول مرحله‌های بعدی را حذف کن.")
    await dbx.execute("DELETE FROM onc_rounds WHERE id=?", rid)
    await audit(admin, "DELETE KNOCKOUT STAGE", algo.STAGE_NAME[r["stage"]], r["tournament_id"])


# ----------------------------------------------------------------- editing confirmed results (with dependency protection)
async def _invalid_ko_matches(tid: int) -> list[dict]:
    """Knockout matches whose teams are no longer valid after a change (walks stage by stage)."""
    q = await qualification(tid)
    rounds = await ko_rounds(tid)
    invalid: list[dict] = []
    prev_winners: set[int] | None = None
    for i, rd in enumerate(rounds):
        ms = await matches_of_round(rd["id"])
        if i == 0 and not q["ready"]:
            # qualification became unresolved: can't verify the bracket → report as one warning entry
            invalid.append({"id": None, "round_id": rd["id"], "text": "صعود دیگر نهایی نیست", "unverifiable": True})
            break
        pool = set(q["teams"]) if i == 0 else prev_winners
        bad = [m for m in ms if m["team_a"] not in pool or m["team_b"] not in pool]
        for m in bad:
            invalid.append({"id": m["id"], "round_id": rd["id"], "text": f"{algo.STAGE_NAME[rd['stage']]}: {m['name_a']} 🆚 {m['name_b']}"})
        bad_ids = {m["id"] for m in bad}
        prev_winners = {m["winner_team_id"] for m in ms if m["id"] not in bad_ids and m["rstatus"] == "CONFIRMED" and m["winner_team_id"]}
    return invalid


async def edit_confirmed_result(admin: int, mid: int, ga: int, gb: int, winner: int | None = None, rebuild: bool = False) -> dict:
    """Changes a result of an already-confirmed round.

    Returns {'applied': bool, 'impact': [...], 'round': round, 'was_published': bool, 'old': str, 'new': str}.
    If the change invalidates the existing knockout (qualified team changed / winner changed) nothing is written
    unless rebuild=True, in which case the invalid knockout matches are removed (and their stage reopened).
    """
    require_admin(admin)
    ga, gb = _validate_goals(ga), _validate_goals(gb)
    m = await get_match(mid)
    if m["round_status"] != "CONFIRMED":
        raise OncError("این راند هنوز تأیید نشده — از ثبت عادی نتیجه استفاده کن.")
    win = await _resolve_winner(m, ga, gb, winner)
    rd = await get_round(m["round_id"])
    old = f"{m['goals_a']}-{m['goals_b']}"
    result: dict = {"applied": False, "impact": [], "old": old, "new": f"{ga}-{gb}", "match": m,
                    "was_published": rd["published_version"] > 0}
    try:
        async with dbx.tx():
            await dbx.execute("UPDATE onc_results SET goals_a=?, goals_b=?, winner_team_id=?, updated_at=?, updated_by=? WHERE match_id=?",
                              ga, gb, win, now(), admin, mid)
            await dbx.execute("UPDATE onc_rounds SET content_version=content_version+1 WHERE id=?", rd["id"])
            impact = await _invalid_ko_matches(m["tournament_id"])
            result["impact"] = [i["text"] for i in impact]
            if impact and not rebuild:
                raise _Rollback()
            for i in impact:
                if i.get("id"):
                    await dbx.execute("DELETE FROM onc_matches WHERE id=?", i["id"])
                    await dbx.execute("UPDATE onc_rounds SET status='OPEN', content_version=content_version+1 WHERE id=?", i["round_id"])
            if impact:  # later stages lose their pool → reopen/clean them
                await _cascade_ko(m["tournament_id"])
            await _refresh_champion(m["tournament_id"])
            await audit(admin, "CHANGED RESULT", f"{m['name_a']} 🆚 {m['name_b']}\n{old} → {ga}-{gb}"
                        + (" (حذفی بازسازی شد)" if impact else ""), m["tournament_id"])
            result["applied"] = True
    except _Rollback:
        pass
    result["round"] = await get_round(rd["id"])
    return result


async def _cascade_ko(tid: int) -> None:
    """After deleting invalid matches, repeat until every remaining knockout match is valid."""
    for _ in range(6):
        invalid = [i for i in await _invalid_ko_matches(tid) if i.get("id")]
        if not invalid:
            return
        for i in invalid:
            await dbx.execute("DELETE FROM onc_matches WHERE id=?", i["id"])
            await dbx.execute("UPDATE onc_rounds SET status='OPEN', content_version=content_version+1 WHERE id=?", i["round_id"])


# ----------------------------------------------------------------- validation / start
async def validation(tid: int) -> list[tuple[bool, str]]:
    from . import templates  # local import: templates ← service
    teams = await teams_of(tid)
    groups = await groups_of(tid)
    unassigned = [t for t in teams if not t["group_id"]]
    no_q = [g for g in groups if g["qualifiers"] is None]
    n_matches = await dbx.scalar("SELECT COUNT(*) FROM onc_matches WHERE tournament_id=? AND group_id IS NOT NULL", tid)
    expected = sum(len(g["members"]) * (len(g["members"]) - 1) // 2 for g in groups)
    missing_tpl = await templates.missing_types()
    channel = await get_setting("channel_id")
    small = [g for g in groups if len(g["members"]) < 2]
    checks = [
        (len(teams) >= 2, f"تیم‌ها ثبت شده‌اند ({len(teams)})" if len(teams) >= 2 else "ثبت تیم‌ها — حداقل ۲ تیم اضافه کن"),
        (bool(groups) and not small, f"گروه‌ها ساخته شده‌اند ({len(groups)})" if groups and not small else
         ("ساخت گروه‌ها — حداقل یک گروه بساز" if not groups else "ساخت گروه‌ها — " + ", ".join(g["name"] for g in small) + " حداقل ۲ تیم لازم دارند")),
        (bool(teams) and not unassigned, "تیم‌ها در گروه‌ها قرار گرفته‌اند" if teams and not unassigned else
         f"قرارگیری تیم‌ها در گروه — {len(unassigned)} تیم بدون گروه: " + ", ".join(t["name"] for t in unassigned[:6]) + ("…" if len(unassigned) > 6 else "")),
        (bool(groups) and not no_q, "تعداد صعودکننده‌ها تعیین شده" if groups and not no_q else
         "تعداد صعودکننده‌ها — تعیین نشده برای " + ", ".join(g["name"] for g in no_q)),
        (n_matches > 0 and n_matches == expected, f"برنامه ساخته شده ({n_matches} بازی)" if n_matches and n_matches == expected else
         ("برنامه — هنوز ساخته نشده" if not n_matches else "برنامه — قدیمی شده، دوباره بساز")),
        (not missing_tpl, "تمپلیت‌های گرافیکی آماده‌اند" if not missing_tpl else "تمپلیت‌های گرافیکی — ناقص: " + ", ".join(missing_tpl)),
        (bool(channel), "کانال وان نایت چمپیون تنظیم شده" if channel else "کانال — در بخش «کانال» تنظیمش کن"),
    ]
    return checks


async def start_tournament(admin: int, tid: int) -> None:
    require_admin(admin)
    checks = await validation(tid)
    bad = [c for ok, c in checks if not ok]
    if bad:
        raise OncError("آماده نیست:\n• " + "\n• ".join(bad))
    await dbx.execute("UPDATE onc_tournaments SET status='LIVE' WHERE id=?", tid)
    await audit(admin, "START TOURNAMENT", "", tid)


async def sync_ready_status(tid: int) -> None:
    """DRAFT ⇄ READY follows the checklist (LIVE/FINISHED/ARCHIVED are never touched here)."""
    t = await get_tournament(tid)
    if t["status"] in ("DRAFT", "READY"):
        ok = all(c for c, _ in await validation(tid))
        new = "READY" if ok else "DRAFT"
        if new != t["status"]:
            await dbx.execute("UPDATE onc_tournaments SET status=? WHERE id=?", new, tid)


async def current_round(tid: int) -> dict | None:
    """First round (group or knockout) that still isn't confirmed and has matches."""
    return await dbx.fetchone(
        "SELECT rd.* FROM onc_rounds rd WHERE rd.tournament_id=? AND rd.status='OPEN' "
        "AND EXISTS(SELECT 1 FROM onc_matches m WHERE m.round_id=rd.id) ORDER BY rd.start_at, rd.id LIMIT 1", tid)


# ================================================================= captains / managers, team lists, captain results
from datetime import timedelta  # noqa: E402
from zoneinfo import ZoneInfo  # noqa: E402

from .. import config  # noqa: E402

TEAM_LIST_LOCK_MINUTES = 60          # captains can edit the list until 1 hour before the tournament starts
MAX_CAPTAINS = 2
MAX_LIST = 40


def now_local() -> datetime:
    try:
        return datetime.now(ZoneInfo(config.ONC_TZ)).replace(tzinfo=None)
    except Exception:  # unknown tz name / missing tzdata → server local time
        return datetime.now()


def start_dt(t: dict) -> datetime:
    return datetime.strptime(f"{t['start_date']} {t['start_time']}", "%Y-%m-%d %H:%M")


def list_deadline(t: dict) -> datetime:
    return start_dt(t) - timedelta(minutes=TEAM_LIST_LOCK_MINUTES)


def list_open(t: dict) -> bool:
    return now_local() < list_deadline(t)


async def captains_of(team_id: int) -> list[dict]:
    rows = await dbx.fetchall("SELECT * FROM onc_captains WHERE team_id=? ORDER BY id", team_id)
    for r in rows:
        u = await main_db.fetchone("SELECT name, username FROM users WHERE id=?", r["user_id"])
        r["name"] = (u or {}).get("name") or ""
        r["username"] = (u or {}).get("username") or ""
    return rows


def captain_label(c: dict) -> str:
    return (c.get("name") or "کاربر") + (f" (@{c['username']})" if c.get("username") else "") + f" · {c['user_id']}"


async def add_captain(admin: int, team_id: int, user_id: int) -> int:
    require_admin(admin)
    team = await get_team(team_id)
    if not team:
        raise OncError("تیم پیدا نشد.")
    if not isinstance(user_id, int) or user_id <= 0:
        raise OncError("آیدی عددی تلگرام معتبر نیست.")
    async with dbx.tx():
        if await dbx.scalar("SELECT 1 FROM onc_captains WHERE team_id=? AND user_id=?", team_id, user_id):
            raise OncError("این کاربر قبلاً کاپیتان همین تیم است.")
        if await dbx.scalar("SELECT COUNT(*) FROM onc_captains WHERE team_id=?", team_id) >= MAX_CAPTAINS:
            raise OncError(f"هر تیم حداکثر {MAX_CAPTAINS} کاپیتان/منیجر دارد.")
        cid = await dbx.execute("INSERT INTO onc_captains(tournament_id,team_id,user_id,added_by,added_at) VALUES(?,?,?,?,?)",
                                team["tournament_id"], team_id, user_id, admin, now())
        await audit(admin, "ADD CAPTAIN", f"{team['name']} ← {user_id}", team["tournament_id"])
    return cid


async def remove_captain(admin: int, captain_id: int) -> dict | None:
    require_admin(admin)
    c = await dbx.fetchone("SELECT c.*, t.name AS team_name FROM onc_captains c JOIN onc_teams t ON t.id=c.team_id WHERE c.id=?", captain_id)
    if c:
        await dbx.execute("DELETE FROM onc_captains WHERE id=?", captain_id)
        await audit(admin, "REMOVE CAPTAIN", f"{c['team_name']} ✕ {c['user_id']}", c["tournament_id"])
    return c


async def captain_teams(user_id: int) -> list[dict]:
    """Teams this user is captain of, in tournaments that are not finished/archived."""
    return await dbx.fetchall(
        "SELECT t.id AS team_id, t.name AS team_name, tr.id AS tournament_id, tr.name AS tournament_name, tr.status "
        "FROM onc_captains c JOIN onc_teams t ON t.id=c.team_id JOIN onc_tournaments tr ON tr.id=c.tournament_id "
        "WHERE c.user_id=? AND tr.status IN ('DRAFT','READY','LIVE') ORDER BY tr.id DESC, t.name", user_id)


async def assert_captain(user_id: int, team_id: int) -> dict:
    """Backend gate for EVERY captain action: user → tournament → team → is this user a captain of this team?"""
    row = await dbx.fetchone(
        "SELECT c.*, t.name AS team_name, tr.status, tr.start_date, tr.start_time, tr.name AS tournament_name "
        "FROM onc_captains c JOIN onc_teams t ON t.id=c.team_id JOIN onc_tournaments tr ON tr.id=c.tournament_id "
        "WHERE c.user_id=? AND c.team_id=?", user_id, team_id)
    if not row:
        raise OncError("⛔ تو کاپیتان/منیجر این تیم نیستی.")
    if row["status"] in ("FINISHED", "ARCHIVED"):
        raise OncError("این تورنمنت تمام شده است.")
    return row


async def set_team_list(user_id: int, team_id: int, players: list[str]) -> list[str]:
    """Captain replaces the whole team list (deadline: 1 hour before the tournament starts). Admins edit via the admin panel."""
    row = await assert_captain(user_id, team_id)
    t = await get_tournament(row["tournament_id"])
    if not list_open(t):
        raise OncError(f"مهلت ثبت/ویرایش لیست تمام شده ({list_deadline(t).strftime('%H:%M')} ؛ یک ساعت قبل از شروع). برای تغییر به ادمین بگو.")
    clean: list[str] = []
    for p in players:
        p = _clean_name(p, "آیدی بازیکن")
        if p.lower() not in {x.lower() for x in clean}:
            clean.append(p)
    if not clean:
        raise OncError("حداقل یک بازیکن بفرست.")
    if len(clean) > MAX_LIST:
        raise OncError(f"حداکثر {MAX_LIST} بازیکن.")
    async with dbx.tx():
        await dbx.execute("DELETE FROM onc_players WHERE team_id=?", team_id)
        for p in clean:
            await dbx.execute("INSERT INTO onc_players(team_id,player_id) VALUES(?,?)", team_id, p)
        await audit(user_id, "CAPTAIN TEAM LIST", f"{row['team_name']}: {len(clean)}", row["tournament_id"])
    return clean


async def captain_matches(user_id: int, team_id: int) -> list[dict]:
    """Matches of the captain's own team that still have no official result."""
    await assert_captain(user_id, team_id)
    rows = await dbx.fetchall(
        "SELECT m.id FROM onc_matches m JOIN onc_rounds rd ON rd.id=m.round_id LEFT JOIN onc_results r ON r.match_id=m.id "
        "WHERE (m.team_a=? OR m.team_b=?) AND rd.status='OPEN' AND (r.match_id IS NULL OR r.status<>'CONFIRMED') ORDER BY rd.start_at, m.id",
        team_id, team_id)
    return [await get_match(r["id"]) for r in rows]


async def pending_for(match_id: int, team_id: int | None = None) -> dict | None:
    sql, args = "SELECT * FROM onc_pending_results WHERE match_id=? AND status='PENDING'", [match_id]
    if team_id:
        sql += " AND team_id=?"; args.append(team_id)
    return await dbx.fetchone(sql, *args)


async def submit_result(user_id: int, team_id: int, match_id: int, ga: int, gb: int, winner: int | None = None) -> int:
    """Captain submits a result for ONE OF HIS OWN matches. It stays PENDING until an admin approves it — never official on its own."""
    row = await assert_captain(user_id, team_id)
    ga, gb = _validate_goals(ga), _validate_goals(gb)
    m = await get_match(match_id)
    if not m or m["tournament_id"] != row["tournament_id"] or team_id not in (m["team_a"], m["team_b"]):
        raise OncError("⛔ این بازی مربوط به تیم تو نیست.")
    if row["status"] != "LIVE":
        raise OncError("تورنمنت هنوز شروع نشده است.")
    if m["round_status"] == "CONFIRMED" or m["rstatus"] == "CONFIRMED":
        raise OncError("برای این بازی نتیجه‌ی رسمی ثبت شده است.")
    if await pending_for(match_id, team_id):
        raise OncError("نتیجه‌ی قبلی تو هنوز در انتظار تأیید ادمین است.")
    win = await _resolve_winner(m, ga, gb, winner)
    async with dbx.tx():
        pid = await dbx.execute(
            "INSERT INTO onc_pending_results(match_id,team_id,user_id,goals_a,goals_b,winner_team_id,created_at) VALUES(?,?,?,?,?,?,?)",
            match_id, team_id, user_id, ga, gb, win, now())
        await audit(user_id, "CAPTAIN RESULT SUBMITTED", f"{m['name_a']} 🆚 {m['name_b']}: {ga}-{gb}", m["tournament_id"])
    return pid


async def get_pending(pid: int) -> dict | None:
    return await dbx.fetchone(
        "SELECT p.*, m.team_a, m.team_b, m.round_id, m.tournament_id, a.name AS name_a, b.name AS name_b, t.name AS team_name, "
        "rd.status AS round_status, rd.stage, rd.number "
        "FROM onc_pending_results p JOIN onc_matches m ON m.id=p.match_id JOIN onc_teams a ON a.id=m.team_a JOIN onc_teams b ON b.id=m.team_b "
        "JOIN onc_teams t ON t.id=p.team_id JOIN onc_rounds rd ON rd.id=m.round_id WHERE p.id=?", pid)


async def pending_results(tid: int) -> list[dict]:
    ids = await dbx.fetchall("SELECT p.id FROM onc_pending_results p JOIN onc_matches m ON m.id=p.match_id "
                             "WHERE m.tournament_id=? AND p.status='PENDING' ORDER BY p.id", tid)
    return [await get_pending(r["id"]) for r in ids]


async def pending_count(tid: int) -> int:
    return await dbx.scalar("SELECT COUNT(*) FROM onc_pending_results p JOIN onc_matches m ON m.id=p.match_id "
                            "WHERE m.tournament_id=? AND p.status='PENDING'", tid) or 0


async def approve_pending(admin: int, pid: int) -> dict:
    """Admin approval makes the match result OFFICIAL (it counts in standings at once). The round is NOT published here —
    the existing round confirmation / publication flow stays exactly as it was."""
    require_admin(admin)
    async with dbx.tx():
        p = await get_pending(pid)
        if not p or p["status"] != "PENDING":
            raise OncError("این نتیجه قبلاً بررسی شده است.")
        stale = p["round_status"] == "CONFIRMED"
        if stale:
            await dbx.execute("UPDATE onc_pending_results SET status='REJECTED', decided_at=?, decided_by=? WHERE id=?", now(), admin, pid)
        else:
          await dbx.execute(
            "INSERT INTO onc_results(match_id,goals_a,goals_b,winner_team_id,status,updated_at,updated_by) VALUES(?,?,?,?, 'CONFIRMED',?,?) "
            "ON CONFLICT(match_id) DO UPDATE SET goals_a=excluded.goals_a, goals_b=excluded.goals_b, winner_team_id=excluded.winner_team_id, "
            "status='CONFIRMED', updated_at=excluded.updated_at, updated_by=excluded.updated_by",
            p["match_id"], p["goals_a"], p["goals_b"], p["winner_team_id"], now(), admin)
          await dbx.execute("UPDATE onc_pending_results SET status='APPROVED', decided_at=?, decided_by=? WHERE id=?", now(), admin, pid)
          await dbx.execute("UPDATE onc_pending_results SET status='SUPERSEDED', decided_at=?, decided_by=? WHERE match_id=? AND status='PENDING'",
                            now(), admin, p["match_id"])
          await dbx.execute("UPDATE onc_tournaments SET status='LIVE' WHERE id=? AND status IN ('DRAFT','READY')", p["tournament_id"])
          await audit(admin, "RESULT APPROVED", f"{p['name_a']} 🆚 {p['name_b']}: {p['goals_a']}-{p['goals_b']} (کاپیتان {p['team_name']})", p["tournament_id"])
    if stale:
        raise OncError("راند این بازی قبلاً تأیید شده؛ نتیجه رد شد. از ویرایش نتیجه استفاده کن.")
    return p


async def reject_pending(admin: int, pid: int) -> dict:
    require_admin(admin)
    async with dbx.tx():
        p = await get_pending(pid)
        if not p or p["status"] != "PENDING":
            raise OncError("این نتیجه قبلاً بررسی شده است.")
        await dbx.execute("UPDATE onc_pending_results SET status='REJECTED', decided_at=?, decided_by=? WHERE id=?", now(), admin, pid)
        await audit(admin, "RESULT REJECTED", f"{p['name_a']} 🆚 {p['name_b']}: {p['goals_a']}-{p['goals_b']} (کاپیتان {p['team_name']})", p["tournament_id"])
    return p


# ---- viewer: live vs finished tournaments
async def live_tournaments() -> list[dict]:
    return await dbx.fetchall("SELECT * FROM onc_tournaments WHERE status='LIVE' ORDER BY id DESC")


async def finished_tournaments() -> list[dict]:
    return await dbx.fetchall("SELECT * FROM onc_tournaments WHERE status IN ('FINISHED','ARCHIVED') ORDER BY id DESC")
