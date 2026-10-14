"""Demo of the VPN feature from a REAL run of tests/vpn_test.py.   RECORD=/tmp/recvpn python3 -m tests.vpn_test && python3 -m tests.vpn_demo_build /tmp/recvpn"""
import json
import os
import sys

from tests import onc_demo_build as odb

FA = {"VPN admin panel": "پنل ادمین: وضعیت پنل، لوکیشن‌های آنلاین، پلن‌ها", "Main menu with the multi-location button": "منوی اصلی با دکمه‌ی «🌍 مولتی‌لوکیشن»",
      "VPN plans": "پلن‌ها و موجودی کیف پول", "Buy confirmation": "تأیید خرید از کیف پول", "Service created": "سرویس ساخته شد: لینک اشتراک + راهنمای اتصال",
      "My service": "سرویس من: وضعیت، مصرف، زمان مانده، تمدید"}


def main(rec):
    frames = json.load(open(os.path.join(rec, "frames.json")))
    data = [{"i": i, "title": f["title"], "fa": FA.get(f["title"], f["title"]), "kind": f["kind"],
             "messages": [{"text": m["text"] or "", "rows": m["rows"], "img": None} for m in f["messages"]]} for i, f in enumerate(frames)]
    page = odb.TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False)).replace("🏆 ONE NIGHT CHAMPION — اجرای واقعی ربات", "🌍 مولتی‌لوکیشن — اجرای واقعی ربات")
    os.makedirs("demo/vpn-live", exist_ok=True)
    open("demo/vpn-live/index.html", "w", encoding="utf-8").write(page)
    print("frames:", len(data))


if __name__ == "__main__":
    main(sys.argv[1])
