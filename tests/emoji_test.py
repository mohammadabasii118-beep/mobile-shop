"""Offline tests: custom emoji, editable buttons and messages.  python -m tests.emoji_test"""
import ast
import asyncio
import glob
import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["ADMIN_IDS"] = "1"

from aiogram.client.default import Default  # noqa: E402
from aiogram.exceptions import TelegramBadRequest  # noqa: E402
from aiogram.methods import AnswerCallbackQuery, SendMessage  # noqa: E402
from aiogram.types import InlineKeyboardButton as B, InlineKeyboardMarkup  # noqa: E402

from pclbot import buttons, db, emojis, messages, outgoing  # noqa: E402


def static_button_labels() -> set[str]:
    found = set()
    for f in glob.glob("pclbot/**/*.py", recursive=True):
        for node in ast.walk(ast.parse(open(f, encoding="utf-8").read())):
            if not isinstance(node, ast.Call):
                continue
            fn = node.func.id if isinstance(node.func, ast.Name) else getattr(node.func, "attr", "")
            if fn == "btn" and node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                found.add(node.args[0].value)
            if fn == "back":
                if len(node.args) > 1 and isinstance(node.args[1], ast.Constant):
                    found.add(node.args[1].value)
                for kw in node.keywords:
                    if kw.arg == "text" and isinstance(kw.value, ast.Constant):
                        found.add(kw.value.value)
    return found


