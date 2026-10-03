"""Captains/managers (1–2 per team), captain result submission with instant admin approval, the pending-results tab and team lists.

Two routers:
* `admin_router`  – admin only (filters): assign captains, approve / reject results, pending list, publish a team list.
* `router`        – captain-facing. NO role filter on purpose: every handler re-validates in the service layer
  (user id → tournament → team → is this user a captain of THIS team?), so forged callback data can't reach another team.
"""
import html
import re

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from .. import admins, db as main_db
from ..utils import is_admin, show
from . import publish, service, ui
from .service import OncError
from .states import CaptSt
from .ui import E, ob, okb

admin_router = Router()
admin_router.message.filter(lambda m: is_admin(m.from_user.id))
admin_router.callback_query.filter(lambda c: is_admin(c.from_user.id))
router = Router()


async def _alert(c: CallbackQuery, text: str) -> None:
    await c.answer(text[:190], show_alert=True)


# ================================================================= ADMIN: captains of a team
async def captains_screen(c, team_id: int) -> None:
    team = await service.get_team(team_id)
    caps = await service.captains_of(team_id)
    rows = [[ob(f"➖ {service.captain_label(x)}", f"onc:tcd:{x['id']}")] for x in caps]
    if len(caps) < service.MAX_CAPTAINS:
        rows.append([ob("➕ افزودن کاپیتان/منیجر", f"onc:tca:{team_id}")])
    rows.append([ob("🔙 بازگشت", f"onc:te:{team_id}")])
    text = (f"🧢 <b>کاپیتان/منیجر — {E(team['name'])}</b>\n\n"
            + ("\n".join(f"• {E(service.captain_label(x))}" for x in caps) if caps else "هنوز کسی تعیین نشده.")
            + f"\n\nهر تیم حداکثر {service.MAX_CAPTAINS} نفر دارد. دسترسی آن‌ها فقط به همین تیم است: ثبت نتیجه (با تأیید ادمین) و ثبت/ویرایش لیست تیم.")
    await show(c, text, okb(rows))


@admin_router.callback_query(F.data.regexp(r"^onc:tc:(\d+)$"))
async def captains_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await captains_screen(c, int(c.data.split(":")[2]))
    await c.answer()


@admin_router.callback_query(F.data.regexp(r"^onc:tca:(\d+)$"))
async def captain_add_ask(c: CallbackQuery, state: FSMContext):
    team_id = int(c.data.split(":")[2])
    await state.set_state(CaptSt.add)
    await state.update_data(team=team_id)
    await show(c, "➕ <b>افزودن کاپیتان/منیجر</b>\n\n<b>آیدی عددی تلگرام</b> او را بفرست، یا <b>یک پیام از او را فوروارد کن</b>، "
               "یا اگر قبلاً ربات را استارت کرده، <code>@username</code> را بفرست.", okb([[ob("❌ لغو", f"onc:tc:{team_id}")]]))
    await c.answer()


@admin_router.message(CaptSt.add)
async def captain_add_do(m: Message, state: FSMContext, bot: Bot):
    d = await state.get_data()
    uid = None
    fo = getattr(m, "forward_origin", None)
    if fo is not None and getattr(fo, "sender_user", None):
        uid = fo.sender_user.id
    elif m.text and re.fullmatch(r"\d{5,15}", service.norm_digits(m.text)):
        uid = int(service.norm_digits(m.text))
    elif m.text and re.fullmatch(r"@[A-Za-z0-9_]{4,}", m.text.strip()):
        row = await main_db.fetchone("SELECT id FROM users WHERE lower(username)=lower(?)", m.text.strip()[1:])
        uid = row["id"] if row else None
        if uid is None:
            return await m.answer("⚠️ این یوزرنیم در ربات پیدا نشد (باید قبلاً ربات را استارت کرده باشد). آیدی عددی را بفرست.")
    if uid is None:
        return await m.answer("⚠️ آیدی عددی تلگرام، یک پیام فورواردشده یا @username بفرست.")
    try:
        await service.add_captain(m.from_user.id, d["team"], uid)
    except OncError as e:
        return await m.answer(f"⚠️ {e}")
    await state.clear()
    team = await service.get_team(d["team"])
    t = await service.get_tournament(team["tournament_id"])
    try:  # tell the new captain how to find his panel
        await bot.send_message(uid, f"🧢 تو کاپیتان/منیجر تیم <b>{E(team['name'])}</b> در <b>{E(t['name'])}</b> شدی.\n"
                                    "از «🏆 وان نایت چمپیون ← 🧢 پنل کاپیتان/منیجر» می‌توانی نتیجه و لیست تیم را ثبت کنی.")
    except TelegramAPIError:
        pass
    await captains_screen(m, d["team"])


