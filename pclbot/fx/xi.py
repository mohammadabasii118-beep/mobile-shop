"""⭐ TEAM OF THE TOURNAMENT manager (admin only).

AUTO   — the team is built from the PCL app data (best XI / stats). Nothing is invented: if a line can't be filled the admin is told so.
MANUAL — the admin picks 3-5-2 / 3-4-3 / 4-3-3 and then gives the 11 players one by one: id → photo → team name → team logo → confirm.

The whole work-in-progress lives in the database (fx_xi_drafts), so a restart or a pause never loses entered players, and the admin
can come back later («ادامه فرآیند نیمه‌تمام»). Every step can be edited, and you can always go back to the previous player.
"""
import io
import json
import logging

import aiohttp
from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery, Message

from .. import outgoing
from ..onc import dbx, formations as fm, gfx, render, templates, themes
from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import appapi, core
from .core import E
from .states import XiSt

log = logging.getLogger("pclbot.fx.xi")
router = Router()
router.message.filter(lambda m: is_admin(m.from_user.id))
router.callback_query.filter(lambda c: is_admin(c.from_user.id))
_bytes_cache: dict[str, bytes] = {}
TITLE = "TEAM OF THE TOURNAMENT"


# ------------------------------------------------------------------------------------------------ draft (persistent)
def blank_players() -> list[dict]:
    return [{"pid": "", "photo": None, "team": "", "logo": None, "done": False} for _ in range(11)]


async def get_draft(uid: int) -> dict | None:
    raw = await dbx.scalar("SELECT data FROM fx_xi_drafts WHERE admin_id=?", uid)
    return json.loads(raw) if raw else None


async def save(uid: int, d: dict) -> None:
    await dbx.execute("INSERT INTO fx_xi_drafts(admin_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(admin_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
                      uid, json.dumps(d, ensure_ascii=False), core.now())


async def drop(uid: int) -> None:
    await dbx.execute("DELETE FROM fx_xi_drafts WHERE admin_id=?", uid)


def new_draft(mode: str, comp: dict | None = None, title: str = "") -> dict:
    return {"mode": mode, "comp": comp, "title": title, "formation": None, "idx": 0, "sub": "pid", "players": blank_players(), "theme": None,
            "preview": False, "scope": None}


def slot(d: dict, i: int) -> dict:
    return fm.FORMATIONS[d["formation"]][i]


def filled(d: dict) -> int:
    return sum(1 for p in d["players"] if p["done"])


def label(d: dict, i: int) -> str:
    return fm.POS_FA[slot(d, i)["pos"]]


# --------------------------------------------------------------------------------------------------------- images
async def load(bot: Bot, ref: str | None) -> bytes | None:
    """'tg:<file_id>' (sent by the admin) or 'url:<https…>' (from the app). Missing / broken images simply fall back to initials."""
    if not ref:
        return None
    if ref in _bytes_cache:
        return _bytes_cache[ref]
    data = None
    try:
        if ref.startswith("tg:"):
            buf = io.BytesIO()
            await bot.download(ref[3:], destination=buf)
            data = buf.getvalue()
        elif ref.startswith("url:"):
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as s:
                async with s.get(ref[4:]) as r:
                    if r.status == 200 and int(r.headers.get("Content-Length", "0") or 0) < 4_000_000:
                        data = await r.read()
    except Exception as ex:
        log.info("image %s not loaded: %s", ref[:30], ex)
    if data:
        _bytes_cache[ref] = data
    return data or None


async def xi_data(bot: Bot, d: dict) -> dict:
    sub = d["title"] or (d["comp"]["name"] if d.get("comp") else "")
    players = []
    for i, p in enumerate(d["players"]):
        s = slot(d, i)
        players.append({"name": p["pid"] or "?", "position": s["pos"], "team": p["team"], "x": s["x"], "y": s["y"],
                        "photo": await load(bot, p["photo"]), "logo": await load(bot, p["logo"])})
    return {"title": f"{TITLE} · {d['formation']}", "subtitle": (sub + " · " if sub else "") + d["formation"], "formation": d["formation"], "players": players}


async def draw(bot: Bot, d: dict) -> bytes:
    return (await gfx._render("BEST_XI", await xi_data(bot, d), d.get("theme")))[0]


# ------------------------------------------------------------------------------------------------------------ entry
def mode_kb() -> list[list]:
    return [[ob("🤖 بر اساس آمار اپ — AUTO", "fx:xim:a")], [ob("✍️ انتخاب دستی — MANUAL", "fx:xim:m")]]


