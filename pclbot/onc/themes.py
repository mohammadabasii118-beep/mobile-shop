"""Ten graphic themes for every PCL / ONE NIGHT CHAMPION image.

A theme is NOT a recolour: each one has its own background composition, header treatment, card/row style, score pill and
title ornament (the painters below). The renderer calls these hooks whenever `cfg["theme"]["style"]` is set; the three
legacy palettes (RED / BLUE / GOLD) have no style and keep the original look.

Palette keys: bg1 bg2 accent gold(=highlight) panel · ink (dark text on a highlight) · muted · label · ok · bad.
"""
import math
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SS = 2


def S(v) -> int:
    return int(round(v * SS))


def rgba(c, a: float | None = None):
    c = c.lstrip("#")
    if len(c) == 6:
        c += "ff"
    r, g, b, al = (int(c[i:i + 2], 16) for i in (0, 2, 4, 6))
    return (r, g, b, int(al if a is None else a * 255))


def _p(style, bg1, bg2, accent, hl, ink="#0b0b10", muted="#b8c0cc", label=None, **kw):
    d = {"style": style, "bg1": bg1, "bg2": bg2, "accent": accent, "gold": hl, "panel": "#ffffff14", "ink": ink, "muted": muted,
         "label": label or hl, "ok": "#45e08a", "bad": "#ff5f6d"}
    d.update(kw)
    return d


PALETTES = {
    "PREMIUM_ESPORTS": _p("premium_esports", "#050b1c", "#0c2a66", "#2f7bff", "#e8c24a", "#0a0f1e", label="#f0d37a", name="PREMIUM ESPORTS"),
    "CYBER_NEON": _p("cyber_neon", "#05030d", "#1a0b3f", "#b43bff", "#34f0ff", "#04040c", label="#7df5ff", name="CYBER NEON"),
    "MINIMAL_PRO": _p("minimal_pro", "#0a0a0b", "#17171a", "#ffffff", "#ffffff", "#0a0a0b", "#a9aab0", label="#d7d8dc", name="MINIMAL PRO"),
    "CHAMPIONS_GOLD": _p("champions_gold", "#060401", "#2a1d05", "#d9a521", "#ffd76a", "#1a1204", label="#f3c95b", name="CHAMPIONS GOLD"),
    "RED_ARENA": _p("red_arena", "#0c0205", "#4a0812", "#e2132d", "#ffffff", "#2a0509", label="#ff9aa6", name="RED ARENA"),
    "ELECTRIC_BLUE": _p("electric_blue", "#020a1f", "#06408f", "#22b8ff", "#5ff3ff", "#021227", label="#8ff6ff", name="ELECTRIC BLUE"),
    "FUTURISTIC_HUD": _p("futuristic_hud", "#010806", "#04261b", "#19e68c", "#7dffd0", "#01120b", "#9fc7b8", label="#69ffc4", name="FUTURISTIC HUD"),
    "DARK_CINEMATIC": _p("dark_cinematic", "#050505", "#1b1b1f", "#8a8f99", "#d8bf86", "#14110a", "#a7a7ad", label="#e2cd9b", name="DARK CINEMATIC"),
    "GLASSMORPHIC": _p("glassmorphic", "#0a1642", "#2b63cf", "#9fd4ff", "#ffffff", "#0b2152", "#d6e6ff", label="#e4f1ff", name="GLASSMORPHIC"),
    "WORLD_CUP_BROADCAST": _p("world_cup_broadcast", "#0a0b17", "#1a1330", "#d3112b", "#ffb81c", "#160a02", "#c2c6d4", label="#ffcf5a", name="WORLD CUP BROADCAST"),
}
ORDER = list(PALETTES)
NAMES = {k: v["name"] for k, v in PALETTES.items()}
NAMES_FA = {"PREMIUM_ESPORTS": "پریمیوم اسپورتز", "CYBER_NEON": "سایبر نئون", "MINIMAL_PRO": "مینیمال پرو", "CHAMPIONS_GOLD": "طلایی قهرمانان",
            "RED_ARENA": "رِد آرنا", "ELECTRIC_BLUE": "آبی الکتریکی", "FUTURISTIC_HUD": "فیوچریستیک HUD", "DARK_CINEMATIC": "تیره سینمایی",
            "GLASSMORPHIC": "شیشه‌ای", "WORLD_CUP_BROADCAST": "پخش زنده جام جهانی"}


