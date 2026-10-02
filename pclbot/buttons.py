"""Editable button labels.

Every static inline-button label used by the bot is listed in REGISTRY. The admin panel (🔤 ویرایش دکمه‌ها) can change
the text and/or the emoji (including a Premium emoji shown as the button icon) of each one. Overrides are keyed by the
original label, so no handler code has to change; they are applied to outgoing requests by pclbot/outgoing.py.
tests/emoji_test.py checks that this list still covers every label written in the code.
"""
import re

from aiogram.types import InlineKeyboardButton

from . import db
from .emojis import EMOJI_RX, VS16

# (original label, scope) - scope is "user" or "admin" and only groups the list in the panel
REGISTRY: list[tuple[str, str]] = [
    ('🏅 نشان\u200cها', 'user'),
    ('✏️ ویرایش', 'user'),
    ('🗑 حذف', 'user'),
    ('✅ تأیید', 'user'),
    ('❌ رد', 'user'),
    ('✅ بله، حذف کن', 'user'),
    ('🔙 نه', 'user'),
    ('🔙 لغو', 'user'),
    ('⏭ رد کردن', 'user'),
    ('◀️ مرحله قبل', 'user'),
    ('❌ لغو', 'user'),
    ('🔁 تمدید', 'user'),
    ('⭐️ ارتقا به ویژه', 'user'),
    ('✅ تأیید و ارسال', 'user'),
    ('🎮 بازیکن آزاد', 'user'),
    ('🛡 جذب بازیکن', 'user'),
    ('📄 عادی', 'user'),
    ('⭐️ ویژه', 'user'),
    ('🗄 آگهی\u200cهای من', 'user'),
    ('🟢 فعال و در انتظار', 'user'),
    ('🔴 منقضی و ردشده', 'user'),
    ('✅ پرداخت از کیف پول', 'user'),
    ('🔙 بازگشت به پیش\u200cنمایش', 'user'),
    ('▶️ ادامه ثبت آگهی', 'user'),
    ('💳 افزایش موجودی', 'user'),
    ('💳 مشکل پرداخت', 'user'),
    ('📝 سؤال درباره آگهی', 'user'),
    ('💬 سایر موارد', 'user'),
    ('↩️ پاسخ', 'user'),
    ('💰 افزایش موجودی', 'user'),
    ('👤 مشخصات من', 'user'),
    ('✍️ مبلغ دلخواه', 'user'),
    ('📜 تراکنش\u200cها', 'user'),
    ('📝 ثبت آگهی جدید', 'user'),
    ('🗄 آگهی\u200cهای ثبت\u200cشده', 'user'),
    ('☎️ ارتباط با ما', 'user'),
    ('🎁 کارت هدیه', 'user'),
    ('👥 دعوت دوستان', 'user'),
    ('🏅 نشان\u200cهای افتخار', 'user'),
    ('🛠 پنل مدیریت', 'user'),
    ('💳 پرداخت آنلاین', 'user'),
    ('✅ عضو شدم', 'user'),
    ('📊 آمار', 'admin'),
    ('👥 کاربران', 'admin'),
    ('📋 آگهی\u200cها', 'admin'),
    ('💵 تراکنش\u200cها', 'admin'),
    ('⚙️ تعرفه و تنظیمات', 'admin'),
    ('🎁 کارت\u200cهای هدیه', 'admin'),
    ('📡 گروه انتشار', 'admin'),
    ('📣 پیام همگانی', 'admin'),
    ('📢 جوین اجباری', 'admin'),
    ('✨ ایموجی\u200cها', 'admin'),
    ('👮 مدیران', 'admin'),
    ('◀️ قبلی', 'admin'),
    ('بعدی ▶️', 'admin'),
    ('🔙 منوی اصلی', 'admin'),
    ('➕ افزایش موجودی', 'admin'),
    ('➖ کاهش موجودی', 'admin'),
    ('💬 پیام', 'admin'),
    ('🧹 برگرداندن به معمولی', 'admin'),
    ('✅ فعال', 'admin'),
    ('⌛️ منقضی', 'admin'),
    ('❌ ردشده', 'admin'),
    ('🔙 انصراف', 'admin'),
    ('➕ ساخت کد جدید', 'admin'),
    ('➕ افزودن مدیر', 'admin'),
    ('🔙 بازگشت', 'admin'),
    ('➕ افزودن کانال', 'admin'),
    ('👁 پیش\u200cنمایش', 'admin'),
    ('➕ افزودن ایموجی', 'admin'),
    ('🔎 فقط گرفتن ID', 'admin'),
    ('🧹 بازنشانی همه', 'admin'),
    ('✅ بله', 'admin'),
    ('➕ نشان جدید', 'admin'),
    ('➡️ بقیه موردها', 'admin'),
    ('🔎 ایموجی بعدی', 'admin'),
    ('🔤 ویرایش دکمه\u200cها', 'admin'),
    ('✉️ ویرایش پیام\u200cها', 'admin'),
    ('✏️ تغییر متن', 'admin'),
    ('😀 تغییر ایموجی', 'admin'),
    ('🧹 برگرداندن به پیش\u200cفرض', 'admin'),
    ('👁 پیش\u200cنمایش دکمه', 'admin'),
    ('✏️ ویرایش متن', 'admin'),
]

