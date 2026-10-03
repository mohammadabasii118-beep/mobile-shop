"""Graphic templates: default configs, template sets and templates (CRUD)."""
import copy
import json
import os

from .. import config
from . import dbx

TYPES = ["SCHEDULE", "GROUP_TABLE", "ROUND_RESULTS", "QUALIFIED", "KO_MATCHES", "BRACKET", "CHAMPION"]
TYPE_LABEL = {"SCHEDULE": "برنامه بازی‌ها", "GROUP_TABLE": "جدول گروه", "ROUND_RESULTS": "نتایج راند",
              "QUALIFIED": "تیم‌های صعودکننده", "KO_MATCHES": "بازی‌های حذفی", "BRACKET": "جدول مرحله حذفی", "CHAMPION": "پوستر قهرمان"}
THEME_FA = {"RED": "قرمز", "BLUE": "آبی", "GOLD": "طلایی"}
ELEMENT_FA = {"pcl_logo": "لوگوی PCL", "eyebrow": "برچسب انگلیسی", "footer": "فوتر", "brand": "نام رویداد", "title": "عنوان", "subtitle": "زیرعنوان", "page": "شماره صفحه", "logo": "لوگو", "team": "نام تیم",
              "stage": "نام مرحله", "rows": "ردیف‌ها", "col:slot": "ساعت و راند", "col:match": "ردیف بازی", "col:a": "تیم اول", "col:b": "تیم دوم",
              "col:score": "نتیجه", "col:group": "گروه", "col:pos": "رتبه", "col:team": "نام تیم", "col:P": "بازی", "col:W": "برد", "col:D": "مساوی",
              "col:L": "باخت", "col:GF": "گل زده", "col:GA": "گل خورده", "col:GD": "تفاضل", "col:PTS": "امتیاز"}

THEMES = {
    "RED": {"bg1": "#1a0509", "bg2": "#5a0f1c", "accent": "#ff3b4e", "panel": "#ffffff14", "gold": "#ffd24a"},
    "BLUE": {"bg1": "#050d1f", "bg2": "#0f3a7a", "accent": "#3b9bff", "panel": "#ffffff14", "gold": "#ffd24a"},
    "GOLD": {"bg1": "#140f02", "bg2": "#5c4408", "accent": "#ffc933", "panel": "#ffffff14", "gold": "#fff0b0"},
}
COLORS = ["#ffffff", "#ffd24a", "#ff3b4e", "#3b9bff", "#45e08a", "#111111", "#b8c0cc"]
ALIGNS = ["left", "center", "right"]
FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
# indexes are part of the template format (`font` in every style): keep the order
FONT_FILES = [("Vazirmatn Black", "Vazirmatn-Black.ttf"), ("Vazirmatn ExtraBold", "Vazirmatn-ExtraBold.ttf"),
              ("Vazirmatn Bold", "Vazirmatn-Bold.ttf"), ("Vazirmatn Medium", "Vazirmatn-Medium.ttf"),
              ("Oswald Bold", "Oswald_700Bold.ttf"), ("Oswald SemiBold", "Oswald_600SemiBold.ttf"), ("Oswald Medium", "Oswald_500Medium.ttf")]
F_BLACK, F_XBOLD, F_BOLD, F_MED, O_BOLD, O_SEMI, O_MED = range(7)
SYSTEM_FALLBACK = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]
DESIGN_VERSION = 2


def fonts() -> list[tuple[str, str]]:
    """Bundled professional fonts first (stable indexes); a custom ONC_FONT is appended at the end."""
    out = []
    fallback = next((p for p in SYSTEM_FALLBACK if os.path.exists(p)), None)
    for name, fn in FONT_FILES:
        path = os.path.join(FONT_DIR, fn)
        out.append((name, path if os.path.exists(path) else fallback))
    env = os.getenv("ONC_FONT")
    if env and os.path.exists(env):
        out.append(("Custom", env))
    return [(n, p) for n, p in out if p]


