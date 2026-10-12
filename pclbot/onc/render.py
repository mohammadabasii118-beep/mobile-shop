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
from . import templates, themes

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
        self.hl = self.th["gold"]                                  # highlight colour (hex) — gold in the classic look
        self.label = self.th.get("label", "#e0bd62")               # small caps labels
        self.ink = self.th.get("ink", "#14080c")                   # dark text on a highlight
        self.ok, self.bad = self.th.get("ok", "#45e08a"), self.th.get("bad", "#ff5f6d")

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
                sx_, sy_, sa_ = (1, 2, 78) if shadow == "title" else (2, 3, 120)
                for ch in text:
                    self.d.text((cx + S(sx_), S(py) + S(sy_)), ch, font=f, fill=(0, 0, 0, sa_), anchor="lm")
                    cx += self.d.textlength(ch, font=f) + S(tr)
            for ch in text:
                self.d.text((sx, S(py)), ch, font=f, fill=col, anchor="lm")
                sx += self.d.textlength(ch, font=f) + S(tr)
            return
        anchor = {"left": "lm", "center": "mm", "right": "rm"}[al]
        if shadow:
            sx_, sy_, sa_ = (1, 2, 78) if shadow == "title" else (2, 3, 130)         # titles: a subtle, refined shadow only
            self.d.text((S(px) + S(sx_), S(py) + S(sy_)), text, font=f, fill=(0, 0, 0, sa_), anchor=anchor, **kw)
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
        shadow = mask.filter(ImageFilter.GaussianBlur(S(3)))
        self.im.paste((0, 0, 0), (S(0), S(2)), shadow.point(lambda v: int(v * .30)))
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
    if th.get("style"):
        return themes.background(th, w, h)
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


def title_style(st: dict, text: str) -> dict:
    """Persian titles use the heavy Persian display face, Latin titles the wide geometric one (unless the font was changed by hand)."""
    if st.get("font") == templates.T_EN and _RTL.search(text or ""):
        return dict(st, font=templates.T_FA)
    return st


def chrome(cv: Canvas, data: dict, page_i: int, pages_n: int) -> None:
    """Header + title + footer shared by all graphics."""
    cfg, el = cv.cfg, cv.cfg["elements"]
    w, h = cv.w, cv.h
    wide = w > h
    hh = 224 if not wide else 204
    # header band with an angled accent cut
    if cv.th.get("style"):
        themes.header(cv, hh, wide)
    else:
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
    cv.text(title, title_style(el["title"], title), shadow="title")
    if "subtitle" in el and data.get("subtitle"):
        cv.text(data["subtitle"], el["subtitle"])
    if not wide:
        # title ornament: gold hairline with a centre diamond
        y = 392
        if cv.th.get("style"):
            themes.divider(cv, y)
        else:
            cv.line([(80, y), (500, y)], hex_rgba(cfg["theme"]["gold"], .55), 2)
            cv.line([(580, y), (1000, y)], hex_rgba(cfg["theme"]["gold"], .55), 2)
            cv.poly([(540, y - 9), (551, y), (540, y + 9), (529, y)], cv.gold)
    # footer
    fy = h - 58
    cv.rect((56, fy - 16, w - 56, fy - 15), fill=(255, 255, 255, 38))
    if "footer" in el:
        cv.text(data.get("footer", el["footer"].get("text")), el["footer"])
    if pages_n > 1 and "page" in el:
        cv.text(f"صفحه {page_i} از {pages_n}", el["page"])


def panel(cv: Canvas, box, accent=True, strong=False, r=20, accent_color=None):
    if cv.th.get("style"):
        return themes.panel(cv, box, accent, strong, r, accent_color)
    x0, y0, x1, y1 = box
    cv.rect(box, fill=(255, 255, 255, 30 if strong else 20), outline=(255, 255, 255, 44), width=1.5, r=r)
    cv.rect((x0 + 2, y0 + 1, x1 - 2, y0 + 3), fill=(255, 255, 255, 22), r=2)       # top highlight
    if accent:
        cv.rect((x0, y0 + 14, x0 + 7, y1 - 14), fill=accent_color or cv.accent, r=3)


