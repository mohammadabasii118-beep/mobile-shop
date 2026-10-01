import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from . import config, db, payments, services
from .handlers import admin, ads, user, wallet
from .utils import UserMiddleware


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if not config.BOT_TOKEN:
        raise SystemExit("BOT_TOKEN تنظیم نشده است (فایل .env را ببینید).")
    await db.init()
    bot = Bot(config.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher(storage=MemoryStorage())
    dp.message.outer_middleware(UserMiddleware())
    dp.callback_query.outer_middleware(UserMiddleware())
    # user router first so /start and /admin always win over FSM-state catch-all handlers
    dp.include_routers(user.router, admin.router, wallet.router, ads.router)
    runner = await payments.start_web(bot)
    expiry = asyncio.create_task(services.expiry_loop(bot))
    try:
        await dp.start_polling(bot)
    finally:
        expiry.cancel()
        await runner.cleanup()
        await db.close()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
