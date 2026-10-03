"""Builds the ONC demo from a REAL run of the bot (frames recorded by tests/onc_test.py with RECORD=dir).

    RECORD=/tmp/rec python3 -m tests.onc_test && python3 -m tests.onc_demo_build /tmp/rec
Outputs demo/onc-live/index.html (self-contained) and demo/screenshots/onc-live/*.png
"""
import base64
import html
import json
import os
import re
import sys

FA = {
    "Main menu — two sections": "منوی اصلی — دو بخش مستقل",
    "TRANSFER opens the existing Transfer menu": "بخش TRANSFER همان منوی قبلی ربات را باز می‌کند",
    "ONC viewer panel": "پنل کاربر ONE NIGHT CHAMPION (فقط بیننده)",
    "Admin: two independent panels": "ادمین: دو پنل مستقل",
    "ONC admin panel": "پنل ادمین مسابقات",
    "Create tournament — confirm step": "ساخت تورنمنت — مرحله تأیید (نام، تاریخ، ساعت، فاصله راندها)",
    "Tournament dashboard": "داشبورد تورنمنت",
    "ONC channel — not configured": "تنظیم کانال ONC — هنوز تنظیم نشده",
    "ONC channel — connected": "کانال ONC — متصل (عنوان، آیدی، یوزرنیم، وضعیت)",
    "Test connection — missing permission": "تست اتصال — دسترسی ویرایش پیام ندارد",
    "Team players": "بازیکنان تیم (فقط Player ID)",
    "Teams": "لیست تیم‌ها",
    "Group management (4/4/3/3 teams)": "مدیریت گروه‌ها — گروه‌ها با تعداد تیم نابرابر (۴/۴/۳/۳)",
    "Pre-tournament checklist (incomplete)": "چک‌لیست قبل از شروع — موارد ناقص دقیقاً مشخص است",
    "Set qualifiers": "تعیین تعداد صعودکننده هر گروه",
    "Schedule: all matches of a round share one time": "برنامه بازی‌ها — همهٔ مسابقات یک Round همزمان",
    "Schedule graphic in the ONC channel": "گرافیک برنامه در کانال ONC (دو صفحه، بدون لوگو)",
    "All checks ✓ → START TOURNAMENT enabled": "همه چک‌ها ✓ → دکمهٔ START TOURNAMENT فعال شد",
    "Live matches — round 1": "LIVE MATCHES — Round 1",
    "Result entry — first team goals": "ثبت نتیجه — گل تیم اول",
    "Result entry — second team goals": "ثبت نتیجه — گل تیم دوم",
    "Result preview": "پیش‌نمایش نتیجه (SAVE / EDIT / CANCEL)",
    "ROUND COMPLETED — text summary for review (nothing published yet)": "ROUND COMPLETED — خلاصهٔ متنی برای ادمین؛ هنوز چیزی منتشر نشده",
    "Round results graphic in the ONC channel": "بعد از CONFIRM & PUBLISH — گرافیک نتایج راند در کانال",
    "Standings after round 2": "جدول بعد از راند ۲ (فقط نتایج تأییدشده)",
    "Final group round — review": "آخرین راند گروهی — بازبینی",
    "Standings: unresolved tie blocks qualification": "تساوی حل‌نشده — صعود نهایی نمی‌شود (NEEDS ADMIN DECISION)",
    "Admin decides the unresolved tie": "ادمین ترتیب را دستی تعیین می‌کند",
    "Standings after the decision — qualification final": "بعد از تصمیم ادمین — صعود نهایی شد",
    "Group tables / qualified teams in the ONC channel": "جدول گروه‌ها و تیم‌های صعودکننده در کانال",
    "Knockout — qualified teams": "حذفی — تیم‌های صعودکننده",
    "Choose the stage": "انتخاب مرحله (فقط مرحله‌های لازم)",
    "Matchup: pick the opponent": "ادمین خودش حریف را انتخاب می‌کند (A1 vs B2 تحمیل نمی‌شود)",
    "Quarter finals — admin chose the matchups": "یک‌چهارم نهایی — matchupها را ادمین تعیین کرده",
    "Level knockout match — admin chooses the winner": "بازی مساوی در حذفی — برنده را ادمین انتخاب می‌کند",
    "Quarter finals — review before publishing": "یک‌چهارم نهایی — بازبینی قبل از انتشار",
    "Published result edited — update the channel post?": "ویرایش نتیجهٔ منتشرشده — به‌روزرسانی همان پست کانال؟",
    "Dependency protection — knockout would break": "محافظت وابستگی — این تغییر حذفی را خراب می‌کرد؛ بدون تأیید اعمال نمی‌شود",
    "Final": "فینال",
    "Final + champion poster published": "فینال + پوستر قهرمان (تنها گرافیکی که لوگو دارد)",
    "Bracket + champion in the channel": "براکت و قهرمان در کانال",
    "Viewer: standings": "کاربر عادی: جدول",
    "Viewer: champion": "کاربر عادی: قهرمان",
    "Template set": "مجموعهٔ تمپلیت‌ها",
    "Template page": "صفحهٔ تمپلیت",
    "Position editor": "ادیتور موقعیت (UP/DOWN/LEFT/RIGHT، Step 1/5/10/25)",
    "Template sets: duplicate / activate": "Template Set — کپی و فعال‌سازی",
    "Dangerous operation → confirmation": "عملیات خطرناک → تأیید لازم",
    "Audit log": "Audit Log",
    "Channel error → retry publish": "خطای کانال → نتایج ثبت شده‌اند، انتشار قابل تکرار است",
    "Automatic draw (then editable by hand)": "قرعه‌کشی خودکار (بعدش دستی هم قابل تغییر)",
}


