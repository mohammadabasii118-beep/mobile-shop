"""Builds the graphics gallery (demo/gfx/index.html + PNGs) from the REAL renderer.  python -m tests.onc_gfx_gallery"""
import base64
import io
import json
import os

from PIL import Image, ImageDraw

from pclbot.onc import render, templates

OUT = "demo/screenshots/gfx"


def emblem() -> bytes:
    im = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([10, 10, 390, 390], fill=(30, 90, 200, 255))
    d.polygon([(200, 70), (320, 300), (80, 300)], fill=(255, 255, 255, 255))
    d.ellipse([160, 190, 240, 270], fill=(30, 90, 200, 255))
    b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()


def main():
    os.makedirs(OUT, exist_ok=True)
    items = [("SCHEDULE", "برنامه بازی‌ها"), ("ROUND_RESULTS", "نتایج راند"), ("GROUP_TABLE", "جدول گروه (انگلیسی)"), ("QUALIFIED", "تیم‌های صعودکننده"),
             ("KO_MATCHES", "بازی‌های حذفی"), ("BRACKET", "جدول مرحله حذفی"), ("CHAMPION", "پوستر قهرمان (تنها گرافیک با لوگوی تیم)")]
    out = []
    for t, label in items:
        data = render.sample(t)
        if t == "CHAMPION":
            data["logo"] = emblem()
        png = render.render(t, templates.default_config(t), data)[0]
        open(f"{OUT}/{t.lower()}.png", "wb").write(png)
        out.append({"t": t, "label": label, "img": "data:image/png;base64," + base64.b64encode(png).decode()})
    page = TEMPLATE.replace("__DATA__", json.dumps(out, ensure_ascii=False))
    os.makedirs("demo/gfx", exist_ok=True)
    open("demo/gfx/index.html", "w", encoding="utf-8").write(page)
    # one overview sheet
    ims = [Image.open(f"{OUT}/{t.lower()}.png") for t, _ in items if t != "BRACKET"]
    h = 760
    ims = [i.resize((int(i.width * h / i.height), h), Image.LANCZOS) for i in ims]
    sheet = Image.new("RGB", (sum(i.width for i in ims) + 20 * (len(ims) + 1), h + 40), (8, 8, 12))
    x = 20
    for i in ims:
        sheet.paste(i, (x, 20)); x += i.width + 20
    sheet.save(f"{OUT}/overview.png")
    print("ok", len(out))


TEMPLATE = r"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ONC Graphics v2</title><style>
:root{--bg:#0b1118;--panel:#121a24;--line:#243344;--tx:#e8eef5;--mut:#8aa0b5;--gold:#ffd24a}
@media (prefers-color-scheme: light){:root:not([data-theme=dark]){--bg:#eef2f6;--panel:#fff;--line:#d5dde6;--tx:#14202b;--mut:#5b6e80}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.6 system-ui,"Segoe UI",Tahoma,sans-serif;padding:18px}
h1{font-size:20px;margin:0 0 6px}p.s{color:var(--mut);margin:0 0 14px;max-width:900px}
.facts{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 18px}.facts span{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;align-items:start}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:10px;cursor:zoom-in}.card b{display:block;margin:6px 4px 8px;font-size:14px}
.card img{width:100%;border-radius:10px;display:block}.wide{grid-column:span 2}@media(max-width:700px){.wide{grid-column:auto}}
.lb{position:fixed;inset:0;background:rgba(0,0,0,.9);display:none;align-items:center;justify-content:center;padding:12px;z-index:9;cursor:zoom-out}.lb img{max-width:100%;max-height:100%}
</style></head><body>
<h1>🎨 گرافیک‌های وان نایت چمپیون — طراحی جدید</h1>
<p class="s">هر هفت گرافیک یک هویت بصری مشترک دارند؛ کنار هم که قرار بگیرند مشخص است متعلق به یک تورنمنت‌اند. داده‌ها (نام تیم، نتیجه، راند، تاریخ، ساعت، صفحه) مثل قبل خودکار پر می‌شوند.</p>
<div class="facts"><span>🅿 جای ثابت لوگوی PCL بالا-چپ (همه‌ی گرافیک‌ها)</span><span>🔤 فونت: Vazirmatn (فارسی/انگلیسی) + Oswald (عنوان و عدد)</span><span>🎨 پالت قرمز/طلایی فعلی، با عمق و کنتراست بیشتر</span><span>🛡 لوگوی تیم فقط روی پوستر قهرمان</span></div>
<div class="grid" id="g"></div><div class="lb" id="lb"><img id="li"></div>
<script>const D=__DATA__;
document.getElementById('g').innerHTML=D.map(x=>`<div class="card ${x.t==='BRACKET'?'wide':''}"><b>${x.label}</b><img src="${x.img}" alt=""></div>`).join('');
document.getElementById('g').onclick=e=>{const i=e.target.closest('img');if(i){li.src=i.src;lb.style.display='flex'}};lb.onclick=()=>lb.style.display='none';
</script></body></html>"""

if __name__ == "__main__":
    main()