# ------------------------------------------------------------------------------------------------------- helpers
def _vgrad(w, h, stops):
    col = Image.new("RGB", (1, 256))
    for i in range(256):
        t = i / 255
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                k = (t - t0) / max(t1 - t0, 1e-9)
                col.putpixel((0, i), tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(3)))
                break
    return col.resize((w, h))


def _hx(c):
    return rgba(c)[:3]


def _blend(im, layer):
    im.paste(layer.convert("RGB"), (0, 0), layer.getchannel("A"))


def _glow_layer(im, draw_fn, blur, alpha=1.0):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer, "RGBA"))
    layer = layer.filter(ImageFilter.GaussianBlur(S(blur)))
    if alpha < 1:
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
    _blend(im, layer)


def _orb(im, cx, cy, r, color, alpha, blur=None):
    w, h = im.size
    _glow_layer(im, lambda d: d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (int(alpha),)), blur or r * .35 / SS)


def _vignette(im, strength=.55, soft=.12):
    w, h = im.size
    vig = Image.new("L", (w, h), 0)
    ImageDraw.Draw(vig).ellipse([-int(w * .25), -int(h * .2), int(w * 1.25), int(h * 1.2)], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(int(w * soft)))
    im.paste((0, 0, 0), (0, 0), ImageChops.invert(vig).point(lambda v: int(v * strength)))


def _lines(im, items, color, blur=0.0, alpha=1.0, width=2):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for pts in items:
        d.line(pts, fill=color, width=S(width), joint="curve")
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(S(blur)))
    _blend(im, layer)


# ------------------------------------------------------------------------------------------------------ backgrounds
_BG_CACHE: dict = {}


def background(th: dict, w: int, h: int) -> Image.Image:
    """w, h are already supersampled (S) pixels. Dispatches on the theme style."""
    key = (th["style"], w, h)
    if key not in _BG_CACHE:
        _BG_CACHE[key] = globals()["_bg_" + th["style"]](th, w, h, random.Random(th["style"]))
    return _BG_CACHE[key].copy()


