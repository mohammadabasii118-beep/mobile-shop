"""Pure-algorithm tests: round robin, standings, tie-breaks, qualification.   python -m tests.onc_algo_test"""
import itertools

from pclbot.onc import algo


def test_round_robin():
    for n in range(2, 33):
        teams = list(range(1, n + 1))
        rounds = algo.round_robin(teams)
        assert len(rounds) == (n - 1 if n % 2 == 0 else n)
        seen = [frozenset(p) for r in rounds for p in r]
        assert len(seen) == len(set(seen)) == n * (n - 1) // 2, n              # every pair exactly once (single round robin)
        for r in rounds:
            flat = [t for p in r for t in p]
            assert len(flat) == len(set(flat)), "a team plays once per round"
            assert len(r) == n // 2 or (n % 2 and len(r) == (n - 1) // 2)       # BYE handled for odd groups
    assert algo.round_robin([1]) == [] and algo.round_robin([]) == []
    assert algo.round_time("2026-10-10", "20:00", 30, 0) == "2026-10-10 20:00"
    assert algo.round_time("2026-10-10", "23:30", 30, 1) == "2026-10-11 00:00"


def test_scoring_and_two_team_tiebreak():
    # T1 and T2 both 6 pts; T2 beat T1 head-to-head although T1's goal difference is better
    m = [(1, 2, 0, 1), (1, 3, 5, 0), (1, 4, 1, 0), (2, 3, 1, 0), (2, 4, 0, 1), (3, 4, 0, 0)]
    rows, un = algo.rank_group([1, 2, 3, 4], m)
    by = {r["team"]: r for r in rows}
    assert by[1]["Pts"] == by[2]["Pts"] == 6 and by[2]["pos"] < by[1]["pos"] and by[2]["tb"] == "H2H" and not un
    assert by[1]["GD"] > by[2]["GD"]                      # head-to-head overrides the better goal difference
    assert (by[1]["P"], by[1]["W"], by[1]["D"], by[1]["L"], by[1]["GF"], by[1]["GA"], by[1]["GD"]) == (3, 2, 0, 1, 6, 1, 5)


def test_two_teams_h2h_level_then_gd_then_gf_then_admin():
    # 1 vs 2 drew; 1 has better GD
    m = [(1, 2, 1, 1), (1, 3, 3, 0), (2, 3, 1, 0)]
    rows, un = algo.rank_group([1, 2, 3], m)
    assert [r["team"] for r in rows] == [1, 2, 3] and rows[0]["tb"] == "GD" and not un
    # same GD, better GF decides
    m = [(1, 2, 1, 1), (1, 3, 4, 3), (2, 3, 2, 1), (3, 4, 0, 0)]
    rows, un = algo.rank_group([1, 2, 3, 4], m)
    assert not un
    # fully level → needs admin decision, then the decision is applied
    m = [(1, 2, 1, 1)]
    rows, un = algo.rank_group([1, 2], m)
    assert un == [[1, 2]] and rows[0]["tb"] == "UNRESOLVED"
    rows, un = algo.rank_group([1, 2], m, {algo.signature([1, 2]): [2, 1]})
    assert [r["team"] for r in rows] == [2, 1] and rows[0]["tb"] == "ADMIN" and not un


def test_three_plus_teams_ignore_head_to_head():
    # 3 teams level on points: 1>2, 2>3, 3>1 (a cycle) → decided by GD (never H2H)
    m = [(1, 2, 1, 0), (2, 3, 2, 0), (3, 1, 3, 1)]
    rows, un = algo.rank_group([1, 2, 3], m)
    assert [r["team"] for r in rows] == [2, 3, 1] and not un and {r["tb"] for r in rows} == {"GD"}
    # H2H would put 1 above 2, GD puts 2 above 1 → proves H2H isn't used for 3+
    # all level → unresolved set of three; a stale decision (different set) is ignored
    m = [(1, 2, 1, 0), (2, 3, 1, 0), (3, 1, 1, 0)]
    rows, un = algo.rank_group([1, 2, 3], m)
    assert un == [[1, 2, 3]]
    rows, un = algo.rank_group([1, 2, 3], m, {algo.signature([1, 2]): [2, 1]})
    assert un == [[1, 2, 3]]


def test_qualification_blocking():
    m = [(1, 2, 1, 1)]
    rows, un = algo.rank_group([1, 2], m)
    assert algo.group_status(rows, un, 1, True)["state"] == "NEEDS ADMIN DECISION"      # tie on the qualification line
    assert algo.group_status(rows, un, 2, True)["state"] == "FINAL"                      # both qualify → tie is irrelevant
    assert algo.group_status(rows, un, 1, False)["state"] == "PENDING"
    m = [(1, 2, 1, 0), (1, 3, 0, 0), (2, 3, 0, 0)]
    rows, un = algo.rank_group([1, 2, 3], m)
    st = algo.group_status(rows, un, 1, True)
    assert st["state"] == "FINAL" and st["qualified"] == [1]


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("ALGO OK")
