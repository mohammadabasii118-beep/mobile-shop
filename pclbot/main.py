import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from . import admins, buttons, config, db, emojis, messages, outgoing, payments, services
from .handlers import admin, ads, home, user, wallet
from .onc import dbx as onc_dbx, setup as onc_setup
from .utils import UserMiddleware


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if not config.BOT_TOKEN:
        raise SystemExit("BOT_TOKEN تنظیم نشده است (فایل .env را ببینید).")
    await db.init()
    await onc_setup.init()  # ONE NIGHT CHAMPION: own tables/connection, never touches Transfer data
    await admins.load()
    await emojis.load()
    await buttons.load()
    await messages.load()
    bot = Bot(config.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    bot.session.middleware(outgoing.OutgoingMiddleware())
    dp = Dispatcher(storage=MemoryStorage())
    dp.message.outer_middleware(UserMiddleware())
    dp.callback_query.outer_middleware(UserMiddleware())
    # user router first so /start and /admin always win over FSM-state catch-all handlers
    # home first: /start and /admin open the section chooser; ONC routers sit beside Transfer's, in their own `onc:` namespace
    dp.include_routers(home.router, user.router, *onc_setup.routers(), admin.router, wallet.router, ads.router, onc_setup.fallback)
    await services.setup_bot(bot)
    runner = await payments.start_web(bot)
    expiry = asyncio.create_task(services.expiry_loop(bot))
    try:
        await dp.start_polling(bot)
    finally:
        expiry.cancel()
        await runner.cleanup()
        await db.close()
        await onc_dbx.close()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
