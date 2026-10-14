"""🌍 Multi-location VPN: users buy / renew subscriptions from the wallet; the bot talks to the vpn-panel API (docs: panel/API.md of the panel).

User:  🌍 مولتی‌لوکیشن → plans → buy (wallet) → subscription link · «سرویس‌های من» (usage / days left / renew) · locations.
Admin: ⚙️ پنل ویژگی‌های جدید → 🌍 VPN: connection test, plans (add / on-off / delete).
The panel address and key come from .env (VPN_PANEL_URL, VPN_PANEL_API_KEY); the key never appears in chat or logs.
"""
import json
import logging
import random
import string

import aiohttp
from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from .. import config, db as main_db
from ..onc import dbx
from ..onc.ui import ob, okb
from ..texts import money
from ..utils import is_admin, show
from . import core
from .core import E
from .states import VpnSt

log = logging.getLogger("pclbot.fx.vpn")
router = Router()
admin_router = Router()
admin_router.message.filter(lambda m: is_admin(m.from_user.id))
admin_router.callback_query.filter(lambda c: is_admin(c.from_user.id))
STATUS_FA = {"active": "🟢 فعال", "disabled": "⚪ غیرفعال", "expired": "🔴 منقضی", "quota": "🟠 حجم تمام شده"}


class PanelError(Exception):
    def __init__(self, message: str, status: int = 0):
        super().__init__(message)
        self.status = status


def enabled() -> bool:
    return bool(config.VPN_PANEL_URL and config.VPN_PANEL_API_KEY)


async def request(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    """The only network call (tests patch it): returns (HTTP status, parsed JSON)."""
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=25)) as s:
        async with s.request(method, config.VPN_PANEL_URL + path, json=body, headers={"Authorization": f"Bearer {config.VPN_PANEL_API_KEY}"}) as r:
            try:
                data = await r.json(content_type=None)
            except Exception:
                data = {}
            return r.status, data


async def call(method: str, path: str, body: dict | None = None):
    if not enabled():
        raise PanelError("پنل VPN هنوز تنظیم نشده است.")
    try:
        status, data = await request(method, path, body)
    except (aiohttp.ClientError, TimeoutError) as ex:
        raise PanelError("اتصال به پنل برقرار نشد.") from ex
    if status >= 400:
        detail = data.get("detail") if isinstance(data, dict) else None
        raise PanelError(str(detail or f"خطای پنل ({status})"), status)
    return data


# ------------------------------------------------------------------------------------------------ plans / services
async def plans(active_only: bool = True) -> list[dict]:
    return await dbx.fetchall("SELECT * FROM fx_vpn_plans" + (" WHERE active=1" if active_only else "") + " ORDER BY sort, id")


def plan_line(p: dict) -> str:
    return f"{p['name']} · {p['quota_gb'] or '∞'} گیگ · {p['days'] or '∞'} روز · {money(p['price'])}"


