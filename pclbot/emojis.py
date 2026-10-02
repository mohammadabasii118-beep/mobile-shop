"""Telegram custom (Premium) emoji support (the request rewriting itself lives in pclbot/outgoing.py).

How it works
------------
* Every ordinary emoji used by the bot is a *slot* (see REGISTRY). Giving a slot a custom_emoji_id makes the bot
  send that custom emoji instead, everywhere: message texts, captions and the icon of inline buttons.
* IDs are stored in the database and managed from the admin panel (✨ ایموجی‌ها); nothing needs a restart.
* DEFAULT_IDS below lets you hard-code IDs as well. Values that are not digits (placeholders) are ignored,
  and an ID set in the panel wins over DEFAULT_IDS.
* The conversion is done in one place (EmojiRequestMiddleware), so the rest of the code keeps using plain emoji.
  If Telegram rejects a request that carries custom emoji, the original plain-emoji request is sent instead.
"""
import logging
import re

from . import db

log = logging.getLogger("pclbot")

# (emoji, label shown in the admin panel). Add a line here to make a new emoji appear in the list;
# emojis that are not listed can still be added from the panel (➕ افزودن ایموجی).
REGISTRY: list[tuple[str, str]] = [
    ("✅", "تأیید"),
    ("⚠", "هشدار"),
    ("💰", "پول / موجودی"),
    ("✍", "نوشتن"),
    ("❌", "لغو / رد"),
    ("⭐", "آگهی ویژه"),
    ("🔙", "بازگشت"),
    ("🗑", "حذف"),
    ("⏳", "در انتظار / مدت"),
    ("👤", "کاربر"),
    ("📝", "ثبت آگهی / توضیحات"),
    ("💳", "پرداخت"),
    ("🎁", "هدیه"),
    ("✏", "ویرایش"),
    ("🎯", "پست"),
    ("👥", "دعوت دوستان"),
    ("📢", "اعلان / کانال"),
    ("➕", "افزودن"),
    ("🛡", "جذب بازیکن"),
    ("🛠", "مدیریت"),
    ("🏅", "نشان افتخار"),
    ("🔢", "تعداد"),
    ("🎮", "بازیکن آزاد"),
    ("🔁", "تمدید"),
    ("🗄", "آگهی‌های ثبت‌شده"),
    ("📅", "روزهای فعال"),
    ("⏰", "ساعات فعالیت"),
    ("📡", "استریم"),
    ("📋", "فهرست / شرایط"),
    ("⌛", "منقضی"),
    ("↩", "بازگشت وجه / پاسخ"),
    ("📭", "خالی"),
    ("➖", "کاهش / ندارم"),
    ("😕", "خطا"),
    ("🆔", "آیدی گیمینگ"),
    ("🏆", "افتخارات"),
    ("🖼", "تصویر"),
    ("📌", "وضعیت"),
    ("🥉", "نشان برنزی"),
    ("☎", "ارتباط با ما"),
    ("📊", "آمار"),
    ("💬", "پیام"),
    ("🔒", "مدیر اصلی"),
    ("👇", "اشاره پایین"),
    ("🏟", "سوابق بازی"),
    ("📶", "پینگ"),
    ("🌍", "کشور"),
    ("🎙", "پارتی"),
    ("🔮", "فوتر (خط ۱)"),
    ("📩", "ارتباط"),
    ("🎉", "تبریک"),
    ("👋", "خوش‌آمد"),
    ("⛔", "مسدود"),
    ("📜", "تراکنش‌ها"),
    ("🕒", "زمان"),
    ("💵", "تراکنش مالی"),
    ("⚙", "تنظیمات"),
    ("📣", "پیام همگانی"),
    ("👮", "مدیران"),
    ("🚫", "مسدودسازی"),
    ("📸", "ارسال عکس"),
    ("◀", "مرحله قبل"),
    ("✔", "تأیید انتخاب"),
    ("📄", "آگهی عادی"),
    ("✈", "تلگرام"),
    ("👉", "فوتر (خط ۲)"),
    ("🏷", "نام تیم"),
    ("🏠", "منوی اصلی"),
    ("🧾", "کد پیگیری"),
    ("🥈", "نشان نقره‌ای"),
    ("🥇", "نشان طلایی"),
    ("💎", "نشان الماسی"),
    ("👑", "نشان افسانه‌ای"),
    ("⬆", "ارتقا"),
    ("👛", "کیف پول"),
    ("⏭", "رد کردن"),
    ("👆", "اشاره بالا"),
    ("▶", "ادامه"),
    ("🆕", "آگهی جدید"),
    ("🟢", "روشن"),
    ("🔴", "خاموش"),
    ("❗", "توجه"),
    ("🏁", "پایان"),
    ("🙍", "نام"),
    ("🔗", "لینک"),
    ("👨", "پشتیبان"),
    ("💻", "پشتیبان"),
    ("📨", "پیام پشتیبانی"),
]

