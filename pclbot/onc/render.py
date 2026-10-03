"""Pillow renderer for the ONC graphics (design v2). Template-driven: dynamic rows, pagination, auto-fit text.

One visual identity for every graphic: header with the PCL logo slot, English eyebrow + Persian title, glass rows with
a gold score pill, footer with the channel handle. Everything is drawn at 2× and downsampled (smooth edges).
Team logos are only ever drawn by the CHAMPION template; the PCL logo (branding) is drawn on all of them.
"""
import io
import math
import os
import re

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

from .. import config
from . import templates

try:  # Persian / Arabic need shaping; optional dependency (only used when libraqm is missing)
    import arabic_reshaper
    from bidi.algorithm import get_display
except Exception:  # pragma: no cover
    arabic_reshaper = get_display = None
try:
    from PIL import features as _features
    RAQM = _features.check("raqm")      # Pillow itself shapes + reorders Persian when libraqm is available
except Exception:  # pragma: no cover
    RAQM = False

_RTL = re.compile(r"[؀-ۿ]")
_font_cache: dict = {}
SS = 2                                   # supersampling


def S(v) -> int:
    return int(round(v * SS))


def shape(text: str) -> str:
    """Without libraqm Persian must be reshaped and reordered by hand (arabic-reshaper + python-bidi)."""
    if not RAQM and get_display and _RTL.search(text or ""):
        return get_display(arabic_reshaper.reshape(text))
    return text


def text_kw(text: str) -> dict:
    return {"direction": "rtl", "language": "fa"} if RAQM and _RTL.search(text or "") else {}


def font_at(idx: int, size: float):
    fl = templates.fonts()
    path = fl[idx % len(fl)][1] if fl else None
    key = (path, round(size))
    if key not in _font_cache:
        try:
            _font_cache[key] = (ImageFont.truetype(path, round(size), layout_engine=None if RAQM else ImageFont.Layout.BASIC)
                                if path else ImageFont.load_default(round(size)))
        except Exception:
            _font_cache[key] = ImageFont.load_default(round(size))
    return _font_cache[key]


def hex_rgba(c: str, alpha: float | None = None):
    c = c.lstrip("#")
    if len(c) == 6:
        c += "ff"
    r, g, b, a = (int(c[i:i + 2], 16) for i in (0, 2, 4, 6))
    return (r, g, b, int(a if alpha is None else alpha * 255))


def mix(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))


_measure = ImageDraw.Draw(Image.new("RGB", (4, 4)))


def fit(d, text: str, st: dict, size: int | None = None):
    """Largest font ≤ size that fits max_w (down to `min`); if even `min` is too wide the text is ellipsized. (1× units)"""
    size = size or st["size"]
    lo = min(st.get("min", 12), size)
    kw = text_kw(text)
    s = size
    while s > lo and d.textlength(text, font=font_at(st.get("font", 0), s), **kw) > st.get("max_w", 10_000):
        s -= 1
    f = font_at(st.get("font", 0), s)
    if d.textlength(text, font=f, **kw) > st.get("max_w", 10_000):
        while len(text) > 1 and d.textlength(text + "…", font=f, **kw) > st["max_w"]:
            text = text[:-1]
        text += "…"
    return text, f