def _bg_premium_esports(th, w, h, rnd):
    im = _vgrad(w, h, [(0, _hx("#040a1a")), (.45, _hx("#0b2260")), (1, _hx("#040816"))])
    _orb(im, int(w * .85), int(h * .05), int(w * .55), _hx("#2f7bff"), 150)
    _orb(im, int(w * .05), int(h * .95), int(w * .42), _hx("#c99a2e"), 90)
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay, "RGBA")
    for k in range(9):                                          # cinematic light fan from the top centre
        a0 = math.radians(62 + k * 7.5)
        a1 = a0 + math.radians(2.2)
        R = h * 1.2
        d.polygon([(w * .5, -h * .05), (w * .5 + R * math.cos(a0), -h * .05 + R * math.sin(a0)), (w * .5 + R * math.cos(a1), -h * .05 + R * math.sin(a1))], fill=(190, 215, 255, 11))
    lay = lay.filter(ImageFilter.GaussianBlur(S(3)))
    _blend(im, lay)
    for x0, wd, a in ((.08, .018, 120), (.17, .006, 150), (.78, .03, 100)):          # brushed gold beams
        sx, sw, sk = int(w * x0), int(w * wd), int(h * .38)
        _glow_layer(im, lambda dd, sx=sx, sw=sw, sk=sk, a=a: dd.polygon([(sx + sk, 0), (sx + sk + sw, 0), (sx + sw, h), (sx, h)], fill=(232, 194, 74, a)), .8, .8)
    hexs = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hexs, "RGBA")
    r = S(34)
    for gy in range(int(h * .58), h + r, int(r * 1.5)):
        for gx in range(-r, w + r, int(r * 1.74)):
            ox = int(r * .87) if ((gy // int(r * 1.5)) % 2) else 0
            hd.polygon([(gx + ox + r * math.cos(math.radians(60 * i + 30)), gy + r * math.sin(math.radians(60 * i + 30))) for i in range(6)], outline=(120, 170, 255, 22), width=S(1))
    _blend(im, hexs)
    _vignette(im, .5)
    return im


def _bg_cyber_neon(th, w, h, rnd):
    im = _vgrad(w, h, [(0, _hx("#04030a")), (.5, _hx("#140a38")), (1, _hx("#04030a"))])
    _orb(im, int(w * .2), int(h * .08), int(w * .5), _hx("#7a2cff"), 120)
    _orb(im, int(w * .9), int(h * .55), int(w * .4), _hx("#1aa3ff"), 90)
    horizon = int(h * .62)
    items, items2 = [], []
    for i in range(1, 15):                                       # perspective floor grid
        t = (i / 14) ** 2.1
        y = horizon + int((h - horizon) * t)
        items.append([(0, y), (w, y)])
    for i in range(-14, 15):
        items2.append([(w * .5 + i * w * .02, horizon), (w * .5 + i * w * .17, h)])
    _lines(im, items + items2, (180, 70, 255, 150), blur=1.2, width=2)
    _lines(im, items + items2, (120, 230, 255, 70), width=1)
    for k, (yy, col) in enumerate(((int(h * .015), (52, 240, 255, 230)), (int(h * .028), (180, 59, 255, 200)))):
        _lines(im, [[(0, yy), (w, yy)]], col, blur=2.0, width=3)
        _lines(im, [[(0, yy), (w, yy)]], col, width=2)
    _vignette(im, .45)
    return im


def _bg_minimal_pro(th, w, h, rnd):
    im = _vgrad(w, h, [(0, _hx("#0c0c0e")), (.55, _hx("#17171a")), (1, _hx("#09090a"))])
    items = [[(x, 0), (x, h)] for x in range(0, w, S(90))] + [[(0, y), (w, y)] for y in range(0, h, S(90))]
    _lines(im, items, (255, 255, 255, 9), width=1)
    _lines(im, [[(S(56), int(h * .2)), (w - S(56), int(h * .2))]], (255, 255, 255, 40), width=2)
    _vignette(im, .35)
    return im


def _bg_champions_gold(th, w, h, rnd):
    im = _vgrad(w, h, [(0, _hx("#050301")), (.4, _hx("#1d1405")), (1, _hx("#040301"))])
    _orb(im, int(w * .5), int(h * .22), int(w * .62), _hx("#e0a817"), 135)
    _orb(im, int(w * .5), int(h * 1.02), int(w * .6), _hx("#b07a0a"), 120)
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay, "RGBA")
    for k in range(22):
        a0 = math.radians(k * 16.4 + 2)
        a1 = a0 + math.radians(4)
        R = h * 1.5
        d.polygon([(w * .5, h * .3), (w * .5 + R * math.cos(a0), h * .3 + R * math.sin(a0)), (w * .5 + R * math.cos(a1), h * .3 + R * math.sin(a1))], fill=(255, 215, 110, 14))
    _blend(im, lay.filter(ImageFilter.GaussianBlur(S(2))))
    dust = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dust, "RGBA")
    for _ in range(260):                                          # golden dust
        x, y, r = rnd.randint(0, w), rnd.randint(0, h), rnd.choice((1, 1, 2, 3, 4)) * SS
        dd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 215, 110, rnd.randint(40, 170)))
    _blend(im, dust.filter(ImageFilter.GaussianBlur(S(.6))))
    _vignette(im, .6)
    return im


def _bg_red_arena(th, w, h, rnd):
    im = _vgrad(w, h, [(0, _hx("#090104")), (.5, _hx("#3d0710")), (1, _hx("#080103"))])
    _orb(im, int(w * .15), int(h * .1), int(w * .5), _hx("#e2132d"), 130)
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay, "RGBA")
    sk = int(h * .55)
    for x0, wd, col in ((-.15, .22, (226, 19, 45, 70)), (.18, .05, (255, 255, 255, 38)), (.34, .16, (0, 0, 0, 120)), (.62, .03, (255, 255, 255, 60)),
                        (.7, .2, (226, 19, 45, 62)), (.98, .06, (255, 255, 255, 30))):
        sx, sw = int(w * x0), int(w * wd)
        d.polygon([(sx + sk, 0), (sx + sk + sw, 0), (sx + sw, h), (sx, h)], fill=col)
    _blend(im, lay)
    dots = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots, "RGBA")
    for gx in range(0, w, S(22)):                                 # halftone corner
        for gy in range(int(h * .72), h, S(22)):
            r = max(0, (gy - h * .72) / (h * .28)) * S(5)
            dd.ellipse([gx, gy, gx + r, gy + r], fill=(255, 255, 255, 20))
    _blend(im, dots)
    _vignette(im, .55)
    return im