@admin_router.callback_query(F.data.regexp(r"^onc:tcd:(\d+)$"))
async def captain_remove(c: CallbackQuery):
    row = await service.remove_captain(c.from_user.id, int(c.data.split(":")[2]))
    await c.answer("حذف شد")
    if row:
        await captains_screen(c, row["team_id"])


@admin_router.callback_query(F.data.regexp(r"^onc:tpub:(\d+)$"))
async def admin_publish_list(c: CallbackQuery, bot: Bot):
    try:
        res = await publish.team_list(bot, int(c.data.split(":")[2]), c.from_user.id)
    except (publish.PublishError, OncError) as e:
        return await _alert(c, str(e))
    await c.answer("📢 لیست در کانال منتشر شد" if res["sent"] else "📢 پست قبلی کانال به‌روز شد")


# ================================================================= ADMIN: pending results
async def pending_screen(c, tid: int) -> None:
    t = await service.get_tournament(tid)
    items = await service.pending_results(tid)
    rows = [[ob(f"{x['name_a']} {x['goals_a']} - {x['goals_b']} {x['name_b']}", f"onc:pv:{x['id']}")] for x in items]
    rows.append([ob("🔙 بازگشت", f"onc:rs:{tid}")])
    body = "\n".join(f"{E(x['name_a'])} {x['goals_a']} - {x['goals_b']} {E(x['name_b'])}" for x in items) or "نتیجه‌ای در انتظار تأیید نیست."
    await show(c, f"⏳ <b>نتایج در انتظار تایید ({len(items)})</b>\n{E(t['name'])}\n\n{body}", okb(rows))


@admin_router.callback_query(F.data.regexp(r"^onc:pl:(\d+)$"))
async def pending_open(c: CallbackQuery):
    await pending_screen(c, int(c.data.split(":")[2]))
    await c.answer()


def pending_text(p: dict, status: str = "⏳ در انتظار تأیید") -> str:
    extra = f"\n▶ برنده: <b>{E(p['name_a'] if p['winner_team_id'] == p['team_a'] else p['name_b'])}</b>" if p["winner_team_id"] and p["goals_a"] == p["goals_b"] else ""
    return (f"⚽ <b>نتیجه‌ی جدید</b>\n\n{E(p['name_a'])} {p['goals_a']} - {p['goals_b']} {E(p['name_b'])}{extra}\n\n"
            f"ثبت‌شده توسط:\nکاپیتان {E(p['team_name'])}\n\nوضعیت:\n{status}")


def decision_markup(pid: int):
    return okb([[ob("✅ تایید", f"onc:pa:{pid}"), ob("❌ رد", f"onc:pr:{pid}")]])


@admin_router.callback_query(F.data.regexp(r"^onc:pv:(\d+)$"))
async def pending_view(c: CallbackQuery):
    p = await service.get_pending(int(c.data.split(":")[2]))
    if not p or p["status"] != "PENDING":
        return await _alert(c, "این نتیجه قبلاً بررسی شده است.")
    rows = decision_markup(p["id"]).inline_keyboard + [[ob("🔙 لیست", f"onc:pl:{p['tournament_id']}")]]
    await show(c, pending_text(p), okb(rows))
    await c.answer()


async def _tell_captain(bot: Bot, p: dict, text: str) -> None:
    try:
        await bot.send_message(p["user_id"], text)
    except TelegramAPIError:
        pass


@admin_router.callback_query(F.data.regexp(r"^onc:pa:(\d+)$"))
async def pending_approve(c: CallbackQuery, bot: Bot):
    try:
        p = await service.approve_pending(c.from_user.id, int(c.data.split(":")[2]))
    except OncError as e:
        return await _alert(c, str(e))
    await c.answer("✅ تأیید شد")
    await show(c, pending_text(p, "✅ تأیید شد — نتیجه‌ی رسمی ثبت شد (انتشار راند جداست)"),
               okb([[ob("⏳ نتایج در انتظار", f"onc:pl:{p['tournament_id']}")]]))
    await _tell_captain(bot, p, f"✅ نتیجه‌ی {p['name_a']} {p['goals_a']} - {p['goals_b']} {p['name_b']} توسط ادمین تأیید شد.")