async def entry(c: CallbackQuery, state: FSMContext, comp: dict | None = None):
    await state.clear()
    if comp:
        await state.update_data(comp=comp)
    d = await get_draft(c.from_user.id)
    if d and (filled(d) or d.get("formation")):
        n = filled(d)
        await show(c, f"⭐ <b>{TITLE}</b>\n\nیک فرآیند نیمه‌تمام داری ({'AUTO' if d['mode'] == 'auto' else 'MANUAL'} · {d.get('formation') or 'ترکیب انتخاب نشده'} · {n} از ۱۱ بازیکن ثبت شده).",
                   okb([[ob("▶️ ادامه فرآیند نیمه‌تمام", "fx:xir")], [ob("🗑 شروع از نو", "fx:xin")], [ob("🔙 بازگشت", "fx:a")]]))
    else:
        await show(c, f"⭐ <b>{TITLE}</b>\n\n<b>تیم منتخب به چه روشی ساخته شود؟</b>", okb(mode_kb() + [[ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@router.callback_query(F.data == "fx:xi")
async def entry_hub(c: CallbackQuery, state: FSMContext):
    await entry(c, state)


@router.callback_query(F.data == "fx:xin")
async def fresh(c: CallbackQuery, state: FSMContext):
    await drop(c.from_user.id)
    await entry(c, state, (await state.get_data()).get("comp"))


@router.callback_query(F.data == "fx:xim:m")
async def manual(c: CallbackQuery, state: FSMContext):
    comp = (await state.get_data()).get("comp")
    d = new_draft("manual", comp)
    await save(c.from_user.id, d)
    if comp:
        return await ask_formation(c.message, d, manual=True)
    await state.set_state(XiSt.title)
    await show(c, "✍️ <b>MANUAL</b>\n\nنام تورنمنت را بنویس (برای زیرنویس تصویر)، یا «⏭ بدون نام» را بزن:", okb([[ob("⏭ بدون نام", "fx:xiti")], [ob("🔙 بازگشت", "fx:xi")]]))
    await c.answer()


@router.callback_query(F.data == "fx:xiti")
async def title_skip(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await c.answer()
    await ask_formation(c.message, await get_draft(c.from_user.id), manual=True)


@router.message(XiSt.title, F.text)
async def title_got(m: Message, state: FSMContext):
    d = await get_draft(m.from_user.id)
    d["title"] = m.text.strip()[:60]
    await save(m.from_user.id, d)
    await state.clear()
    await ask_formation(m, d, manual=True)


async def ask_formation(target: Message, d: dict, manual: bool, change: bool = False):
    head = "🔁 <b>تغییر ترکیب</b>\n\nسیستم تاکتیکی جدید را انتخاب کن:" if change else ("«سیستم تاکتیکی تیم منتخب را انتخاب کنید.»" if manual else "سیستم تاکتیکی را انتخاب کن:")
    rows = [[ob(f, f"fx:xif:{i}") for i, f in enumerate(fm.ORDER)]]
    if d["mode"] == "auto" and not change:
        rows.append([ob("🎯 مناسب‌ترین ترکیب (خودکار)", "fx:xif:auto")])
    await target.answer(f"⭐ <b>{TITLE}</b>\n\n{head}", reply_markup=okb(rows + [[ob("🔙 بازگشت", "fx:xi")]]))


# --------------------------------------------------------------------------------------------------------- AUTO
@router.callback_query(F.data == "fx:xim:a")
async def auto_start(c: CallbackQuery, state: FSMContext):
    comp = (await state.get_data()).get("comp")
    if comp:
        await save(c.from_user.id, new_draft("auto", comp))
        await c.answer()
        return await ask_formation(c.message, await get_draft(c.from_user.id), manual=False)
    try:
        comps = await appapi.competitions()
    except appapi.AppApiError as ex:
        return await c.answer(str(ex), show_alert=True)
    comps = comps[:30]
    await state.update_data(comps=[{k: x.get(k) for k in ("id", "name", "type", "status")} for x in comps])
    rows = [[ob(x["name"][:60], f"fx:xic:{i}")] for i, x in enumerate(comps)]
    await show(c, "🤖 <b>AUTO</b>\n\nمسابقه‌ی مورد نظر را از اپ انتخاب کن:" + ("" if comps else "\n\nمسابقه‌ای در اپ پیدا نشد."), okb(rows + [[ob("🔙 بازگشت", "fx:xi")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:xic:\d+$"))
async def auto_comp(c: CallbackQuery, state: FSMContext):
    comps = (await state.get_data()).get("comps") or []
    i = int(c.data.split(":")[2])
    if i >= len(comps):
        return await c.answer("فهرست قدیمی شده؛ دوباره انتخاب کن.", show_alert=True)
    await state.update_data(comp=comps[i])
    await save(c.from_user.id, new_draft("auto", comps[i]))
    await c.answer()
    await ask_formation(c.message, await get_draft(c.from_user.id), manual=False)


def _cands(xi: list[dict]) -> dict[int, list[dict]]:
    out: dict[int, list[dict]] = {0: [], 1: [], 2: [], 3: []}
    for p in xi:
        out[render._line_of(p.get("position", ""))].append(p)
    for v in out.values():
        v.sort(key=lambda p: (-(p.get("rating") or 0), -(p.get("goals") or 0)))
    return out


def plan(xi: list[dict], formation: str) -> tuple[list[dict | None], list[str]]:
    """Fills the slots of `formation` from real app players by line; returns (slot → player|None, missing-line texts)."""
    cands = _cands(xi)
    names = {0: "دروازه‌بان", 1: "مدافع", 2: "هافبک", 3: "مهاجم"}
    need = fm.counts(formation)
    out: list[dict | None] = [None] * 11
    missing = []
    for line in (0, 1, 2, 3):
        idxs = [i for i, s in enumerate(fm.FORMATIONS[formation]) if s["line"] == line]
        pick = sorted(cands[line][:need[line]], key=lambda p: render._side(p.get("position", "")))
        for i, p in zip(idxs, pick):
            out[i] = p
        if len(pick) < need[line]:
            missing.append(f"{names[line]}: {len(pick)} از {need[line]}")
    return out, missing


def best_formation(xi: list[dict]) -> str:
    def score(f):
        out, _ = plan(xi, f)
        return (sum(1 for p in out if p), sum((p.get("rating") or 0) for p in out if p))
    return max(fm.ORDER, key=score)


@router.callback_query(F.data.regexp(r"^fx:xif:(\d|auto)$"))
async def pick_formation(c: CallbackQuery, state: FSMContext, bot: Bot):
    uid = c.from_user.id
    d = await get_draft(uid)
    if not d:
        return await c.answer("فرآیندی باز نیست؛ از «⭐ تیم منتخب» شروع کن.", show_alert=True)
    arg = c.data.split(":")[2]
    if d["mode"] == "auto" and not d["formation"]:
        # AUTO: the formation is chosen first, then the scope (whole competition / one round)
        d["formation"] = None if arg == "auto" else fm.ORDER[int(arg)]
        d["scope"] = "ask"
        await save(uid, d)
        await c.answer()
        return await ask_scope(c.message, d)
    if arg == "auto" or int(arg) >= len(fm.ORDER):
        return await c.answer()
    new = fm.ORDER[int(arg)]
    if d["formation"] and d["formation"] != new:                        # change the system but keep the players that still fit their line
        old_by_line: dict[int, list[dict]] = {0: [], 1: [], 2: [], 3: []}
        for i, p in enumerate(d["players"]):
            if p["pid"]:
                old_by_line[slot(d, i)["line"]].append(p)
        fresh_players, lost = blank_players(), 0
        for line in (0, 1, 2, 3):
            idxs = [i for i, s in enumerate(fm.FORMATIONS[new]) if s["line"] == line]
            for i, p in zip(idxs, old_by_line[line]):
                fresh_players[i] = p
            lost += max(0, len(old_by_line[line]) - len(idxs))
        d["players"], d["formation"] = fresh_players, new
        d["idx"], d["sub"] = next((i for i, p in enumerate(fresh_players) if not p["done"]), 0), "pid"
        await save(uid, d)
        await c.answer(f"ترکیب {new} — " + (f"{lost} بازیکن اضافه از چینش خارج شد" if lost else "بازیکن‌ها حفظ شد"), show_alert=bool(lost))
        return await continue_flow(c.message, state, d, bot)
    d["formation"] = new
    await save(uid, d)
    await c.answer()
    await continue_flow(c.message, state, d, bot)


async def ask_scope(target: Message, d: dict):
    comp = d["comp"]
    try:
        ms = await appapi.all_matches(comp)
    except appapi.AppApiError as ex:
        return await target.answer(f"⚠️ {ex}")
    from .appgfx import rounds_of, stage_name
    rs = rounds_of(ms)
    d["rounds"] = rs
    await save_by_msg(target, d)
    btns = [ob(stage_name(r), f"fx:xis:{i}") for i, r in enumerate(rs)]
    await target.answer("🤖 <b>AUTO</b>\n\nتیم منتخب بر اساس کدام بازه ساخته شود؟",
                        reply_markup=okb([[ob("🌟 کل مسابقه", "fx:xis:all")]] + [btns[i:i + 3] for i in range(0, len(btns), 3)] + [[ob("🔙 بازگشت", "fx:xi")]]))


async def save_by_msg(target: Message, d: dict):
    await save(target.chat.id, d)


@router.callback_query(F.data.regexp(r"^fx:xis:(\d+|all)$"))
async def auto_build(c: CallbackQuery, state: FSMContext, bot: Bot):
    uid = c.from_user.id
    d = await get_draft(uid)
    if not d or d["mode"] != "auto":
        return await c.answer("فرآیندی باز نیست.", show_alert=True)
    arg = c.data.split(":")[2]
    raw = None if arg == "all" else (d.get("rounds") or [])[int(arg)] if int(arg) < len(d.get("rounds") or []) else None
    await c.answer("⏳ در حال خواندن آمار اپ…")
    try:
        xi = await appapi.best_xi(d["comp"], raw)
    except appapi.AppApiError as ex:
        return await c.message.answer(f"⚠️ {ex}")
    if not xi:
        return await c.message.answer("اطلاعات کافی برای انتخاب خودکار در اپ وجود ندارد (تیم منتخبی ثبت نشده). می‌توانی از «✍️ MANUAL» استفاده کنی.",
                                      reply_markup=okb([[ob("✍️ انتخاب دستی", "fx:xim:m")], [ob("🔙 بازگشت", "fx:xi")]]))
    f = d["formation"] or best_formation(xi)
    out, missing = plan(xi, f)
    if missing:
        return await c.message.answer(f"⚠️ برای ترکیب {f} در اپ بازیکن کافی نیست ({'، '.join(missing)}). بازیکن ساختگی ساخته نمی‌شود؛ ترکیب دیگری امتحان کن یا حالت MANUAL را بزن.",
                                      reply_markup=okb([[ob("🔁 ترکیب دیگر", "fx:xin")], [ob("✍️ انتخاب دستی", "fx:xim:m")]]))
    d["formation"] = f
    players = []
    for p in out:
        players.append({"pid": p.get("gamer_tag") or p.get("player_name") or "", "photo": ("url:" + p["avatar_url"]) if p.get("avatar_url") else None,
                        "team": p.get("team_name") or "", "logo": ("url:" + p["team_logo"]) if p.get("team_logo") else None, "done": True})
    d["players"], d["preview"], d["scope"] = players, True, raw
    if raw:
        from .appgfx import stage_name
        d["title"] = (d["comp"]["name"] + " · " + stage_name(raw))
    await save(uid, d)
    await send_preview(c.message, uid, bot, note="🤖 ترکیب از آمار اپ ساخته شد (بازیکن یا آماری ساختگی نیست).")


# --------------------------------------------------------------------------------------------------- MANUAL intake
async def continue_flow(target: Message, state: FSMContext, d: dict, bot: Bot):
    """Go to the first player that still needs data (or the preview when all 11 are confirmed)."""
    await state.clear()
    uid = target.chat.id
    nxt = next((i for i, p in enumerate(d["players"]) if not p["done"]), None)
    if nxt is None:
        d["preview"] = True
        await save(uid, d)
        return await send_preview(target, uid, bot)
    d["idx"], d["sub"], d["preview"] = nxt, "pid", False
    await save(uid, d)
    await prompt(target, state, d)


@router.callback_query(F.data == "fx:xir")
async def resume(c: CallbackQuery, state: FSMContext, bot: Bot):
    d = await get_draft(c.from_user.id)
    if not d:
        return await c.answer("فرآیندی نیست.", show_alert=True)
    await c.answer()
    if not d.get("formation"):
        return await ask_formation(c.message, d, manual=d["mode"] == "manual")
    if d.get("preview") and filled(d) == 11:
        return await send_preview(c.message, c.from_user.id, bot)
    await prompt(c.message, state, d)


STEP_TEXT = {"pid": "آیدی بازیکن را وارد کنید.", "photo": "عکس بازیکن را ارسال کنید.", "team": "نام تیم بازیکن را وارد کنید.", "logo": "عکس یا لوگوی تیم را ارسال کنید."}
STATE_OF = {"pid": XiSt.pid, "photo": XiSt.photo, "team": XiSt.team, "logo": XiSt.logo}


def head(d: dict) -> str:
    i = d["idx"]
    return f"⭐ <b>بازیکن شماره {i + 1} از 11 — {label(d, i)}</b> ({slot(d, i)['pos']} · {d['formation']})"


def nav(d: dict, skip: str | None = None) -> list[list]:
    rows = []
    if skip:
        rows.append([ob("⏭ بدون " + ("عکس" if skip == "photo" else "لوگو"), f"fx:xiskip:{skip}")])
    rows.append([ob("🔙 مرحله قبل", "fx:xib"), ob("💾 ذخیره و خروج", "fx:xix")])
    return rows


async def prompt(target: Message, state: FSMContext, d: dict):
    sub = d["sub"]
    if sub == "confirm":
        return await show_confirm(target, state, d)
    await state.set_state(STATE_OF[sub])
    p = d["players"][d["idx"]]
    extra = f"\n\n🆔 {E(p['pid'])}" if p["pid"] and sub != "pid" else ""
    await target.answer(f"{head(d)}\n\n{STEP_TEXT[sub]}{extra}", reply_markup=okb(nav(d, sub if sub in ("photo", "logo") else None)))


async def show_confirm(target: Message, state: FSMContext, d: dict):
    await state.clear()
    i = d["idx"]
    p = d["players"][i]
    text = (f"{head(d)}\n\n🆔 آیدی: <b>{E(p['pid'])}</b>\n🏷 تیم: <b>{E(p['team']) or '—'}</b>\n🖼 عکس بازیکن: {'✅' if p['photo'] else '—'}   🛡 لوگوی تیم: {'✅' if p['logo'] else '—'}\n\n"
            f"اطلاعات درست است؟ ({filled(d)} از 11 تأیید شده)")
    kb = okb([[ob("✅ تأیید و بازیکن بعدی" if i < 10 else "✅ تأیید و ساخت پیش‌نمایش", "fx:xiok")], [ob("✏️ ویرایش اطلاعات", "fx:xied")], [ob("🔙 بازگشت", "fx:xib")]])
    ref = p["photo"] if p["photo"] and p["photo"].startswith("tg:") else None
    if ref:
        try:
            return await target.answer_photo(ref[3:], caption=text, reply_markup=kb)
        except TelegramAPIError:
            pass
    await target.answer(text, reply_markup=kb)


async def _advance(target: Message, state: FSMContext, uid: int, d: dict, sub: str):
    d["sub"] = sub
    await save(uid, d)
    await prompt(target, state, d)


async def _current(uid: int) -> dict | None:
    d = await get_draft(uid)
    return d if d and d.get("formation") else None


@router.message(XiSt.pid, F.text)
async def got_pid(m: Message, state: FSMContext):
    uid = m.from_user.id
    d = await _current(uid)
    if not d:
        return await state.clear()
    pid = core.norm(m.text).strip()
    if not 2 <= len(pid) <= 32 or " " in pid:
        return await m.answer("⚠️ آیدی باید ۲ تا ۳۲ کاراکتر و بدون فاصله باشد.")
    dup = next((j for j, p in enumerate(d["players"]) if j != d["idx"] and p["pid"].lower() == pid.lower()), None)
    if dup is not None:
        return await m.answer(f"⚠️ این آیدی قبلاً برای بازیکن شماره {dup + 1} ({label(d, dup)}) ثبت شده؛ بازیکن تکراری ممکن نیست.")
    p = d["players"][d["idx"]]
    p["pid"] = pid
    note = ""
    editing = bool(d.get("edit") or p["done"])
    known = None if editing else await dbx.fetchone("SELECT * FROM fx_xi_known WHERE player_id=?", pid)
    api = None
    if not known and not editing:
        try:
            rows = appapi.rows(await appapi.get("/players", search=pid, limit=5, page=1))
            api = next((r for r in rows if (r.get("gamer_tag") or "").lower() == pid.lower()), None)
            note = "\n\n✅ بازیکن در دیتابیس اپ پیدا شد." if api else "\n\nℹ️ این آیدی در دیتابیس اپ پیدا نشد (ثبت می‌شود)."
        except appapi.AppApiError:
            note = ""
    await save(uid, d)
    if known or api:
        team = known["team_name"] if known else (api.get("team_name") or "")
        d["offer"] = ({"team": team, "photo": known["photo_file"], "logo": known["logo_file"], "src": "saved"} if known
                      else {"team": team, "photo": ("url:" + api["avatar_url"]) if api.get("avatar_url") else None, "logo": ("url:" + api["team_logo"]) if api.get("team_logo") else None, "src": "app"})
        await save(uid, d)
        await state.clear()
        return await m.answer(f"{head(d)}\n\n🆔 {E(pid)}{note}\n♻️ اطلاعات {'ذخیره‌شده' if known else 'اپ'}: تیم «{E(team) or '—'}»" + (" + عکس" if d["offer"]["photo"] else "") + (" + لوگو" if d["offer"]["logo"] else "")
                              + "\n\nاز همین اطلاعات استفاده شود؟", reply_markup=okb([[ob("♻️ استفاده از اطلاعات", "fx:xiuse")], [ob("✍️ وارد کردن دستی", "fx:ximan")]]))
    await _advance(m, state, uid, d, "confirm" if editing else "photo")
    if note:
        await m.answer(note.strip())


@router.callback_query(F.data == "fx:xiuse")
async def use_known(c: CallbackQuery, state: FSMContext):
    d = await _current(c.from_user.id)
    if not d or not d.get("offer"):
        return await c.answer("موردی نیست.", show_alert=True)
    p, o = d["players"][d["idx"]], d.pop("offer")
    p["team"], p["photo"], p["logo"] = o["team"], o["photo"], o["logo"]
    await c.answer()
    await _advance(c.message, state, c.from_user.id, d, "confirm")


@router.callback_query(F.data == "fx:ximan")
async def manual_entry(c: CallbackQuery, state: FSMContext):
    d = await _current(c.from_user.id)
    if not d:
        return await c.answer()
    d.pop("offer", None)
    await c.answer()
    await _advance(c.message, state, c.from_user.id, d, "confirm" if d["players"][d["idx"]]["done"] else "photo")


@router.message(XiSt.photo, F.photo)
async def got_photo(m: Message, state: FSMContext):
    uid = m.from_user.id
    d = await _current(uid)
    if not d:
        return await state.clear()
    d["players"][d["idx"]]["photo"] = "tg:" + m.photo[-1].file_id
    await _advance(m, state, uid, d, "confirm" if d.get("edit") else "team")


@router.message(XiSt.team, F.text)
async def got_team(m: Message, state: FSMContext):
    uid = m.from_user.id
    d = await _current(uid)
    if not d:
        return await state.clear()
    team = m.text.strip()
    if not 1 <= len(team) <= 40:
        return await m.answer("⚠️ نام تیم باید ۱ تا ۴۰ کاراکتر باشد.")
    d["players"][d["idx"]]["team"] = team
    await _advance(m, state, uid, d, "confirm" if d.get("edit") else "logo")


@router.message(XiSt.logo, F.photo)
async def got_logo(m: Message, state: FSMContext):
    uid = m.from_user.id
    d = await _current(uid)
    if not d:
        return await state.clear()
    d["players"][d["idx"]]["logo"] = "tg:" + m.photo[-1].file_id
    await _advance(m, state, uid, d, "confirm")


@router.message(XiSt.photo)
@router.message(XiSt.logo)
async def wrong_media(m: Message):
    await m.answer("⚠️ یک عکس (تصویر) بفرست، یا «⏭ بدون …» را بزن.")


@router.callback_query(F.data.regexp(r"^fx:xiskip:(photo|logo)$"))
async def skip(c: CallbackQuery, state: FSMContext):
    d = await _current(c.from_user.id)
    if not d:
        return await c.answer()
    what = c.data.split(":")[2]
    d["players"][d["idx"]]["photo" if what == "photo" else "logo"] = None
    await c.answer()
    await _advance(c.message, state, c.from_user.id, d, "confirm" if d.get("edit") else ("team" if what == "photo" else "confirm"))


@router.callback_query(F.data == "fx:xiok")
async def confirm_player(c: CallbackQuery, state: FSMContext, bot: Bot):
    uid = c.from_user.id
    d = await _current(uid)
    if not d:
        return await c.answer()
    p = d["players"][d["idx"]]
    if not p["pid"]:
        return await c.answer("آیدی بازیکن خالی است.", show_alert=True)
    p["done"] = True
    d.pop("edit", None)
    await dbx.execute("INSERT INTO fx_xi_known(player_id,team_name,photo_file,logo_file,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET "
                      "team_name=excluded.team_name, photo_file=COALESCE(excluded.photo_file, photo_file), logo_file=COALESCE(excluded.logo_file, logo_file), updated_at=excluded.updated_at",
                      p["pid"], p["team"], p["photo"] if (p["photo"] or "").startswith("tg:") else None, p["logo"] if (p["logo"] or "").startswith("tg:") else None, core.now())
    await save(uid, d)
    await c.answer("✅ ثبت شد")
    if d.get("back_to_preview") or all(x["done"] for x in d["players"]):
        d.pop("back_to_preview", None)
        d["preview"] = True
        await save(uid, d)
        return await send_preview(c.message, uid, bot)
    await continue_flow(c.message, state, d, bot)


@router.callback_query(F.data == "fx:xied")
async def edit_menu(c: CallbackQuery, state: FSMContext):
    d = await _current(c.from_user.id)
    if not d:
        return await c.answer()
    await state.clear()
    await c.answer()
    await c.message.answer(f"{head(d)}\n\nکدام را ویرایش می‌کنی؟", reply_markup=okb(
        [[ob("🆔 آیدی", "fx:xie:pid"), ob("🖼 عکس بازیکن", "fx:xie:photo")], [ob("🏷 نام تیم", "fx:xie:team"), ob("🛡 لوگوی تیم", "fx:xie:logo")], [ob("🔙 بازگشت", "fx:xic2")]]))


@router.callback_query(F.data == "fx:xic2")
async def back_to_confirm(c: CallbackQuery, state: FSMContext):
    d = await _current(c.from_user.id)
    await c.answer()
    if d:
        d.pop("edit", None)
        await _advance(c.message, state, c.from_user.id, d, "confirm")


@router.callback_query(F.data.regexp(r"^fx:xie:(pid|photo|team|logo)$"))
async def edit_field(c: CallbackQuery, state: FSMContext):
    d = await _current(c.from_user.id)
    if not d:
        return await c.answer()
    sub = c.data.split(":")[2]
    d["edit"] = True
    await c.answer()
    await _advance(c.message, state, c.from_user.id, d, sub)


@router.callback_query(F.data == "fx:xib")
async def back(c: CallbackQuery, state: FSMContext, bot: Bot):
    uid = c.from_user.id
    d = await _current(uid)
    if not d:
        return await c.answer()
    await c.answer()
    order = ["pid", "photo", "team", "logo"]
    if d.get("edit"):                                                    # leaving an edit → back to the player's summary
        d.pop("edit")
        return await _advance(c.message, state, uid, d, "confirm")
    if d["sub"] in ("team", "logo", "photo"):
        return await _advance(c.message, state, uid, d, order[order.index(d["sub"]) - 1])
    if d["idx"] == 0:                                                    # first player: back to the system choice
        await state.clear()
        return await ask_formation(c.message, d, manual=d["mode"] == "manual", change=True)
    d["idx"] -= 1                                                        # previous player (his data stays editable)
    await _advance(c.message, state, uid, d, "confirm")


@router.callback_query(F.data == "fx:xix")
async def exit_keep(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await c.answer("ذخیره شد؛ هر وقت خواستی از «⭐ تیم منتخب» ادامه بده.", show_alert=True)


# ------------------------------------------------------------------------------------------------------ preview
async def send_preview(target: Message, uid: int, bot: Bot, note: str = ""):
    d = await get_draft(uid)
    png = await draw(bot, d)
    t = d.get("theme")
    cap = f"⭐ <b>{TITLE}</b> · {d['formation']}" + (f"\n🎭 {themes.NAMES[t]}" if t in themes.NAMES else "") + (f"\n{note}" if note else "")
    await target.answer_photo(BufferedInputFile(png, "team_of_the_tournament.png"), caption=cap)
    await target.answer("پیش‌نمایش ترکیب نهایی. تأیید می‌کنی؟", reply_markup=okb([
        [ob("✅ تأیید نهایی", "fx:xifin")], [ob("✏️ ویرایش بازیکنان", "fx:xipl"), ob("🔁 تغییر ترکیب", "fx:xichg")],
        [ob("🎭 تغییر تم گرافیکی", "fx:xith")], [ob("❌ لغو", "fx:xidel")]]))


@router.callback_query(F.data == "fx:xipl")
async def player_list(c: CallbackQuery):
    d = await _current(c.from_user.id)
    if not d:
        return await c.answer()
    rows = [[ob(f"{i + 1}. {label(d, i)} — {p['pid']}"[:50], f"fx:xip:{i}")] for i, p in enumerate(d["players"])]
    await c.answer()
    await c.message.answer("✏️ <b>ویرایش بازیکنان</b> — یک بازیکن را انتخاب کن:", reply_markup=okb(rows + [[ob("🔙 بازگشت به پیش‌نمایش", "fx:xipv")]]))


@router.callback_query(F.data.regexp(r"^fx:xip:\d+$"))
async def player_edit(c: CallbackQuery, state: FSMContext):
    d = await _current(c.from_user.id)
    i = int(c.data.split(":")[2])
    if not d or i > 10:
        return await c.answer()
    d["idx"], d["back_to_preview"], d["preview"] = i, True, False
    await c.answer()
    await _advance(c.message, state, c.from_user.id, d, "confirm")


@router.callback_query(F.data == "fx:xipv")
async def back_preview(c: CallbackQuery, bot: Bot):
    await c.answer()
    d = await _current(c.from_user.id)
    if d:
        d.pop("back_to_preview", None)
        d["preview"] = True
        await save(c.from_user.id, d)
        await send_preview(c.message, c.from_user.id, bot)


@router.callback_query(F.data == "fx:xichg")
async def change_formation(c: CallbackQuery):
    d = await _current(c.from_user.id)
    await c.answer()
    if d:
        await ask_formation(c.message, d, manual=d["mode"] == "manual", change=True)


@router.callback_query(F.data == "fx:xith")
async def theme_menu(c: CallbackQuery):
    btns = [ob(f"{i + 1}. {themes.NAMES[t]}", f"fx:xit:{i}") for i, t in enumerate(themes.ORDER)]
    await c.answer()
    await c.message.answer("🎭 <b>تم گرافیکی</b> را انتخاب کن (آیدی، عکس‌ها و ترکیب همان می‌ماند):",
                           reply_markup=okb([btns[i:i + 2] for i in range(0, len(btns), 2)] + [[ob("♻️ تم پیش‌فرض", "fx:xit:def")], [ob("🔙 بازگشت", "fx:xipv")]]))


@router.callback_query(F.data.regexp(r"^fx:xit:(\d+|def)$"))
async def theme_set(c: CallbackQuery, bot: Bot):
    d = await _current(c.from_user.id)
    arg = c.data.split(":")[2]
    if not d or (arg != "def" and int(arg) >= len(themes.ORDER)):
        return await c.answer()
    d["theme"] = None if arg == "def" else themes.ORDER[int(arg)]
    await save(c.from_user.id, d)
    await c.answer("⏳ در حال ساخت…")
    await send_preview(c.message, c.from_user.id, bot)


@router.callback_query(F.data == "fx:xidel")
async def cancel(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await drop(c.from_user.id)
    await c.answer("لغو شد و اطلاعات پاک شد.", show_alert=True)
    await entry(c, state)


@router.callback_query(F.data == "fx:xifin")
async def final(c: CallbackQuery, bot: Bot):
    uid = c.from_user.id
    d = await _current(uid)
    if not d or not all(p["done"] for p in d["players"]):
        return await c.answer("هنوز همه‌ی ۱۱ بازیکن تأیید نشده‌اند.", show_alert=True)
    await c.answer("⏳ در حال ساخت تصویر نهایی…")
    png = await draw(bot, d)
    cap = f"⭐ <b>{TITLE}</b> · {d['formation']}"
    await c.message.answer_document(BufferedInputFile(png, "team_of_the_tournament.png"), caption=cap + "\n\n(فایل کامل با کیفیت اصلی 1080×1350)")
    from . import appgfx
    appgfx.PREVIEW[uid] = {"images": [png], "caption": cap, "jobs": []}
    await c.message.answer("✅ تصویر نهایی ساخته شد.", reply_markup=okb([[ob("📣 انتشار در کانال گرافیک‌ها", "fx:agp")], [ob("🔙 ویرایش دوباره", "fx:xipv")], [ob("🏁 پایان و پاک کردن پیش‌نویس", "fx:xidel")]]))