def _bg_electric_blue(th, w, h, rnd):
    im = _vgrad(w, h, [(0, _hx("#020a1f")), (.5, _hx("#054a9e")), (1, _hx("#020a1f"))])
    _orb(im, int(w * .8), int(h * .12), int(w * .5), _hx("#22b8ff"), 150)
    _orb(im, int(w * .1), int(h * .8), int(w * .45), _hx("#0a5cff"), 120)
    bolts = []
    for k in range(4):                                            # seeded lightning
        x, y = rnd.uniform(.05, .95) * w, 0.0
        pts = [(x, y)]
        while y < h * rnd.uniform(.35, .75):
            x += rnd.uniform(-.06, .06) * w
            y += rnd.uniform(.03, .07) * h
            pts.append((x, y))
        bolts.append(pts)
    _lines(im, bolts, (95, 243, 255, 85), blur=3, width=6)
    _lines(im, bolts, (230, 255, 255, 120), width=2)
    items = [[(S(56), y), (S(56) + rnd.randint(S(80), S(260)), y)] for y in range(int(h * .55), h, S(34))]
    _lines(im, items, (95, 243, 255, 55), width=2)
    _vignette(im, .45)
    return im


def _bg_futuristic_hud(th, w, h, rnd):
    im = _vgrad(w, h, [(0, _hx("#010806")), (.5, _hx("#04261b")), (1, _hx("#010806"))])
    _orb(im, int(w * .8), int(h * .2), int(w * .45), _hx("#0fa86a"), 80)
    grid = [[(x, 0), (x, h)] for x in range(0, w, S(60))] + [[(0, y), (w, y)] for y in range(0, h, S(60))]
    _lines(im, grid, (25, 230, 140, 16), width=1)
    cx, cy = int(w * .8), int(h * .2)
    rings = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rings, "RGBA")
    for r, a in ((.10, 70), (.17, 45), (.26, 28)):
        R = int(w * r)
        rd.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(25, 230, 140, a), width=S(2))
    for k in range(72):                                           # tick marks
        a = math.radians(k * 5)
        r0, r1 = w * .26, w * (.285 if k % 6 == 0 else .272)
        rd.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))], fill=(25, 230, 140, 70), width=S(2))
    _blend(im, rings)
    scan = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scan, "RGBA")
    for y in range(0, h, S(6)):
        sd.line([(0, y), (w, y)], fill=(0, 0, 0, 40), width=S(2))
    _blend(im, scan)
    _vignette(im, .5)
    return im


def _bg_dark_cinematic(th, w, h, rnd):
    im = _vgrad(w, h, [(0, _hx("#050505")), (.5, _hx("#19191c")), (1, _hx("#040404"))])
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay, "RGBA")
    for cx, spread in ((.18, .22), (.5, .3), (.84, .22)):          # stadium floodlight cones
        d.polygon([(w * (cx - .015), -h * .02), (w * (cx + .015), -h * .02), (w * (cx + spread), h * .78), (w * (cx - spread), h * .78)], fill=(255, 240, 210, 26))
    _blend(im, lay.filter(ImageFilter.GaussianBlur(S(14))))
    for _ in range(24):                                            # bokeh
        _orb(im, rnd.randint(0, w), rnd.randint(0, int(h * .5)), rnd.randint(S(14), S(46)), (255, 235, 190), rnd.randint(12, 34), 4)
    items = [[(w * .5 + i * w * .12, h * .8), (w * .5 + i * w * .5, h)] for i in range(-4, 5)] + [[(0, h * (.8 + .2 * (j / 5) ** 1.8)), (w, h * (.8 + .2 * (j / 5) ** 1.8))] for j in range(1, 6)]
    _lines(im, items, (255, 255, 255, 14), width=2)
    _vignette(im, .72, .16)
    return im