def score_pill(cv: Canvas, cx, cy, text, st, w=220, h=66):
    box = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    if cv.th.get("style"):
        themes.pill(cv, box, h)
    else:
        cv.glow(lambda d: d.rounded_rectangle([S(box[0]), S(box[1]), S(box[2]), S(box[3])], radius=S(h / 2), fill=cv.gold[:3] + (120,)), 7, .5)
        cv.rect(box, fill=(14, 5, 9, 245), outline=cv.gold, width=3, r=h / 2)
    cv.text(text, st, y=cy, max_w=w - 36)


def watermark(cv: Canvas, lines=("ONE NIGHT", "ONE CHAMPION")) -> None:
    """Large faded tagline at the bottom: fills the lower area of short pages with brand texture instead of empty space."""
    f = font_at(templates.O_BOLD, S(104))
    mask = Image.new("L", cv.im.size, 0)
    md = ImageDraw.Draw(mask)
    for k, txt in enumerate(lines):
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
            watermark(cv, tuple(data.get("watermark", ("ONE NIGHT", "ONE CHAMPION"))))
        if type_ == "GROUP_TABLE":
            hy = cfg.get("header_y", y0 - 40)
            cv.rect((left, hy - 24, right, hy + 24), fill=(0, 0, 0, 120), r=14)
            hdr = {"pos": "POS", "team": "TEAM"}
            for key in cfg["show"]:
                c = cols[key]
                cv.text(hdr.get(key, key), c, y=hy, size=max(c["size"] - 16, 15), color=cv.label, max_w=c.get("max_w", 80) + (10 if key == "pos" else 0), track=1)
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
                    cv.text("VS", {"x": cx, "size": 22, "min": 12, "color": cv.hl, "align": "center", "max_w": 48, "font": templates.O_BOLD}, y=mid)
                    cv.text(a, c, y=mid, x=cx - 46, align="right", max_w=c["max_w"] - 20)
                    cv.text(b, c, y=mid, x=cx + 46, align="left", max_w=c["max_w"] - 20)
            elif type_ == "GROUP_TABLE":
                panel(cv, (left, top, right, top + rh), accent=False, strong=(i % 2 == 0))
                # rank = a plain number (never a medal / gold-silver-bronze); qualification is a separate green / red / neutral marker
                stt = row.get("status") or ("in" if row.get("qualified") else None)
                bar = hex_rgba(cv.ok) if stt == "in" else hex_rgba(cv.bad) if stt == "out" else (255, 255, 255, 70)
                cv.rect((left, top + 12, left + 7, top + rh - 12), fill=bar, r=3)
                for key in cfg["show"]:
                    c = cols[key]
                    val = row[key]
                    if key == "pos":
                        cx = c["x"]
                        themes.pos_badge(cv, cx, mid, 25)
                        cv.text(val, c, y=mid, color="#ffffff")
                    elif key == "PTS":
                        cv.rect((c["x"] - 40, mid - 29, c["x"] + 40, mid + 29), fill=cv.gold, r=16)
                        cv.text(val, c, y=mid)
                    elif key == "team":
                        cv.text(val, c, y=mid)
                    else:
                        cv.text(val, c, y=mid, color="#ffffff" if key not in ("GD",) else (cv.ok if str(val).startswith("+") else cv.bad if str(val).startswith("-") else "#ffffff"))
            elif type_ == "QUALIFIED":
                panel(cv, (left, top, right, top + rh), accent=True, accent_color=hex_rgba(cv.ok))
                grp, pos, team = row["cells"]
                cg, cp, ct = cols["group"], cols["pos"], cols["team"]
                cv.rect((cg["x"] - 14, mid - 22, cg["x"] + 250, mid + 22), fill=hex_rgba(cfg["theme"]["accent"], .55), r=22)
                cv.text(grp, cg, y=mid, x=cg["x"], max_w=230)
                cv.ellipse((cp["x"] - 27, mid - 27, cp["x"] + 27, mid + 27), fill=cv.gold)
                cv.text(pos, cp, y=mid, color=cv.ink)
                cv.text(team, ct, y=mid)
                cx_, ok = right - 46, hex_rgba(cv.ok)
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
        if type_ == "GROUP_TABLE":                      # status legend (the rank itself is only ever a plain number)
            ly = min(y0 + k * (rh + gap) + 34, cfg["h"] - 118)
            lx = left + 6
            for col, txt in ((cv.ok, "QUALIFIED"), (cv.bad, "ELIMINATED"), ("#9aa3b2", "IN PROGRESS")):
                cv.rect((lx, ly - 7, lx + 8, ly + 7), fill=hex_rgba(col), r=3)
                cv.text(txt, {"x": lx + 18, "size": 22, "min": 12, "color": "#b9c0cc", "align": "left", "max_w": 220, "font": templates.O_MED}, y=ly, track=2)
                lx += 24 + _measure.textlength(txt, font=font_at(templates.O_MED, S(22))) / SS + 22 + 26
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
        cv.text(stg["name"], el["stage"], y=b["top"] + 30, x=x0 + pw / 2, color="#ffffff" if si < n - 1 else cv.ink, max_w=pw - 24)
        for mi, m in enumerate(ms):
            cy = cs[mi]
            panel(cv, (x0, cy - h / 2, x0 + box_w, cy + h / 2), accent=True, strong=True, r=16)
            cv.rect((x0 + box_w / 2 - 70, cy - 1, x0 + box_w - 70 + 70, cy + 1), fill=(255, 255, 255, 30))
            for k, (nm, sc, win) in enumerate(((m["a"], m["ga"], m["win"] == "a"), (m["b"], m["gb"], m["win"] == "b"))):
                yy = cy - 22 + k * 44
                lost = m["win"] is not None and not win
                ts = dict(team, x=x0 + 24, max_w=box_w - 110, align="left")
                cv.text(nm, ts, y=yy, color=cv.gold and (cv.hl if win else "#8d96a6" if lost else team["color"]))
                if sc is not None:
                    cv.rect((x0 + box_w - 62, yy - 17, x0 + box_w - 12, yy + 17), fill=(cv.gold if win else (255, 255, 255, 34)), r=9)
                    cv.text(sc, {"x": x0 + box_w - 37, "size": 28, "min": 14, "color": cv.ink if win else "#ffffff", "align": "center", "max_w": 44, "font": templates.O_BOLD}, y=yy)
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
    cv.gradient_text(data.get("title", el["title"].get("text")), title_style(el["title"], data.get("title", el["title"].get("text"))), el["title"]["y"] + 0, el["title"]["size"], mix(cv.gold, (255, 255, 255, 255), .55), mix(cv.gold, (0, 0, 0, 255), .18))
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


