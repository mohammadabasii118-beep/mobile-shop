"""Demo of the extra features from a REAL run of tests/fx_test.py.   RECORD=/tmp/recfx python3 -m tests.fx_test && python3 -m tests.fx_demo_build /tmp/recfx
Outputs demo/fx-live/index.html and (via Playwright) demo/screenshots/fx-live/*.png
"""
import json
import os
import re
import sys

from tests import onc_demo_build as odb

FA = {
    "Main menu (user)": "منوی اصلی کاربر — ورودی‌های جدید",
    "International subscription — plans": "اشتراک بین‌المللی — راست: استاندارد · چپ: پرو",
    "International subscription — payment details": "جزئیات پرداخت USDT (مبلغ، شبکه، آدرس ولت)",
    "Admin gets the receipt": "ادمین رسید را می‌گیرد (✅ تایید / ❌ رد)",
    "User notified: subscription active": "اطلاع به کاربر: اشتراک فعال شد",
    "Blacklist (user tab)": "بلک‌لیست بازیکنان (تب کاربر)",
    "Draft — second position (optional)": "درفت — انتخاب پست دوم (اختیاری)",
    "Draft — admin list": "درفت — لیست ثبت‌نامی‌ها در پنل ادمین",
    "Streamer — asks for another link": "Streamer — سؤال: لینک استریم دیگری داری؟",
    "Streamer — preview with link buttons": "Streamer — پیش‌نمایش با دکمه‌های لینک (هر لینک یک دکمه)",
    "Contests list (user)": "مسابقه فوتبالی — لیست و اعلام آمادگی",
    "Quiz — a question with 4 buttons": "سؤال با ۴ دکمه شیشه‌ای (۱۰ ثانیه)",
    "Quiz — final result": "پایان مسابقه — امتیاز و رتبه",
    "Hall of champions": "تالار قهرمانان (۱ تا ۳ هر دوره)",
    "Here We Go — admin": "ترنسفر نیوز (Here We Go) — پنل ادمین",
    "Here We Go — channel post": "پست Here We Go در کانال (گرافیک + متن)",
    "App graphics — choose the competition": "گرافیک اپ — اول مسابقه را انتخاب می‌کنی (لیگ / جام / تورنمنت)",
    "League tabs": "تب‌های مسابقه (لیگ)",
    "App graphic — league table": "جدول لیگ",
    "App graphic — player stats (top scorer / assists / GK / rating)": "آمار بازیکنان: بهترین گلزن، پاس گل، دروازه‌بان، میانگین امتیاز",
    "Round schedule — choose the round": "برنامه راندی — انتخاب راند (دکمه شیشه‌ای)",
    "App graphic — round schedule (times + title)": "برنامه راندی با ساعت و تایتل",
    "Team of the round — choose": "تیم منتخب — انتخاب راند",
    "App graphic — team of the round (pitch)": "تیم منتخب روی زمین",
    "Daily schedule — choose the day": "برنامه روزانه — انتخاب روز (روزهای دارای بازی)",
    "App graphic — daily schedule": "برنامه روزانه",
    "App graphic — cup bracket": "براکت جام",
}


def main(rec):
    odb.FA = FA
    frames = json.load(open(os.path.join(rec, "frames.json")))
    data = []
    for i, f in enumerate(frames):
        msgs = [{"text": m["text"] or "", "rows": m["rows"], "img": odb.b64(os.path.join(rec, m["photo"])) if m["photo"] else None} for m in f["messages"]]
        data.append({"i": i, "title": f["title"], "fa": FA.get(f["title"], f["title"]), "kind": f["kind"], "messages": msgs})
    page = (odb.TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False)).replace("🏆 ONE NIGHT CHAMPION — اجرای واقعی ربات", "⚙️ قابلیت‌های جدید PCL — اجرای واقعی ربات")
            .replace("ONE NIGHT CHAMPION | News", "کانال").replace("کانال — فقط اخبار تورنمنت", "کانال انتشار"))
    os.makedirs("demo/fx-live", exist_ok=True)
    open("demo/fx-live/index.html", "w", encoding="utf-8").write(page)
    print("frames:", len(data))
    from playwright.sync_api import sync_playwright
    out = "demo/screenshots/fx-live"
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(os.path.join(out, f))
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium" if os.path.exists("/opt/pw-browsers/chromium") else None)
        pg = b.new_page(viewport={"width": 480, "height": 900}, device_scale_factor=2, color_scheme="dark")
        for i, f in enumerate(frames):
            pg.goto(f"file://{os.getcwd()}/demo/fx-live/index.html?shot={i}")
            slug = re.sub(r"[^a-z0-9]+", "-", f["title"].lower()).strip("-")[:50]
            pg.locator(".stage").screenshot(path=f"{out}/{i + 1:02d}-{slug}.png")
        b.close()


if __name__ == "__main__":
    main(sys.argv[1])
