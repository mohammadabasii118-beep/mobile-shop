"""ONC publishing: the ONLY place that sends to the ONE NIGHT CHAMPION news channel.

The destination is onc_settings.channel_id — a setting of its own. The Transfer publish chat is never read here,
and nothing in the Transfer code reads the ONC channel.
"""
import html
import logging

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest
from aiogram.types import BufferedInputFile, InputMediaPhoto

from .. import outgoing
from . import dbx, gfx, service

log = logging.getLogger("pclbot.onc")


class PublishError(Exception):
    pass


async def channel_id() -> str:
    return await service.get_setting("channel_id")


async def channel_info(bot: Bot) -> dict:
    """Title / id / username + whether the bot can send, send photos and edit messages."""
    cid = await channel_id()
    info = {"id": cid, "title": "", "username": "", "ok": False, "problems": [], "can_post": False, "can_edit": False}
    if not cid:
        info["problems"].append("کانالی تنظیم نشده")
        return info
    try:
        chat = await bot.get_chat(cid)
        info["title"], info["username"] = chat.title or "", chat.username or ""
        me = await bot.get_me()
        mem = await bot.get_chat_member(cid, me.id)
    except TelegramAPIError as ex:
        info["problems"].append(f"تلگرام: {ex.message if hasattr(ex, 'message') else ex}")
        return info
    if mem.status == "creator":
        info["can_post"] = info["can_edit"] = True
    elif mem.status == "administrator":
        info["can_post"] = bool(getattr(mem, "can_post_messages", False))
        info["can_edit"] = bool(getattr(mem, "can_edit_messages", False))
    else:
        info["problems"].append("ربات ادمین کانال نیست")
    if mem.status in ("administrator", "creator"):
        if not info["can_post"]:
            info["problems"].append("دسترسی «ارسال پیام» (متن/عکس) داده نشده")
        if not info["can_edit"]:
            info["problems"].append("دسترسی «ویرایش پیام‌ها» داده نشده")
    info["ok"] = not info["problems"]
    return info


def _caption(text: str, page: int, pages: int) -> str:
    return text + (f"\n\n<i>صفحه {page} از {pages}</i>" if pages > 1 else "")


async def publish(bot: Bot, tid: int, stage: str, kind: str, ref_id: int, images: list[bytes], caption: str,
                  admin: int, version: int = 1, update: bool = False) -> dict:
    """Sends (or, with update=True, edits the earlier posts of) one publication.

    A DB record is written only after Telegram accepted the message, so a failure never leaves a phantom record.
    Returns {'sent': n, 'edited': n}.
    """
    cid = await channel_id()
    if not cid:
        raise PublishError("کانال وان نایت چمپیون تنظیم نشده (پنل → کانال).")
    prior = {r["page"]: r for r in await dbx.fetchall(
        "SELECT * FROM onc_publications WHERE tournament_id=? AND kind=? AND ref_id=? AND channel_id=?", tid, kind, ref_id, cid)}
    sent = edited = 0
    outgoing.EXEMPT_CHATS.add(str(cid))
    try:
        for i, img in enumerate(images, 1):
            cap = _caption(caption, i, len(images))
            file = BufferedInputFile(img, filename=f"onc_{kind.lower()}_{i}.png")
            old = prior.get(i)
            if old and update:
                try:
                    await bot.edit_message_media(chat_id=cid, message_id=old["message_id"],
                                                 media=InputMediaPhoto(media=file, caption=cap, parse_mode="HTML"))
                    await dbx.execute("UPDATE onc_publications SET content_version=?, published_at=?, published_by=? WHERE id=?",
                                      version, service.now(), admin, old["id"])
                    edited += 1
                    continue
                except TelegramBadRequest as ex:
                    if "not modified" in str(ex).lower():
                        edited += 1
                        continue
                    log.warning("ONC edit failed (%s) — sending a new post instead", ex)
            m = await bot.send_photo(cid, file, caption=cap)
            async with dbx.tx():
                await dbx.execute(
                    "INSERT INTO onc_publications(tournament_id,stage,kind,ref_id,page,channel_id,message_id,published_at,published_by,content_version) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tournament_id,kind,ref_id,page,channel_id) DO UPDATE SET "
                    "message_id=excluded.message_id, published_at=excluded.published_at, published_by=excluded.published_by, "
                    "content_version=excluded.content_version", tid, stage, kind, ref_id, i, cid, m.message_id, service.now(), admin, version)
            sent += 1
    except TelegramAPIError as ex:
        raise PublishError(f"تلگرام پست را نپذیرفت: {ex}") from ex
    finally:
        pass
    return {"sent": sent, "edited": edited}