async def run():
    await db.init()
    await emojis.load(); await buttons.load(); await messages.load()

    # ---- the button registry must cover every static label in the code
    missing = static_button_labels() - {o for o, _ in buttons.REGISTRY}
    assert not missing, f"add to buttons.REGISTRY: {missing}"

    # ---- custom emoji in text
    assert not emojis.active() and emojis.apply_html("🎮 x") == "🎮 x"
    await emojis.set_id("🎮", "111"); await emojis.set_id("✏️", "222")
    out = emojis.apply_html('🎮 <b>x 🎮</b> <code>🎮</code> ✏️ y <tg-emoji emoji-id="9">🎮</tg-emoji>')
    assert out.count('emoji-id="111"') == 2 and 'emoji-id="222">✏️</tg-emoji>' in out, out
    assert emojis.button_icon("🎮 بازیکن") == ("بازیکن", "111") and emojis.button_icon("🎮") == ("🎮", None)
    assert emojis.ce("🎮") == '<tg-emoji emoji-id="111">🎮</tg-emoji>' and emojis.ce("🏆") == "🏆"

    # ---- editable button labels
    assert buttons.split("🔙 بازگشت") == ("🔙", "بازگشت") and buttons.split("بدون ایموجی") == ("", "بدون ایموجی")
    await buttons.save("👤 مشخصات من", text="حساب من")
    assert buttons.label_of("👤 مشخصات من") == "👤 حساب من"
    await buttons.save("👤 مشخصات من", emoji="💎", emoji_id="333")
    assert buttons.effective("👤 مشخصات من") == ("حساب من", "💎", "333")
    kb = InlineKeyboardMarkup(inline_keyboard=[[B(text="👤 مشخصات من", callback_data="profile"), B(text="🎮 a", callback_data="x"), B(text="plain", callback_data="y")]])
    plain = outgoing.convert_markup(kb, premium=False).inline_keyboard[0]
    full = outgoing.convert_markup(kb, premium=True).inline_keyboard[0]
    assert plain[0].text == "💎 حساب من" and plain[0].icon_custom_emoji_id is None      # fallback keeps the emoji char
    assert full[0].text == "حساب من" and full[0].icon_custom_emoji_id == "333"         # premium icon on the button
    assert full[1].text == "a" and full[1].icon_custom_emoji_id == "111" and plain[1].text == "🎮 a"
    assert full[2].text == "plain" and full[2].icon_custom_emoji_id is None
    await buttons.reset("👤 مشخصات من")
    assert buttons.label_of("👤 مشخصات من") == "👤 مشخصات من"

    # a button with its own premium emoji works even when no global emoji slot is configured
    await emojis.reset()
    await buttons.save("👤 مشخصات من", emoji="💎", emoji_id="444")
    sent0 = []

    async def ok0(bot, method):
        sent0.append(method)

    await outgoing.OutgoingMiddleware()(ok0, None, SendMessage(chat_id=1, text="x", parse_mode="HTML", reply_markup=InlineKeyboardMarkup(
        inline_keyboard=[[B(text="👤 مشخصات من", callback_data="profile")]])))
    assert sent0[-1].reply_markup.inline_keyboard[0][0].icon_custom_emoji_id == "444"
    await buttons.reset()
    await emojis.set_id("🎮", "111"); await emojis.set_id("✏️", "222")

    # ---- editable messages
    assert messages.T("ad_approved", id=7) == "✅ آگهی شماره <b>7</b> تأیید و منتشر شد."
    assert messages.check("ad_approved", "سلام {id}") is None
    assert messages.check("ad_approved", "سلام {oops}") and messages.check("ad_approved", "سلام {id")
    await messages.save("ad_approved", "آگهی {id} تأیید شد 🎉")
    assert messages.T("ad_approved", id=7) == "آگهی 7 تأیید شد 🎉" and messages.is_changed("ad_approved")
    _ = messages._over.__setitem__("ad_approved", "broken {")                          # a broken template must not crash
    assert messages.T("ad_approved", id=7) == "✅ آگهی شماره <b>7</b> تأیید و منتشر شد."
    await messages.reset("ad_approved")
    assert not messages.is_changed("ad_approved")
    assert set(messages.DEFAULTS) >= {"ad_submitted", "payment_ok", "join_required"}

    # ---- middleware
    mw = outgoing.OutgoingMiddleware()
    sent = []

    async def ok(bot, method):
        sent.append(method)
        return "ok"

    await mw(ok, None, SendMessage(chat_id=1, text="🎮 hi", parse_mode=Default("parse_mode"), reply_markup=kb))
    assert 'emoji-id="111"' in sent[-1].text and sent[-1].reply_markup.inline_keyboard[0][1].icon_custom_emoji_id == "111"
    await mw(ok, None, AnswerCallbackQuery(callback_query_id="1", text="🎮 alert"))
    assert sent[-1].text == "🎮 alert"
    await mw(ok, None, SendMessage(chat_id=1, text="🎮 md", parse_mode="Markdown"))
    assert sent[-1].text == "🎮 md"

    calls = []

    async def flaky(bot, method):
        calls.append(method.text)
        if "tg-emoji" in method.text:
            raise TelegramBadRequest(method=method, message="Bad Request: can't parse entities")
        return "ok"

    assert await mw(flaky, None, SendMessage(chat_id=1, text="🎮 hi", parse_mode="HTML")) == "ok"
    assert "tg-emoji" in calls[0] and calls[1] == "🎮 hi"

    async def always_bad(bot, method):
        raise TelegramBadRequest(method=method, message="Bad Request: chat not found")

    await buttons.save("👤 مشخصات من", text="حساب من")                               # labels only: a real error is not retried
    await emojis.set_enabled(False)
    try:
        await mw(always_bad, None, SendMessage(chat_id=1, text="x", parse_mode="HTML", reply_markup=kb))
        raise AssertionError("expected the error to propagate")
    except TelegramBadRequest:
        pass
    await mw(ok, None, SendMessage(chat_id=1, text="🎮 x", parse_mode="HTML", reply_markup=kb))
    assert sent[-1].text == "🎮 x" and sent[-1].reply_markup.inline_keyboard[0][0].text == "👤 حساب من"   # labels work with emoji off
    await emojis.set_enabled(True)
    await emojis.reset(); await buttons.reset()
    assert not emojis.active() and not buttons.has_overrides()
    print("OK")


async def main():
    try:
        await run()
    finally:
        await db.close()


asyncio.run(main())
