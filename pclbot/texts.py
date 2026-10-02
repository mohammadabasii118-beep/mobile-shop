import hashlib
from html import escape

# (key, label, kind) kind: text | photo ; optional keys listed separately
PLAYER_FIELDS = [
    ("name", "👤 نام بازیکن", "text"),
    ("psn", "🆔 آیدی گیمینگ (PSN یا EA ID)", "text"),
    ("pos1", "🎯 پست اصلی", "text"),
    ("pos2", "🎯 پست دوم", "text"),
    ("history", "🏟 سوابق بازی", "text"),
    ("honors", "🏆 افتخارات بازیکن", "text"),
    ("days", "📅 تعداد روزهای فعال در هفته (عدد ۱ تا ۷)", "text"),
    ("hours", "⏰ ساعات فعالیت", "text"),
    ("ping", "📶 پینگ (فقط عدد، به میلی‌ثانیه)", "text"),
    ("stream", "📡 قابلیت استریم", "text"),
    ("country", "🌍 کشور محل زندگی", "text"),
    ("party", "🎙 توانایی صحبت در پارتی", "text"),
    ("photo", "🖼 تصویر کارت بازیکن", "photo"),
    ("notes", "📝 توضیحات تکمیلی", "text"),  # always the last question
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

# Fields picked with buttons: "single" = exactly one, "multi" = any number
POSITIONS = ["GK", "CB", "RB/LB", "CDM", "CM", "RM/LM", "CAM", "ST"]
YES_NO = ["بله", "خیر"]
CHOICES = {
    "pos1": POSITIONS, "pos2": POSITIONS, "positions": POSITIONS,
    "stream": YES_NO, "party": YES_NO,
}
CHOICE_MODE = {"pos1": "single", "pos2": "multi", "positions": "multi", "stream": "single", "party": "single"}
CHOICE_COLS: dict[str, int] = {}
# Digits-only questions: key -> (min, max, example)
NUMERIC = {"days": (1, 7, "5"), "ping": (1, 999, "45")}
NO_POS = "ندارد"

KIND_TITLE = {"player": "🎮 آگهی بازیکنان آزاد", "team": "🛡 آگهی جذب بازیکن"}
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
    "free_ad": "🎁 استفاده از آگهی رایگان",
    "free_ad_refund": "🎁 بازگشت آگهی رایگان",
    "free_ad_grant": "🎁 جایزه نشان (آگهی رایگان)",
}


AD_FOOTER = (
    "<b>🔮 The Biggest Transfer Market for Iranian Teams &amp; Players!</b>\n"
    "<b>👉 Join us: @ProClubs_Transfer!</b>"
)
# label of the URL button under every published ad (links to the bot)
AD_BUTTON = "برای درج آگهیت کلیک کن"


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
            f"🎮 <b>آگهی بازیکنان آزاد</b>\n{star}{line}\n"
            f"👤 <b>نام:</b> {e(d.get('name'))}\n"
            f"🆔 <b>آیدی گیمینگ:</b> <code>{e(d.get('psn'))}</code>\n"
            f"🎯 <b>پست اصلی:</b> {e(d.get('pos1'))}\n"
            f"🎯 <b>پست دوم:</b> {e(d.get('pos2'))}\n"
            f"🏟 <b>سوابق بازی:</b> {e(d.get('history'))}\n"
            f"🏆 <b>افتخارات:</b> {e(d.get('honors'))}\n"
        )
        # fields added later are skipped for older ads that don't have them
        if d.get("days"):
            body += f"📅 <b>روزهای فعال در هفته:</b> {e(d['days'])}\n"
        body += f"⏰ <b>ساعات فعالیت:</b> {e(d.get('hours'))}\n"
        if d.get("ping"):
            body += f"📶 <b>پینگ:</b> {e(d['ping'])} ms\n"
        if d.get("stream"):
            body += f"📡 <b>استریم:</b> {e(d['stream'])}\n"
        if d.get("country"):
            body += f"🌍 <b>کشور:</b> {e(d['country'])}\n"
        if d.get("party"):
            body += f"🎙 <b>صحبت در پارتی:</b> {e(d['party'])}\n"
    else:
        body = (
            f"🛡 <b>آگهی جذب بازیکن</b>\n{star}{line}\n"
            f"🏷 <b>تیم:</b> {e(d.get('team'))}\n"
            f"🎯 <b>پست‌های موردنیاز:</b> {e(d.get('positions'))}\n"
            f"🔢 <b>تعداد موردنیاز:</b> {e(d.get('count'))}\n"
            f"⏰ <b>ساعات فعالیت:</b> {e(d.get('hours'))}\n"
            f"📋 <b>شرایط جذب:</b> {e(d.get('terms'))}\n"
        )
    if d.get("notes"):
        body += f"📝 <b>توضیحات:</b> {e(d['notes'])}\n"
    body += f"📩 <b>ارتباط:</b> {contact_line(ad, user)}\n{line}\n{AD_FOOTER}"
    return body


def fingerprint(kind: str, d: dict) -> str:
    if kind == "player":
        key = f"{d.get('psn', '')}|{d.get('pos1', '')}"
    else:
        key = f"{d.get('team', '')}|{d.get('positions', '')}"
    return hashlib.sha1(f"{kind}|{key}".lower().replace(" ", "").encode()).hexdigest()
