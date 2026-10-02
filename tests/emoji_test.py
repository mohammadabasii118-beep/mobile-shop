"""Offline test of the custom emoji layer: python -m tests.emoji_test"""
import asyncio
import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["ADMIN_IDS"] = "1"

from aiogram.client.default import Default  # noqa: E402
from aiogram.exceptions import TelegramBadRequest  # noqa: E402
from aiogram.methods import AnswerCallbackQuery, SendMessage  # noqa: E402
from aiogram.types import InlineKeyboardButton as B, InlineKeyboardMarkup  # noqa: E402

from pclbot import db, emojis  # noqa: E402


async def main():
    await db.init()
    await emojis.load()
    assert not emojis.active()
    assert emojis.apply_html("🎮 x") == "🎮 x"          # nothing configured -> untouched

    await emojis.set_id("🎮", "111")
    await emojis.set_id("✏️", "222")                    # variation selector must not matter
    assert emojis.active() and emojis.id_of("✏") == "222"
    out = emojis.apply_html('🎮 <b>x 🎮</b> <code>🎮</code> ✏️ y <tg-emoji emoji-id="9">🎮</tg-emoji>')
    assert out.count('emoji-id="111"') == 2, out        # code + existing tg-emoji untouched
    assert 'emoji-id="222">✏️</tg-emoji>' in out, out

    assert emojis.button_icon("🎮 بازیکن") == ("بازیکن", "111")
    assert emojis.button_icon("بازیکن 🎮") == ("بازیکن 🎮", None)
    assert emojis.button_icon("🎮") == ("🎮", None)     # never leave a button without text
    assert emojis.ce("🎮") == '<tg-emoji emoji-id="111">🎮</tg-emoji>' and emojis.ce("🏆") == "🏆"

    kb = InlineKeyboardMarkup(inline_keyboard=[[B(text="🎮 a", callback_data="x"), B(text="b", callback_data="y")]])
    new = emojis.convert_markup(kb).inline_keyboard[0]
    assert new[0].text == "a" and new[0].icon_custom_emoji_id == "111" and new[1].icon_custom_emoji_id is None

    # middleware: HTML requests are converted, alerts (no parse_mode) are not, failures fall back to plain
    mw = emojis.EmojiRequestMiddleware()
    sent = []

    async def ok(bot, method):
        sent.append(method)
        return "ok"

    await mw(ok, None, SendMessage(chat_id=1, text="🎮 hi", parse_mode=Default("parse_mode"), reply_markup=kb))
    assert 'emoji-id="111"' in sent[-1].text and sent[-1].reply_markup.inline_keyboard[0][0].icon_custom_emoji_id == "111"
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

    await emojis.set_enabled(False)
    assert emojis.apply_html("🎮") == "🎮" and emojis.ce("🎮") == "🎮"
    await emojis.set_enabled(True)
    await emojis.reset("🎮")
    assert emojis.id_of("🎮") is None and emojis.id_of("✏") == "222"
    await emojis.reset()
    assert not emojis.active()
    print("OK")
    await db.close()


asyncio.run(main())
