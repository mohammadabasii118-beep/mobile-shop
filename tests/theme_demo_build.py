"""Builds demo/themes/index.html (10 themes × 10 graphics gallery) from the JPEG previews of tests.theme_matrix.

    python -m tests.theme_matrix /tmp/matrix && python -m tests.theme_demo_build /tmp/matrix
"""
import base64
import json
import os
import sys

from pclbot.onc import templates, themes


def main(src: str):
    data = []
    for th in themes.ORDER:
        items = []
        for ty in templates.TYPES:
            p = os.path.join(src, f"{th}__{ty}.jpg")
            items.append({"type": ty, "fa": templates.TYPE_LABEL[ty], "img": "data:image/jpeg;base64," + base64.b64encode(open(p, "rb").read()).decode()})
        data.append({"id": th, "name": themes.NAMES[th], "fa": themes.NAMES_FA[th], "items": items})
    page = TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False))
    os.makedirs("demo/themes", exist_ok=True)
    open("demo/themes/index.html", "w", encoding="utf-8").write(page)
    print("themes:", len(data), "KB:", len(page) // 1024)


TEMPLATE = r"""<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>10 Themes Gallery</title>
<style>
:root{--bg:#0b1118;--panel:#121a24;--line:#243344;--tx:#e8eef5;--mut:#8aa0b5;--ac:#4aa3ff}
:root:not([data-theme=dark]){}
@media (prefers-color-scheme: light){:root:not([data-theme=dark]){--bg:#eef2f6;--panel:#fff;--line:#d5dde6;--tx:#14202b;--mut:#5b6e80;--ac:#1d6fd8}}
:root[data-theme=light]{--bg:#eef2f6;--panel:#fff;--line:#d5dde6;--tx:#14202b;--mut:#5b6e80;--ac:#1d6fd8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.6 system-ui,"Segoe UI",Tahoma,sans-serif}
.wrap{max-width:1240px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:4px 0}.sub{color:var(--mut);margin:0 0 14px;font-size:13.5px}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.tab{background:var(--panel);border:1px solid var(--line);color:var(--tx);border-radius:10px;padding:8px 12px;cursor:pointer;font:inherit;font-size:13px}
.tab[aria-selected=true]{background:var(--ac);border-color:var(--ac);color:#fff}
.tab small{display:block;color:inherit;opacity:.75;font-size:11px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;cursor:zoom-in}
.card img{display:block;width:100%;height:auto}.card div{padding:8px 10px;font-size:13px;display:flex;justify-content:space-between;gap:8px}
.card span{color:var(--mut);direction:ltr;font-size:11.5px}
.lb{position:fixed;inset:0;background:rgba(0,0,0,.86);display:none;align-items:center;justify-content:center;padding:12px;z-index:9;cursor:zoom-out}
.lb.on{display:flex}.lb img{max-width:100%;max-height:100%;border-radius:10px}
@media(max-width:520px){.grid{grid-template-columns:repeat(2,1fr)}}
</style></head><body><div class="wrap">
<h1>🎭 ۱۰ تم × ۱۰ بخش = ۱۰۰ ترکیب</h1>
<p class="sub">هر تم ترکیب‌بندی، پس‌زمینه، هدر، کارت، پیل امتیاز و ظاهر جدول مخصوص خودش را دارد (فقط تغییر رنگ نیست). روی هر تصویر بزن تا بزرگ شود.</p>
<div class="tabs" id="tabs" role="tablist"></div><div class="grid" id="grid"></div></div>
<div class="lb" id="lb"><img id="lbi" alt=""></div>
<script>
const D=__DATA__;let cur=0;const $=id=>document.getElementById(id);
function render(){document.querySelectorAll('.tab').forEach((t,i)=>t.setAttribute('aria-selected',i===cur));
 $('grid').innerHTML=D[cur].items.map(x=>`<div class="card" data-s="${x.img}"><img loading="lazy" src="${x.img}" alt="${x.type}"><div><b>${x.fa}</b><span>${x.type}</span></div></div>`).join('')}
$('tabs').innerHTML=D.map((t,i)=>`<button class="tab" role="tab" data-i="${i}">${i+1}. ${t.name}<small>${t.fa}</small></button>`).join('');
$('tabs').onclick=e=>{const b=e.target.closest('.tab');if(b){cur=+b.dataset.i;render();location.hash=cur+1}};
$('grid').onclick=e=>{const c=e.target.closest('.card');if(c){$('lbi').src=c.dataset.s;$('lb').classList.add('on')}};
$('lb').onclick=()=>$('lb').classList.remove('on');
const h=+location.hash.slice(1);if(h>=1&&h<=D.length)cur=h-1;render();
</script></body></html>"""

if __name__ == "__main__":
    main(sys.argv[1])