@admin_router.callback_query(F.data.regexp(r"^onc:pr:(\d+)$"))
async def pending_reject(c: CallbackQuery, bot: Bot):
    try:
        p = await service.reject_pending(c.from_user.id, int(c.data.split(":")[2]))
    except OncError as e:
        return await _alert(c, str(e))
    await c.answer("❌ رد شد")
    await show(c, pending_text(p, "❌ رد شد"), okb([[ob("⏳ نتایج در انتظار", f"onc:pl:{p['tournament_id']}")]]))
    await _tell_captain(bot, p, f"❌ نتیجه‌ی {p['name_a']} {p['goals_a']} - {p['goals_b']} {p['name_b']} رد شد. نتیجه‌ی درست را دوباره ثبت کن.")


async def notify_admins(bot: Bot, pid: int) -> None:
    """Instant approval request: the result goes to every admin with ✅ تایید / ❌ رد right under it."""
    p = await service.get_pending(pid)
    for aid in admins.all_ids():
        try:
            await bot.send_message(aid, pending_text(p), reply_markup=decision_markup(pid))
        except TelegramAPIError:
            pass  # that admin never started the bot


# ================================================================= CAPTAIN panel (every handler validates in the backend)
def _bk(team_id: int) -> list:
    return [ob("🔙 بازگشت", f"onc:cpt:{team_id}")]


