"""All 10 themes × all 10 graphics = 100 combinations, rendered from real default templates.   python -m tests.theme_matrix [outdir]

Asserts every combination renders at the right size and is not blank; writes JPEG previews (for the demo) when an outdir is given.
"""
import io
import os
import sys

from PIL import Image, ImageStat

from pclbot.onc import render, templates, themes

TYPES = templates.TYPES
assert len(TYPES) == 10 and len(themes.ORDER) == 10


def main(out: str | None):
    n = 0
    for th in themes.ORDER:
        for ty in TYPES:
            cfg = templates.default_config(ty, th)
            pages = render.render(ty, cfg, {"brand": "ONE NIGHT CHAMPION", **render.sample(ty)})
            im = Image.open(io.BytesIO(pages[0]))
            assert im.size == ((1920, 1080) if ty == "BRACKET" else (1080, 1350)), (th, ty, im.size)
            assert max(ImageStat.Stat(im.convert("L")).stddev) > 12, (th, ty, "blank image")
            # the same data in another theme through the override path (what the admin does with «تغییر تم»)
            if th == "RED_ARENA":
                alt = templates.apply_theme(templates.default_config(ty, "RED"), "CYBER_NEON", ty)
                assert alt["theme"]["style"] == "cyber_neon"
            if out:
                os.makedirs(out, exist_ok=True)
                im.convert("RGB").resize((540, int(540 * im.height / im.width)), Image.LANCZOS).save(os.path.join(out, f"{th}__{ty}.jpg"), quality=80)
            n += 1
    print(f"MATRIX OK: {n} combinations")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