def _el(x, y, size, color="#ffffff", align="center", max_w=900, min_=24, font=F_BOLD, text=None, track=0):
    d = {"x": x, "y": y, "size": size, "min": min_, "color": color, "align": align, "max_w": max_w, "font": font}
    if text is not None:
        d["text"] = text
    if track:
        d["track"] = track
    return d


EYEBROW = {"SCHEDULE": "MATCH SCHEDULE", "GROUP_TABLE": "GROUP STAGE", "ROUND_RESULTS": "ROUND RESULTS", "QUALIFIED": "QUALIFIED TEAMS",
           "KO_MATCHES": "KNOCKOUT", "BRACKET": "KNOCKOUT BRACKET", "CHAMPION": "CHAMPION"}
TITLE_FA = {"SCHEDULE": "برنامه بازی‌ها", "GROUP_TABLE": "GROUP STANDINGS", "ROUND_RESULTS": "نتایج", "QUALIFIED": "تیم‌های صعودکننده",
            "KO_MATCHES": "مرحله حذفی", "BRACKET": "جدول مرحله حذفی", "CHAMPION": "قهرمان"}


def default_config(type_: str, theme: str = "RED") -> dict:
    """Design v2 — one visual identity for all seven graphics (header with PCL logo slot, title tag, glass rows, footer)."""
    th = THEMES[theme]
    gold, grey = th["gold"], "#b9c0cc"
    cfg: dict = {"v": DESIGN_VERSION, "w": 1080, "h": 1350, "theme": th, "elements": {}, "cols": {}}
    el = cfg["elements"]
    wide = type_ == "BRACKET"
    if wide:
        cfg["w"], cfg["h"] = 1920, 1080
    # ---- shared header / footer (same on every graphic; PCL logo slot top-left) -----------------------------------
    el["pcl_logo"] = {"x": 122, "y": 112, "size": 132} if not wide else {"x": 112, "y": 96, "size": 112}
    bx = 214 if not wide else 190
    el["brand"] = _el(bx, 92 if not wide else 72, 56 if not wide else 52, "#ffffff", "left", 800, 30, O_BOLD, "ONE NIGHT CHAMPION", track=3)
    el["eyebrow"] = _el(bx, 150 if not wide else 124, 27, gold, "left", 700, 16, O_SEMI, EYEBROW[type_], track=6)
    el["title"] = _el(540 if not wide else 1860, 268 if not wide else 96, 76 if not wide else 58, "#ffffff", "center" if not wide else "right",
                      940, 36, F_BLACK, TITLE_FA[type_])
    el["subtitle"] = _el(540, 350, 34, gold, "center", 940, 20, F_MED)
    el["page"] = _el(1024, 1312, 26, grey, "right", 300, 16, F_MED)
    el["footer"] = _el(56 if not wide else 60, 1312 if not wide else 1046, 26, grey, "left", 700, 16, O_MED, "@Onenightchampion", track=2)
    if wide:
        el.pop("subtitle")
        el["page"] = _el(1860, 1046, 26, grey, "right", 300, 16, F_MED)
    # ---- per type ---------------------------------------------------------------------------------------------------
    c = lambda x, size, color="#ffffff", align="center", mw=100, font=O_MED, mn=18: _el(x, 0, size, color, align, mw, mn, font)
    if type_ == "SCHEDULE":
        cfg["rows"] = {"start_y": 438, "row_h": 78, "gap": 10, "max_rows": 9}
        cfg["cols"] = {"slot": c(60, 44, gold, "left", 420, O_BOLD, 28), "match": c(540, 36, "#ffffff", "center", 420, F_BOLD, 20)}
    elif type_ == "GROUP_TABLE":
        cfg["rows"] = {"start_y": 492, "row_h": 84, "gap": 10, "max_rows": 8}
        cfg["header_y"] = 452
        cfg["show"] = ["pos", "team", "P", "W", "D", "L", "GF", "GA", "GD", "PTS"]
        st = lambda x, mw=60: c(x, 34, "#ffffff", "center", mw, O_SEMI, 20)
        cfg["cols"] = {"pos": c(100, 36, "#ffffff", "center", 60, O_BOLD, 22), "team": c(156, 36, "#ffffff", "left", 350, F_BOLD, 18),
                       "P": st(548), "W": st(610), "D": st(672), "L": st(734), "GF": st(798), "GA": st(862), "GD": st(926),
                       "PTS": c(996, 40, "#14080c", "center", 80, O_BOLD, 24)}
    elif type_ == "ROUND_RESULTS":
        cfg["rows"] = {"start_y": 438, "row_h": 100, "gap": 14, "max_rows": 7}
        cfg["cols"] = {"a": c(100, 40, "#ffffff", "left", 330, F_BOLD, 20), "score": c(540, 54, gold, "center", 200, O_BOLD, 30),
                       "b": c(980, 40, "#ffffff", "right", 330, F_BOLD, 20)}
    elif type_ == "QUALIFIED":
        cfg["rows"] = {"start_y": 438, "row_h": 84, "gap": 10, "max_rows": 9}
        cfg["cols"] = {"group": c(92, 30, gold, "left", 240, F_XBOLD, 18), "pos": c(370, 40, "#ffffff", "center", 70, O_BOLD, 24),
                       "team": c(430, 40, "#ffffff", "left", 540, F_BOLD, 20)}
    elif type_ == "KO_MATCHES":
        cfg["rows"] = {"start_y": 438, "row_h": 112, "gap": 16, "max_rows": 6}
        cfg["cols"] = {"a": c(100, 42, "#ffffff", "left", 330, F_BOLD, 20), "score": c(540, 54, gold, "center", 200, O_BOLD, 30),
                       "b": c(980, 42, "#ffffff", "right", 330, F_BOLD, 20)}
    elif type_ == "BRACKET":
        el["stage"] = _el(0, 0, 30, gold, "center", 400, 18, F_XBOLD)
        el["team"] = _el(0, 0, 30, "#ffffff", "left", 330, 16, F_BOLD)
        cfg["bracket"] = {"top": 230, "bottom": 1010, "left": 60, "right": 1860}
    elif type_ == "CHAMPION":
        el["subtitle"]["y"] = 1176
        el["title"] = _el(540, 330, 110, gold, "center", 940, 50, F_BLACK, "قهرمان")
        el["logo"] = {"x": 540, "y": 700, "size": 440}
        el["team"] = _el(540, 1050, 104, "#ffffff", "center", 960, 44, F_BLACK)
    return cfg


