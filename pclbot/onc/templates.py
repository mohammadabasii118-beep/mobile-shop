"""Graphic templates: default configs, template sets and templates (CRUD)."""
import copy
import json
import os

from .. import config
from . import dbx

TYPES = ["SCHEDULE", "GROUP_TABLE", "ROUND_RESULTS", "QUALIFIED", "KO_MATCHES", "BRACKET", "CHAMPION"]
TYPE_LABEL = {"SCHEDULE": "MATCH SCHEDULE", "GROUP_TABLE": "GROUP TABLE", "ROUND_RESULTS": "ROUND RESULTS",
              "QUALIFIED": "QUALIFIED TEAMS", "KO_MATCHES": "KNOCKOUT MATCHES", "BRACKET": "KNOCKOUT BRACKET", "CHAMPION": "CHAMPION POSTER"}

THEMES = {
    "RED": {"bg1": "#1a0509", "bg2": "#5a0f1c", "accent": "#ff3b4e", "panel": "#ffffff14", "gold": "#ffd24a"},
    "BLUE": {"bg1": "#050d1f", "bg2": "#0f3a7a", "accent": "#3b9bff", "panel": "#ffffff14", "gold": "#ffd24a"},
    "GOLD": {"bg1": "#140f02", "bg2": "#5c4408", "accent": "#ffc933", "panel": "#ffffff14", "gold": "#fff0b0"},
}
COLORS = ["#ffffff", "#ffd24a", "#ff3b4e", "#3b9bff", "#45e08a", "#111111", "#b8c0cc"]
ALIGNS = ["left", "center", "right"]
FONT_CANDIDATES = [
    ("DejaVu Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ("Liberation Bold", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
    ("Serif Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"),
    ("Mono Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"),
]


def fonts() -> list[tuple[str, str]]:
    env = os.getenv("ONC_FONT")
    out = [("Custom", env)] if env and os.path.exists(env) else []
    return out + [(n, p) for n, p in FONT_CANDIDATES if os.path.exists(p)]


def _el(x, y, size, color="#ffffff", align="center", max_w=900, min_=24, font=0, text=None):
    d = {"x": x, "y": y, "size": size, "min": min_, "color": color, "align": align, "max_w": max_w, "font": font}
    if text is not None:
        d["text"] = text
    return d


def default_config(type_: str, theme: str = "RED") -> dict:
    th = THEMES[theme]
    cfg: dict = {"w": 1080, "h": 1350, "theme": th, "elements": {}, "cols": {}}
    el = cfg["elements"]
    gold = th["gold"]
    el["brand"] = _el(540, 95, 58, "#ffffff", text="ONE NIGHT CHAMPION", max_w=960, min_=30)
    if type_ == "SCHEDULE":
        el["title"] = _el(540, 185, 44, gold, text="MATCH SCHEDULE")
        el["subtitle"] = _el(540, 245, 30, "#b8c0cc", min_=18)
        el["page"] = _el(540, 1300, 26, "#b8c0cc", min_=16)
        cfg["rows"] = {"start_y": 330, "row_h": 78, "gap": 10, "max_rows": 10}
        cfg["cols"] = {"slot": _el(90, 0, 40, gold, "left", 900), "match": _el(540, 0, 36, "#ffffff", "center", 900, 20)}
    elif type_ == "GROUP_TABLE":
        el["title"] = _el(540, 185, 52, gold, text="GROUP TABLE")
        el["subtitle"] = _el(540, 250, 36, "#ffffff", min_=20)
        el["page"] = _el(540, 1300, 26, "#b8c0cc", min_=16)
        cfg["rows"] = {"start_y": 400, "row_h": 84, "gap": 10, "max_rows": 9}
        cfg["header_y"] = 340
        cfg["show"] = ["pos", "team", "P", "W", "D", "L", "GF", "GA", "GD", "PTS"]
        cfg["cols"] = {
            "pos": _el(70, 0, 34, gold, "center", 70, 20), "team": _el(125, 0, 36, "#ffffff", "left", 330, 18),
            "P": _el(520, 0, 32, "#ffffff", "center", 70, 20), "W": _el(595, 0, 32, "#ffffff", "center", 70, 20),
            "D": _el(670, 0, 32, "#ffffff", "center", 70, 20), "L": _el(745, 0, 32, "#ffffff", "center", 70, 20),
            "GF": _el(820, 0, 32, "#ffffff", "center", 70, 20), "GA": _el(895, 0, 32, "#ffffff", "center", 70, 20),
            "GD": _el(970, 0, 32, "#ffffff", "center", 80, 20), "PTS": _el(1035, 0, 36, gold, "center", 80, 20)}
    elif type_ == "ROUND_RESULTS":
        el["title"] = _el(540, 195, 60, gold, text="RESULTS")
        el["subtitle"] = _el(540, 265, 40, "#ffffff", min_=20)
        el["page"] = _el(540, 1300, 26, "#b8c0cc", min_=16)
        cfg["rows"] = {"start_y": 360, "row_h": 92, "gap": 14, "max_rows": 8}
        cfg["cols"] = {"a": _el(80, 0, 40, "#ffffff", "left", 380, 20), "score": _el(540, 0, 46, gold, "center", 200, 30),
                       "b": _el(1000, 0, 40, "#ffffff", "right", 380, 20)}
    elif type_ == "QUALIFIED":
        el["title"] = _el(540, 195, 56, gold, text="QUALIFIED TEAMS")
        el["subtitle"] = _el(540, 262, 32, "#b8c0cc", min_=18)
        el["page"] = _el(540, 1300, 26, "#b8c0cc", min_=16)
        cfg["rows"] = {"start_y": 350, "row_h": 80, "gap": 10, "max_rows": 10}
        cfg["cols"] = {"group": _el(90, 0, 32, gold, "left", 260, 18), "pos": _el(420, 0, 34, "#ffffff", "center", 70, 20),
                       "team": _el(480, 0, 40, "#ffffff", "left", 520, 20)}
    elif type_ == "KO_MATCHES":
        el["title"] = _el(540, 195, 56, gold, text="KNOCKOUT")
        el["subtitle"] = _el(540, 265, 42, "#ffffff", min_=20)
        el["page"] = _el(540, 1300, 26, "#b8c0cc", min_=16)
        cfg["rows"] = {"start_y": 360, "row_h": 100, "gap": 16, "max_rows": 7}
        cfg["cols"] = {"a": _el(80, 0, 42, "#ffffff", "left", 380, 20), "score": _el(540, 0, 44, gold, "center", 200, 28),
                       "b": _el(1000, 0, 42, "#ffffff", "right", 380, 20)}
    elif type_ == "BRACKET":
        cfg["w"], cfg["h"] = 1920, 1080
        el["brand"] = _el(960, 70, 56, "#ffffff", text="ONE NIGHT CHAMPION", max_w=1500, min_=30)
        el["title"] = _el(960, 140, 40, gold, text="KNOCKOUT BRACKET")
        el["stage"] = _el(0, 0, 30, gold, "center", 380, 18)
        el["team"] = _el(0, 0, 30, "#ffffff", "left", 330, 16)
        cfg["bracket"] = {"top": 200, "bottom": 1020, "left": 60, "right": 1860}
    elif type_ == "CHAMPION":
        el["brand"] = _el(540, 120, 62, "#ffffff", text="ONE NIGHT CHAMPION", max_w=960, min_=30)
        el["title"] = _el(540, 260, 76, gold, text="CHAMPION")
        el["logo"] = {"x": 540, "y": 620, "size": 420}
        el["team"] = _el(540, 960, 96, "#ffffff", max_w=960, min_=40)
        el["subtitle"] = _el(540, 1100, 36, "#b8c0cc", min_=20)
    return cfg


def bg_dir() -> str:
    os.makedirs(config.ONC_ASSETS_DIR, exist_ok=True)
    return config.ONC_ASSETS_DIR


# ----------------------------------------------------------------- sets / templates
async def ensure_defaults() -> None:
    if await dbx.scalar("SELECT COUNT(*) FROM onc_template_sets"):
        return
    async with dbx.tx():
        sid = await dbx.execute("INSERT INTO onc_template_sets(name,is_active) VALUES('ONE NIGHT CHAMPION — RED',1)")
        for t in TYPES:
            await dbx.execute("INSERT INTO onc_templates(set_id,type,name,config,active) VALUES(?,?,?,?,1)",
                              sid, t, TYPE_LABEL[t], json.dumps(default_config(t, "RED")))


async def sets() -> list[dict]:
    return await dbx.fetchall("SELECT * FROM onc_template_sets ORDER BY id")


async def get_set(sid: int) -> dict | None:
    return await dbx.fetchone("SELECT * FROM onc_template_sets WHERE id=?", sid)


async def active_set() -> dict | None:
    return await dbx.fetchone("SELECT * FROM onc_template_sets WHERE is_active=1")


async def templates_of(sid: int) -> list[dict]:
    rows = await dbx.fetchall("SELECT * FROM onc_templates WHERE set_id=? ORDER BY id", sid)
    for r in rows:
        r["config"] = json.loads(r["config"])
    return rows


async def get_template(tid: int) -> dict | None:
    r = await dbx.fetchone("SELECT * FROM onc_templates WHERE id=?", tid)
    if r:
        r["config"] = json.loads(r["config"])
    return r


async def active_template(type_: str) -> dict | None:
    """The active template of this type in the active set (falls back to the built-in default at render time)."""
    r = await dbx.fetchone(
        "SELECT t.* FROM onc_templates t JOIN onc_template_sets s ON s.id=t.set_id "
        "WHERE s.is_active=1 AND t.type=? AND t.active=1 ORDER BY t.id LIMIT 1", type_)
    if r:
        r["config"] = json.loads(r["config"])
    return r


async def missing_types() -> list[str]:
    out = []
    for t in TYPES:
        if not await active_template(t):
            out.append(TYPE_LABEL[t])
    return out


async def create_set(name: str, theme: str = "RED") -> int:
    async with dbx.tx():
        sid = await dbx.execute("INSERT INTO onc_template_sets(name) VALUES(?)", name[:50])
        for t in TYPES:
            await dbx.execute("INSERT INTO onc_templates(set_id,type,name,config,active) VALUES(?,?,?,?,1)",
                              sid, t, TYPE_LABEL[t], json.dumps(default_config(t, theme)))
    return sid


async def duplicate_set(sid: int) -> int:
    s = await get_set(sid)
    async with dbx.tx():
        new = await dbx.execute("INSERT INTO onc_template_sets(name) VALUES(?)", f"{s['name']} (copy)"[:50])
        for t in await templates_of(sid):
            await dbx.execute("INSERT INTO onc_templates(set_id,type,name,bg_path,config,active) VALUES(?,?,?,?,?,?)",
                              new, t["type"], t["name"], t["bg_path"], json.dumps(t["config"]), t["active"])
    return new


async def rename_set(sid: int, name: str) -> None:
    await dbx.execute("UPDATE onc_template_sets SET name=? WHERE id=?", name[:50], sid)


async def activate_set(sid: int) -> None:
    async with dbx.tx():
        await dbx.execute("UPDATE onc_template_sets SET is_active=0")
        await dbx.execute("UPDATE onc_template_sets SET is_active=1 WHERE id=?", sid)


async def delete_set(sid: int) -> None:
    s = await get_set(sid)
    if s["is_active"]:
        raise ValueError("Activate another set first.")
    await dbx.execute("DELETE FROM onc_template_sets WHERE id=?", sid)


async def add_template(sid: int, type_: str, theme: str = "RED") -> int:
    n = await dbx.scalar("SELECT COUNT(*) FROM onc_templates WHERE set_id=? AND type=?", sid, type_)
    return await dbx.execute("INSERT INTO onc_templates(set_id,type,name,config,active) VALUES(?,?,?,?,0)",
                             sid, type_, f"{TYPE_LABEL[type_]} #{n + 1}", json.dumps(default_config(type_, theme)))


async def duplicate_template(tid: int) -> int:
    t = await get_template(tid)
    return await dbx.execute("INSERT INTO onc_templates(set_id,type,name,bg_path,config,active) VALUES(?,?,?,?,?,0)",
                             t["set_id"], t["type"], f"{t['name']} (copy)"[:50], t["bg_path"], json.dumps(t["config"]))


async def set_active_flag(tid: int, on: bool) -> None:
    t = await get_template(tid)
    async with dbx.tx():
        if on:  # one active template per type inside a set
            await dbx.execute("UPDATE onc_templates SET active=0 WHERE set_id=? AND type=?", t["set_id"], t["type"])
        await dbx.execute("UPDATE onc_templates SET active=? WHERE id=?", 1 if on else 0, tid)


async def delete_template(tid: int) -> None:
    await dbx.execute("DELETE FROM onc_templates WHERE id=?", tid)


async def save_config(tid: int, cfg: dict) -> None:
    await dbx.execute("UPDATE onc_templates SET config=? WHERE id=?", json.dumps(cfg), tid)


async def set_bg(tid: int, path: str | None) -> None:
    await dbx.execute("UPDATE onc_templates SET bg_path=? WHERE id=?", path, tid)


# ----------------------------------------------------------------- editor operations (pure on a config dict)
def items(cfg: dict) -> list[str]:
    """Editable items in a stable order: static elements, then row columns, then the rows block."""
    out = [k for k in cfg["elements"]]
    out += [f"col:{k}" for k in cfg.get("cols", {})]
    if "rows" in cfg:
        out.append("rows")
    if "bracket" in cfg:
        pass
    return out


def item_style(cfg: dict, name: str) -> dict:
    if name == "rows":
        return cfg["rows"]
    if name.startswith("col:"):
        return cfg["cols"][name[4:]]
    return cfg["elements"][name]


def apply_op(cfg: dict, name: str, op: str, step: int) -> dict:
    """op: u d l r (move) · fs+ fs- · w+ w- · col · al · font · show:<col> (toggle a table column)."""
    cfg = copy.deepcopy(cfg)
    st = item_style(cfg, name)
    if name == "rows":
        if op == "u": st["start_y"] -= step
        elif op == "d": st["start_y"] += step
        elif op in ("l", "r"):
            for c in cfg["cols"].values():
                c["x"] += -step if op == "l" else step
        elif op == "fs+": st["row_h"] += step
        elif op == "fs-": st["row_h"] = max(30, st["row_h"] - step)
        elif op == "w+": st["max_rows"] += 1
        elif op == "w-": st["max_rows"] = max(1, st["max_rows"] - 1)
        return cfg
    if op == "u": st["y"] = st.get("y", 0) - step
    elif op == "d": st["y"] = st.get("y", 0) + step
    elif op == "l": st["x"] -= step
    elif op == "r": st["x"] += step
    elif op == "fs+": st["size"] += step
    elif op == "fs-": st["size"] = max(st.get("min", 10), st["size"] - step)
    elif op == "w+": st["max_w"] = st.get("max_w", 400) + step * 4
    elif op == "w-": st["max_w"] = max(40, st.get("max_w", 400) - step * 4)
    elif op == "col" and "color" in st:
        st["color"] = COLORS[(COLORS.index(st["color"]) + 1) % len(COLORS)] if st["color"] in COLORS else COLORS[0]
    elif op == "al" and "align" in st:
        st["align"] = ALIGNS[(ALIGNS.index(st["align"]) + 1) % 3]
    elif op == "font" and "font" in st:
        st["font"] = (st["font"] + 1) % max(1, len(fonts()))
    return cfg