# Optional hard-coded IDs, e.g. "🎮": "5368324170671202286". Placeholders are ignored until replaced.
DEFAULT_IDS: dict[str, str] = {
    "🎮": "PLACEHOLDER_PLAYER",
    "🛡": "PLACEHOLDER_TEAM",
    "🏆": "PLACEHOLDER_TROPHY",
    "⭐": "PLACEHOLDER_STAR",
    "💰": "PLACEHOLDER_MONEY",
}

VS16 = "\ufe0f"
# one emoji character (optionally followed by the variation selector)
EMOJI_RX = re.compile("[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\u2300-\u23FF\u25A0-\u25FF\u2190-\u21FF"
                      "\u2705\u2728\u274C\u274E\u2753-\u2757\u2795-\u2797\u2B50\u2B55]\ufe0f?")
_ids: dict[str, str] = {}   # base emoji -> custom_emoji_id (DB + defaults)
_extra: list[str] = []      # emojis added from the panel that are not in REGISTRY
enabled = True
_rx: re.Pattern | None = None


def base(emoji: str) -> str:
    return emoji.replace(VS16, "")


def valid_id(value: str | None) -> bool:
    return bool(value) and value.isdigit()


def _rebuild() -> None:
    global _rx
    keys = sorted(_ids, key=len, reverse=True)
    _rx = re.compile("(?:" + "|".join(re.escape(k) for k in keys) + ")" + VS16 + "?") if keys else None


async def load() -> None:
    """Reload IDs and the on/off switch from the database."""
    global enabled
    _ids.clear()
    _ids.update({k: v for k, v in DEFAULT_IDS.items() if valid_id(v)})
    rows = await db.fetchall("SELECT emoji, emoji_id FROM custom_emojis")
    for r in rows:
        if valid_id(r["emoji_id"]):
            _ids[base(r["emoji"])] = r["emoji_id"]
    known = {e for e, _ in REGISTRY}
    _extra[:] = sorted(r["emoji"] for r in rows if r["emoji"] not in known)
    enabled = (await db.get_setting("premium_emoji")) != "0"
    _rebuild()


async def set_id(emoji: str, emoji_id: str) -> None:
    await db.execute(
        "INSERT INTO custom_emojis(emoji, emoji_id) VALUES(?,?) ON CONFLICT(emoji) DO UPDATE SET emoji_id=excluded.emoji_id",
        base(emoji), emoji_id)
    await load()


async def reset(emoji: str | None = None) -> None:
    if emoji:
        await db.execute("DELETE FROM custom_emojis WHERE emoji=?", base(emoji))
    else:
        await db.execute("DELETE FROM custom_emojis")
    await load()


async def set_enabled(value: bool) -> None:
    await db.set_setting("premium_emoji", "1" if value else "0")
    await load()


def all_slots() -> list[tuple[str, str]]:
    return REGISTRY + [(e, "افزوده‌شده") for e in _extra]


def id_of(emoji: str) -> str | None:
    return _ids.get(base(emoji))


def configured_count() -> int:
    return sum(1 for e, _ in all_slots() if base(e) in _ids)


def active() -> bool:
    return enabled and _rx is not None


# ---- conversion ------------------------------------------------------------------------------------------
_TAG = re.compile(r"(<[^>]*>)")


def ce(emoji: str) -> str:
    """HTML for one emoji: the custom emoji when configured, otherwise the plain emoji."""
    cid = _ids.get(base(emoji))
    return f'<tg-emoji emoji-id="{cid}">{emoji}</tg-emoji>' if cid and enabled else emoji


def apply_html(text: str) -> str:
    """Replace plain emoji with <tg-emoji> in the text nodes of an HTML string (never inside code/pre/tg-emoji)."""
    if not active() or not text:
        return text
    out, skip = [], 0
    for part in _TAG.split(text):
        if part.startswith("<") and part.endswith(">"):
            m = re.match(r"<(/?)(code|pre|tg-emoji)\b", part, re.I)
            if m:
                skip = max(0, skip + (-1 if m.group(1) else 1))
            out.append(part)
        elif skip:
            out.append(part)
        else:
            out.append(_rx.sub(lambda mo: f'<tg-emoji emoji-id="{_ids[base(mo.group(0))]}">{mo.group(0)}</tg-emoji>', part))
    return "".join(out)


def button_icon(text: str) -> tuple[str, str | None]:
    """If the button label starts with a configured emoji, return (label without it, custom_emoji_id)."""
    if not active() or not text:
        return text, None
    m = _rx.match(text)
    if not m:
        return text, None
    rest = text[m.end():].lstrip()
    return (rest, _ids[base(m.group(0))]) if rest else (text, None)