def _bg_glassmorphic(th, w, h, rnd):
    im = _vgrad(w, h, [(0, _hx("#0a1642")), (.5, _hx("#2b63cf")), (1, _hx("#6fb3f2"))])
    _orb(im, int(w * .15), int(h * .12), int(w * .42), _hx("#bfe0ff"), 150)
    _orb(im, int(w * .9), int(h * .4), int(w * .38), _hx("#7b5cff"), 120)
    _orb(im, int(w * .3), int(h * .85), int(w * .5), _hx("#ffffff"), 90)
    _orb(im, int(w * .85), int(h * .95), int(w * .3), _hx("#33d6ff"), 110)
    return im


def _bg_world_cup_broadcast(th, w, h, rnd):
    im = _vgrad(w, h, [(0, _hx("#0a0b17")), (.5, _hx("#161233")), (1, _hx("#0a0b17"))])
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay, "RGBA")
    sk = int(h * .12)
    for y0, hh_, col in ((.0, .10, (211, 17, 43, 230)), (.105, .012, (255, 184, 28, 255)), (.93, .012, (255, 184, 28, 255)), (.945, .055, (211, 17, 43, 230))):
        d.polygon([(0, h * y0), (w, h * y0 - sk), (w, h * (y0 + hh_) - sk), (0, h * (y0 + hh_))], fill=col)
    d.polygon([(w * .62, 0), (w * .74, 0), (w * .50, h), (w * .38, h)], fill=(255, 255, 255, 12))
    d.polygon([(w * .80, 0), (w * .83, 0), (w * .61, h), (w * .58, h)], fill=(255, 184, 28, 22))
    _blend(im, lay)
    return im


# ------------------------------------------------------------------------------------------------------- header
def header(cv, hh: float, wide: bool) -> None:
    st = cv.th["style"]
    w = cv.w
    hl, ac = cv.gold, cv.accent
    c0 = w * (.76 if not wide else .70)
    if st == "premium_esports":
        cv.rect((0, 0, w, hh), fill=(2, 6, 20, 150))
        cv.poly([(c0, 0), (w, 0), (w, hh), (c0 - 70 * hh / 224, hh)], rgba("#2f7bff", .26))
        cv.gradient((0, hh - 4, w, hh), (232, 194, 74, 255), (255, 240, 170, 255), True)
        cv.gradient((0, 0, w, 7), (47, 123, 255, 255), (232, 194, 74, 255), True)
    elif st == "cyber_neon":
        cv.rect((0, 0, w, hh), fill=(4, 2, 14, 150))
        cv.glow(lambda d: d.line([(0, S(hh)), (w * SS, S(hh))], fill=(52, 240, 255, 255), width=S(5)), 3, .9)
        cv.rect((0, hh - 2, w, hh), fill=(52, 240, 255, 255))
        cv.poly([(c0 + 30, 0), (w, 0), (w, hh), (c0 - 40, hh)], (180, 59, 255, 60))
        cv.gradient((0, 0, w, 5), (180, 59, 255, 255), (52, 240, 255, 255), True)
    elif st == "minimal_pro":
        cv.rect((0, hh - 1, w, hh + 1), fill=(255, 255, 255, 70))
        cv.rect((56, hh - 1, 56 + 120, hh + 3), fill=(255, 255, 255, 255))
    elif st == "champions_gold":
        cv.rect((0, 0, w, hh), fill=(0, 0, 0, 170))
        cv.gradient((0, hh - 6, w, hh - 3), (140, 96, 10, 255), (255, 232, 140, 255), True)
        cv.gradient((0, hh + 3, w, hh + 5), (255, 232, 140, 255), (140, 96, 10, 255), True)
        cv.gradient((0, 0, w, 6), (255, 232, 140, 255), (140, 96, 10, 255), True)
    elif st == "red_arena":
        cv.rect((0, 0, w, hh), fill=(0, 0, 0, 125))
        cv.poly([(c0 + 60, 0), (w, 0), (w, hh), (c0 + 60 - 90 * hh / 224, hh)], (226, 19, 45, 235))
        cv.poly([(c0 + 35, 0), (c0 + 50, 0), (c0 + 50 - 90 * hh / 224, hh), (c0 + 35 - 90 * hh / 224, hh)], (255, 255, 255, 235))
        cv.rect((0, hh, w, hh + 4), fill=(255, 255, 255, 235))
    elif st == "electric_blue":
        cv.rect((0, 0, w, hh), fill=(2, 14, 44, 160))
        pts = [(0, hh)]
        for i in range(1, 25):
            pts.append((w * i / 24, hh - (7 if i % 2 else 0)))
        cv.glow(lambda d: d.line([(S(x), S(y)) for x, y in pts], fill=(95, 243, 255, 255), width=S(4)), 3, .9)
        cv.line(pts, (210, 255, 255, 255), 2)
        cv.poly([(c0, 0), (w, 0), (w, hh), (c0 - 60, hh)], (34, 184, 255, 55))
    elif st == "futuristic_hud":
        cv.rect((0, 0, w, hh), fill=(0, 12, 8, 150))
        for k in range(0, int(w), 24):
            cv.rect((k, hh - (10 if k % 96 == 0 else 5), k + 2, hh), fill=(25, 230, 140, 150))
        cv.rect((0, hh - 2, w, hh), fill=(25, 230, 140, 230))
        for x in (24, w - 24):
            d = 1 if x < w / 2 else -1
            cv.line([(x, 52), (x, 24), (x + d * 52, 24)], (125, 255, 208, 255), 3)
    elif st == "dark_cinematic":
        cv.gradient((0, 0, w, hh + 20), (0, 0, 0, 215), (0, 0, 0, 0), False)
        cv.rect((56, hh - 1, w - 56, hh), fill=(216, 191, 134, 110))
    elif st == "glassmorphic":
        cv.rect((22, 18, w - 22, hh - 8), fill=(255, 255, 255, 46), outline=(255, 255, 255, 120), width=1.5, r=34)
        cv.rect((50, 20, w - 50, 24), fill=(255, 255, 255, 80), r=2)
    elif st == "world_cup_broadcast":
        cv.rect((0, 0, w, hh), fill=(8, 9, 22, 245))
        cv.poly([(0, 0), (c0 + 40, 0), (c0 - 40, hh), (0, hh)], (211, 17, 43, 255))
        cv.poly([(c0 + 46, 0), (c0 + 68, 0), (c0 - 12, hh), (c0 - 34, hh)], (255, 184, 28, 255))
        cv.rect((0, hh, w, hh + 5), fill=(255, 184, 28, 255))
    else:
        raise KeyError(st)