_over: dict[str, dict] = {}  # original label -> {"text": str|None, "emoji": str|None, "emoji_id": str|None}
_LEAD = re.compile("^(" + EMOJI_RX.pattern + ")\\s*")


def split(label: str) -> tuple[str, str]:
    """('🔙', 'بازگشت') for '🔙 بازگشت'; ('', label) when there is no leading emoji."""
    m = _LEAD.match(label)
    return (m.group(1).replace(VS16, ""), label[m.end():]) if m else ("", label)


async def load() -> None:
    _over.clear()
    for r in await db.fetchall("SELECT orig, text, emoji, emoji_id FROM button_labels"):
        _over[r["orig"]] = {"text": r["text"], "emoji": r["emoji"], "emoji_id": r["emoji_id"]}


async def save(orig: str, **fields) -> None:
    """Merge the given fields (text / emoji / emoji_id) into the override of one button."""
    cur = dict(_over.get(orig) or {"text": None, "emoji": None, "emoji_id": None})
    cur.update(fields)
    if not any(cur.values()):
        return await reset(orig)
    await db.execute(
        "INSERT INTO button_labels(orig,text,emoji,emoji_id) VALUES(?,?,?,?) ON CONFLICT(orig) DO UPDATE SET "
        "text=excluded.text, emoji=excluded.emoji, emoji_id=excluded.emoji_id", orig, cur["text"], cur["emoji"], cur["emoji_id"])
    await load()


async def reset(orig: str | None = None) -> None:
    if orig:
        await db.execute("DELETE FROM button_labels WHERE orig=?", orig)
    else:
        await db.execute("DELETE FROM button_labels")
    await load()


def has_overrides() -> bool:
    return bool(_over)


def has_premium() -> bool:
    return any(o.get("emoji_id") for o in _over.values())


def effective(orig: str) -> tuple[str, str, str | None]:
    """(text, fallback emoji, custom_emoji_id) the button currently shows."""
    emoji, text = split(orig)
    ov = _over.get(orig) or {}
    return ov.get("text") or text, ov.get("emoji") or emoji, ov.get("emoji_id")


def label_of(orig: str) -> str:
    text, emoji, _ = effective(orig)
    return f"{emoji} {text}".strip()


def apply(b: InlineKeyboardButton, premium: bool) -> InlineKeyboardButton:
    """Apply the text/emoji override of a button. With premium=True the custom emoji becomes the button icon."""
    ov = _over.get(b.text)
    if not ov:
        return b
    text, emoji, emoji_id = effective(b.text)
    if premium and emoji_id and b.icon_custom_emoji_id is None:
        return b.model_copy(update={"text": text, "icon_custom_emoji_id": emoji_id})
    return b.model_copy(update={"text": f"{emoji} {text}".strip()})
