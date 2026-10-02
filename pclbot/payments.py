import json
import logging
import re
from html import escape

import aiohttp
from aiohttp import web
from aiogram import Bot

from . import config, db
from .services import notify
from .texts import money

log = logging.getLogger("pclbot")


async def _post(path: str, payload: dict) -> dict:
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as s:
        async with s.post(f"{config.ZARINPAL_API_URL}/{path}.json", json=payload, headers={"Accept": "application/json"}) as r:
            return await r.json(content_type=None)


async def create_payment(uid: int, amount: int) -> str | None:
    """Returns the StartPay URL, or None if the gateway rejected the request."""
    if not config.ZARINPAL_MERCHANT or not config.ZARINPAL_CALLBACK_URL:
        return None
    try:
        res = await _post("request", {
            "merchant_id": config.ZARINPAL_MERCHANT,
            "amount": amount,
            "currency": "IRT",
            "callback_url": config.ZARINPAL_CALLBACK_URL,
            "description": f"شارژ کیف پول PCL Transfer - کاربر {uid}",
        })
    except Exception:
        log.exception("zarinpal request failed")
        return None
    data = res.get("data") or {}
    if data.get("code") != 100 or not data.get("authority"):
        log.error("zarinpal rejected: %s", res)
        return None
    await db.add_tx(uid, amount, "topup", "زرین‌پال", status="pending", authority=data["authority"])
    base = config.ZARINPAL_PAY_PAGE_URL or config.ZARINPAL_STARTPAY_URL
    return base.rstrip("/") + "/" + data["authority"]


def _page(ok: bool, text: str) -> web.Response:
    color = "#16a34a" if ok else "#dc2626"
    html = (f'<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<body style="font-family:sans-serif;text-align:center;padding:48px 16px">'
            f'<h2 style="color:{color}">{"✅" if ok else "❌"} {escape(text)}</h2>'
            f'<p>برای ادامه به ربات تلگرام برگردید.</p></body></html>')
    return web.Response(text=html, content_type="text/html")


AUTHORITY_RE = re.compile(r"^[A-Za-z0-9]{30,40}$")


async def pay_redirect(request: web.Request) -> web.Response:
    """Hop through our own domain so the gateway sees it (not Telegram) as the referrer."""
    authority = request.match_info["authority"]
    if not AUTHORITY_RE.match(authority):
        raise web.HTTPNotFound()
    target = config.ZARINPAL_STARTPAY_URL.rstrip("/") + "/" + authority
    html = (f'<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<meta http-equiv="refresh" content="0;url={escape(target)}">'
            f'<body style="font-family:sans-serif;text-align:center;padding:48px 16px">'
            f'<p>در حال انتقال به درگاه پرداخت...</p>'
            f'<p><a href="{escape(target)}">اگر منتقل نشدید اینجا بزنید</a></p>'
            f'<script>location.href={json.dumps(target)}</script></body></html>')
    return web.Response(text=html, content_type="text/html", headers={"Referrer-Policy": "origin"})


async def callback(request: web.Request) -> web.Response:
    bot: Bot = request.app["bot"]
    authority = request.query.get("Authority", "")
    tx = await db.fetchone("SELECT * FROM transactions WHERE authority=? AND type='topup'", authority)
    if not tx:
        return _page(False, "تراکنش یافت نشد")
    if tx["status"] == "done":
        return _page(True, "این پرداخت قبلاً ثبت شده است")
    if request.query.get("Status") != "OK":
        await db.execute("UPDATE transactions SET status='failed' WHERE id=? AND status='pending'", tx["id"])
        await notify(bot, tx["user_id"], "❌ پرداخت انجام نشد یا لغو شد.")
        return _page(False, "پرداخت ناموفق بود")
    try:
        res = await _post("verify", {"merchant_id": config.ZARINPAL_MERCHANT, "amount": tx["amount"], "authority": authority})
    except Exception:
        log.exception("zarinpal verify failed")
        return _page(False, "خطا در تأیید پرداخت؛ اگر مبلغ کسر شده با پشتیبانی تماس بگیرید")
    data = res.get("data") or {}
    if data.get("code") in (100, 101):
        # Only the request that flips pending->done credits the wallet (callback may be hit twice).
        if await db.execute("UPDATE transactions SET status='done', ref_id=? WHERE id=? AND status='pending'", str(data.get("ref_id", "")), tx["id"]):
            await db.execute("UPDATE users SET balance=balance+? WHERE id=?", tx["amount"], tx["user_id"])
            await notify(bot, tx["user_id"], f"✅ پرداخت موفق!\n💰 {money(tx['amount'])} به کیف پولت اضافه شد.\n🧾 کد پیگیری: <code>{data.get('ref_id', '')}</code>")
        return _page(True, "پرداخت با موفقیت انجام شد")
    await db.execute("UPDATE transactions SET status='failed' WHERE id=? AND status='pending'", tx["id"])
    await notify(bot, tx["user_id"], "❌ پرداخت تأیید نشد. اگر مبلغ از حسابت کسر شده، از «ارتباط با ما» پیگیری کن.")
    return _page(False, "پرداخت تأیید نشد")


async def start_web(bot: Bot) -> web.AppRunner:
    app = web.Application()
    app["bot"] = bot
    app.router.add_get("/zarinpal/callback", callback)
    app.router.add_get("/pay/{authority}", pay_redirect)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, config.WEB_HOST, config.WEB_PORT).start()
    return runner