def divider(cv, y: float) -> None:
    """The ornament under the title (portrait pages)."""
    st, hl = cv.th["style"], cv.gold
    w = cv.w
    a = (hl[0], hl[1], hl[2], 140)
    if st in ("minimal_pro", "dark_cinematic"):
        cv.rect((80, y, w - 80, y + 1.5), fill=a)
    elif st == "futuristic_hud":
        cv.line([(80, y), (w / 2 - 30, y), (w / 2 - 14, y - 12), (w / 2 + 14, y - 12), (w / 2 + 30, y), (w - 80, y)], a, 2)
    elif st in ("cyber_neon", "electric_blue"):
        cv.glow(lambda d: d.line([(S(80), S(y)), (S(w - 80), S(y))], fill=(hl[0], hl[1], hl[2], 255), width=S(4)), 3, .8)
        cv.rect((80, y - 1, w - 80, y + 1), fill=(hl[0], hl[1], hl[2], 255))
    elif st == "glassmorphic":
        cv.rect((80, y - 1, w - 80, y + 1), fill=(255, 255, 255, 90), r=1)
    elif st in ("red_arena", "world_cup_broadcast"):
        cv.poly([(80, y - 3), (w - 60, y - 3), (w - 80, y + 3), (60, y + 3)], hl)
    else:
        cv.line([(80, y), (500, y)], a, 2)
        cv.line([(580, y), (1000, y)], a, 2)
        cv.poly([(540, y - 9), (551, y), (540, y + 9), (529, y)], hl)


