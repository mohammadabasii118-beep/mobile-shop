"""Pillow renderer for ONC graphics. Template-driven: dynamic rows, pagination, auto-fit text.

Team logos are only ever drawn by the CHAMPION template — no other graphic reads a logo.
"""
import io
import os
import re

from PIL import Image, ImageDraw, ImageFont

from . import templates

try:  # Persian / Arabic team names need shaping; optional dependency
    import arabic_reshaper
    from bidi.algorithm import get_display
except Exception:  # pragma: no cover
    arabic_reshaper = get_display = None

_RTL = re.compile(r"[؀-ۿ]")
_font_cache: dict = {}


def shape(text: str) -> str:
    if get_display and _RTL.search(text or ""):
        return get_display(arabic_reshaper.reshape(text))
    return text


def font_at(idx: int, size: int):
    fl = templates.fonts()
    path = fl[idx % len(fl)][1] if fl else None
    key = (path, size)
    if key not in _font_cache:
        try:
            _font_cache[key] = ImageFont.truetype(path, size) if path else ImageFont.load_default(size)
        except Exception:
            _font_cache[key] = ImageFont.load_default(size)
    return _font_cache[key]


def hex_rgba(c: str):
    c = c.lstrip("#")
    if len(c) == 6:
        c += "ff"
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4, 6))


def fit(d: ImageDraw.ImageDraw, text: str, st: dict, size: int | None = None):
    """Largest font ≤ size that fits max_w (down to `min`); if even `min` is too wide the text is ellipsized."""
    size = size or st["size"]
    lo = min(st.get("min", 12), size)
    s = size
    while s > lo and d.textlength(text, font=font_at(st.get("font", 0), s)) > st.get("max_w", 10_000):
        s -= 1
    f = font_at(st.get("font", 0), s)
    if d.textlength(text, font=f) > st.get("max_w", 10_000):
        while len(text) > 1 and d.textlength(text + "…", font=f) > st["max_w"]:
            text = text[:-1]
        text += "…"
    return text, f


def put(d, text: str, st: dict, y: float, size: int | None = None, color: str | None = None, dx: float = 0):
    text = shape(str(text))
    text, f = fit(d, text, st, size)
    anchor = {"left": "lm", "center": "mm", "right": "rm"}[st.get("align", "center")]
    d.text((st["x"] + dx, y), text, font=f, fill=hex_rgba(color or st["color"]), anchor=anchor)


def background(cfg: dict, bg_path: str | None) -> Image.Image:
    w, h = cfg["w"], cfg["h"]
    if bg_path and os.path.exists(bg_path):
        try:
            im = Image.open(bg_path).convert("RGB")
            r = max(w / im.width, h / im.height)  # cover
            im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1))
            l, t = (im.width - w) // 2, (im.height - h) // 2
            return im.crop((l, t, l + w, t + h)).convert("RGBA")
        except Exception:
            pass
    th = cfg["theme"]
    c1, c2 = hex_rgba(th["bg1"]), hex_rgba(th["bg2"])
    im = Image.new("RGBA", (w, h))
    px = ImageDraw.Draw(im)
    for y in range(h):  # vertical gradient
        t = y / (h - 1)
        px.line([(0, y), (w, y)], fill=tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4)))
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    ac = hex_rgba(th["accent"])
    od.rectangle([0, 0, w, 14], fill=ac)
    od.rectangle([0, h - 14, w, h], fill=ac)
    od.polygon([(w, 0), (w, int(h * .32)), (int(w * .62), 0)], fill=ac[:3] + (38,))
    od.polygon([(0, h), (0, int(h * .7)), (int(w * .4), h)], fill=ac[:3] + (30,))
    return Image.alpha_composite(im, ov)


def _chunks(rows: list, per: int, sticky_kind: str | None = None) -> list[list]:
    pages, cur = [], []
    for r in rows:
        if len(cur) >= per:
            if sticky_kind and cur[-1].get("kind") == sticky_kind:  # never leave a slot header alone at the page bottom
                head = cur.pop()
                pages.append(cur); cur = [head]
            else:
                pages.append(cur); cur = []
        cur.append(r)
    if cur:
        pages.append(cur)
    return pages or [[]]


