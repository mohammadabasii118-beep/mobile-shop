"""Demo of the Team of the Tournament manager + theme manager from a REAL run of tests/xi_test.py.
    RECORD=/tmp/recxi python3 -m tests.xi_test && python3 -m tests.xi_demo_build /tmp/recxi
"""
import json
import os
import re
import sys

from tests import onc_demo_build as odb

FA = {
    "Theme manager": "مدیریت تم‌ها (پیش‌فرض کل ربات / هر بخش)",
    "Team of the Tournament — AUTO or MANUAL": "تیم منتخب — روش ساخت: AUTO یا MANUAL",
    "Choose the tactical system": "«سیستم تاکتیکی تیم منتخب را انتخاب کنید.»",
    "Player 1 of 11 — id": "بازیکن شماره 1 از 11 — دروازه‌بان",
    "Player summary — confirm / edit / back": "خلاصه‌ی بازیکن: تأیید و بازیکن بعدی / ویرایش / بازگشت",
    "Preview of the final line-up": "پیش‌نمایش ترکیب نهایی (عکس، آیدی، تیم، لوگو)",
    "Choose a graphic theme": "تغییر تم گرافیکی",
    "Team of the Tournament — 3-4-3 + Electric Blue": "ترکیب 3-4-3 با تم Electric Blue",
    "AUTO — choose the scope": "AUTO — انتخاب بازه (کل مسابقه / راند)",
    "AUTO — line-up from the app stats (needs admin approval)": "AUTO — ترکیب ساخته‌شده از آمار اپ (قبل از انتشار تأیید ادمین)",
}


def main(rec):
    frames = json.load(open(os.path.join(rec, "frames.json")))
    data = []
    for i, f in enumerate(frames):
        msgs = [{"text": m["text"] or "", "rows": m["rows"], "img": odb.b64(os.path.join(rec, m["photo"])) if m["photo"] else None} for m in f["messages"]]
        data.append({"i": i, "title": f["title"], "fa": FA.get(f["title"], f["title"]), "kind": f["kind"], "messages": msgs})
    page = odb.TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False)).replace("🏆 ONE NIGHT CHAMPION — اجرای واقعی ربات", "⭐ تیم منتخب تورنمنت — اجرای واقعی ربات")
    os.makedirs("demo/xi-live", exist_ok=True)
    open("demo/xi-live/index.html", "w", encoding="utf-8").write(page)
    print("frames:", len(data), "KB:", len(page) // 1024)


if __name__ == "__main__":
    main(sys.argv[1])
