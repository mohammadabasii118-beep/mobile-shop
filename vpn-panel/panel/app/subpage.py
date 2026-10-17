"""Public page shown when a user opens their subscription link in a browser."""
from html import escape

from .db import User

GB = 1024 ** 3


def render_sub_page(user: User, entries: list[dict], days_left: int | None, sub_url: str, brand: dict | None = None) -> str:
    brand = brand or {"name": "", "logo": "", "color": ""}
    pct = min(100, user.used_bytes / user.quota_bytes * 100) if user.quota_bytes else 0
    quota = f"{user.quota_bytes / GB:.2f} GB" if user.quota_bytes else "نامحدود"
    status = {"active": ("فعال", "good"), "disabled": ("غیرفعال", "bad"), "expired": ("منقضی", "bad"),
              "quota": ("حجم تمام شده", "bad")}[user.status()]
    expiry = "بدون انقضا" if days_left is None else f"{days_left} روز مانده"
    rows = []
    for e in entries:
        text = e["link"] or e["copy"] or ""
        shown = e["link"] or e["summary"] or ""
        download = (f'<a class="btn" href="{escape(sub_url, quote=True)}/file/{e["node_id"]}/{e["proto"]}">دانلود فایل</a>'
                    if e.get("file_ext") else "")
        rows.append(f'<div class="row"><span class="cc">{escape(e["cc"])}</span><b class="loc">{escape(e["node"])}</b>'
                    f'<span class="muted proto">{escape(e["label"])}</span>'
                    f'<code>{escape(shown)}</code>{download}<button data-copy="{escape(text, quote=True)}">کپی</button></div>')
    accent = f"<style>:root{{--acc:{brand['color']}}}@media (prefers-color-scheme:dark){{:root{{--acc:{brand['color']}}}}}</style>" if brand["color"] else ""
    logo = f'<img src="{escape(brand["logo"], quote=True)}" alt="" style="width:40px;height:40px;object-fit:contain;border-radius:10px">' if brand["logo"] else ""
    head = (f'<div style="display:flex;align-items:center;gap:10px;font-weight:700">{logo}<span>{escape(brand["name"])}</span></div>'
            if brand["name"] or logo else "")
    icon = escape(brand["logo"], quote=True) if brand["logo"] else "data:,"
    body = "".join(rows) or '<p class="muted">فعلاً کانفیگی برای نمایش نیست.</p>'
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(user.name)}{" · " + escape(brand["name"]) if brand["name"] else ""}</title>
<link rel="icon" href="{icon}"><style>
:root{{color-scheme:light;--bg:#f3f5f7;--card:#fff;--line:#d9e0e6;--fg:#12202b;--muted:#5d6e7c;--acc:#0b7a6e;--soft:#eaeef2;--good:#1b8a4b;--bad:#c0392b}}
@media (prefers-color-scheme:dark){{:root{{color-scheme:dark;--bg:#0d1419;--card:#141d24;--line:#26343f;--fg:#e4ecf1;--muted:#8a9ba8;--acc:#2fc4b2;--soft:#1c2831;--good:#4cc582;--bad:#ec6b5c}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.7 system-ui,Tahoma,sans-serif;
padding:20px max(16px,env(safe-area-inset-right,0px)) 40px max(16px,env(safe-area-inset-left,0px))}}
main{{max-width:760px;margin:auto;display:flex;flex-direction:column;gap:14px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;min-width:0}}
h1{{margin:0;font-size:19px}}.muted{{color:var(--muted)}}
.bar{{height:8px;border-radius:4px;background:var(--soft);overflow:hidden;margin:10px 0}}.bar i{{display:block;height:100%;background:var(--acc)}}
.stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}}.stats div{{background:var(--soft);border-radius:8px;padding:8px 12px}}
.stats b{{display:block;font-size:17px}}.pill{{padding:1px 10px;border-radius:99px;background:var(--soft)}}.good{{color:var(--good)}}.bad{{color:var(--bad)}}
.row{{display:flex;gap:8px;align-items:center;background:var(--soft);border-radius:8px;padding:6px 10px;margin-top:8px;min-width:0}}
.row code{{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:left;font-size:12px}}
.loc{{white-space:nowrap}}.proto{{white-space:nowrap;font-size:12px}}
.cc{{font:11px monospace;background:var(--card);padding:1px 6px;border-radius:4px}}
a.btn{{text-decoration:none;color:var(--fg);border:1px solid var(--line);background:var(--card);border-radius:8px;padding:3px 12px;white-space:nowrap}}
button{{cursor:pointer;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:8px;padding:3px 12px;font:inherit}}
button:focus-visible,a.btn:focus-visible{{outline:2px solid var(--acc)}}
</style>{accent}</head><body><main>
{head}
<div class="card"><h1>{escape(user.name)} <span class="pill {status[1]}">{status[0]}</span></h1>
<div class="bar"><i style="width:{pct:.1f}%"></i></div>
<div class="stats"><div><span class="muted">مصرف</span><b dir="ltr">{user.used_bytes / GB:.2f} GB</b></div>
<div><span class="muted">حجم کل</span><b dir="ltr">{quota}</b></div><div><span class="muted">زمان</span><b>{escape(expiry)}</b></div></div>
<p class="muted" style="margin-bottom:0">حجم و زمان بین همه‌ی کانفیگ‌های زیر مشترک است.</p></div>
<div class="card"><h1>لینک اشتراک</h1><p class="muted">این لینک را در برنامه‌ی کلاینت (v2rayNG، Hiddify، Streisand و ...) وارد کنید؛ همه‌ی لوکیشن‌ها یک‌جا می‌آیند و حجم نمایش داده می‌شود.</p>
<div class="row"><code>{escape(sub_url)}</code><button data-copy="{escape(sub_url, quote=True)}">کپی</button></div></div>
<div class="card"><h1>کانفیگ‌ها</h1>{body}</div></main>
<script>document.addEventListener('click',e=>{{const t=e.target.dataset&&e.target.dataset.copy;if(!t)return;
const b=e.target;const done=()=>{{b.textContent='کپی شد';setTimeout(()=>b.textContent='کپی',1200)}};
(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(done,()=>{{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{{document.execCommand('copy');done()}}catch(_){{}}a.remove()}})}});</script></body></html>"""