def tname(t: dict) -> str:
    return html.escape(t["name"])


# ---- publication wrappers (each builds its graphic and routes it to the ONC channel) ----
async def round_results(bot: Bot, rid: int, admin: int, update: bool = False) -> dict:
    r = await service.get_round(rid)
    t = await service.get_tournament(r["tournament_id"])
    label = await service.round_label(r)
    imgs = await gfx.round_results(rid)
    cap = f"🏆 <b>{html.escape(t['name'])}</b>\n{label}\n<b>نتایج</b>"
    res = await publish(bot, r["tournament_id"], r["stage"], "RESULTS", rid, imgs, cap, admin, r["content_version"], update)
    await service.mark_published(rid)
    return res


async def group_standings(bot: Bot, tid: int, gid: int, round_id: int, admin: int, update: bool = False) -> dict:
    t = await service.get_tournament(tid)
    g = await service.get_group(gid)
    imgs = await gfx.group_table(tid, gid)
    cap = f"🏆 <b>{html.escape(t['name'])}</b>\n📊 <b>{html.escape(g['name'])}</b> — جدول به‌روز"
    return await publish(bot, tid, "GROUP", "STANDINGS", gid * 100000 + round_id, imgs, cap, admin, 1, update)


async def schedule(bot: Bot, tid: int, admin: int) -> dict:
    t = await service.get_tournament(tid)
    imgs = await gfx.schedule(tid)
    cap = f"🏆 <b>{html.escape(t['name'])}</b>\n📅 <b>برنامه بازی‌ها</b> — {service.fmt_date(t['start_date'])}"
    return await publish(bot, tid, "GROUP", "SCHEDULE", 0, imgs, cap, admin, 1, update=True)


async def qualified(bot: Bot, tid: int, admin: int) -> dict:
    t = await service.get_tournament(tid)
    imgs = await gfx.qualified(tid)
    cap = f"🏆 <b>{html.escape(t['name'])}</b>\n✅ <b>تیم‌های صعودکننده</b>"
    return await publish(bot, tid, "GROUP", "QUALIFIED", 0, imgs, cap, admin, 1, update=True)


async def ko_matches(bot: Bot, rid: int, admin: int) -> dict:
    r = await service.get_round(rid)
    t = await service.get_tournament(r["tournament_id"])
    from .algo import STAGE_NAME
    imgs = await gfx.ko_matches(rid)
    cap = f"🏆 <b>{html.escape(t['name'])}</b>\n⚔️ <b>{STAGE_NAME[r['stage']]}</b> — بازی‌ها"
    return await publish(bot, r["tournament_id"], r["stage"], "KO_MATCHES", rid, imgs, cap, admin, r["content_version"], update=True)


async def bracket(bot: Bot, tid: int, admin: int) -> dict:
    t = await service.get_tournament(tid)
    imgs = await gfx.bracket(tid)
    cap = f"🏆 <b>{html.escape(t['name'])}</b>\n🧩 <b>جدول مرحله حذفی</b>"
    return await publish(bot, tid, "KO", "BRACKET", 0, imgs, cap, admin, 1, update=True)


async def champion(bot: Bot, tid: int, admin: int, update: bool = False) -> dict:
    t = await service.get_tournament(tid)
    imgs = await gfx.champion(bot, tid)
    team = await service.get_team(t["champion_team_id"])
    cap = f"🏆 <b>{html.escape(t['name'])}</b>\n👑 <b>قهرمان: {html.escape(team['name'])}</b>"
    return await publish(bot, tid, "F", "CHAMPION", 0, imgs, cap, admin, 1, update=True)


async def after_confirm(bot: Bot, rid: int, admin: int) -> dict:
    """Everything that follows CONFIRM & PUBLISH: results graphic, optional standings, champion poster after the final."""
    r = await service.get_round(rid)
    out = {"results": await round_results(bot, rid, admin)}
    if r["stage"] == "GROUP" and await service.get_setting("auto_standings", "0") == "1":
        for t in await service.group_tables(r["tournament_id"]):
            await group_standings(bot, r["tournament_id"], t["group"]["id"], rid, admin)
    if r["stage"] == "F":
        t = await service.get_tournament(r["tournament_id"])
        if t["champion_team_id"]:
            out["champion"] = await champion(bot, r["tournament_id"], admin)
    return out
