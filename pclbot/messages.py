"""Editable bot messages (notifications and confirmations).

DEFAULTS holds the original text of every message the admin can edit from the panel (✉️ ویرایش پیام‌ها).
Texts are HTML; {name} placeholders are filled by the code (the allowed ones are listed per message).
An edited text is stored in the database and used immediately; a broken template falls back to the default.
"""
import logging

from . import db

log = logging.getLogger("pclbot")

# key: (label shown in the panel, default text, {placeholder: meaning})
DEFAULTS: dict[str, tuple[str, str, dict[str, str]]] = {
    "ad_submitted": ("ثبت آگهی (تأیید دریافت)", "✅ آگهی شماره <b>{id}</b> ثبت شد و بعد از تأیید مدیر منتشر می‌شه.\n💰 {price} از کیفت کسر شد.",
                     {"id": "شماره آگهی", "price": "هزینه"}),
    "ad_edit_submitted": ("ویرایش آگهی (ارسال برای تأیید)", "✅ ویرایش ثبت شد و برای تأیید مجدد مدیر ارسال شد.", {}),
    "ad_approved": ("تأیید آگهی", "✅ آگهی شماره <b>{id}</b> تأیید و منتشر شد.", {"id": "شماره آگهی"}),
    "ad_rejected": ("رد آگهی", "❌ آگهی شماره <b>{id}</b> رد شد.", {"id": "شماره آگهی"}),
    "ad_rejected_reason": ("رد آگهی (خط دلیل)", "📌 دلیل: {reason}", {"reason": "دلیلی که مدیر نوشته"}),
    "ad_rejected_refund": ("رد آگهی (خط بازگشت وجه)", "↩️ مبلغ {amount} به کیف پولت برگشت.", {"amount": "مبلغ"}),
    "ad_expired": ("انقضای آگهی", "⌛️ آگهی شماره <b>{id}</b> منقضی شد. از بخش «آگهی‌های ثبت‌شده» می‌تونی تمدیدش کنی.", {"id": "شماره آگهی"}),
    "payment_ok": ("پرداخت موفق", "✅ پرداخت موفق!\n💰 {amount} به کیف پولت اضافه شد.\n🧾 کد پیگیری: <code>{ref}</code>",
                   {"amount": "مبلغ", "ref": "کد پیگیری"}),
    "payment_cancel": ("پرداخت لغو شد", "❌ پرداخت انجام نشد یا لغو شد.", {}),
    "payment_failed": ("پرداخت تأیید نشد", "❌ پرداخت تأیید نشد. اگر مبلغ از حسابت کسر شده، از «ارتباط با ما» پیگیری کن.", {}),
    "gift_ok": ("کارت هدیه (موفق)", "🎉 <b>{amount}</b> به کیف پولت اضافه شد.", {"amount": "مبلغ"}),
    "badge_earned": ("دریافت نشان", "🎉 تبریک! نشان {emoji} <b>{name}</b> رو دریافت کردی.", {"emoji": "ایموجی نشان", "name": "نام نشان"}),
    "referral_reward": ("پاداش دعوت", "🎁 دوستت اولین آگهی معتبرش رو ثبت کرد و <b>{amount}</b> پاداش گرفتی!", {"amount": "مبلغ پاداش"}),
    "support_sent": ("ارسال پیام پشتیبانی", "✅ پیامت برای پشتیبانی ارسال شد. به‌زودی جواب می‌گیری.", {}),
    "join_required": ("جوین اجباری", "📢 برای استفاده از ربات اول در کانال‌های زیر عضو شو، بعد روی «✅ عضو شدم» بزن:", {}),
}

SAMPLES = {"id": "123", "price": "20,000 تومان", "reason": "اطلاعات ناقص است", "amount": "50,000 تومان", "ref": "1234567890",
           "emoji": "🥉", "name": "برنزی"}

_over: dict[str, str] = {}


class _Safe(dict):
    def __missing__(self, key):
        return "{" + key + "}"


def render(template: str, **kw) -> str:
    return template.format_map(_Safe(kw))


def T(key: str, **kw) -> str:
    """The (possibly edited) text of a message with its placeholders filled in."""
    default = DEFAULTS[key][1]
    text = _over.get(key)
    if text:
        try:
            return render(text, **kw)
        except (ValueError, IndexError, KeyError, AttributeError) as ex:  # broken template, e.g. a stray "{"
            log.warning("message %s has a broken template (%s); using the default", key, ex)
    return render(default, **kw)


def check(key: str, text: str) -> str | None:
    """None when the template is usable, otherwise a short reason."""
    allowed = set(DEFAULTS[key][2])
    try:
        import string
        names = {f[1].split(".")[0].split("[")[0] for f in string.Formatter().parse(text) if f[1] is not None}
        render(text, **{k: SAMPLES.get(k, "x") for k in allowed})
    except (ValueError, IndexError, KeyError, AttributeError):
        return "قالب نامعتبره؛ آکولادها ({}) رو چک کن."
    unknown = sorted(n for n in names if n not in allowed)
    if unknown:
        return "جای‌نگهدارنده نامعتبر: " + " ".join("{" + n + "}" for n in unknown)
    return None


async def load() -> None:
    _over.clear()
    for r in await db.fetchall("SELECT key, text FROM message_texts"):
        if r["key"] in DEFAULTS:
            _over[r["key"]] = r["text"]


async def save(key: str, text: str) -> None:
    await db.execute("INSERT INTO message_texts(key,text) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET text=excluded.text", key, text)
    await load()


async def reset(key: str | None = None) -> None:
    if key:
        await db.execute("DELETE FROM message_texts WHERE key=?", key)
    else:
        await db.execute("DELETE FROM message_texts")
    await load()


def is_changed(key: str) -> bool:
    return key in _over


def current(key: str) -> str:
    return _over.get(key) or DEFAULTS[key][1]