# ===================================================================== canvas
class Canvas:
    def __init__(self, cfg: dict, bg: Image.Image):
        self.cfg, self.w, self.h = cfg, cfg["w"], cfg["h"]
        self.th = cfg["theme"]
        self.im = bg.convert("RGB")
        self.d = ImageDraw.Draw(self.im, "RGBA")
        self.accent = hex_rgba(self.th["accent"])
        self.gold = hex_rgba(self.th["gold"])

    # -- shapes (1× coordinates) ---------------------------------------------------------------------------------
    def rect(self, box, fill=None, outline=None, width=1, r=0):
        x0, y0, x1, y1 = box
        kw = {"fill": fill, "outline": outline, "width": S(width) if outline else 0}
        if r:
            self.d.rounded_rectangle([S(x0), S(y0), S(x1), S(y1)], radius=S(r), **kw)
        else:
            self.d.rectangle([S(x0), S(y0), S(x1), S(y1)], **kw)

    def poly(self, pts, fill):
        self.d.polygon([(S(x), S(y)) for x, y in pts], fill=fill)

    def line(self, pts, fill, width=2):
        self.d.line([(S(x), S(y)) for x, y in pts], fill=fill, width=S(width), joint="curve")

    def ellipse(self, box, fill=None, outline=None, width=1):
        x0, y0, x1, y1 = box
        self.d.ellipse([S(x0), S(y0), S(x1), S(y1)], fill=fill, outline=outline, width=S(width) if outline else 0)

    def gradient(self, box, c1, c2, horizontal=True, r=0):
        x0, y0, x1, y1 = [S(v) for v in box]
        w, h = max(x1 - x0, 1), max(y1 - y0, 1)
        n = w if horizontal else h
        strip = Image.new("RGBA", (n, 1), (0, 0, 0, 0))
        px = strip.load()
        for i in range(n):
            px[i, 0] = mix(c1, c2, i / max(n - 1, 1))
        g = strip.resize((w, h)) if horizontal else strip.rotate(90, expand=True).transpose(Image.FLIP_LEFT_RIGHT).resize((w, h))
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=S(r), fill=255) if r else mask.paste(255, [0, 0, w, h])
        self.im.paste(g.convert("RGB"), (x0, y0), ImageChops.multiply(mask, g.getchannel("A")))

    def glow(self, draw_fn, blur: float, alpha: float = 1.0):
        layer = Image.new("RGBA", self.im.size, (0, 0, 0, 0))
        draw_fn(ImageDraw.Draw(layer, "RGBA"))
        layer = layer.filter(ImageFilter.GaussianBlur(S(blur)))
        if alpha < 1:
            layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
        self.im.paste(layer.convert("RGB"), (0, 0), layer.getchannel("A"))

    # -- text -----------------------------------------------------------------------------------------------------
    def text(self, text, st: dict, y=None, size=None, color=None, x=None, align=None, max_w=None, shadow=False, track=None):
        if text in (None, ""):
            return
        text = shape(str(text))
        st2 = dict(st)
        if max_w:
            st2["max_w"] = max_w
        text, f1 = fit(_measure, text, st2, size)
        sz = f1.size
        f = font_at(st.get("font", 0), sz * SS)
        al = align or st.get("align", "center")
        px = st["x"] if x is None else x
        py = st.get("y", 0) if y is None else y
        kw = text_kw(text)
        col = hex_rgba(color or st["color"])
        tr = st.get("track", 0) if track is None else track
        if tr and not kw and not _RTL.search(text):          # letter-spaced Latin caption
            total = sum(self.d.textlength(ch, font=f) for ch in text) + S(tr) * (len(text) - 1)
            sx = S(px) - (total / 2 if al == "center" else total if al == "right" else 0)
            if shadow:
                cx = sx
                for ch in text:
                    self.d.text((cx + S(2), S(py) + S(3)), ch, font=f, fill=(0, 0, 0, 120), anchor="lm")
                    cx += self.d.textlength(ch, font=f) + S(tr)
            for ch in text:
                self.d.text((sx, S(py)), ch, font=f, fill=col, anchor="lm")
                sx += self.d.textlength(ch, font=f) + S(tr)
            return
        anchor = {"left": "lm", "center": "mm", "right": "rm"}[al]
        if shadow:
            self.d.text((S(px) + S(2), S(py) + S(3)), text, font=f, fill=(0, 0, 0, 130), anchor=anchor, **kw)
        self.d.text((S(px), S(py)), text, font=f, fill=col, anchor=anchor, **kw)

    def gradient_text(self, text, st, y, size, c1, c2, x=None):
        text = shape(text)
        text, f1 = fit(_measure, text, st, size)
        f = font_at(st.get("font", 0), f1.size * SS)
        kw = text_kw(text)
        mask = Image.new("L", self.im.size, 0)
        px = S(st["x"] if x is None else x)
        ImageDraw.Draw(mask).text((px, S(y)), text, font=f, fill=255, anchor="mm", **kw)
        bbox = mask.getbbox()
        if not bbox:
            return
        grad = Image.new("RGB", (1, bbox[3] - bbox[1]))
        for i in range(grad.height):
            grad.putpixel((0, i), mix(c1, c2, i / max(grad.height - 1, 1))[:3])
        full = Image.new("RGB", self.im.size, (0, 0, 0))
        full.paste(grad.resize((bbox[2] - bbox[0], grad.height)), (bbox[0], bbox[1]))
        shadow = mask.filter(ImageFilter.GaussianBlur(S(6)))
        self.im.paste((0, 0, 0), (S(0), S(5)), shadow.point(lambda v: int(v * .55)))
        self.im.paste(full, (0, 0), mask)

    def png(self) -> bytes:
        out = self.im.resize((self.w, self.h), Image.LANCZOS)
        buf = io.BytesIO()
        out.save(buf, "PNG", optimize=True)
        return buf.getvalue()


