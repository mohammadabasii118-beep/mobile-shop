"""Public page shown when a user opens their subscription link in a browser: usage at a glance, the link with a QR code,
one-tap import buttons for the common apps, and every config grouped by location."""
import base64
from html import escape
from urllib.parse import quote

from .db import User

GB = 1024 ** 3
STATUS = {"active": ("فعال", "good"), "disabled": ("غیرفعال", "bad"), "expired": ("منقضی شده", "bad"),
          "quota": ("حجم تمام شده", "bad")}
STATUS_HINT = {"disabled": "این اشتراک غیرفعال شده است. برای فعال‌سازی با پشتیبانی تماس بگیرید.",
               "expired": "زمان این اشتراک تمام شده است. برای تمدید با پشتیبانی تماس بگیرید.",
               "quota": "حجم این اشتراک تمام شده است. برای تمدید یا افزایش حجم با پشتیبانی تماس بگیرید."}
FIELD_LABELS = {"server": "سرور", "username": "نام کاربری", "password": "رمز", "psk": "کلید اشتراکی (PSK)", "remote_id": "Remote ID",
                "address": "آدرس داخلی", "domain": "دامنه‌ی تونل", "public_key": "کلید عمومی", "uuid": "UUID", "local_port": "پورت محلی",
                "port": "پورت", "secret": "Secret", "ssh_user": "نام کاربری SSH", "ssh_password": "رمز SSH", "dns": "DNS"}
ICONS = {
    "copy": '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    "qr": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/>',
    "down": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    "moon": '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    "send": '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    "headset": '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z"/>',
}


def _i(name: str) -> str:
    return f'<svg class="i" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>'


def app_links(sub_url: str, name: str) -> list[tuple[str, str]]:
    """One-tap import links of the common client apps (they all accept the subscription URL)."""
    enc, nm = quote(sub_url, safe=""), quote(name, safe="")
    b64 = base64.b64encode(sub_url.encode()).decode()
    return [("Hiddify", f"hiddify://import/{sub_url}#{nm}"), ("v2rayNG", f"v2rayng://install-sub?url={enc}&name={nm}"),
            ("Streisand", f"streisand://import/{sub_url}#{nm}"), ("Shadowrocket", f"shadowrocket://add/sub://{b64}?remark={nm}"),
            ("sing-box", f"sing-box://import-remote-profile?url={enc}#{nm}")]


def qr_text(entry: dict) -> str | None:
    """What a QR code of this config should hold: its share link, or the WireGuard file; nothing for the rest."""
    if entry.get("link"):
        return entry["link"]
    if entry.get("proto") == "mtproto":
        return entry.get("copy")
    if entry.get("proto") == "wg":
        return (entry.get("details") or {}).get("config")
    return None


def _detail_rows(entry: dict) -> str:
    rows = []
    for k, v in (entry.get("details") or {}).items():
        if k == "config" or v in (None, ""):
            continue
        rows.append(f'<div class="kv"><span class="muted">{escape(FIELD_LABELS.get(k, k))}</span><code>{escape(str(v))}</code>'
                    f'<button class="ib" data-copy="{escape(str(v), quote=True)}" aria-label="کپی">{_i("copy")}</button></div>')
    return "".join(rows)


def _entry_row(e: dict, idx: int, sub_url: str) -> str:
    text = e.get("link") or e.get("copy") or ""
    acts = [f'<button class="ib" data-copy="{escape(text, quote=True)}" aria-label="کپی">{_i("copy")}</button>']
    if e.get("open"):
        acts.insert(0, f'<a class="ib" href="{escape(e["open"], quote=True)}" aria-label="باز کردن در تلگرام">{_i("send")}</a>')
    if qr_text(e):
        acts.append(f'<button class="ib" data-qr="{idx}" data-title="{escape(e["label"], quote=True)}" aria-label="QR">{_i("qr")}</button>')
    if e.get("file_ext"):
        acts.append(f'<a class="ib" href="{escape(sub_url, quote=True)}/file/{e["node_id"]}/{e["proto"]}" aria-label="دانلود فایل">{_i("down")}</a>')
    detail = _detail_rows(e)
    if detail:
        acts.append(f'<button class="ib" data-toggle aria-label="جزئیات">{_i("info")}</button>')
    shown = e.get("link") or e.get("summary") or ""
    return (f'<div class="entry"><div class="erow"><div class="etxt"><b>{escape(e["label"])}</b><code>{escape(shown)}</code></div>'
            f'<div class="acts">{"".join(acts)}</div></div>' + (f'<div class="details" hidden>{detail}</div>' if detail else "") + "</div>")