def b64(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()


def main(rec):
    frames = json.load(open(os.path.join(rec, "frames.json")))
    data = []
    for i, f in enumerate(frames):
        msgs = []
        for m in f["messages"]:
            msgs.append({"text": m["text"] or "", "rows": m["rows"], "img": b64(os.path.join(rec, m["photo"])) if m["photo"] else None})
        data.append({"i": i, "title": f["title"], "fa": FA.get(f["title"], f["title"]), "kind": f["kind"], "messages": msgs})
    page = TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False))
    os.makedirs("demo/onc-live", exist_ok=True)
    open("demo/onc-live/index.html", "w", encoding="utf-8").write(page)
    print("frames:", len(data), "size KB:", len(page) // 1024)


TEMPLATE = r"""<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ONC Live Demo</title>
<style>
:root{--bg:#0b1118;--panel:#121a24;--bub:#1b2836;--line:#243344;--tx:#e8eef5;--mut:#8aa0b5;--ac:#4aa3ff;--btn:#27415c;--red:#ff4d5e}
@media (prefers-color-scheme: light){:root:not([data-theme=dark]){--bg:#eef2f6;--panel:#fff;--bub:#fff;--line:#d5dde6;--tx:#14202b;--mut:#5b6e80;--btn:#dbe8f5}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.55 system-ui,"Segoe UI",Tahoma,sans-serif}
.wrap{display:grid;grid-template-columns:330px 1fr;gap:18px;max-width:1180px;margin:0 auto;padding:16px}
@media(max-width:820px){.wrap{grid-template-columns:1fr}.side{max-height:240px}}
h1{font-size:19px;margin:0 0 4px}.sub{color:var(--mut);font-size:13px;margin:0 0 12px}
.side{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px;overflow:auto;max-height:calc(100vh - 32px);position:sticky;top:16px}
.item{display:flex;gap:8px;padding:8px 9px;border-radius:9px;cursor:pointer;font-size:13.5px;align-items:flex-start}
.item:hover{background:var(--btn)}.item.on{background:var(--ac);color:#fff}.item .n{opacity:.7;min-width:22px}
.item.ch .n:after{content:"📢"}
.stage{display:flex;flex-direction:column;align-items:center}
.cap{width:100%;max-width:440px;margin-bottom:10px}.cap b{display:block;font-size:16px}.cap span{color:var(--mut);font-size:12.5px;direction:ltr;display:block;text-align:left}
.phone{width:100%;max-width:440px;background:var(--panel);border:1px solid var(--line);border-radius:22px;overflow:hidden}
.top{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--line);direction:ltr}
.av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ff4d5e,#7a1030);display:grid;place-items:center;font-weight:700;color:#fff}
.nm{font-weight:600}.st{font-size:12px;color:var(--mut)}
.chat{padding:14px;display:flex;flex-direction:column;gap:6px;direction:ltr;min-height:240px}
.bub{background:var(--bub);border:1px solid var(--line);border-radius:14px;padding:9px 12px;max-width:100%;white-space:pre-wrap;word-wrap:break-word;text-align:left;unicode-bidi:plaintext}
.bub img{display:block;width:100%;border-radius:10px;margin-bottom:8px}
.bub pre{margin:6px 0;font:12.5px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre;overflow:auto;background:rgba(0,0,0,.18);padding:7px 8px;border-radius:8px}
.bub code{font:13px ui-monospace,Menlo,monospace;background:rgba(127,127,127,.2);padding:0 4px;border-radius:4px}
.kb{display:grid;gap:4px;margin-top:2px}.kb .r{display:flex;gap:4px}
.kb .b{flex:1;background:var(--btn);border-radius:9px;padding:8px 6px;text-align:center;font-size:13px;min-width:0;overflow-wrap:anywhere}
.nav{display:flex;gap:8px;margin:12px 0}
button{background:var(--btn);color:var(--tx);border:0;border-radius:9px;padding:8px 14px;font:inherit;cursor:pointer}
button:disabled{opacity:.4}
.feed .bub{background:var(--bub)}
.pill{display:inline-block;background:var(--red);color:#fff;border-radius:999px;padding:1px 9px;font-size:11px;margin-inline-start:6px}
body.shot .side,body.shot .nav,body.shot h1,body.shot .sub{display:none}body.shot .wrap{grid-template-columns:1fr;padding:8px}
</style></head><body>
<div class="wrap">
  <div>
    <h1>🏆 ONE NIGHT CHAMPION — اجرای واقعی ربات</h1>
    <p class="sub">این صفحه با اجرای <b>کد واقعی ربات</b> (هندلرها، دیتابیس و رندر گرافیک) ساخته شده؛ نه یک ماکت.</p>
    <div class="side" id="side"></div>
  </div>
  <div class="stage">
    <div class="cap"><b id="ft"></b><span id="fe"></span></div>
    <div class="phone"><div class="top"><div class="av" id="av">PCL</div><div><div class="nm" id="nm"></div><div class="st" id="st"></div></div></div>
      <div class="chat" id="chat"></div></div>
    <div class="nav"><button id="prev">⬅ قبلی</button><button id="next">بعدی ➡</button></div>
  </div>
</div>
<script>
const F=__DATA__;let cur=0;
const $=id=>document.getElementById(id);
function render(){const f=F[cur];$('ft').textContent=f.fa;$('fe').textContent=f.title;
 const ch=f.kind==='channel';$('nm').textContent=ch?'ONE NIGHT CHAMPION | News':'PCL BOT';$('st').textContent=ch?'کانال — فقط اخبار تورنمنت':'ربات';
 $('chat').className='chat'+(ch?' feed':'');
 $('chat').innerHTML=f.messages.map(m=>`<div class="bub">${m.img?`<img src="${m.img}">`:''}${m.text}</div>`+
  (m.rows.length?`<div class="kb">${m.rows.map(r=>`<div class="r">${r.map(t=>`<div class="b">${t.replace(/</g,'&lt;')}</div>`).join('')}</div>`).join('')}</div>`:'')).join('');
 document.querySelectorAll('.item').forEach((e,i)=>e.classList.toggle('on',i===cur));
 $('prev').disabled=cur===0;$('next').disabled=cur===F.length-1;
 const on=document.querySelector('.item.on');if(on&&!document.body.classList.contains('shot'))on.scrollIntoView({block:'nearest'});}
$('side').innerHTML=F.map((f,i)=>`<div class="item ${f.kind==='channel'?'ch':''}" data-i="${i}"><span class="n">${i+1}</span><span>${f.fa}</span></div>`).join('');
$('side').onclick=e=>{const t=e.target.closest('.item');if(t){cur=+t.dataset.i;render();location.hash=cur+1}};
$('prev').onclick=()=>{cur=Math.max(0,cur-1);render()};$('next').onclick=()=>{cur=Math.min(F.length-1,cur+1);render()};
document.onkeydown=e=>{if(e.key==='ArrowRight')$('prev').click();if(e.key==='ArrowLeft')$('next').click()};
const q=new URLSearchParams(location.search);if(q.get('shot')){document.body.classList.add('shot');cur=+q.get('shot')}
else if(+location.hash.slice(1))cur=+location.hash.slice(1)-1;
render();
</script></body></html>"""

if __name__ == "__main__":
    main(sys.argv[1])