# ===================================================================== background + shared chrome
def background(cfg: dict, bg_path: str | None) -> Image.Image:
    w, h = S(cfg["w"]), S(cfg["h"])
    if bg_path and os.path.exists(bg_path):
        try:
            im = Image.open(bg_path).convert("RGB")
            r = max(w / im.width, h / im.height)  # cover
            im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1))
            l, t = (im.width - w) // 2, (im.height - h) // 2
            im = im.crop((l, t, l + w, t + h))
            shade = Image.new("L", (1, h))        # keep text readable on any uploaded picture
            for y in range(h):
                shade.putpixel((0, y), int(70 + 90 * abs(y / h - .5) * 2))
            im.paste((0, 0, 0), (0, 0), shade.resize((w, h)))
            return im
        except Exception:
            pass
    th = cfg["theme"]
    c1, c2, ac = hex_rgba(th["bg1"]), hex_rgba(th["bg2"]), hex_rgba(th["accent"])
    col = Image.new("RGB", (1, 256))
    for i in range(256):                          # deep vertical gradient: near-black → theme depth → near-black
        t = i / 255
        k = math.sin(t * math.pi) ** 1.4
        col.putpixel((0, i), mix(c1, c2, k)[:3])
    im = col.resize((w, h))
    # radial glows
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([int(w * .45), -int(h * .18), int(w * 1.25), int(h * .30)], fill=ac[:3] + (120,))
    gd.ellipse([-int(w * .45), int(h * .62), int(w * .55), int(h * 1.15)], fill=c2[:3] + (170,))
    glow = glow.filter(ImageFilter.GaussianBlur(int(w * .09)))
    im.paste(glow.convert("RGB"), (0, 0), glow.getchannel("A"))
    # diagonal speed stripes + fine dot grid (esports texture)
    tex = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(tex)
    for i, (x0, wd, a) in enumerate([(-.1, .10, 16), (.05, .035, 26), (.32, .06, 11), (.66, .02, 30), (.78, .09, 14), (.97, .04, 20)]):
        sx, sw = int(w * x0), int(w * wd)
        sk = int(h * .42)
        td.polygon([(sx + sk, 0), (sx + sk + sw, 0), (sx + sw, h), (sx, h)], fill=(255, 255, 255, a))
    step = S(26)
    for gx in range(0, w, step):
        for gy in range(int(h * .55), h, step):
            td.ellipse([gx, gy, gx + S(2.2), gy + S(2.2)], fill=(255, 255, 255, 20))
    im.paste(tex.convert("RGB"), (0, 0), tex.getchannel("A"))
    vig = Image.new("L", (w, h), 0)               # vignette
    ImageDraw.Draw(vig).ellipse([-int(w * .25), -int(h * .2), int(w * 1.25), int(h * 1.2)], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(int(w * .12)))
    im.paste((0, 0, 0), (0, 0), ImageChops.invert(vig).point(lambda v: int(v * .55)))
    return im


