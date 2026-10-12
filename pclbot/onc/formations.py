"""Tactical systems of TEAM OF THE TOURNAMENT: exact slot positions on the pitch (x: 0 = left … 1 = right, y: 0 = attack end … 1 = own goal).

Slots are listed in the order the admin is asked for the players: goalkeeper, defenders, midfielders, attackers (left → right).
"""
GK_, DEF_, MID_, ATT_ = 0, 1, 2, 3
POS_FA = {"GK": "دروازه‌بان", "LCB": "مدافع چپ", "CB": "مدافع میانی", "RCB": "مدافع راست", "LB": "مدافع چپ", "RB": "مدافع راست",
          "LM": "هافبک چپ", "CM": "هافبک میانی", "CDM": "هافبک دفاعی", "CAM": "هافبک هجومی", "RM": "هافبک راست",
          "LW": "وینگر چپ", "RW": "وینگر راست", "ST": "مهاجم"}


def _s(code, x, y, line):
    return {"pos": code, "x": x, "y": y, "line": line}


FORMATIONS: dict[str, list[dict]] = {
    "3-5-2": [_s("GK", .5, .93, GK_),
              _s("LCB", .22, .67, DEF_), _s("CB", .5, .71, DEF_), _s("RCB", .78, .67, DEF_),
              _s("LM", .07, .40, MID_), _s("CM", .285, .43, MID_), _s("CDM", .5, .49, MID_), _s("CM", .715, .43, MID_), _s("RM", .93, .40, MID_),
              _s("ST", .35, .11, ATT_), _s("ST", .65, .11, ATT_)],
    "3-4-3": [_s("GK", .5, .93, GK_),
              _s("LCB", .22, .67, DEF_), _s("CB", .5, .71, DEF_), _s("RCB", .78, .67, DEF_),
              _s("LM", .1, .42, MID_), _s("CM", .37, .45, MID_), _s("CM", .63, .45, MID_), _s("RM", .9, .42, MID_),
              _s("LW", .15, .13, ATT_), _s("ST", .5, .09, ATT_), _s("RW", .85, .13, ATT_)],
    "4-3-3": [_s("GK", .5, .93, GK_),
              _s("LB", .1, .67, DEF_), _s("CB", .36, .71, DEF_), _s("CB", .64, .71, DEF_), _s("RB", .9, .67, DEF_),
              _s("CM", .24, .42, MID_), _s("CDM", .5, .49, MID_), _s("CM", .76, .42, MID_),
              _s("LW", .15, .13, ATT_), _s("ST", .5, .09, ATT_), _s("RW", .85, .13, ATT_)],
}
ORDER = list(FORMATIONS)


def counts(name: str) -> dict[int, int]:
    out = {GK_: 0, DEF_: 0, MID_: 0, ATT_: 0}
    for s in FORMATIONS[name]:
        out[s["line"]] += 1
    return out


def sample_players(name: str = "4-3-3") -> list[dict]:
    return [{"name": f"Player_{i + 1}", "position": s["pos"], "team": ["تاج", "آزادی", "لگسی", "آریا"][i % 4], "x": s["x"], "y": s["y"]} for i, s in enumerate(FORMATIONS[name])]
