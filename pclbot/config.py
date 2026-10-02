import os

from dotenv import load_dotenv

load_dotenv()


def _ids(value: str) -> list[int]:
    return [int(x) for x in value.replace(" ", "").split(",") if x.strip().lstrip("-").isdigit()]


BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_IDS = _ids(os.getenv("ADMIN_IDS", ""))
ZARINPAL_MERCHANT = os.getenv("ZARINPAL_MERCHANT", "")
ZARINPAL_STARTPAY_URL = os.getenv("ZARINPAL_STARTPAY_URL", "https://sub.pclproclubss.ir/pg/StartPay/")
# Optional intermediate page on our own domain; the payer is redirected from it to StartPay so that
# the gateway sees our registered domain as the referrer. Example: https://bot.example.ir/pay/
ZARINPAL_PAY_PAGE_URL = os.getenv("ZARINPAL_PAY_PAGE_URL", "")
ZARINPAL_API_URL = os.getenv("ZARINPAL_API_URL", "https://api.zarinpal.com/pg/v4/payment")
ZARINPAL_CALLBACK_URL = os.getenv("ZARINPAL_CALLBACK_URL", "")
WEB_HOST = os.getenv("WEB_HOST", "0.0.0.0")
WEB_PORT = int(os.getenv("WEB_PORT", "8080"))
DB_PATH = os.getenv("DB_PATH", "pclbot.db")
