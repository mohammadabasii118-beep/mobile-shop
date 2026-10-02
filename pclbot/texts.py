import hashlib
from html import escape

# (key, label, kind) kind: text | photo ; optional keys listed separately
PLAYER_FIELDS = [
    ("name", "👤 نام بازیکن", "text"),
    ("psn", "🆔 آیدی PSN یا EA ID", "text"),
    ("pos1", "🎯 پست اصلی", "text"),
    ("pos2", "🎯 پست دوم", "text"),
    ("history", "🏟 سابقه حضور در تیم‌ها", "text"),
    ("honors", "🏆 افتخارات بازیکن", "text"),
    ("hours", "⏰ ساعات فعالیت", "text"),
    ("notes", "📝 توضیحات تکمیلی", "text"),
    ("photo", "🖼 تصویر کارت بازیکن", "photo"),
]
TEAM_FIELDS = [
    ("team", "🛡 نام تیم", "text"),
    ("logo", "🖼 لوگوی تیم", "photo"),
    ("captain_tg", "✈️ آیدی تلگرام کاپیتان", "text"),
    ("positions", "🎯 پست‌های موردنیاز", "text"),
    ("count", "🔢 تعداد بازیکنان موردنیاز", "text"),
    ("hours", "⏰ ساعات فعالیت", "text"),
    ("terms", "📋 شرایط جذب", "text"),
    ("notes", "📝 توضیحات تکمیلی", "text"),
]
OPTIONAL = {"photo", "logo", "notes"}

KIND_TITLE = {"player": "🎮 آگهی بازیکن آزاد", "team": "🛡 آگهی جذب بازیکن"}
STATUS_TITLE = {
    "pending": "⏳ در انتظار تأیید",
    "approved": "✅ تأییدشده و منتشرشده",
    "rejected": "❌ ردشده",
    "expired": "⌛️ منقضی‌شده",
}
TX_TITLE = {
    "topup": "💳 افزایش موجودی",
    "ad": "📝 ثبت آگهی",
    "renew": "🔁 تمدید آگهی",
    "upgrade": "⭐ ارتقا به ویژه",
    "gift": "🎁 کارت هدیه",
    "referral": "👥 پاداش دعوت",
    "refund": "↩️ بازگشت وجه",
    "admin": "🛠 تغییر توسط مدیر",
}


AD_FOOTER = (
    "🔮 The Biggest Transfer Market for Iranian Teams &amp; Players.\n"
    "👉 Join us: @PCL_ProClubs"
)


def fields_of(kind: str) -> list[tuple[str, str, str]]:
    return PLAYER_FIELDS if kind == "player" else TEAM_FIELDS


def money(n: int) -> str:
    return f"{n:,} تومان"


def fmt_date(ts: int | None) -> str:
    if not ts:
        return "—"
    import datetime as dt
    return dt.datetime.fromtimestamp(ts).strftime("%Y/%m/%d %H:%M")


def e(v) -> str:
    return escape(str(v or "—"))


def contact_line(ad: dict, user: dict | None) -> str:
    if ad["kind"] == "team":
        tg = (ad["data"].get("captain_tg") or "").strip()
        if tg:
            return e(tg if tg.startswith("@") else "@" + tg.lstrip("@/").replace("t.me/", ""))
    if user and user.get("username"):
        return f"@{escape(user['username'])}"
    return f'<a href="tg://user?id={ad["user_id"]}">پیام در تلگرام</a>'


def render_ad(ad: dict, user: dict | None = None, preview: bool = False) -> str:
    d = ad["data"]
    star = "⭐️ <b>ویژه</b>\n" if ad.get("special") else ""
    line = "━━━━━━━━━━━━━━"
    if ad["kind"] == "player":
        body = (
            f"🎮 <b>بازیکن آزاد</b>\n{star}{line}\n"
            f"👤 <b>نام:</b> {e(d.get('name'))}\n"
            f"🆔 <b>آیدی:</b> <code>{e(d.get('psn'))}</code>\n"
            f"🎯 <b>پست اصلی:</b> {e(d.get('pos1'))}\n"
            f"🎯 <b>پست دوم:</b> {e(d.get('pos2'))}\n"
            f"🏟 <b>سوابق:</b> {e(d.get('history'))}\n"
            f"🏆 <b>افتخارات:</b> {e(d.get('honors'))}\n"
            f"⏰ <b>ساعات فعالیت:</b> {e(d.get('hours'))}\n"
        )
        tags = "#بازیکن_آزاد #PCL"
    else:
        body = (
            f"🛡 <b>آگهی جذب بازیکن</b>\n{star}{line}\n"
            f"🏷 <b>تیم:</b> {e(d.get('team'))}\n"
            f"🎯 <b>پست‌های موردنیاز:</b> {e(d.get('positions'))}\n"
            f"🔢 <b>تعداد موردنیاز:</b> {e(d.get('count'))}\n"
            f"⏰ <b>ساعات فعالیت:</b> {e(d.get('hours'))}\n"
            f"📋 <b>شرایط جذب:</b> {e(d.get('terms'))}\n"
        )
        tags = "#جذب_بازیکن #PCL"
    if d.get("notes"):
        body += f"📝 <b>توضیحات:</b> {e(d['notes'])}\n"
    body += f"{line}\n📩 <b>ارتباط:</b> {contact_line(ad, user)}\n\n{tags}\n\n{AD_FOOTER}"
    return body


def fingerprint(kind: str, d: dict) -> str:
    if kind == "player":
        key = f"{d.get('psn', '')}|{d.get('pos1', '')}"
    else:
        key = f"{d.get('team', '')}|{d.get('positions', '')}"
    return hashlib.sha1(f"{kind}|{key}".lower().replace(" ", "").encode()).hexdigest()