def _to_png(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.convert("RGB").save(buf, "PNG", optimize=True)
    return buf.getvalue()


def _static(d, cfg, data, page_i, pages_n):
    for name, st in cfg["elements"].items():
        if name in ("logo", "team", "stage") or name == "page":
            continue
        text = data.get(name, st.get("text"))
        if text:
            put(d, text, st, st["y"])
    if pages_n > 1 and "page" in cfg["elements"]:
        put(d, f"PAGE {page_i}/{pages_n}", cfg["elements"]["page"], cfg["elements"]["page"]["y"])


def _panel(im, cfg, y, h, x0=40, x1=None, fill=None):
    x1 = x1 or cfg["w"] - 40
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rounded_rectangle([x0, y, x1, y + h], radius=18, fill=hex_rgba(fill or cfg["theme"]["panel"]))
    return Image.alpha_composite(im, ov)


def render_rows(type_: str, cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    rows_cfg = cfg["rows"]
    rows = data["rows"]
    pages = _chunks(rows, rows_cfg["max_rows"], "slot" if type_ == "SCHEDULE" else None)
    out = []
    for pi, chunk in enumerate(pages, 1):
        im = background(cfg, bg_path)
        d = ImageDraw.Draw(im)
        _static(d, cfg, data, pi, len(pages))
        y0, rh, gap = rows_cfg["start_y"], rows_cfg["row_h"], rows_cfg["gap"]
        if type_ == "GROUP_TABLE":  # header line
            hdr = {"pos": "#", "team": "TEAM"}
            for key in cfg["show"]:
                c = cfg["cols"][key]
                put(d, hdr.get(key, key), c, cfg.get("header_y", y0 - 60), size=max(c["size"] - 8, 14), color="#b8c0cc")
        for i, row in enumerate(chunk):
            top = y0 + i * (rh + gap)
            mid = top + rh / 2
            kind = row.get("kind", "row")
            if kind != "slot":
                im = _panel(im, cfg, top, rh)
                d = ImageDraw.Draw(im)
            if type_ == "SCHEDULE":
                c = cfg["cols"]["slot" if kind == "slot" else "match"]
                put(d, row["text"], c, mid + c.get("y", 0))
            elif type_ == "GROUP_TABLE":
                for key in cfg["show"]:
                    c = cfg["cols"][key]
                    put(d, row[key], c, mid + c.get("y", 0))
            else:
                for key, val in zip(list(cfg["cols"].keys()), row["cells"]):
                    c = cfg["cols"][key]
                    put(d, val, c, mid + c.get("y", 0))
        out.append(_to_png(im))
    return out


def render_bracket(cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    im = background(cfg, bg_path)
    d = ImageDraw.Draw(im)
    _static(d, cfg, data, 1, 1)
    b = cfg["bracket"]
    stages = data["stages"]
    if not stages:
        put(d, "No knockout stage yet", cfg["elements"]["title"], cfg["h"] / 2)
        return [_to_png(im)]
    n = len(stages)
    col_w = (b["right"] - b["left"]) / n
    box_w = min(col_w - 50, cfg["elements"]["team"]["max_w"] + 30)
    top, bottom = b["top"] + 60, b["bottom"]
    team = cfg["elements"]["team"]
    st_style = cfg["elements"]["stage"]
    centers: list[list[float]] = []
    for si, stg in enumerate(stages):
        x0 = b["left"] + si * col_w + (col_w - box_w) / 2
        cs = []
        ms = stg["matches"]
        for mi, m in enumerate(ms):
            if si == 0 or len(centers[si - 1]) < 2 * len(ms):
                cy = top + (bottom - top) * (mi + .5) / max(len(ms), 1)
            else:  # between its two feeder matches
                cy = (centers[si - 1][2 * mi] + centers[si - 1][2 * mi + 1]) / 2
            cs.append(cy)
        centers.append(cs)
        sx = dict(st_style, x=x0 + box_w / 2)
        put(d, stg["name"], sx, b["top"] + 20)
        for mi, m in enumerate(ms):
            cy = cs[mi]
            h = 86
            im = _panel(im, cfg, cy - h / 2, h, x0, x0 + box_w, "#ffffff22")
            d = ImageDraw.Draw(im)
            for k, (nm, sc, win) in enumerate(((m["a"], m["ga"], m["win"] == "a"), (m["b"], m["gb"], m["win"] == "b"))):
                yy = cy - 21 + k * 42
                ts = dict(team, x=x0 + 14, max_w=box_w - 90, align="left")
                put(d, nm, ts, yy, color=cfg["theme"]["gold"] if win else team["color"])
                if sc is not None:
                    put(d, sc, dict(team, x=x0 + box_w - 14, align="right", max_w=60, min=14), yy, color=cfg["theme"]["gold"])
            if si + 1 < n:  # connector to the next column
                d.line([(x0 + box_w, cy), (x0 + box_w + 25, cy)], fill=hex_rgba(cfg["theme"]["accent"]), width=3)
    return [_to_png(im)]


def render_champion(cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    im = background(cfg, bg_path)
    d = ImageDraw.Draw(im)
    _static(d, cfg, data, 1, 1)
    lg = cfg["elements"]["logo"]
    size = lg["size"]
    cx, cy = lg["x"], lg["y"]
    ring = Image.new("RGBA", im.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    gold = hex_rgba(cfg["theme"]["gold"])
    rd.ellipse([cx - size / 2 - 22, cy - size / 2 - 22, cx + size / 2 + 22, cy + size / 2 + 22], outline=gold, width=10)
    rd.ellipse([cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2], fill=(255, 255, 255, 30))
    im = Image.alpha_composite(im, ring)
    if data.get("logo"):
        try:
            logo = Image.open(io.BytesIO(data["logo"])).convert("RGBA")
            logo.thumbnail((int(size * .92), int(size * .92)))
            mask = Image.new("L", im.size, 0)
            ImageDraw.Draw(mask).ellipse([cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2], fill=255)
            layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
            layer.paste(logo, (int(cx - logo.width / 2), int(cy - logo.height / 2)), logo)
            layer.putalpha(Image.composite(layer.getchannel("A"), Image.new("L", im.size, 0), mask))
            im = Image.alpha_composite(im, layer)
        except Exception:
            pass
    else:  # initials badge when the team has no usable logo
        d = ImageDraw.Draw(im)
        initials = "".join(w[0] for w in re.split(r"\s+", data["team"].strip())[:2]).upper() or "?"
        put(d, initials, {"x": cx, "size": int(size * .42), "min": 20, "color": "#ffffff", "align": "center", "max_w": size * .8, "font": 0}, cy)
    d = ImageDraw.Draw(im)
    put(d, data["team"], cfg["elements"]["team"], cfg["elements"]["team"]["y"])
    return [_to_png(im)]


def render(type_: str, cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    if type_ in ("SCHEDULE", "GROUP_TABLE", "ROUND_RESULTS", "QUALIFIED", "KO_MATCHES"):
        return render_rows(type_, cfg, data, bg_path)
    if type_ == "BRACKET":
        return render_bracket(cfg, data, bg_path)
    if type_ == "CHAMPION":
        return render_champion(cfg, data, bg_path)
    raise ValueError(type_)


# ----------------------------------------------------------------- sample data for template previews
def sample(type_: str) -> dict:
    names = ["TAJ", "AZADI", "LEGACY", "INVADERZ", "ARYA", "HANGOVER", "PERSIAN GULF UNITED", "GRAVITY"]
    if type_ == "SCHEDULE":
        lines = []
        for i, t in enumerate(["20:00", "20:30", "21:00"], 1):
            lines.append({"kind": "slot", "text": f"{t} · ROUND {i}"})
            lines += [{"kind": "match", "text": f"{names[j]} vs {names[j + 1]}"} for j in (0, 2, 4)]
        return {"subtitle": "2026/10/10", "rows": lines}
    if type_ == "GROUP_TABLE":
        rows = [{"pos": i + 1, "team": names[i], "P": 3, "W": 3 - i if i < 3 else 0, "D": 0, "L": i, "GF": 7 - i, "GA": i + 1,
                 "GD": f"+{6 - 2 * i}" if 6 - 2 * i >= 0 else str(6 - 2 * i), "PTS": 9 - 3 * i if i < 3 else 0} for i in range(4)]
        return {"subtitle": "GROUP A", "rows": rows}
    if type_ == "ROUND_RESULTS":
        sc = ["3 - 1", "2 - 2", "0 - 2", "1 - 3"]
        return {"subtitle": "GROUP STAGE · ROUND 2", "rows": [{"cells": [names[i * 2 % 8], sc[i], names[(i * 2 + 1) % 8]]} for i in range(4)]}
    if type_ == "QUALIFIED":
        return {"subtitle": "GROUP STAGE COMPLETED", "rows": [{"cells": [f"GROUP {g}", str(p), names[(ord(g) - 65) * 2 + p - 1]]} for g in "AB" for p in (1, 2)]}
    if type_ == "KO_MATCHES":
        return {"subtitle": "QUARTER FINALS", "rows": [{"cells": [names[i * 2], "VS", names[i * 2 + 1]]} for i in range(4)]}
    if type_ == "BRACKET":
        return {"stages": [
            {"name": "QUARTER FINALS", "matches": [{"a": names[i * 2], "b": names[i * 2 + 1], "ga": 2, "gb": 1, "win": "a"} for i in range(4)]},
            {"name": "SEMI FINALS", "matches": [{"a": names[0], "b": names[2], "ga": None, "gb": None, "win": None},
                                                {"a": names[4], "b": names[6], "ga": None, "gb": None, "win": None}]},
            {"name": "FINAL", "matches": [{"a": "TBD", "b": "TBD", "ga": None, "gb": None, "win": None}]}]}
    if type_ == "CHAMPION":
        return {"team": "TAJ", "logo": None, "subtitle": "ONE NIGHT CHAMPION #5"}
    raise ValueError(type_)
