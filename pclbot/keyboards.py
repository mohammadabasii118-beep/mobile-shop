from aiogram.types import InlineKeyboardButton as B, InlineKeyboardMarkup


def kb(rows: list[list[B]]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=rows)


def pairs(buttons: list[B], per_row: int = 2) -> list[list[B]]:
    return [buttons[i:i + per_row] for i in range(0, len(buttons), per_row)]


def btn(text: str, data: str) -> B:
    return B(text=text, callback_data=data)


def back(to: str = "menu", text: str = "🔙 بازگشت") -> list[B]:
    return [btn(text, to)]


def main_menu(is_admin: bool = False) -> InlineKeyboardMarkup:
    items = [
        btn("📝 ثبت آگهی جدید", "ad:new"), btn("🗄 آگهی‌های ثبت‌شده", "myads"),
        btn("☎️ ارتباط با ما", "support"), btn("💰 افزایش موجودی", "wallet"),
        btn("👤 مشخصات من", "profile"), btn("🎁 کارت هدیه", "gift"),
        btn("👥 دعوت دوستان", "invite"), btn("🏅 نشان‌های افتخار", "badges"),
    ]
    rows = pairs(items)
    if is_admin:
        rows.append([btn("🛠 پنل مدیریت", "adm")])
    return kb(rows)