def render_sub_page(user: User, entries: list[dict], days_left: int | None, sub_url: str, brand: dict | None = None,
                    support_url: str = "") -> str:
    brand = brand or {"name": "", "logo": "", "color": ""}
    status = user.status()
    label, tone = STATUS[status]
    quota = user.quota_bytes
    used_gb, quota_gb = user.used_bytes / GB, quota / GB
    pct = min(100, user.used_bytes / quota * 100) if quota else 0
    ring_cls = "bad" if pct > 90 else "warn" if pct > 70 else ""
    left_gb = f"{max(0, quota_gb - used_gb):.2f} GB" if quota else "نامحدود"
    expiry_txt = "بدون انقضا" if days_left is None else (f"{days_left} روز مانده" if days_left > 0 else "امروز تمام می‌شود")
    expire_ms = int(user.expire_at.timestamp() * 1000) if user.expire_at else 0
    groups: dict[str, list[tuple[int, dict]]] = {}
    for idx, e in enumerate(entries):
        groups.setdefault(e["node"], []).append((idx, e))
    cards = "".join(
        f'<div class="grp"><div class="ghead"><span class="cc">{escape(items[0][1]["cc"])}</span><b>{escape(name)}</b>'
        f'<span class="muted">{len(items)} کانفیگ</span></div>{"".join(_entry_row(e, i, sub_url) for i, e in items)}</div>'
        for name, items in groups.items())
    if not cards:
        cards = f'<p class="muted empty">{escape(STATUS_HINT.get(status, "فعلاً کانفیگی برای نمایش نیست."))}</p>'
    apps = "".join(f'<a class="chip" href="{escape(u, quote=True)}">{escape(n)}</a>' for n, u in app_links(sub_url, user.name)) if status == "active" else ""
    logo = (f'<img src="{escape(brand["logo"], quote=True)}" alt="" class="blogo">' if brand["logo"]
            else f'<span class="blogo mark">{_i("shield")}</span>')
    brand_name = escape(brand["name"]) if brand["name"] else ""
    accent = ""
    if brand["color"]:
        c = brand["color"]
        accent = f":root{{--acc:{c};--acc2:color-mix(in srgb,{c} 62%,#0ea5e9)}}"
    icon = escape(brand["logo"], quote=True) if brand["logo"] else "data:,"
    title = escape(user.name) + (" · " + brand_name if brand_name else "")
    banner = (f'<div class="banner">{escape(STATUS_HINT[status])}</div>' if status != "active" else "")
    support = (f'<a class="btn pri" href="{escape(support_url, quote=True)}" rel="noopener">{_i("headset")}پشتیبانی</a>' if support_url else "")
    ring_txt = "∞" if not quota else f"{pct:.0f}%"
    ring_sub = "نامحدود" if not quota else "مصرف شده"
    quota_txt = f"{quota_gb:.2f} GB" if quota else "نامحدود"
    app_row = f'<div class="row2"><span class="muted">افزودن با یک لمس:</span>{apps}</div>' if apps else ""
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>{title}</title>
<link rel="icon" href="{icon}"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap" media="print" onload="this.media='all'">
<style>
:root{{color-scheme:light;--bg:#f3f6fb;--card:#fff;--soft:#eef2f8;--line:#dde5ef;--fg:#0f1b2a;--muted:#64748b;--acc:#0d9488;--acc2:#0284c7;--good:#16a34a;--warn:#d97706;--bad:#dc2626;
--glow1:rgba(13,148,136,.13);--glow2:rgba(2,132,199,.12);--shadow:0 1px 2px rgba(15,27,42,.05),0 10px 28px -14px rgba(15,27,42,.18);--grad:linear-gradient(135deg,var(--acc),var(--acc2))}}
@media (prefers-color-scheme:dark){{:root:not([data-theme=light]){{color-scheme:dark;--bg:#080d13;--card:#0f1720;--soft:#16212c;--line:#1f2d3a;--fg:#e6eef6;--muted:#8497a8;--good:#4ade80;--warn:#fbbf24;--bad:#f87171;
--glow1:rgba(45,212,191,.10);--glow2:rgba(56,189,248,.09);--shadow:0 12px 32px -14px rgba(0,0,0,.6)}}}}
:root[data-theme=dark]{{color-scheme:dark;--bg:#080d13;--card:#0f1720;--soft:#16212c;--line:#1f2d3a;--fg:#e6eef6;--muted:#8497a8;--good:#4ade80;--warn:#fbbf24;--bad:#f87171;
--glow1:rgba(45,212,191,.10);--glow2:rgba(56,189,248,.09);--shadow:0 12px 32px -14px rgba(0,0,0,.6)}}
{accent}
*{{box-sizing:border-box}}html{{-webkit-text-size-adjust:100%}}
body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.75 Vazirmatn,system-ui,Tahoma,sans-serif;min-height:100vh;
background-image:radial-gradient(800px 460px at 100% -10%,var(--glow1),transparent 60%),radial-gradient(640px 400px at 0 0,var(--glow2),transparent 60%);background-attachment:fixed;
padding:16px max(14px,env(safe-area-inset-right,0px)) 40px max(14px,env(safe-area-inset-left,0px))}}
.wrap{{max-width:760px;margin:auto;display:flex;flex-direction:column;gap:14px}}
.i{{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}}
.top{{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 2px 4px}}
.brand{{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px;min-width:0}}
.blogo{{width:38px;height:38px;border-radius:11px;object-fit:contain;flex:none}}.blogo.mark{{display:grid;place-items:center;background:var(--grad);color:#fff;box-shadow:0 6px 18px -6px var(--acc)}}
.theme{{all:unset;cursor:pointer;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--card);border:1px solid var(--line);color:var(--muted)}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:var(--shadow);min-width:0}}
.hero{{display:flex;gap:18px;align-items:center;flex-wrap:wrap}}
.ring{{--v:0;--c:var(--acc);width:118px;height:118px;border-radius:50%;flex:none;position:relative;display:grid;place-items:center;text-align:center;background:conic-gradient(var(--c) calc(var(--v)*1%),var(--soft) 0)}}
.ring.warn{{--c:var(--warn)}}.ring.bad{{--c:var(--bad)}}
.ring::before{{content:"";position:absolute;inset:10px;border-radius:50%;background:var(--card)}}
.ring>div{{position:relative;line-height:1.3}}.ring b{{display:block;font-size:22px;font-variant-numeric:tabular-nums}}.ring small{{color:var(--muted);font-size:11px}}
.who{{flex:1;min-width:220px}}.who h1{{margin:0 0 4px;font-size:20px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;word-break:break-all}}
.pill{{display:inline-flex;align-items:center;gap:6px;padding:0 10px;border-radius:99px;font-size:12px;font-weight:500;background:var(--soft);color:var(--muted)}}
.pill::before{{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}}
.pill.good{{background:color-mix(in srgb,var(--good) 15%,transparent);color:var(--good)}}.pill.bad{{background:color-mix(in srgb,var(--bad) 15%,transparent);color:var(--bad)}}
.stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:10px}}
.stats div{{background:var(--soft);border-radius:12px;padding:7px 12px}}.stats span{{display:block;color:var(--muted);font-size:11.5px}}.stats b{{font-size:15px;font-variant-numeric:tabular-nums}}
.num{{direction:ltr;unicode-bidi:isolate;display:inline-block}}
.banner{{border-radius:12px;padding:10px 14px;font-size:13px;background:color-mix(in srgb,var(--bad) 12%,transparent);color:var(--bad);border:1px solid color-mix(in srgb,var(--bad) 25%,transparent);width:100%}}
h2{{margin:0 0 10px;font-size:15px}}.muted{{color:var(--muted)}}
code{{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;direction:ltr;unicode-bidi:isolate}}
.linkrow{{display:flex;gap:4px;align-items:center;background:var(--soft);border-radius:12px;padding:4px 12px 4px 4px;min-width:0}}
.linkrow code{{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}}
.btn{{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:11px;background:var(--card);border:1px solid var(--line);font-size:13px;white-space:nowrap}}
.btn.pri{{background:var(--grad);color:#fff;border-color:transparent;font-weight:700}}
.btn:focus-visible,.ib:focus-visible,.chip:focus-visible,.theme:focus-visible{{outline:2px solid var(--acc);outline-offset:2px}}
.ib{{all:unset;cursor:pointer;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:var(--muted);flex:none}}.ib:hover{{background:var(--card);color:var(--acc)}}
.row2{{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}}.chip{{text-decoration:none;color:var(--fg);padding:5px 13px;border-radius:99px;background:var(--soft);border:1px solid transparent;font-size:13px}}.chip:hover{{border-color:var(--acc)}}
.grp{{margin-top:14px}}.grp:first-of-type{{margin-top:0}}.ghead{{display:flex;align-items:center;gap:8px;padding:0 2px 2px}}
.cc{{font:11px ui-monospace,monospace;background:var(--soft);padding:1px 7px;border-radius:6px;color:var(--muted)}}
.entry{{background:var(--soft);border-radius:14px;padding:6px 10px;margin-top:6px}}
.erow{{display:flex;align-items:center;gap:8px;min-width:0}}.etxt{{flex:1;min-width:0;display:flex;flex-direction:column}}
.etxt code{{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);text-align:left}}.acts{{display:flex;flex:none}}
.details{{padding:6px 4px 8px;border-top:1px dashed var(--line);margin-top:6px;display:flex;flex-direction:column;gap:2px}}
.kv{{display:grid;grid-template-columns:110px 1fr 34px;align-items:center;gap:8px}}.kv code{{overflow-wrap:anywhere;text-align:left}}
.empty{{text-align:center;padding:14px}}.foot{{text-align:center;color:var(--muted);font-size:12px}}
dialog{{border:0;border-radius:20px;padding:18px;background:var(--card);color:var(--fg);max-width:min(340px,92vw);box-shadow:0 30px 80px -20px rgba(0,0,0,.55);text-align:center}}
dialog::backdrop{{background:rgba(5,10,16,.6);backdrop-filter:blur(5px)}}dialog img{{width:100%;border-radius:12px;background:#fff;display:block}}
.toast{{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--fg);color:var(--bg);padding:8px 18px;border-radius:99px;font-size:13px;z-index:9}}
[hidden]{{display:none!important}}
@media (max-width:520px){{.ring{{width:100px;height:100px}}.ring b{{font-size:19px}}.kv{{grid-template-columns:90px 1fr 34px}}}}
</style></head><body><div class="wrap">
<div class="top"><div class="brand">{logo}<span>{brand_name}</span></div><button class="theme" id="theme" aria-label="تغییر تم">{_i("moon")}</button></div>
<section class="card hero"><div class="ring {ring_cls}" style="--v:{pct:.1f}"><div><b>{ring_txt}</b><small>{ring_sub}</small></div></div>
<div class="who"><h1><span>{escape(user.name)}</span><span class="pill {tone}">{label}</span></h1>
<div class="stats"><div><span>مصرف</span><b class="num">{used_gb:.2f} GB</b></div><div><span>حجم کل</span><b class="num">{quota_txt}</b></div>
<div><span>باقی‌مانده</span><b class="num">{left_gb}</b></div><div><span>زمان</span><b>{escape(expiry_txt)}</b></div></div>
<div class="muted" id="expdate" data-ms="{expire_ms}" style="margin-top:6px;font-size:12px"></div></div>{banner}</section>
<section class="card"><h2>لینک اشتراک</h2><div class="linkrow">
<button class="ib" data-copy="{escape(sub_url, quote=True)}" aria-label="کپی">{_i("copy")}</button><button class="ib" data-qr="-1" data-title="لینک اشتراک" aria-label="QR">{_i("qr")}</button>
<code>{escape(sub_url)}</code></div>
<p class="muted" style="margin:10px 0 0;font-size:12.5px">این لینک را در برنامه‌ی خود (Hiddify، v2rayNG، Streisand و ...) اضافه کنید؛ همه‌ی لوکیشن‌ها یک‌جا می‌آیند و حجم و زمان نشان داده می‌شود.</p>
{app_row}</section>
<section class="card"><h2>کانفیگ‌ها</h2>{cards}</section>
<div class="row2" style="justify-content:center">{support}</div>
<div class="foot">{brand_name}</div></div>
<dialog id="qrd"><h2 id="qrt" style="margin-bottom:12px"></h2><img id="qri" alt="QR"><p class="muted" style="font-size:12px;margin:10px 0 0">با برنامه‌ی خود اسکن کنید</p>
<form method="dialog" style="margin-top:12px"><button class="btn" style="margin:auto">بستن</button></form></dialog><div class="toast" id="toast" hidden></div>
<script>
const $=s=>document.querySelector(s),base={sub_url!r};
function toast(t){{const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,1600)}}
function copy(t){{(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('کپی شد'),()=>{{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{{document.execCommand('copy');toast('کپی شد')}}catch(_){{toast('متن را انتخاب و کپی کنید')}}a.remove()}})}}
document.addEventListener('click',e=>{{const b=e.target.closest('button,a');if(!b)return;
if(b.dataset.copy!==undefined){{copy(b.dataset.copy);return}}
if(b.dataset.qr!==undefined){{$('#qrt').textContent=b.dataset.title||'';$('#qri').src=base+'/qr.svg?i='+b.dataset.qr;$('#qrd').showModal();return}}
if(b.dataset.toggle!==undefined){{const d=b.closest('.entry').querySelector('.details');d.hidden=!d.hidden;return}}
if(b.id==='theme'){{const r=document.documentElement,dark=getComputedStyle(r).colorScheme.includes('dark');r.dataset.theme=dark?'light':'dark';try{{localStorage.setItem('subtheme',r.dataset.theme)}}catch(_){{}}}}}});
try{{const t=localStorage.getItem('subtheme');if(t)document.documentElement.dataset.theme=t}}catch(_){{}}
(function(){{const e=$('#expdate'),ms=+e.dataset.ms;if(ms){{try{{e.textContent='تاریخ پایان: '+new Date(ms).toLocaleDateString('fa-IR')}}catch(_){{}}}}}})();
</script></body></html>"""