def pcl_logo_path() -> str | None:
    for base in (config.ONC_ASSETS_DIR, os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")):
        p = os.path.join(base, "pcl_logo.png")
        if os.path.exists(p):
            return p
    return None


def draw_pcl_logo(cv: Canvas) -> None:
    """The fixed branding slot. Drop the real logo at <ONC_ASSETS_DIR>/pcl_logo.png (or upload it from the panel)."""
    st = cv.cfg["elements"].get("pcl_logo")
    if not st:
        return
    x, y, size = st["x"], st["y"], st["size"]
    box = (x - size / 2, y - size / 2, x + size / 2, y + size / 2)
    cv.glow(lambda d: d.rounded_rectangle([S(box[0]), S(box[1]), S(box[2]), S(box[3])], radius=S(size * .22), fill=cv.gold[:3] + (110,)), 10, .55)
    cv.rect(box, fill=(10, 4, 8, 235), outline=cv.gold, width=3, r=size * .22)
    path = pcl_logo_path()
    if path:
        try:
            logo = Image.open(path).convert("RGBA")
            logo.thumbnail((S(size * .78), S(size * .78)))
            cv.im.paste(logo.convert("RGB"), (S(x) - logo.width // 2, S(y) - logo.height // 2), logo.getchannel("A"))
            return
        except Exception:
            pass
    # placeholder monogram until the real logo is provided
    cv.text("PCL", {"x": x, "y": y - 6, "size": size * .40, "min": 12, "color": "#ffffff", "align": "center", "max_w": size * .8, "font": templates.O_BOLD}, track=2)
    cv.rect((x - size * .30, y + size * .20, x + size * .30, y + size * .24), fill=cv.accent, r=2)
    cv.text("LOGO", {"x": x, "y": y + size * .34, "size": size * .13, "min": 8, "color": "#b9c0cc", "align": "center", "max_w": size * .8, "font": templates.O_MED}, track=3)


def chrome(cv: Canvas, data: dict, page_i: int, pages_n: int) -> None:
    """Header + title + footer shared by all graphics."""
    cfg, el = cv.cfg, cv.cfg["elements"]
    w, h = cv.w, cv.h
    wide = w > h
    hh = 224 if not wide else 204
    # header band with an angled accent cut
    cv.rect((0, 0, w, hh), fill=(0, 0, 0, 105))
    cx0 = w * (.76 if not wide else .70)
    cv.poly([(cx0, 0), (w, 0), (w, hh), (cx0 - 70 * (hh / 224), hh)], hex_rgba(cfg["theme"]["accent"], .20))
    cv.poly([(cx0 + 22, 0), (cx0 + 40, 0), (cx0 - 48 * (hh / 224), hh), (cx0 - 66 * (hh / 224), hh)], hex_rgba(cfg["theme"]["gold"], .55))
    cv.gradient((0, 0, w, 10), cv.accent, cv.gold, True)
    cv.gradient((0, hh, w, hh + 3), cv.gold, mix(cv.gold, cv.accent, .8), True)
    draw_pcl_logo(cv)
    cv.text(data.get("brand", el["brand"].get("text")), el["brand"], shadow=True)
    cv.text(data.get("eyebrow", el["eyebrow"].get("text")), el["eyebrow"])
    title = data.get("title", el["title"].get("text"))
    cv.text(title, el["title"], shadow=True)
    if "subtitle" in el and data.get("subtitle"):
        cv.text(data["subtitle"], el["subtitle"])
    if not wide:
        # title ornament: gold hairline with a centre diamond
        y = 392
        cv.line([(80, y), (500, y)], hex_rgba(cfg["theme"]["gold"], .55), 2)
        cv.line([(580, y), (1000, y)], hex_rgba(cfg["theme"]["gold"], .55), 2)
        cv.poly([(540, y - 9), (551, y), (540, y + 9), (529, y)], cv.gold)
    # footer
    fy = h - 58
    cv.rect((56, fy - 16, w - 56, fy - 15), fill=(255, 255, 255, 38))
    if "footer" in el:
        cv.text(el["footer"].get("text"), el["footer"])
    if pages_n > 1 and "page" in el:
        cv.text(f"صفحه {page_i} از {pages_n}", el["page"])


def panel(cv: Canvas, box, accent=True, strong=False, r=20, accent_color=None):
    x0, y0, x1, y1 = box
    cv.rect(box, fill=(255, 255, 255, 30 if strong else 20), outline=(255, 255, 255, 44), width=1.5, r=r)
    cv.rect((x0 + 2, y0 + 1, x1 - 2, y0 + 3), fill=(255, 255, 255, 22), r=2)       # top highlight
    if accent:
        cv.rect((x0, y0 + 14, x0 + 7, y1 - 14), fill=accent_color or cv.accent, r=3)


def score_pill(cv: Canvas, cx, cy, text, st, w=220, h=66):
    box = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    cv.glow(lambda d: d.rounded_rectangle([S(box[0]), S(box[1]), S(box[2]), S(box[3])], radius=S(h / 2), fill=cv.gold[:3] + (120,)), 7, .5)
    cv.rect(box, fill=(14, 5, 9, 245), outline=cv.gold, width=3, r=h / 2)
    cv.text(text, st, y=cy, max_w=w - 36)


def watermark(cv: Canvas) -> None:
    """Large faded tagline at the bottom: fills the lower area of short pages with brand texture instead of empty space."""
    f = font_at(templates.O_BOLD, S(104))
    mask = Image.new("L", cv.im.size, 0)
    md = ImageDraw.Draw(mask)
    for k, txt in enumerate(("ONE NIGHT", "ONE CHAMPION")):
        md.text((S(cv.w / 2), S(cv.h - 188 + k * 112)), txt, font=f, fill=255, anchor="ms")
    cv.im.paste((255, 255, 255), (0, 0), mask.point(lambda v: int(v * .055)))


def _winner(score: str) -> int:
    m = re.search(r"(\d+)\s*-\s*(\d+)", score or "")
    if not m:
        return 0
    a, b = int(m.group(1)), int(m.group(2))
    return (a > b) - (a < b)


# ===================================================================== row based graphics
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


def render_rows(type_: str, cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    rows_cfg, cols = cfg["rows"], cfg["cols"]
    pages = _chunks(data["rows"], rows_cfg["max_rows"], "slot" if type_ == "SCHEDULE" else None)
    out = []
    for pi, chunk in enumerate(pages, 1):
        cv = Canvas(cfg, background(cfg, bg_path))
        chrome(cv, data, pi, len(pages))
        y0, rh, gap = rows_cfg["start_y"], rows_cfg["row_h"], rows_cfg["gap"]
        left, right = 56, cfg["w"] - 56
        k = len(chunk)
        if 0 < k < rows_cfg["max_rows"]:       # few rows: let them breathe instead of leaving a big empty area
            avail = cfg["h"] - 84 - y0
            f = min(1.35, (avail + gap) / (k * (rh + gap)))
            rh, gap = rh * max(f, 1), gap * max(f, 1) * .9
        if y0 + k * (rh + gap) < cfg["h"] - 330:   # only where the lower area would otherwise stay empty
            watermark(cv)
        if type_ == "GROUP_TABLE":
            hy = cfg.get("header_y", y0 - 40)
            cv.rect((left, hy - 24, right, hy + 24), fill=(0, 0, 0, 120), r=14)
            hdr = {"pos": "POS", "team": "TEAM"}
            for key in cfg["show"]:
                c = cols[key]
                cv.text(hdr.get(key, key), c, y=hy, size=max(c["size"] - 16, 15), color="#e0bd62", max_w=c.get("max_w", 80) + (10 if key == "pos" else 0), track=1)
        for i, row in enumerate(chunk):
            top = y0 + i * (rh + gap)
            mid = top + rh / 2
            kind = row.get("kind", "row")
            if type_ == "SCHEDULE":
                if kind == "slot":
                    c = cols["slot"]
                    time_txt, _, label = row["text"].partition(" · ")
                    cv.rect((left, mid - 3, left + 6, mid + 3), fill=cv.accent, r=2)
                    cv.text(time_txt, c, y=mid, x=left + 22)
                    tw = _measure.textlength(time_txt, font=font_at(c["font"], c["size"]))
                    lab = {"x": left + 22 + tw + 28, "y": 0, "size": 30, "min": 18, "color": "#ffffff", "align": "left", "max_w": 360, "font": templates.F_XBOLD}
                    pw = min(_measure.textlength(shape(label), font=font_at(lab["font"], 30), **text_kw(label)) + 44, 400)
                    cv.rect((lab["x"] - 6, mid - 24, lab["x"] - 6 + pw, mid + 24), fill=hex_rgba(cfg["theme"]["accent"], .75), r=24)
                    cv.text(label, lab, y=mid, x=lab["x"] + 16, max_w=pw - 30)
                    cv.rect((lab["x"] + pw + 4, mid - 1, right, mid + 1), fill=(255, 255, 255, 45))
                else:
                    panel(cv, (left, top, right, top + rh), accent=True)
                    c = cols["match"]
                    a, b = row.get("a"), row.get("b")
                    if a is None:
                        a, _, b = row["text"].partition(" × ")
                    cx = cfg["w"] / 2
                    cv.ellipse((cx - 26, mid - 26, cx + 26, mid + 26), fill=(14, 5, 9, 240), outline=cv.gold, width=2.5)
                    cv.text("VS", {"x": cx, "size": 22, "min": 12, "color": "#ffd24a", "align": "center", "max_w": 48, "font": templates.O_BOLD}, y=mid)
                    cv.text(a, c, y=mid, x=cx - 46, align="right", max_w=c["max_w"] - 20)
                    cv.text(b, c, y=mid, x=cx + 46, align="left", max_w=c["max_w"] - 20)
            elif type_ == "GROUP_TABLE":
                panel(cv, (left, top, right, top + rh), accent=False, strong=(i % 2 == 0))
                q = row.get("qualified")
                cv.rect((left, top + 12, left + 7, top + rh - 12), fill=(hex_rgba("#45e08a") if q else cv.accent), r=3)
                for key in cfg["show"]:
                    c = cols[key]
                    val = row[key]
                    if key == "pos":
                        cx = c["x"]
                        cv.ellipse((cx - 25, mid - 25, cx + 25, mid + 25), fill=(cv.gold if q else (255, 255, 255, 36)))
                        cv.text(val, c, y=mid, color="#14080c" if q else "#ffffff")
                    elif key == "PTS":
                        cv.rect((c["x"] - 40, mid - 29, c["x"] + 40, mid + 29), fill=cv.gold, r=16)
                        cv.text(val, c, y=mid)
                    elif key == "team":
                        cv.text(val, c, y=mid)
                    else:
                        cv.text(val, c, y=mid, color="#ffffff" if key not in ("GD",) else ("#7dffb4" if str(val).startswith("+") else "#ff8a96" if str(val).startswith("-") else "#ffffff"))
            elif type_ == "QUALIFIED":
                panel(cv, (left, top, right, top + rh), accent=True, accent_color=hex_rgba("#45e08a"))
                grp, pos, team = row["cells"]
                cg, cp, ct = cols["group"], cols["pos"], cols["team"]
                cv.rect((cg["x"] - 14, mid - 22, cg["x"] + 250, mid + 22), fill=hex_rgba(cfg["theme"]["accent"], .55), r=22)
                cv.text(grp, cg, y=mid, x=cg["x"], max_w=230)
                cv.ellipse((cp["x"] - 27, mid - 27, cp["x"] + 27, mid + 27), fill=cv.gold)
                cv.text(pos, cp, y=mid, color="#14080c")
                cv.text(team, ct, y=mid)
                cx_, ok = right - 46, hex_rgba("#45e08a")
                cv.line([(cx_ - 14, mid + 1), (cx_ - 4, mid + 12), (cx_ + 15, mid - 12)], ok, 6)
            else:  # ROUND_RESULTS / KO_MATCHES
                panel(cv, (left, top, right, top + rh), accent=True)
                a, score, b = row["cells"]
                ca, cs, cb = cols["a"], cols["score"], cols["b"]
                win = _winner(score)
                dim = "#9aa3b2"
                cv.text(a, ca, y=mid, color=ca["color"] if win >= 0 else dim)
                cv.text(b, cb, y=mid, color=cb["color"] if win <= 0 else dim)
                score_pill(cv, cs["x"], mid, "VS" if score in ("×", "VS") else score, cs, w=230, h=min(rh * .68, 84))
        out.append(cv.png())
    return out


# ===================================================================== bracket
def render_bracket(cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    cv = Canvas(cfg, background(cfg, bg_path))
    chrome(cv, data, 1, 1)
    b, el = cfg["bracket"], cfg["elements"]
    stages = data["stages"]
    if not stages:
        cv.text("هنوز مرحله حذفی ساخته نشده", {"x": cfg["w"] / 2, "size": 46, "min": 20, "color": "#ffffff", "align": "center", "max_w": 900, "font": templates.F_BOLD}, y=cfg["h"] / 2)
        return [cv.png()]
    n = len(stages)
    col_w = (b["right"] - b["left"]) / n
    box_w = min(col_w - 70, el["team"]["max_w"] + 60)
    top, bottom = b["top"] + 64, b["bottom"]
    team = el["team"]
    centers: list[list[float]] = []
    h = 92
    for si, stg in enumerate(stages):
        x0 = b["left"] + si * col_w + (col_w - box_w) / 2
        cs = []
        ms = stg["matches"]
        for mi, m in enumerate(ms):
            if si == 0 or len(centers[si - 1]) < 2 * len(ms):
                cy = top + (bottom - top) * (mi + .5) / max(len(ms), 1)
            else:
                cy = (centers[si - 1][2 * mi] + centers[si - 1][2 * mi + 1]) / 2
            cs.append(cy)
        centers.append(cs)
        # stage pill
        pw = box_w
        cv.rect((x0, b["top"] + 6, x0 + pw, b["top"] + 54), fill=(hex_rgba(cfg["theme"]["accent"], .85) if si < n - 1 else cv.gold), r=24)
        cv.text(stg["name"], el["stage"], y=b["top"] + 30, x=x0 + pw / 2, color="#ffffff" if si < n - 1 else "#14080c", max_w=pw - 24)
        for mi, m in enumerate(ms):
            cy = cs[mi]
            panel(cv, (x0, cy - h / 2, x0 + box_w, cy + h / 2), accent=True, strong=True, r=16)
            cv.rect((x0 + box_w / 2 - 70, cy - 1, x0 + box_w - 70 + 70, cy + 1), fill=(255, 255, 255, 30))
            for k, (nm, sc, win) in enumerate(((m["a"], m["ga"], m["win"] == "a"), (m["b"], m["gb"], m["win"] == "b"))):
                yy = cy - 22 + k * 44
                lost = m["win"] is not None and not win
                ts = dict(team, x=x0 + 24, max_w=box_w - 110, align="left")
                cv.text(nm, ts, y=yy, color=cv.gold and ("#ffd24a" if win else "#8d96a6" if lost else team["color"]))
                if sc is not None:
                    cv.rect((x0 + box_w - 62, yy - 17, x0 + box_w - 12, yy + 17), fill=(cv.gold if win else (255, 255, 255, 34)), r=9)
                    cv.text(sc, {"x": x0 + box_w - 37, "size": 28, "min": 14, "color": "#14080c" if win else "#ffffff", "align": "center", "max_w": 44, "font": templates.O_BOLD}, y=yy)
            if si + 1 < n:  # elbow connector to the next column
                nx = x0 + box_w + (col_w - box_w) / 2
                ny = (centers[si + 1][mi // 2] if si + 1 < len(centers) and len(centers) > si + 1 and False else None)
        # connectors are drawn when the next column exists
    for si in range(n - 1):
        x0 = b["left"] + si * col_w + (col_w - box_w) / 2 + box_w
        x1 = b["left"] + (si + 1) * col_w + (col_w - box_w) / 2
        mid = (x0 + x1) / 2
        nxt = centers[si + 1]
        for mi, cy in enumerate(centers[si]):
            if len(centers[si]) >= 2 * len(nxt) and mi // 2 < len(nxt):
                ty = nxt[mi // 2]
            else:
                ty = nxt[min(mi, len(nxt) - 1)]
            col = hex_rgba(cfg["theme"]["gold"], .75)
            cv.line([(x0, cy), (mid, cy), (mid, ty), (x1, ty)], col, 3)
    return [cv.png()]


# ===================================================================== champion
def render_champion(cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    cv = Canvas(cfg, background(cfg, bg_path))
    el = cfg["elements"]
    lg = el["logo"]
    size, cx, cy = lg["size"], lg["x"], lg["y"]
    # light rays + glow behind the ring
    rays = Image.new("RGBA", cv.im.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for k in range(18):
        a0 = math.radians(k * 20)
        a1 = a0 + math.radians(7)
        R = S(1400)
        rd.polygon([(S(cx), S(cy)), (S(cx) + R * math.cos(a0), S(cy) + R * math.sin(a0)), (S(cx) + R * math.cos(a1), S(cy) + R * math.sin(a1))], fill=cv.gold[:3] + (26,))
    rays = rays.filter(ImageFilter.GaussianBlur(S(3)))
    cv.im.paste(rays.convert("RGB"), (0, 0), rays.getchannel("A"))
    cv.glow(lambda d: d.ellipse([S(cx - size * .75), S(cy - size * .75), S(cx + size * .75), S(cy + size * .75)], fill=cv.gold[:3] + (150,)), 60, .55)
    chrome(cv, data, 1, 1)
    cv.gradient_text(data.get("title", el["title"].get("text")), el["title"], el["title"]["y"] + 0, el["title"]["size"], hex_rgba("#fff3b0"), hex_rgba("#e0a800"))
    # trophy-style double ring (+ tick marks)
    for r_, wd, col in ((size / 2 + 36, 4, hex_rgba(cfg["theme"]["gold"], .45)), (size / 2 + 18, 10, cv.gold)):
        cv.ellipse((cx - r_, cy - r_, cx + r_, cy + r_), outline=col, width=wd)
    for k in range(60):
        a = math.radians(k * 6)
        r0, r1 = size / 2 + 44, size / 2 + (62 if k % 5 == 0 else 54)
        cv.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))], hex_rgba(cfg["theme"]["gold"], .7), 3)
    cv.ellipse((cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2), fill=(12, 5, 9, 235))
    if data.get("logo"):  # the ONLY graphic that shows a team logo
        try:
            logo = Image.open(io.BytesIO(data["logo"])).convert("RGBA")
            logo.thumbnail((S(size * .88), S(size * .88)))
            mask = Image.new("L", cv.im.size, 0)
            ImageDraw.Draw(mask).ellipse([S(cx - size / 2), S(cy - size / 2), S(cx + size / 2), S(cy + size / 2)], fill=255)
            layer = Image.new("RGBA", cv.im.size, (0, 0, 0, 0))
            layer.paste(logo, (S(cx) - logo.width // 2, S(cy) - logo.height // 2), logo)
            layer.putalpha(ImageChops.multiply(layer.getchannel("A"), mask))
            cv.im.paste(layer.convert("RGB"), (0, 0), layer.getchannel("A"))
        except Exception:
            pass
    else:
        initials = "".join(w[0] for w in re.split(r"\s+", data["team"].strip())[:2]).upper() or "?"
        cv.text(initials, {"x": cx, "size": size * .40, "min": 20, "color": "#ffffff", "align": "center", "max_w": size * .8, "font": templates.F_BLACK}, y=cy)
    # laurel-like side stars
    for dx in (-1, 1):
        for k, ys in enumerate((-60, 0, 60)):
            sx, sy = cx + dx * (size / 2 + 120), cy + ys - abs(ys) * .3
            cv.poly([(sx + math.cos(math.radians(90 + 72 * j + (36 if j % 2 else 0))) * (26 if j % 2 == 0 else 11) * (1 - k * .15) * 1,
                      sy - math.sin(math.radians(90 + 72 * j)) * 0) for j in range(0)], cv.gold) if False else None
    pts = lambda sx, sy, R: [(sx + (R if i % 2 == 0 else R * .42) * math.cos(math.radians(-90 + i * 36)), sy + (R if i % 2 == 0 else R * .42) * math.sin(math.radians(-90 + i * 36))) for i in range(10)]
    for dx in (-1, 1):
        for sy, R in ((cy - 80, 22), (cy, 30), (cy + 80, 22)):
            cv.poly(pts(cx + dx * (size / 2 + 125), sy, R), cv.gold)
    # team name on a banner
    t = el["team"]
    cv.rect((70, t["y"] - 86, cfg["w"] - 70, t["y"] + 86), fill=(0, 0, 0, 130), outline=hex_rgba(cfg["theme"]["gold"], .7), width=3, r=26)
    cv.rect((70, t["y"] - 86, 84, t["y"] + 86), fill=cv.gold, r=6)
    cv.rect((cfg["w"] - 84, t["y"] - 86, cfg["w"] - 70, t["y"] + 86), fill=cv.gold, r=6)
    cv.text(data["team"], t, shadow=True)
    return [cv.png()]


def render(type_: str, cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    if type_ in ("SCHEDULE", "GROUP_TABLE", "ROUND_RESULTS", "QUALIFIED", "KO_MATCHES"):
        return render_rows(type_, cfg, data, bg_path)
    if type_ == "BRACKET":
        return render_bracket(cfg, data, bg_path)
    if type_ == "CHAMPION":
        return render_champion(cfg, data, bg_path)
    raise ValueError(type_)


# ===================================================================== sample data for template previews
def sample(type_: str) -> dict:
    names = ["تاج", "آزادی", "لگسی", "اینویدرز", "آریا", "هنگ‌اوور", "خلیج فارس متحد", "گرویتی"]
    sub = "وان نایت چمپیون #5"
    if type_ == "SCHEDULE":
        lines = []
        for i, t in enumerate(["20:00", "20:30", "21:00"], 1):
            lines.append({"kind": "slot", "text": f"{t} · راند {i}"})
            lines += [{"kind": "match", "text": f"{names[j]} × {names[j + 1]}", "a": names[j], "b": names[j + 1]} for j in (0, 2, 4)]
        return {"subtitle": f"{sub} · 2026/10/10", "rows": lines}
    if type_ == "GROUP_TABLE":
        rows = [{"pos": i + 1, "team": names[i], "P": 3, "W": 3 - i if i < 3 else 0, "D": 0, "L": i, "GF": 7 - i, "GA": i + 1,
                 "GD": f"+{6 - 2 * i}" if 6 - 2 * i >= 0 else str(6 - 2 * i), "PTS": 9 - 3 * i if i < 3 else 0, "qualified": i < 2} for i in range(4)]
        return {"title": "GROUP A — STANDINGS", "subtitle": "ONE NIGHT CHAMPION #5", "rows": rows}
    if type_ == "ROUND_RESULTS":
        sc = ["3 - 1", "2 - 2", "0 - 2", "1 - 3"]
        return {"subtitle": "مرحله گروهی · راند 2", "rows": [{"cells": [names[i * 2 % 8], sc[i], names[(i * 2 + 1) % 8]]} for i in range(4)]}
    if type_ == "QUALIFIED":
        return {"subtitle": "پایان مرحله گروهی", "rows": [{"cells": [f"گروه {g}", str(p), names[(ord(g) - 65) * 2 + p - 1]]} for g in "AB" for p in (1, 2)]}
    if type_ == "KO_MATCHES":
        return {"subtitle": "یک‌چهارم نهایی", "rows": [{"cells": [names[i * 2], "×", names[i * 2 + 1]]} for i in range(4)]}
    if type_ == "BRACKET":
        return {"stages": [
            {"name": "یک‌چهارم نهایی", "matches": [{"a": names[i * 2], "b": names[i * 2 + 1], "ga": 2, "gb": 1, "win": "a"} for i in range(4)]},
            {"name": "نیمه‌نهایی", "matches": [{"a": names[0], "b": names[2], "ga": None, "gb": None, "win": None},
                                              {"a": names[4], "b": names[6], "ga": None, "gb": None, "win": None}]},
            {"name": "فینال", "matches": [{"a": "؟", "b": "؟", "ga": None, "gb": None, "win": None}]}]}
    if type_ == "CHAMPION":
        return {"team": "تاج", "logo": None, "subtitle": sub}
    raise ValueError(type_)