# -------------------------------------------------------------------------------------------------------- cards
def panel(cv, box, accent=True, strong=False, r=20, accent_color=None) -> None:
    st = cv.th["style"]
    x0, y0, x1, y1 = box
    ac = accent_color or cv.accent
    hl = cv.gold
    if st == "premium_esports":
        cv.gradient((x0, y0, x1, y1), (255, 255, 255, 44 if strong else 34), (255, 255, 255, 8), False, r)
        cv.rect(box, outline=(232, 194, 74, 150), width=1.5, r=r)
        cv.rect((x0 + 3, y0 + 1.5, x1 - 3, y0 + 3), fill=(255, 255, 255, 50), r=2)
        if accent:
            cv.gradient((x0, y0 + 12, x0 + 7, y1 - 12), (255, 232, 140, 255), (200, 150, 30, 255), False, 3)
    elif st == "cyber_neon":
        cv.rect(box, fill=(8, 4, 26, 150 if strong else 115), r=r * .5)
        cv.glow(lambda d: d.rounded_rectangle([S(x0), S(y0), S(x1), S(y1)], radius=S(r * .5), outline=(52, 240, 255, 255), width=S(3)), 4, .8)
        cv.rect(box, outline=(120, 240, 255, 230), width=1.6, r=r * .5)
        if accent:
            cv.rect((x0, y0 + 8, x0 + 5, y1 - 8), fill=ac[:3] + (255,), r=2)
    elif st == "minimal_pro":
        cv.rect(box, fill=(255, 255, 255, 14 if strong else 8), outline=(255, 255, 255, 46), width=1, r=max(r * .35, 4))
        if accent:
            cv.rect((x0, y0 + 10, x0 + 4, y1 - 10), fill=accent_color or (255, 255, 255, 255))
    elif st == "champions_gold":
        cv.rect(box, fill=(18, 12, 3, 205 if strong else 175), r=r * .6)
        cv.rect(box, outline=(255, 215, 106, 190), width=2, r=r * .6)
        cv.rect((x0 + 5, y0 + 5, x1 - 5, y1 - 5), outline=(255, 215, 106, 60), width=1, r=r * .5)
        if accent:
            cv.gradient((x0 + 9, y0 + 14, x0 + 14, y1 - 14), (255, 232, 140, 255), (160, 110, 14, 255), False, 2)
    elif st == "red_arena":
        k = min(18, (y1 - y0) * .2)
        cv.poly([(x0 + k, y0), (x1, y0), (x1 - k, y1), (x0, y1)], (0, 0, 0, 165 if strong else 135))
        cv.line([(x0 + k, y0), (x1, y0), (x1 - k, y1), (x0, y1), (x0 + k, y0)], (255, 255, 255, 60), 1.5)
        if accent:
            cv.poly([(x0 + k, y0), (x0 + k + 10, y0), (x0 + 10, y1), (x0, y1)], accent_color or (226, 19, 45, 255))
    elif st == "electric_blue":
        cv.rect(box, fill=(6, 50, 130, 105 if strong else 80), r=r)
        cv.glow(lambda d: d.rounded_rectangle([S(x0), S(y0), S(x1), S(y1)], radius=S(r), outline=(34, 184, 255, 255), width=S(3)), 4, .7)
        cv.rect(box, outline=(120, 232, 255, 190), width=1.5, r=r)
        if accent:
            cv.rect((x0, y0 + 12, x0 + 6, y1 - 12), fill=accent_color or (95, 243, 255, 255), r=3)
    elif st == "futuristic_hud":
        cv.rect(box, fill=(10, 60, 40, 40 if strong else 22))
        cv.rect(box, outline=(25, 230, 140, 55), width=1)
        L = min(22, (y1 - y0) * .35)
        col = (125, 255, 208, 255) if accent else (25, 230, 140, 200)
        for (cx, cy, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            cv.line([(cx, cy + dy * L), (cx, cy), (cx + dx * L, cy)], col, 2.5)
        if accent and accent_color:
            cv.rect((x0 + 6, y0 + 8, x0 + 9, y1 - 8), fill=accent_color)
    elif st == "dark_cinematic":
        cv.glow(lambda d: d.rounded_rectangle([S(x0 + 4), S(y0 + 10), S(x1 + 4), S(y1 + 12)], radius=S(r), fill=(0, 0, 0, 200)), 8, .9)
        cv.rect(box, fill=(14, 14, 16, 205 if strong else 185), r=r)
        cv.rect((x0 + 6, y0 + 1, x1 - 6, y0 + 2.5), fill=(255, 255, 255, 30), r=1)
        if accent:
            cv.rect((x0, y0 + 14, x0 + 3, y1 - 14), fill=accent_color or (216, 191, 134, 255))
    elif st == "glassmorphic":
        cv.rect(box, fill=(12, 34, 100, 96 if strong else 76), outline=(255, 255, 255, 135), width=1.5, r=r * 1.25)
        cv.rect((x0 + 8, y0 + 2, x1 - 8, y0 + 4), fill=(255, 255, 255, 110), r=2)
        if accent:
            cv.rect((x0 + 14, y1 - 6, x0 + 70, y1 - 3.5), fill=accent_color or (255, 255, 255, 230), r=2)
    elif st == "world_cup_broadcast":
        cv.rect(box, fill=(8, 9, 24, 238), r=3)
        cv.rect((x0, y1 - 4, x1, y1), fill=(255, 184, 28, 255))
        if accent:
            cv.poly([(x0, y0), (x0 + 16, y0), (x0 + 8, y1 - 4), (x0, y1 - 4)], accent_color or (211, 17, 43, 255))
    else:
        raise KeyError(st)


def pill(cv, box, h: float) -> None:
    """The score pill / badge behind big numbers."""
    st, hl = cv.th["style"], cv.gold
    x0, y0, x1, y1 = box
    ring = hl[:3] + (255,)
    if st == "minimal_pro":
        cv.rect(box, fill=(255, 255, 255, 14), outline=(255, 255, 255, 190), width=2, r=h * .22)
    elif st == "world_cup_broadcast":
        cv.poly([(x0 + 10, y0), (x1, y0), (x1 - 10, y1), (x0, y1)], (8, 9, 22, 255))
        cv.line([(x0 + 10, y0), (x1, y0), (x1 - 10, y1), (x0, y1), (x0 + 10, y0)], ring, 3)
    elif st == "red_arena":
        cv.poly([(x0 + 12, y0), (x1, y0), (x1 - 12, y1), (x0, y1)], (14, 3, 6, 250))
        cv.line([(x0 + 12, y0), (x1, y0), (x1 - 12, y1), (x0, y1), (x0 + 12, y0)], (255, 255, 255, 235), 3)
    elif st == "futuristic_hud":
        cv.rect(box, fill=(2, 22, 14, 245))
        L = 16
        for (cx, cy, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            cv.line([(cx, cy + dy * L), (cx, cy), (cx + dx * L, cy)], ring, 3)
    elif st in ("cyber_neon", "electric_blue"):
        cv.glow(lambda d: d.rounded_rectangle([S(x0), S(y0), S(x1), S(y1)], radius=S(h / 2), outline=ring, width=S(4)), 5, .9)
        cv.rect(box, fill=(4, 4, 18, 245), outline=ring, width=2.5, r=h / 2)
    elif st == "glassmorphic":
        cv.rect(box, fill=(255, 255, 255, 70), outline=(255, 255, 255, 190), width=2, r=h / 2)
    elif st == "dark_cinematic":
        cv.rect(box, fill=(8, 8, 9, 250), outline=ring, width=2, r=h * .3)
    else:                                                                       # premium / champions
        cv.glow(lambda d: d.rounded_rectangle([S(x0), S(y0), S(x1), S(y1)], radius=S(h / 2), fill=hl[:3] + (110,)), 7, .5)
        cv.rect(box, fill=(10, 8, 6, 245), outline=ring, width=3, r=h / 2)


def pos_badge(cv, cx, cy, r) -> None:
    """Group-table rank: a plain, neutral number holder — never a medal / gold / silver / bronze."""
    st = cv.th.get("style")
    if st in ("red_arena", "world_cup_broadcast"):
        cv.poly([(cx - r + 6, cy - r), (cx + r, cy - r), (cx + r - 6, cy + r), (cx - r, cy + r)], (255, 255, 255, 38))
    elif st == "futuristic_hud":
        cv.rect((cx - r, cy - r, cx + r, cy + r), outline=(125, 255, 208, 110), width=1.5)
    elif st == "minimal_pro":
        cv.rect((cx - r, cy - r, cx + r, cy + r), outline=(255, 255, 255, 110), width=1.5, r=6)
    else:
        cv.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, 34))