def render_transfer(cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    """HERE WE GO card: player, from → to, type badge, date. (No team logos: they belong to the champion poster only.)"""
    cv = Canvas(cfg, background(cfg, bg_path))
    el = cfg["elements"]
    w = cfg["w"]
    chrome(cv, {**data, "title": data.get("title") or el["title"].get("text")}, 1, 1)
    # the title uses the display font + letter spacing; give it a glow
    pl, tm = el["player"], el["team"]
    cv.glow(lambda d: d.rounded_rectangle([S(60), S(pl["y"] - 120), S(w - 60), S(pl["y"] + 120)], radius=S(40), fill=cv.accent[:3] + (110,)), 50, .5)
    panel(cv, (56, pl["y"] - 118, w - 56, pl["y"] + 118), accent=False, strong=True, r=34)
    cv.rect((56, pl["y"] - 118, 70, pl["y"] + 118), fill=cv.gold, r=7)
    cv.text("PLAYER", {"x": 540, "size": 24, "min": 14, "color": cv.label, "align": "center", "max_w": 300, "font": templates.O_SEMI}, y=pl["y"] - 78, track=8)
    cv.text(data["player"], pl, y=pl["y"] + 6, shadow=True)
    # from → to
    y0 = 820
    for k, (lab, name) in enumerate((("FROM", data["from"]), ("TO", data["to"]))):
        x0, x1 = (56, 500) if k == 0 else (580, w - 56)
        panel(cv, (x0, y0, x1, y0 + 190), accent=(k == 0), strong=True, r=26)
        cv.text(lab, {"x": (x0 + x1) / 2, "size": 24, "min": 14, "color": cv.label, "align": "center", "max_w": 200, "font": templates.O_SEMI}, y=y0 + 38, track=8)
        cv.text(name, tm, y=y0 + 112, x=(x0 + x1) / 2, max_w=(x1 - x0) - 50)
    # arrow medallion between the two cards
    cx, cy = w / 2, y0 + 95
    cv.ellipse((cx - 44, cy - 44, cx + 44, cy + 44), fill=cv.gold)
    cv.poly([(cx - 20, cy - 8), (cx + 4, cy - 8), (cx + 4, cy - 22), (cx + 28, cy), (cx + 4, cy + 22), (cx + 4, cy + 8), (cx - 20, cy + 8)], (20, 8, 12, 255))
    # type badge + date
    b = el["badge"]
    cv.rect((540 - 240, b["y"] - 46, 540 + 240, b["y"] + 46), fill=cv.gold, r=46)
    cv.text(data["type_label"], b)
    cv.text(data["date"], el["date"])
    return [cv.png()]


def render_stats(cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    """PLAYER STATS: one glass card per category (top scorer / assists / goalkeeper / rating) with the leader and the runners-up."""
    cv = Canvas(cfg, background(cfg, bg_path))
    el = cfg["elements"]
    chrome(cv, data, 1, 1)
    cards = data["cards"][:4]
    top, ch, gap = 410, 196, 14
    for i, c in enumerate(cards):
        y0 = top + i * (ch + gap)
        panel(cv, (56, y0, cfg["w"] - 56, y0 + ch), accent=True, strong=(i % 2 == 0))
        ct, pl, tm, ot, vl = el["card_title"], el["player"], el["team"], el["others"], el["value"]
        cv.text(c["label"], ct, y=y0 + 34)
        cv.text(c["name"], pl, y=y0 + 90, shadow=True)
        cv.text(c.get("team"), tm, y=y0 + 138)
        cv.text(c.get("others"), ot, y=y0 + 172)
        cv.glow(lambda d, y0=y0: d.rounded_rectangle([S(vl["x"] - 92), S(y0 + 46), S(vl["x"] + 92), S(y0 + 146)], radius=S(30), fill=cv.gold[:3] + (110,)), 12, .5)
        cv.rect((vl["x"] - 90, y0 + 48, vl["x"] + 90, y0 + 144), fill=cv.gold, r=30)
        cv.text(c["value"], vl, y=y0 + 96)
    return [cv.png()]


def _line_of(pos: str) -> int:
    p = (pos or "").upper().replace(" ", "")
    if p in ("GK", "GOALKEEPER", "GKP") or p.startswith("GK"):
        return 0
    if any(k in p for k in ("CB", "LB", "RB", "WB", "DEF", "DF")) and "CDM" not in p:
        return 1
    if any(k in p for k in ("CDM", "CM", "CAM", "LM", "RM", "MID", "MF", "DM", "AM")):
        return 2
    return 3


def _side(pos: str) -> int:
    p = (pos or "").upper()
    return 0 if p.startswith("L") else 2 if p.startswith("R") else 1


def _photo_circle(cv: Canvas, raw: bytes | None, cx: float, cy: float, r: float, fallback: str, ring) -> None:
    """A player photo cropped to a circle (centre-cropped, no stretching) with a highlight ring; initials when there is no photo."""
    cv.glow(lambda d: d.ellipse([S(cx - r - 4), S(cy - r - 4), S(cx + r + 4), S(cy + r + 4)], fill=ring[:3] + (130,)), 8, .6)
    cv.ellipse((cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4), fill=ring)
    cv.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(12, 12, 18, 255))
    if raw:
        try:
            im = Image.open(io.BytesIO(raw)).convert("RGBA")
            side = min(im.size)
            im = im.crop(((im.width - side) // 2, int((im.height - side) * .25), (im.width + side) // 2, int((im.height - side) * .25) + side)).resize((S(2 * r), S(2 * r)), Image.LANCZOS)
            mask = Image.new("L", im.size, 0)
            ImageDraw.Draw(mask).ellipse([0, 0, im.width - 1, im.height - 1], fill=255)
            cv.im.paste(im.convert("RGB"), (S(cx - r), S(cy - r)), mask)
            return
        except Exception:
            pass
    cv.text(fallback, {"x": cx, "size": r * .8, "min": 14, "color": "#ffffff", "align": "center", "max_w": r * 1.6, "font": templates.F_BLACK}, y=cy)


def _logo_chip(cv: Canvas, raw: bytes | None, cx: float, cy: float, size: float) -> bool:
    if not raw:
        return False
    try:
        im = Image.open(io.BytesIO(raw)).convert("RGBA")
        im.thumbnail((S(size), S(size)))
        cv.im.paste(im.convert("RGB"), (S(cx) - im.width // 2, S(cy) - im.height // 2), im.getchannel("A"))
        return True
    except Exception:
        return False


def render_xi_pitch(cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    """TEAM OF THE TOURNAMENT: players placed by the exact slot coordinates of the chosen system (x, y in 0..1 of the pitch),
    each with a photo, the player id, the team name and the team logo. Nothing leaves the frame, cards never overlap."""
    cv = Canvas(cfg, background(cfg, bg_path))
    el = cfg["elements"]
    chrome(cv, data, 1, 1)
    x0, y0, x1, y1 = 40, 396, cfg["w"] - 40, 1262
    pw, ph = x1 - x0, y1 - y0
    cv.rect((x0, y0, x1, y1), fill=(16, 100, 56, 78), outline=(255, 255, 255, 80), width=2, r=24)
    line = (255, 255, 255, 62)
    for k in range(1, 8):                                          # mowing stripes
        if k % 2:
            cv.rect((x0 + 2, y0 + ph * k / 8, x1 - 2, y0 + ph * (k + 1) / 8), fill=(255, 255, 255, 9))
    cv.line([(x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2)], line, 2)
    cv.ellipse((cfg["w"] / 2 - 84, (y0 + y1) / 2 - 84, cfg["w"] / 2 + 84, (y0 + y1) / 2 + 84), outline=line, width=2)
    for yy, d in ((y0, 1), (y1, -1)):
        cv.rect((cfg["w"] / 2 - 200, min(yy, yy + d * 138), cfg["w"] / 2 + 200, max(yy, yy + d * 138)), outline=line, width=2)
        cv.rect((cfg["w"] / 2 - 90, min(yy, yy + d * 56), cfg["w"] / 2 + 90, max(yy, yy + d * 56)), outline=line, width=2)
    pl, rt = el["player"], el["rating"]
    tstyle = {"x": 0, "size": 21, "min": 12, "color": "#d6dbe6", "align": "left", "max_w": 170, "font": templates.F_MED}
    R = 40
    for p in data["players"]:
        cx = x0 + 70 + (pw - 140) * p["x"]
        cy = y0 + 66 + (ph - 190) * p["y"]
        cx = min(max(cx, x0 + 100), x1 - 100)
        initials = (re.sub(r"[^A-Za-z0-9\u0600-\u06FF]", "", p["name"])[:2] or "?").upper()
        _photo_circle(cv, p.get("photo"), cx, cy, R, initials, cv.gold)
        cv.text(p["name"], dict(pl, max_w=176), y=cy + R + 24, x=cx, shadow=True)
        team = p.get("team") or ""
        tw = _measure.textlength(shape(team), font=font_at(templates.F_MED, S(21)), **text_kw(team)) / SS if team else 0
        tw = min(tw, 150)
        has_logo = bool(p.get("logo"))
        total = tw + (26 if has_logo else 0)
        sx = cx - total / 2
        if has_logo:
            _logo_chip(cv, p["logo"], sx + 12, cy + R + 52, 24)
        if team:
            cv.text(team, dict(tstyle, max_w=150), y=cy + R + 52, x=sx + (28 if has_logo else 0))
        if p.get("rating") not in (None, ""):
            cv.rect((cx + R - 14, cy - R - 2, cx + R + 30, cy - R + 26), fill=cv.gold, r=10)
            cv.text(p["rating"], dict(rt, color=cv.ink, size=22, max_w=40), y=cy - R + 12, x=cx + R + 8)
    return [cv.png()]


def render_best_xi(cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    if data["players"] and "x" in data["players"][0]:
        return render_xi_pitch(cfg, data, bg_path)
    """BEST XI: the selected players placed on a pitch by line (GK / DEF / MID / ATT) and left-to-right hint of their position."""
    cv = Canvas(cfg, background(cfg, bg_path))
    el = cfg["elements"]
    chrome(cv, data, 1, 1)
    x0, y0, x1, y1 = 56, 400, cfg["w"] - 56, 1250
    cv.rect((x0, y0, x1, y1), fill=(20, 110, 60, 70), outline=(255, 255, 255, 70), width=2, r=26)
    line = (255, 255, 255, 60)
    cv.line([(x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2)], line, 2)
    cv.ellipse((cfg["w"] / 2 - 90, (y0 + y1) / 2 - 90, cfg["w"] / 2 + 90, (y0 + y1) / 2 + 90), outline=line, width=2)
    for yy, d in ((y0, 1), (y1, -1)):
        cv.rect((cfg["w"] / 2 - 230, min(yy, yy + d * 150), cfg["w"] / 2 + 230, max(yy, yy + d * 150)), outline=line, width=2)
    groups: dict[int, list[dict]] = {}
    for p in data["players"][:11]:
        groups.setdefault(_line_of(p.get("position", "")), []).append(p)
    present = sorted(groups, reverse=True)                      # attackers at the top … goalkeeper at the bottom
    ys = [y1 - 120] if len(present) == 1 else [y0 + 90 + k * ((y1 - y0 - 230) / (len(present) - 1)) for k in range(len(present))]
    pl, rt = el["player"], el["rating"]
    for ln, yy in zip(present, ys):
        row = sorted(groups[ln], key=lambda p: _side(p.get("position", "")))
        n = len(row)
        for k, p in enumerate(row):
            cx = x0 + (x1 - x0) * (k + 1) / (n + 1)
            cv.glow(lambda d, cx=cx, yy=yy: d.ellipse([S(cx - 42), S(yy - 42), S(cx + 42), S(yy + 42)], fill=cv.gold[:3] + (120,)), 10, .55)
            cv.ellipse((cx - 38, yy - 38, cx + 38, yy + 38), fill=cv.gold, outline=(20, 8, 12, 255), width=3)
            cv.text((p.get("position") or "")[:3].upper(), {"x": cx, "size": 26, "min": 14, "color": cv.ink, "align": "center", "max_w": 64, "font": templates.O_BOLD}, y=yy)
            cv.text(p["name"], pl, y=yy + 62, x=cx, shadow=True)
            if p.get("rating") not in (None, ""):
                cv.text(p["rating"], rt, y=yy + 92, x=cx)
    return [cv.png()]


def render(type_: str, cfg: dict, data: dict, bg_path: str | None = None) -> list[bytes]:
    if type_ == "PLAYER_STATS":
        return render_stats(cfg, data, bg_path)
    if type_ == "BEST_XI":
        return render_best_xi(cfg, data, bg_path)
    if type_ == "TRANSFER":
        return render_transfer(cfg, data, bg_path)
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
    if type_ == "PLAYER_STATS":
        return {"subtitle": "لیگ برتر پرو · تا راند 5", "cards": [
            {"label": "TOP SCORER", "name": "Ali_10", "team": "تاج", "value": "12", "others": "2. Reza_7 — 9   ·   3. Sina_9 — 8"},
            {"label": "MOST ASSISTS", "name": "Mehdi_8", "team": "آزادی", "value": "9", "others": "2. Ali_10 — 7   ·   3. Arash_6 — 6"},
            {"label": "BEST GOALKEEPER", "name": "Keeper_1", "team": "لگسی", "value": "5 CS", "others": "2. GK_Pro — 4   ·   3. Wall_99 — 3"},
            {"label": "BEST AVG RATING", "name": "Star_11", "team": "آریا", "value": "8.42", "others": "2. Ali_10 — 8.30   ·   3. Mehdi_8 — 8.11"}]}
    if type_ == "BEST_XI":
        from . import formations
        return {"title": "TEAM OF THE TOURNAMENT", "subtitle": "ONE NIGHT CHAMPION · 4-3-3", "formation": "4-3-3", "players": formations.sample_players("4-3-3")}
    if type_ == "TRANSFER":
        return {"player": "Ali_10", "from": "آریا", "to": "تاج", "type_label": "انتقال", "date": "2026/10/11", "subtitle": "TRANSFER NEWS · PCL"}
    raise ValueError(type_)