def new_name(uid: int, attempt: int = 0) -> str:
    return f"u{uid}" + ("" if attempt == 0 else "_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=4)))


async def create_user(uid: int, plan: dict) -> dict:
    protos = json.loads(plan["protos"] or "[]")
    for attempt in range(4):
        body = {"name": new_name(uid, attempt), "quota_gb": plan["quota_gb"], "days": plan["days"], "node_ids": []}
        if protos:
            body["protos"] = protos
        try:
            return await call("POST", "/api/users", body)
        except PanelError as ex:
            if ex.status != 409:                                           # name exists → try another suffix
                raise
    raise PanelError("ساخت کاربر ناموفق بود.")


async def service_of(uid: int, sid: int) -> dict | None:
    return await dbx.fetchone("SELECT * FROM fx_vpn_services WHERE id=? AND user_id=?", sid, uid)       # always scoped to the owner


def gb(x) -> str:
    try:
        return f"{float(x):.1f}".rstrip("0").rstrip(".") or "0"
    except (TypeError, ValueError):
        return "—"


def user_text(u: dict, name: str) -> str:
    quota = u.get("quota_gb") or 0
    days = u.get("days_left")
    return (f"🌍 <b>{E(name)}</b>\n\nوضعیت: {STATUS_FA.get(u.get('status'), u.get('status') or '—')}\n"
            f"📊 مصرف: <b>{gb(u.get('used_gb'))}</b> از {gb(quota) + ' گیگ' if quota else 'نامحدود'}\n"
            f"⏳ زمان مانده: <b>{days if days is not None else 'نامحدود'}</b>{' روز' if days is not None else ''}")


HOWTO = ("📱 <b>اتصال:</b> لینک اشتراک را کپی کن، در برنامه‌ی v2rayNG (اندروید) / Streisand یا Hiddify (آیفون) / Hiddify (ویندوز) "
         "گزینه‌ی «افزودن اشتراک / Import from clipboard» را بزن. همین لینک در مرورگر هم مصرف و کانفیگ‌ها را نشان می‌دهد.")


# ================================================================================================== user side
@router.callback_query(F.data == "fx:vp")
async def entry(c: CallbackQuery, state: FSMContext):
    await state.clear()
    if not enabled():
        return await c.answer("این بخش هنوز فعال نشده.", show_alert=True)
    ps = await plans()
    bal = (await main_db.get_user(c.from_user.id) or {}).get("balance", 0)
    rows = [[ob(plan_line(p)[:62], f"fx:vpb:{p['id']}")] for p in ps]
    await show(c, f"🌍 <b>مولتی‌لوکیشن</b>\n\nیک اشتراک VPN با چند لوکیشن و چند پروتکل؛ حجم و زمان بین همه‌ی لوکیشن‌ها مشترک است.\n"
                  f"💰 موجودی کیف پول: <b>{money(bal)}</b>" + ("" if ps else "\n\nفعلاً پلنی تعریف نشده."),
               okb(rows + [[ob("📋 سرویس‌های من", "fx:vps"), ob("📍 لوکیشن‌ها", "fx:vpn")], [ob("🔙 منوی اصلی", "home")]]))
    await c.answer()


@router.callback_query(F.data == "fx:vpn")
async def nodes(c: CallbackQuery):
    try:
        ns = await call("GET", "/api/nodes")
    except PanelError as ex:
        return await c.answer(str(ex), show_alert=True)
    lines = [f"{'🟢' if n.get('online') else '🔴'} {E(str(n.get('name') or n.get('address') or n.get('id')))}" for n in ns] or ["—"]
    await show(c, "📍 <b>لوکیشن‌ها</b>\n\n" + "\n".join(lines), okb([[ob("🔙 بازگشت", "fx:vp")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:vpb:\d+$"))
async def buy_confirm(c: CallbackQuery):
    p = await dbx.fetchone("SELECT * FROM fx_vpn_plans WHERE id=? AND active=1", int(c.data.split(":")[2]))
    if not p:
        return await c.answer("این پلن دیگر موجود نیست.", show_alert=True)
    bal = (await main_db.get_user(c.from_user.id) or {}).get("balance", 0)
    rows = [[ob("✅ خرید از کیف پول", f"fx:vpc:{p['id']}")]] if bal >= p["price"] else [[ob("💰 شارژ کیف پول", "wallet")]]
    note = "" if bal >= p["price"] else f"\n\n⚠️ موجودی کافی نیست؛ {money(p['price'] - bal)} کم داری."
    await show(c, f"🛒 <b>{E(p['name'])}</b>\n\n📊 حجم: {p['quota_gb'] or 'نامحدود'} گیگ\n⏳ مدت: {p['days'] or 'نامحدود'} روز\n💵 قیمت: <b>{money(p['price'])}</b>\n"
                  f"💰 موجودی: {money(bal)}{note}", okb(rows + [[ob("🔙 بازگشت", "fx:vp")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:vpc:\d+$"))
async def buy(c: CallbackQuery, bot: Bot):
    uid = c.from_user.id
    p = await dbx.fetchone("SELECT * FROM fx_vpn_plans WHERE id=? AND active=1", int(c.data.split(":")[2]))
    if not p:
        return await c.answer("این پلن دیگر موجود نیست.", show_alert=True)
    if not await main_db.charge(uid, p["price"], "vpn", f"VPN: {p['name']}"):
        return await c.answer("موجودی کیف پول کافی نیست.", show_alert=True)
    await c.answer("⏳ در حال ساخت سرویس…")
    try:
        u = await create_user(uid, p)
    except PanelError as ex:                                              # nothing was created → the money goes back
        await main_db.credit(uid, p["price"], "vpn_refund", f"بازگشت وجه VPN: {p['name']}")
        log.error("vpn create failed for %s: %s", uid, ex)
        return await c.message.answer(f"❌ ساخت سرویس انجام نشد ({E(str(ex))}). مبلغ به کیف پولت برگشت.", reply_markup=okb([[ob("🔙 بازگشت", "fx:vp")]]))
    sid = await dbx.execute("INSERT INTO fx_vpn_services(user_id,panel_id,name,plan_id,price,created_at) VALUES(?,?,?,?,?,?)", uid, u.get("id"), u["name"], p["id"], p["price"], core.now())
    await c.message.answer(f"✅ <b>سرویس ساخته شد</b>\n\n{user_text(u, p['name'])}\n\n🔗 لینک اشتراک:\n<code>{E(u.get('sub_url') or '')}</code>\n\n{HOWTO}",
                           reply_markup=okb([[ob("📋 سرویس‌های من", "fx:vps")], [ob("🔙 منوی اصلی", "home")]]))
    await core.notify_admins(bot, f"🌍 خرید VPN: {E(await core.user_label(uid))}\n{E(plan_line(p))}")


@router.callback_query(F.data == "fx:vps")
async def my_services(c: CallbackQuery):
    rows = await dbx.fetchall("SELECT * FROM fx_vpn_services WHERE user_id=? ORDER BY id DESC LIMIT 10", c.from_user.id)
    btns = [[ob(f"🌍 {r['name']}", f"fx:vpv:{r['id']}")] for r in rows]
    await show(c, "📋 <b>سرویس‌های من</b>" + ("" if rows else "\n\nهنوز سرویسی نخریده‌ای."), okb(btns + [[ob("🔙 بازگشت", "fx:vp")]]))
    await c.answer()


async def _fetch(s: dict) -> dict:
    return await call("GET", f"/api/users/by-name/{s['name']}")


@router.callback_query(F.data.regexp(r"^fx:vpv:\d+$"))
async def service_page(c: CallbackQuery):
    s = await service_of(c.from_user.id, int(c.data.split(":")[2]))
    if not s:
        return await c.answer("سرویس پیدا نشد.", show_alert=True)
    try:
        u = await _fetch(s)
    except PanelError as ex:
        return await c.answer(str(ex), show_alert=True)
    p = await dbx.fetchone("SELECT * FROM fx_vpn_plans WHERE id=?", s["plan_id"]) if s["plan_id"] else None
    rows = [[ob("🔗 لینک اشتراک", f"fx:vpl:{s['id']}")]]
    if p and p["days"]:
        rows.append([ob(f"🔁 تمدید ({money(p['price'])})", f"fx:vpr:{s['id']}")])
    await show(c, user_text(u, s["name"]), okb(rows + [[ob("🔙 بازگشت", "fx:vps")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:vpl:\d+$"))
async def link(c: CallbackQuery):
    s = await service_of(c.from_user.id, int(c.data.split(":")[2]))
    if not s:
        return await c.answer("سرویس پیدا نشد.", show_alert=True)
    try:
        u = await _fetch(s)
    except PanelError as ex:
        return await c.answer(str(ex), show_alert=True)
    await c.message.answer(f"🔗 لینک اشتراک «{E(s['name'])}»:\n<code>{E(u.get('sub_url') or '')}</code>\n\n{HOWTO}", reply_markup=okb([[ob("🔙 بازگشت", f"fx:vpv:{s['id']}")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:vpr:\d+$"))
async def renew_confirm(c: CallbackQuery):
    s = await service_of(c.from_user.id, int(c.data.split(":")[2]))
    p = await dbx.fetchone("SELECT * FROM fx_vpn_plans WHERE id=?", s["plan_id"]) if s and s["plan_id"] else None
    if not s or not p:
        return await c.answer("تمدید برای این سرویس ممکن نیست.", show_alert=True)
    bal = (await main_db.get_user(c.from_user.id) or {}).get("balance", 0)
    rows = [[ob("✅ تمدید از کیف پول", f"fx:vprc:{s['id']}")]] if bal >= p["price"] else [[ob("💰 شارژ کیف پول", "wallet")]]
    await show(c, f"🔁 <b>تمدید {E(s['name'])}</b>\n\n{E(plan_line(p))}\nحجم مصرف‌شده صفر و {p['days']} روز به زمان فعلی اضافه می‌شود.\n💰 موجودی: {money(bal)}",
               okb(rows + [[ob("🔙 بازگشت", f"fx:vpv:{s['id']}")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:vprc:\d+$"))
async def renew(c: CallbackQuery, bot: Bot):
    uid = c.from_user.id
    s = await service_of(uid, int(c.data.split(":")[2]))
    p = await dbx.fetchone("SELECT * FROM fx_vpn_plans WHERE id=?", s["plan_id"]) if s and s["plan_id"] else None
    if not s or not p or not p["days"]:
        return await c.answer("تمدید برای این سرویس ممکن نیست.", show_alert=True)
    if not await main_db.charge(uid, p["price"], "vpn", f"تمدید VPN: {s['name']}"):
        return await c.answer("موجودی کیف پول کافی نیست.", show_alert=True)
    await c.answer("⏳ در حال تمدید…")
    try:
        u = await _fetch(s)
        await call("PATCH", f"/api/users/{u['id']}", {"extend_days": p["days"], "reset_usage": True, "enabled": True, **({"quota_gb": p["quota_gb"]} if p["quota_gb"] else {})})
        u = await _fetch(s)
    except PanelError as ex:
        await main_db.credit(uid, p["price"], "vpn_refund", f"بازگشت وجه تمدید VPN: {s['name']}")
        return await c.message.answer(f"❌ تمدید انجام نشد ({E(str(ex))}). مبلغ برگشت.", reply_markup=okb([[ob("🔙 بازگشت", f"fx:vpv:{s['id']}")]]))
    await c.message.answer(f"✅ <b>تمدید شد</b>\n\n{user_text(u, s['name'])}", reply_markup=okb([[ob("🔙 سرویس‌های من", "fx:vps")]]))
    await core.notify_admins(bot, f"🔁 تمدید VPN: {E(await core.user_label(uid))} — {E(s['name'])}")


# ================================================================================================== admin
@admin_router.callback_query(F.data == "fx:av")
async def admin_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    ps = await plans(False)
    status = "⚪ تنظیم نشده (VPN_PANEL_URL / VPN_PANEL_API_KEY در .env)"
    if enabled():
        try:
            ns = await call("GET", "/api/nodes")
            status = f"🟢 متصل — {sum(1 for n in ns if n.get('online'))} از {len(ns)} لوکیشن آنلاین"
        except PanelError as ex:
            status = f"🔴 {E(str(ex))}"
    sold = await dbx.scalar("SELECT COUNT(*) FROM fx_vpn_services")
    rows = [[ob(("🟢 " if p["active"] else "⚪ ") + plan_line(p)[:55], f"fx:avp:{p['id']}")] for p in ps]
    await show(c, f"🌍 <b>VPN مولتی‌لوکیشن</b>\n\nپنل: {status}\nسرویس‌های فروخته‌شده: {sold}\n\nپلن‌ها (برای ویرایش بزن):",
               okb(rows + [[ob("➕ پلن جدید", "fx:avn"), ob("🔄 تست اتصال", "fx:av")], [ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@admin_router.callback_query(F.data.regexp(r"^fx:avp:\d+$"))
async def plan_page(c: CallbackQuery):
    p = await dbx.fetchone("SELECT * FROM fx_vpn_plans WHERE id=?", int(c.data.split(":")[2]))
    if not p:
        return await c.answer("پیدا نشد.", show_alert=True)
    await show(c, f"🌍 <b>{E(p['name'])}</b>\n\n{E(plan_line(p))}\nپروتکل‌ها: {E(', '.join(json.loads(p['protos'])) or 'پیش‌فرض پنل')}\nوضعیت: {'🟢 فعال' if p['active'] else '⚪ غیرفعال'}",
               okb([[ob("🔴 غیرفعال کردن" if p["active"] else "🟢 فعال کردن", f"fx:avt:{p['id']}"), ob("🗑 حذف", f"fx:avd:{p['id']}")], [ob("🔙 بازگشت", "fx:av")]]))
    await c.answer()


@admin_router.callback_query(F.data.regexp(r"^fx:avt:\d+$"))
async def plan_toggle(c: CallbackQuery, state: FSMContext):
    await dbx.execute("UPDATE fx_vpn_plans SET active=1-active WHERE id=?", int(c.data.split(":")[2]))
    await c.answer("انجام شد")
    await admin_home(c, state)


@admin_router.callback_query(F.data.regexp(r"^fx:avd:\d+$"))
async def plan_delete(c: CallbackQuery, state: FSMContext):
    await dbx.execute("DELETE FROM fx_vpn_plans WHERE id=?", int(c.data.split(":")[2]))        # services keep working; they just can't be renewed
    await c.answer("حذف شد")
    await admin_home(c, state)


@admin_router.callback_query(F.data == "fx:avn")
async def wiz_start(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await state.set_state(VpnSt.name)
    await show(c, "➕ <b>پلن جدید</b> — ۱ از ۴\n\n<b>نام پلن</b> را بنویس (مثلاً: ۳۰ روزه ۵۰ گیگ):", okb([[ob("❌ لغو", "fx:av")]]))
    await c.answer()


@admin_router.message(VpnSt.name, F.text)
async def wiz_name(m: Message, state: FSMContext):
    await state.update_data(name=m.text.strip()[:40])
    await state.set_state(VpnSt.quota)
    await m.answer("➕ <b>پلن جدید</b> — ۲ از ۴\n\n<b>حجم (گیگ)</b> را بفرست (۰ = نامحدود):")


async def _num(m: Message) -> int | None:
    t = core.norm(m.text or "").strip()
    if not t.isdigit() or int(t) > 10_000_000:
        await m.answer("⚠️ یک عدد صحیح بفرست.")
        return None
    return int(t)


@admin_router.message(VpnSt.quota, F.text)
async def wiz_quota(m: Message, state: FSMContext):
    n = await _num(m)
    if n is None:
        return
    await state.update_data(quota=n)
    await state.set_state(VpnSt.days)
    await m.answer("➕ <b>پلن جدید</b> — ۳ از ۴\n\n<b>مدت (روز)</b> را بفرست (۰ = نامحدود؛ پلن نامحدود تمدید ندارد):")


@admin_router.message(VpnSt.days, F.text)
async def wiz_days(m: Message, state: FSMContext):
    n = await _num(m)
    if n is None:
        return
    await state.update_data(days=n)
    await state.set_state(VpnSt.price)
    await m.answer("➕ <b>پلن جدید</b> — ۴ از ۴\n\n<b>قیمت (تومان)</b> را بفرست:")


@admin_router.message(VpnSt.price, F.text)
async def wiz_price(m: Message, state: FSMContext):
    n = await _num(m)
    if n is None:
        return
    d = await state.get_data()
    await state.clear()
    pid = await dbx.execute("INSERT INTO fx_vpn_plans(name,quota_gb,days,price,protos,sort) VALUES(?,?,?,?,?,?)", d["name"], d["quota"], d["days"], n, "[]",
                            await dbx.scalar("SELECT COALESCE(MAX(sort),0)+1 FROM fx_vpn_plans"))
    await m.answer(f"✅ پلن ساخته شد.\n{E(plan_line(await dbx.fetchone('SELECT * FROM fx_vpn_plans WHERE id=?', pid)))}\n\n"
                   "پروتکل‌ها و لوکیشن‌های این پلن همان پیش‌فرض پنل هستند (همه‌ی لوکیشن‌ها).", reply_markup=okb([[ob("🔙 بازگشت", "fx:av")]]))
