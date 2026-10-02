import asyncio
import logging

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError
from aiogram.types import BotCommand, BotCommandScopeChat, MenuButtonCommands

from . import admins, db
from .messages import T
from .texts import money, render_ad

log = logging.getLogger("pclbot")


USER_COMMANDS = [BotCommand(command="start", description="🏠 شروع و منوی اصلی")]
ADMIN_COMMANDS = USER_COMMANDS + [BotCommand(command="admin", description="🛠 پنل مدیریت")]


async def sync_admin_commands(bot: Bot, uid: int, is_admin: bool) -> None:
    """Admins get /admin in their command list; everyone else sees only /start."""
    try:
        if is_admin:
            await bot.set_my_commands(ADMIN_COMMANDS, scope=BotCommandScopeChat(chat_id=uid))
        else:
            await bot.delete_my_commands(scope=BotCommandScopeChat(chat_id=uid))
    except TelegramAPIError:
        pass  # the admin has not started the bot yet; commands are synced on the next restart


async def setup_bot(bot: Bot) -> None:
    """Command list + menu button (the 'Menu' button next to the input box), and the text shown before START."""
    try:
        await bot.set_my_commands(USER_COMMANDS)
        await bot.set_chat_menu_button(menu_button=MenuButtonCommands())
        await bot.set_my_description("🔮 بزرگ‌ترین بازار نقل‌وانتقالات تیم‌ها و بازیکنان ایرانی پروکلاب.\nثبت آگهی بازیکن آزاد و جذب بازیکن، کیف پول و نشان‌های افتخار.")
        await bot.set_my_short_description("بازار نقل‌وانتقالات پروکلاب ایران")
    except TelegramAPIError as ex:
        log.warning("bot setup failed: %s", ex)
    for uid in admins.all_ids():
        await sync_admin_commands(bot, uid, True)


async def notify(bot: Bot, uid: int, text: str, **kw) -> None:
    try:
        await bot.send_message(uid, text, **kw)
    except TelegramAPIError:
        pass


async def notify_admins(bot: Bot, text: str, **kw) -> None:
    for aid in admins.all_ids():
        await notify(bot, aid, text, **kw)


async def unpublish(bot: Bot, ad: dict) -> None:
    if ad.get("msg_id") and ad.get("chat_id"):
        try:
            await bot.delete_message(ad["chat_id"], ad["msg_id"])
        except TelegramAPIError:
            pass
    await db.execute("UPDATE ads SET msg_id=NULL, chat_id=NULL WHERE id=?", ad["id"])


async def publish(bot: Bot, ad: dict) -> bool:
    """Post the ad to the transfers group/channel. Replaces an earlier post."""
    chat = await db.get_setting("publish_chat")
    if not chat:
        return False
    await unpublish(bot, ad)
    user = await db.get_user(ad["user_id"])
    text = render_ad(ad, user)
    try:
        if ad["photo"]:
            msg = await bot.send_photo(chat, ad["photo"], caption=text)
        else:
            msg = await bot.send_message(chat, text)
    except TelegramAPIError as ex:
        log.error("publish failed: %s", ex)
        return False
    await db.execute("UPDATE ads SET msg_id=?, chat_id=? WHERE id=?", msg.message_id, str(chat), ad["id"])
    return True


async def check_badge_and_referral(bot: Bot, ad: dict) -> None:
    """Called when an ad is approved for the first time and counted as valid."""
    uid = ad["user_id"]
    count = await db.counted_ads(uid)
    prev_badge, _ = await db.badge_for(count - 1)
    badge, _ = await db.badge_for(count)
    if badge and (not prev_badge or prev_badge["id"] != badge["id"]):
        await notify(bot, uid, T("badge_earned", emoji=badge["emoji"], name=badge["name"]))
    user = await db.get_user(uid)
    if user and user["referrer_id"] and not user["ref_rewarded"]:
        reward = await db.get_int("referral_reward")
        if await db.execute("UPDATE users SET ref_rewarded=1 WHERE id=? AND ref_rewarded=0", uid):
            if reward > 0:
                await db.credit(user["referrer_id"], reward, "referral", f"دعوت کاربر {uid}")
                await notify(bot, user["referrer_id"], T("referral_reward", amount=money(reward)))


async def approve(bot: Bot, ad_id: int) -> str:
    ad = await db.get_ad(ad_id)
    if not ad or ad["status"] != "pending":
        return "این آگهی در انتظار تأیید نیست."
    days = await db.get_int("days_special" if ad["special"] else "days_normal")
    # An edited ad keeps its remaining validity; re-approval must not grant extra days.
    expires = ad["expires_at"] if ad["expires_at"] and ad["expires_at"] > db.now() else db.now() + days * 86400
    await db.execute("UPDATE ads SET status='approved', expires_at=? WHERE id=?", expires, ad_id)
    ad = await db.get_ad(ad_id)
    ok = await publish(bot, ad)
    # Valid ad count: first approval only, and never for a duplicate of an already counted ad.
    dup = await db.scalar("SELECT COUNT(*) FROM ads WHERE user_id=? AND fingerprint=? AND counted=1 AND id<>?", ad["user_id"], ad["fingerprint"], ad_id)
    if not ad["counted"] and not dup:
        await db.execute("UPDATE ads SET counted=1 WHERE id=?", ad_id)
        await check_badge_and_referral(bot, ad)
    await notify(bot, ad["user_id"], T("ad_approved", id=ad_id))
    return "✅ تأیید شد." + ("" if ok else " (⚠️ گروه انتشار تنظیم نشده یا ربات دسترسی ندارد)")


async def reject(bot: Bot, ad_id: int, reason: str = "") -> str:
    ad = await db.get_ad(ad_id)
    if not ad or ad["status"] != "pending":
        return "این آگهی در انتظار تأیید نیست."
    await db.execute("UPDATE ads SET status='rejected', reject_reason=? WHERE id=?", reason, ad_id)
    paid = await db.scalar("SELECT -SUM(amount) FROM transactions WHERE note=? AND type='ad'", f"ad:{ad_id}") or 0
    if paid > 0:
        await db.credit(ad["user_id"], paid, "refund", f"ad:{ad_id}")
    msg = T("ad_rejected", id=ad_id)
    if reason:
        msg += "\n" + T("ad_rejected_reason", reason=reason)
    if paid > 0:
        msg += "\n" + T("ad_rejected_refund", amount=money(paid))
    await notify(bot, ad["user_id"], msg)
    return "❌ رد شد."


async def delete_ad(bot: Bot, ad_id: int) -> None:
    ad = await db.get_ad(ad_id)
    if ad:
        await unpublish(bot, ad)
        await db.execute("DELETE FROM ads WHERE id=?", ad_id)


async def expiry_loop(bot: Bot) -> None:
    while True:
        try:
            rows = await db.fetchall("SELECT * FROM ads WHERE status='approved' AND expires_at<?", db.now())
            for r in rows:
                ad = db.ad_row(r)
                await unpublish(bot, ad)
                await db.execute("UPDATE ads SET status='expired' WHERE id=?", ad["id"])
                await notify(bot, ad["user_id"], T("ad_expired", id=ad["id"]))
        except Exception:  # keep the loop alive
            log.exception("expiry loop")
        await asyncio.sleep(600)