def upgrade_text(old: dict, new: dict) -> dict:
    return new


def bg_dir() -> str:
    os.makedirs(config.ONC_ASSETS_DIR, exist_ok=True)
    return config.ONC_ASSETS_DIR


# ----------------------------------------------------------------- sets / templates
async def ensure_defaults() -> None:
    if await dbx.scalar("SELECT COUNT(*) FROM onc_template_sets"):
        return
    async with dbx.tx():
        sid = await dbx.execute("INSERT INTO onc_template_sets(name,is_active) VALUES('وان نایت چمپیون — قرمز',1)")
        for t in TYPES:
            await dbx.execute("INSERT INTO onc_templates(set_id,type,name,config,active) VALUES(?,?,?,?,1)",
                              sid, t, TYPE_LABEL[t], json.dumps(default_config(t, "RED")))


async def upgrade_designs() -> int:
    """One-time move of built-in/older templates to design v2 (positions of v1 don't fit the new layout).
    Uploaded backgrounds, names and active flags are kept."""
    n = 0
    async with dbx.tx():
        for r in await dbx.fetchall("SELECT * FROM onc_templates"):
            cfg = json.loads(r["config"])
            if cfg.get("v") == DESIGN_VERSION:
                continue
            theme = next((k for k, v in THEMES.items() if v["bg1"] == cfg.get("theme", {}).get("bg1")), "RED")
            await dbx.execute("UPDATE onc_templates SET config=? WHERE id=?", json.dumps(default_config(r["type"], theme)), r["id"])
            n += 1
    return n


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
        new = await dbx.execute("INSERT INTO onc_template_sets(name) VALUES(?)", f"{s['name']} (کپی)"[:50])
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
                             t["set_id"], t["type"], f"{t['name']} (کپی)"[:50], t["bg_path"], json.dumps(t["config"]))


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