@router.callback_query(F.data == "onc:cp")
async def panel(c: CallbackQuery, state: FSMContext):
    await state.clear()
    teams = await service.captain_teams(c.from_user.id)
    if not teams:
        return await _alert(c, "⛔ تو کاپیتان/منیجر هیچ تیمی نیستی.")
    rows = [[ob(f"🧢 {x['team_name']} — {x['tournament_name']}", f"onc:cpt:{x['team_id']}")] for x in teams]
    await show(c, "🧢 <b>پنل کاپیتان/منیجر</b>\n\nتیم خودت را انتخاب کن:", okb(rows + [[ob("🔙 بازگشت", "onc:u")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^onc:cpt:(\d+)$"))
async def team_panel(c: CallbackQuery, state: FSMContext):
    await state.clear()
    team_id = int(c.data.split(":")[2])
    try:
        row = await service.assert_captain(c.from_user.id, team_id)
    except OncError as e:
        return await _alert(c, str(e))
    t = await service.get_tournament(row["tournament_id"])
    dl = service.list_deadline(t)
    state_txt = f"✅ تا {dl.strftime('%Y/%m/%d %H:%M')}" if service.list_open(t) else f"⛔ بسته شد ({dl.strftime('%H:%M')})"
    text = (f"🧢 <b>{E(row['team_name'])}</b>\n{E(t['name'])}\n\nمهلت ثبت/ویرایش لیست: {state_txt}")
    rows = [[ob("⚽ ثبت نتیجه", f"onc:cpr:{team_id}")], [ob("📋 لیست تیم", f"onc:cpl:{team_id}")], [ob("🔙 بازگشت", "onc:cp")]]
    await show(c, text, okb(rows))
    await c.answer()


# ---- results
@router.callback_query(F.data.regexp(r"^onc:cpr:(\d+)$"))
async def result_matches(c: CallbackQuery, state: FSMContext):
    await state.clear()
    team_id = int(c.data.split(":")[2])
    try:
        row = await service.assert_captain(c.from_user.id, team_id)
        if row["status"] != "LIVE":
            raise OncError("تورنمنت هنوز شروع نشده است.")
        ms = await service.captain_matches(c.from_user.id, team_id)
    except OncError as e:
        return await _alert(c, str(e))
    rows = []
    for m in ms:
        pend = await service.pending_for(m["id"], team_id)
        tag = " ⏳" if pend else ""
        rows.append([ob(f"{m['name_a']} 🆚 {m['name_b']}{tag}", f"onc:cps:{team_id}:{m['id']}")])
    await show(c, f"⚽ <b>ثبت نتیجه — {E(row['team_name'])}</b>\n\nبازی را انتخاب کن (⏳ = منتظر تأیید ادمین):" if ms else
               "⚽ بازی بدون نتیجه‌ی رسمی نداری.", okb(rows + [_bk(team_id)]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^onc:cps:(\d+):(\d+)$"))
async def result_start(c: CallbackQuery, state: FSMContext):
    _, _, team_id, mid = c.data.split(":")
    team_id, mid = int(team_id), int(mid)
    try:
        await service.assert_captain(c.from_user.id, team_id)
        m = await service.get_match(mid)
        if not m or team_id not in (m["team_a"], m["team_b"]):
            raise OncError("⛔ این بازی مربوط به تیم تو نیست.")
        if await service.pending_for(mid, team_id):
            raise OncError("نتیجه‌ی قبلی تو هنوز در انتظار تأیید ادمین است.")
    except OncError as e:
        return await _alert(c, str(e))
    await state.clear()
    await state.set_state(CaptSt.ga)
    await state.update_data(team=team_id, mid=mid)
    await show(c, f"⚽ <b>{E(m['name_a'])} 🆚 {E(m['name_b'])}</b>\n\n<b>گل {E(m['name_a'])}:</b>\n<i>(یک عدد بفرست، یا هر دو را مثل 3-1)</i>",
               okb([[ob("❌ لغو", f"onc:cpr:{team_id}")]]))
    await c.answer()


def _goals(text: str) -> tuple[int, int | None]:
    t = service.norm_digits(text)
    mm = re.fullmatch(r"(\d{1,2})\s*[-:–]\s*(\d{1,2})", t)
    if mm:
        return int(mm.group(1)), int(mm.group(2))
    if re.fullmatch(r"\d{1,2}", t):
        return int(t), None
    raise OncError("یک عدد صحیح (۰ تا ۹۹) بفرست، مثلاً 3 — یا هر دو گل را مثل 3-1.")


@router.message(CaptSt.ga, F.text)
async def result_ga(m: Message, state: FSMContext):
    d = await state.get_data()
    try:
        a, b = _goals(m.text)
        match = await service.get_match(d["mid"])
    except OncError as e:
        return await m.answer(f"⚠️ {e}")
    await state.update_data(ga=a)
    if b is not None:
        await state.update_data(gb=b)
        return await _after_goals(m, state)
    await state.set_state(CaptSt.gb)
    await m.answer(f"<b>گل {E(match['name_b'])}:</b>")


@router.message(CaptSt.gb, F.text)
async def result_gb(m: Message, state: FSMContext):
    try:
        b, extra = _goals(m.text)
        if extra is not None:
            raise OncError("فقط گل تیم دوم را (یک عدد) بفرست.")
    except OncError as e:
        return await m.answer(f"⚠️ {e}")
    await state.update_data(gb=b)
    await _after_goals(m, state)


async def _after_goals(m: Message, state: FSMContext) -> None:
    d = await state.get_data()
    match = await service.get_match(d["mid"])
    if match["stage"] != "GROUP" and d["ga"] == d["gb"]:
        await state.set_state(CaptSt.winner)
        return await m.answer(f"🤝 مساوی: <b>{E(match['name_a'])} {d['ga']} - {d['gb']} {E(match['name_b'])}</b>\n\nبرنده کیست؟",
                              reply_markup=okb([[ob(f"🏆 {match['name_a']}", "onc:cpw:a"), ob(f"🏆 {match['name_b']}", "onc:cpw:b")]]))
    await _preview(m, state)


@router.callback_query(F.data.in_({"onc:cpw:a", "onc:cpw:b"}), CaptSt.winner)
async def result_winner(c: CallbackQuery, state: FSMContext):
    d = await state.get_data()
    match = await service.get_match(d["mid"])
    await state.update_data(winner=match["team_a"] if c.data.endswith(":a") else match["team_b"])
    await c.answer()
    await _preview(c.message, state)


async def _preview(m: Message, state: FSMContext) -> None:
    d = await state.get_data()
    match = await service.get_match(d["mid"])
    await state.set_state(CaptSt.preview)
    await m.answer(f"<b>{E(match['name_a'])} {d['ga']} - {d['gb']} {E(match['name_b'])}</b>\n\nبعد از ارسال، نتیجه <b>در انتظار تأیید ادمین</b> می‌ماند و رسمی نیست.",
                   reply_markup=okb([[ob("✅ ارسال برای تأیید ادمین", "onc:cpok")], [ob("✏️ ویرایش", f"onc:cps:{d['team']}:{d['mid']}"), ob("❌ لغو", f"onc:cpr:{d['team']}")]]))


@router.callback_query(F.data == "onc:cpok", CaptSt.preview)
async def result_send(c: CallbackQuery, state: FSMContext, bot: Bot):
    d = await state.get_data()
    try:  # the backend re-checks user → team → match, whatever the FSM data says
        pid = await service.submit_result(c.from_user.id, d["team"], d["mid"], d["ga"], d["gb"], d.get("winner"))
    except OncError as e:
        return await _alert(c, str(e))
    await state.clear()
    await c.answer("ارسال شد")
    await show(c, "✅ نتیجه ثبت شد و برای ادمین فرستاده شد.\nوضعیت: ⏳ در انتظار تأیید",
               okb([[ob("⚽ ثبت نتیجه‌ی دیگر", f"onc:cpr:{d['team']}")], _bk(d["team"])]))
    await notify_admins(bot, pid)


# ---- team list
@router.callback_query(F.data.regexp(r"^onc:cpl:(\d+)$"))
async def list_view(c: CallbackQuery, state: FSMContext):
    await state.clear()
    team_id = int(c.data.split(":")[2])
    try:
        row = await service.assert_captain(c.from_user.id, team_id)
    except OncError as e:
        return await _alert(c, str(e))
    t = await service.get_tournament(row["tournament_id"])
    players = await service.players_of(team_id)
    open_ = service.list_open(t)
    dl = service.list_deadline(t)
    text = (f"📋 <b>لیست تیم {E(row['team_name'])}</b>\n\n" + ("\n".join(f"• {E(p['player_id'])}" for p in players) if players else "هنوز لیستی ثبت نشده.")
            + f"\n\n{'✅ می‌توانی تا ' + dl.strftime('%Y/%m/%d %H:%M') + ' ثبت/ویرایش کنی.' if open_ else '⛔ مهلت ثبت/ویرایش تمام شده؛ فقط می‌توانی لیست را ببینی. برای تغییر به ادمین بگو.'}")
    rows = [[ob("✏️ ثبت / ویرایش لیست", f"onc:cpe:{team_id}")]] if open_ else []
    await show(c, text, okb(rows + [_bk(team_id)]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^onc:cpe:(\d+)$"))
async def list_edit(c: CallbackQuery, state: FSMContext):
    team_id = int(c.data.split(":")[2])
    try:
        row = await service.assert_captain(c.from_user.id, team_id)
        if not service.list_open(await service.get_tournament(row["tournament_id"])):
            raise OncError("مهلت ثبت/ویرایش لیست تمام شده است.")
    except OncError as e:
        return await _alert(c, str(e))
    await state.clear()
    await state.set_state(CaptSt.list)
    await state.update_data(team=team_id)
    await show(c, "✏️ <b>لیست بازیکنان</b> را بفرست — هر بازیکن در یک خط (یا با ویرگول جدا).\nلیست جدید جایگزین لیست قبلی می‌شود.",
               okb([[ob("❌ لغو", f"onc:cpl:{team_id}")]]))
    await c.answer()


@router.message(CaptSt.list, F.text)
async def list_text(m: Message, state: FSMContext):
    d = await state.get_data()
    players = [x.strip() for x in m.text.replace("،", "\n").replace(",", "\n").splitlines() if x.strip()]
    players = [re.sub(r"^[•\-\*\d\.\)\s]+", "", p) or p for p in players]
    if not players:
        return await m.answer("⚠️ حداقل یک بازیکن بفرست.")
    await state.update_data(players=players)
    await state.set_state(CaptSt.list_preview)
    team = await service.get_team(d["team"])
    await m.answer(publish.team_list_text(team["name"], players) + "\n\nثبت و در کانال منتشر شود؟",
                   reply_markup=okb([[ob("✅ ثبت و انتشار", "onc:cplok")], [ob("✏️ ویرایش", f"onc:cpe:{d['team']}"), ob("❌ لغو", f"onc:cpl:{d['team']}")]]))


@router.callback_query(F.data == "onc:cplok", CaptSt.list_preview)
async def list_save(c: CallbackQuery, state: FSMContext, bot: Bot):
    d = await state.get_data()
    try:
        await service.set_team_list(c.from_user.id, d["team"], d["players"])   # captain + deadline re-checked here
    except OncError as e:
        return await _alert(c, str(e))
    await state.clear()
    try:
        res = await publish.team_list(bot, d["team"], c.from_user.id)
        note = "✅ لیست ثبت و در کانال منتشر شد." if res["sent"] else "✅ لیست ثبت شد و پست قبلی کانال ویرایش شد."
    except (publish.PublishError, OncError) as e:
        note = "✅ لیست ثبت شد ولی انتشار در کانال انجام نشد؛ به ادمین خبر داده شد."
        team = await service.get_team(d["team"])
        for aid in admins.all_ids():
            try:
                await bot.send_message(aid, f"⚠️ انتشار لیست تیم {E(team['name'])} در کانال ناموفق بود: {E(str(e))}")
            except TelegramAPIError:
                pass
    await c.answer("ثبت شد")
    await show(c, note, okb([[ob("📋 لیست تیم", f"onc:cpl:{d['team']}")], _bk(d["team"])]))
