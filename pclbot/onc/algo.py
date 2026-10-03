"""Pure algorithms (no I/O): round-robin scheduling, standings and tie-break, qualification."""
import json
from datetime import datetime, timedelta

STAGES = ["R32", "R16", "QF", "SF", "F"]
STAGE_NAME = {"GROUP": "مرحله گروهی", "R32": "یک‌سی‌ودوم نهایی", "R16": "یک‌شانزدهم نهایی",
              "QF": "یک‌چهارم نهایی", "SF": "نیمه‌نهایی", "F": "فینال"}
STAGE_SHORT = dict(STAGE_NAME)


def round_robin(teams: list[int]) -> list[list[tuple[int, int]]]:
    """Single round robin (circle method). Returns rounds -> pairs; BYE (odd group) is simply left out.

    Every team appears at most once per round and every pair meets exactly once.
    """
    ts = list(teams)
    if len(ts) < 2:
        return []
    if len(ts) % 2:
        ts.append(None)  # BYE
    n = len(ts)
    rounds = []
    for _ in range(n - 1):
        pairs = []
        for i in range(n // 2):
            a, b = ts[i], ts[n - 1 - i]
            if a is not None and b is not None:
                pairs.append((a, b))
        rounds.append(pairs)
        ts = [ts[0]] + [ts[-1]] + ts[1:-1]
    return rounds


def round_time(date: str, time: str, interval: int, index: int) -> str:
    """Start of round `index` (0-based): start + index * interval minutes. Matches inside a round share this time."""
    base = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
    return (base + timedelta(minutes=interval * index)).strftime("%Y-%m-%d %H:%M")


# --------------------------------------------------------------------- standings
def _blank(t):
    return {"team": t, "P": 0, "W": 0, "D": 0, "L": 0, "GF": 0, "GA": 0, "GD": 0, "Pts": 0, "tb": ""}


def stats(teams: list[int], matches: list[tuple]) -> dict[int, dict]:
    """matches: (team_a, team_b, goals_a, goals_b) — confirmed results only."""
    rows = {t: _blank(t) for t in teams}
    for a, b, ga, gb in matches:
        if a not in rows or b not in rows:
            continue
        for t, f, g in ((a, ga, gb), (b, gb, ga)):
            r = rows[t]
            r["P"] += 1; r["GF"] += f; r["GA"] += g
            if f > g: r["W"] += 1; r["Pts"] += 3
            elif f == g: r["D"] += 1; r["Pts"] += 1
            else: r["L"] += 1
        # GD last
    for r in rows.values():
        r["GD"] = r["GF"] - r["GA"]
    return rows


def _h2h(a: int, b: int, matches: list[tuple]) -> int:
    """>0 if a beat b head to head, <0 if b beat a, 0 if drawn / not played."""
    for x, y, gx, gy in matches:
        if {x, y} == {a, b}:
            ga, gb = (gx, gy) if x == a else (gy, gx)
            return (ga > gb) - (ga < gb)
    return 0


def rank_group(teams: list[int], matches: list[tuple], decisions: dict[str, list[int]] | None = None):
    """Orders a group.

    Rules: Pts → (exactly 2 tied: head-to-head → GD → GF | 3+ tied: GD → GF, no head-to-head) → admin decision.
    Returns (rows, unresolved) where rows are in table order (with 'tb' = deciding criterion) and
    unresolved is a list of teams-sets that still need an admin decision (as lists of team ids, in current order).
    """
    decisions = decisions or {}
    st = stats(teams, matches)
    by_pts: dict[int, list[int]] = {}
    for t in teams:
        by_pts.setdefault(st[t]["Pts"], []).append(t)
    ordered: list[int] = []
    unresolved: list[list[int]] = []
    for pts in sorted(by_pts, reverse=True):
        tied = sorted(by_pts[pts])
        if len(tied) == 1:
            ordered += tied
            continue
        if len(tied) == 2:
            a, b = tied
            h = _h2h(a, b, matches)
            if h:
                first, second = (a, b) if h > 0 else (b, a)
                st[first]["tb"] = st[second]["tb"] = "H2H"
                ordered += [first, second]
                continue
        # GD then GF (also the second step for two teams whose head-to-head is level)
        keyf = lambda t: (-st[t]["GD"], -st[t]["GF"])
        tied.sort(key=keyf)
        i = 0
        while i < len(tied):
            j = i
            while j < len(tied) and keyf(tied[j]) == keyf(tied[i]):
                j += 1
            block = tied[i:j]
            if len(block) == 1:
                ordered += block
                t = block[0]
                st[t]["tb"] = "GD" if [st[o]["GD"] for o in tied].count(st[t]["GD"]) == 1 else "GF"
            else:
                sig = signature(block)
                if sig in decisions and sorted(decisions[sig]) == sorted(block):
                    block = list(decisions[sig])
                    for t in block:
                        st[t]["tb"] = "ADMIN"
                else:
                    for t in block:
                        st[t]["tb"] = "UNRESOLVED"
                    unresolved.append(block)
                ordered += block
            i = j
    rows = []
    for pos, t in enumerate(ordered, 1):
        r = dict(st[t]); r["pos"] = pos
        rows.append(r)
    return rows, unresolved


def signature(team_ids) -> str:
    return ",".join(str(t) for t in sorted(team_ids))


def group_status(rows: list[dict], unresolved: list[list[int]], qualifiers: int | None, complete: bool) -> dict:
    """PENDING (matches left) | NEEDS ADMIN DECISION (a real tie touches the qualification line) | FINAL.

    A tie that does not touch the qualification line is shown but does not block qualification.
    """
    if not complete:
        return {"state": "PENDING", "qualified": [], "blocking": []}
    pos_of = {r["team"]: r["pos"] for r in rows}
    if qualifiers is None:  # not configured: nothing to qualify yet, but real ties still need a decision
        return {"state": "NEEDS ADMIN DECISION" if unresolved else "FINAL", "qualified": [], "blocking": unresolved}
    blocking = [b for b in unresolved if min(pos_of[t] for t in b) <= qualifiers < max(pos_of[t] for t in b)]
    if blocking:
        return {"state": "NEEDS ADMIN DECISION", "qualified": [], "blocking": blocking}
    return {"state": "FINAL", "qualified": [r["team"] for r in rows if r["pos"] <= qualifiers], "blocking": []}


def bracket_stage_sizes(n_teams: int) -> list[str]:
    """Stages needed for n qualified teams (power-of-two bracket upward from the first stage)."""
    need = {2: ["F"], 4: ["SF", "F"], 8: ["QF", "SF", "F"], 16: ["R16", "QF", "SF", "F"], 32: ["R32", "R16", "QF", "SF", "F"]}
    return need.get(n_teams, [])


def dumps(o) -> str:
    return json.dumps(o, ensure_ascii=False)
