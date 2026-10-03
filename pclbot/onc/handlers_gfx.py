"""ONC admin panel, part 3: GRAPHICS (template sets, templates, position editor, preview) and CHANNEL settings."""
import os
import re
import uuid

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery, Message

from ..utils import is_admin, show
from . import publish, render, service, templates, ui
from .handlers_admin import PANEL, alert
from .service import OncError
from .states import ChanSt, TplSt
from .ui import E, ob, okb

router = Router()
router.message.filter(lambda m: is_admin(m.from_user.id))
router.callback_query.filter(lambda c: is_admin(c.from_user.id))

STEPS = [1, 5, 10, 25]


# ----------------------------------------------------------------- graphics menu / template sets
@router.callback_query(F.data == "onc:gx")
async def gfx_menu(c: CallbackQuery, state: FSMContext):
    await state.clear()
    s = await templates.active_set()
    miss = await templates.missing_types()
    text = (f"🎨 <b>GRAPHICS</b>\n\nActive template set: <b>{E(s['name']) if s else '—'}</b>\n"
            + ("⚠️ Missing active templates: " + ", ".join(miss) if miss else "✅ All 7 graphic types have an active template")
            + "\n\n<i>Team logos appear ONLY on the Champion poster.</i>")
    rows = [[ob("🗂 TEMPLATE SETS", "onc:xs")]]
    if s:
        rows.append([ob("🎨 TEMPLATES OF ACTIVE SET", f"onc:xsp:{s['id']}")])
    rows.append([ob("🔙 BACK", PANEL)])
    await show(c, text, okb(rows))
    await c.answer()


async def sets_screen(c) -> None:
    ss = await templates.sets()
    rows = [[ob(("✅ " if s["is_active"] else "") + s["name"], f"onc:xsp:{s['id']}")] for s in ss]
    await show(c, "🗂 <b>TEMPLATE SETS</b>\n\nA set holds one template per graphic type (schedule, group table, round results, "
               "qualified, knockout matches, bracket, champion).", okb(rows + [[ob("➕ NEW SET", "onc:xsn")], [ob("🔙 BACK", "onc:gx")]]))


@router.callback_query(F.data == "onc:xs")
async def sets_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await sets_screen(c)
    await c.answer()


@router.callback_query(F.data == "onc:xsn")
async def set_new(c: CallbackQuery):
    rows = [[ob(f"🎨 {t}", f"onc:xsc:{t}") for t in templates.THEMES]]
    await show(c, "➕ <b>NEW TEMPLATE SET</b>\n\nChoose a colour theme (you can upload your own backgrounds afterwards):", okb(rows + [[ob("🔙 BACK", "onc:xs")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:xsc:"))
async def set_create(c: CallbackQuery):
    theme = c.data.split(":")[2]
    sid = await templates.create_set(f"ONE NIGHT CHAMPION — {theme}", theme)
    await service.audit(c.from_user.id, "ADD TEMPLATE SET", theme)
    await c.answer("Set created")
    await set_screen(c, sid)


async def set_screen(c, sid: int) -> None:
    s = await templates.get_set(sid)
    ts = await templates.templates_of(sid)
    rows = [[ob(f"{'🟢' if t['active'] else '⚪'} {t['name']}" + (" 🖼" if t["bg_path"] else ""), f"onc:xt:{t['id']}")] for t in ts]
    text = f"🗂 <b>{E(s['name'])}</b> {'✅ ACTIVE' if s['is_active'] else ''}\n\n🟢 active template · ⚪ inactive · 🖼 custom background"
    act = [] if s["is_active"] else [ob("✅ ACTIVATE SET", f"onc:xsa:{sid}")]
    rows += [[ob("➕ ADD TEMPLATE", f"onc:xta:{sid}")],
             act + [ob("📑 DUPLICATE SET", f"onc:xsd:{sid}"), ob("✏️ RENAME", f"onc:xsr:{sid}")],
             ([ob("🗑 DELETE SET", f"onc:cf:dss:{sid}")] if not s["is_active"] else []),
             [ob("🔙 SETS", "onc:xs")]]
    await show(c, text, okb([r for r in rows if r]))


@router.callback_query(F.data.startswith("onc:xsp:"))
async def set_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await set_screen(c, int(c.data.split(":")[2]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:xsa:"))
async def set_activate(c: CallbackQuery):
    sid = int(c.data.split(":")[2])
    await templates.activate_set(sid)
    await service.audit(c.from_user.id, "ACTIVATE TEMPLATE SET", str(sid))
    await c.answer("✅ Activated")
    await set_screen(c, sid)


@router.callback_query(F.data.startswith("onc:xsd:"))
async def set_duplicate(c: CallbackQuery):
    new = await templates.duplicate_set(int(c.data.split(":")[2]))
    await service.audit(c.from_user.id, "DUPLICATE TEMPLATE SET", str(new))
    await c.answer("Duplicated")
    await set_screen(c, new)


@router.callback_query(F.data.startswith("onc:xsr:"))
async def set_rename(c: CallbackQuery, state: FSMContext):
    sid = int(c.data.split(":")[2])
    await state.set_state(TplSt.set_name)
    await state.update_data(sid=sid)
    await show(c, "✏️ Send the new <b>SET NAME</b>", okb([[ob("❌ CANCEL", f"onc:xsp:{sid}")]]))
    await c.answer()


@router.message(TplSt.set_name, F.text)
async def set_rename_do(m: Message, state: FSMContext):
    d = await state.get_data()
    await templates.rename_set(d["sid"], m.text.strip())
    await state.clear()
    await set_screen(m, d["sid"])


@router.callback_query(F.data.startswith("onc:xta:"))
async def tpl_add_type(c: CallbackQuery):
    sid = int(c.data.split(":")[2])
    rows = [[ob(templates.TYPE_LABEL[t], f"onc:xtn:{sid}:{i}")] for i, t in enumerate(templates.TYPES)]
    await show(c, "➕ <b>ADD TEMPLATE</b>\n\nChoose the template type:", okb(rows + [[ob("🔙 BACK", f"onc:xsp:{sid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:xtn:"))
async def tpl_add(c: CallbackQuery):
    _, _, sid, i = c.data.split(":")
    tid = await templates.add_template(int(sid), templates.TYPES[int(i)])
    await service.audit(c.from_user.id, "ADD TEMPLATE", templates.TYPES[int(i)])
    await c.answer("Template added (inactive)")
    await tpl_screen(c, tid)


# ----------------------------------------------------------------- one template
async def tpl_screen(c, tid: int, note: str = "") -> None:
    t = await templates.get_template(tid)
    cfg = t["config"]
    text = (f"{note}🎨 <b>{E(t['name'])}</b>\nType: {templates.TYPE_LABEL[t['type']]}\nStatus: {'🟢 ACTIVE' if t['active'] else '⚪ inactive'}\n"
            f"Background: {'🖼 custom' if t['bg_path'] else 'built-in theme'}\nCanvas: {cfg['w']}×{cfg['h']}")
    rows = [
        [ob("👁 PREVIEW", f"onc:xtv:{tid}"), ob("✏️ EDIT POSITIONS", f"onc:xe:{tid}:0:1")],
        [ob("🖼 UPLOAD BACKGROUND", f"onc:xtb:{tid}")] + ([ob("🧽 REMOVE BG", f"onc:xtr:{tid}")] if t["bg_path"] else []),
        [ob("⛔ DEACTIVATE" if t["active"] else "✅ ACTIVATE", f"onc:xtt:{tid}"), ob("📑 DUPLICATE", f"onc:xtd:{tid}")],
    ]
    if t["type"] == "GROUP_TABLE":
        rows.append([ob(("✓ " if k in cfg["show"] else "✗ ") + k, f"onc:xtc:{tid}:{k}") for k in ("W", "D", "L", "GF", "GA", "GD")])
    rows += [[ob("🗑 DELETE", f"onc:cf:dtp:{tid}")], [ob("🔙 SET", f"onc:xsp:{t['set_id']}")]]
    await show(c, text, okb(rows))


@router.callback_query(F.data.startswith("onc:xt:"))
async def tpl_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await tpl_screen(c, int(c.data.split(":")[2]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:xtt:"))
async def tpl_toggle(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    t = await templates.get_template(tid)
    await templates.set_active_flag(tid, not t["active"])
    await service.audit(c.from_user.id, "ACTIVATE TEMPLATE" if not t["active"] else "DEACTIVATE TEMPLATE", t["name"])
    await c.answer("Done")
    await tpl_screen(c, tid)


@router.callback_query(F.data.startswith("onc:xtd:"))
async def tpl_dup(c: CallbackQuery):
    new = await templates.duplicate_template(int(c.data.split(":")[2]))
    await c.answer("Duplicated (inactive)")
    await tpl_screen(c, new)


@router.callback_query(F.data.startswith("onc:xtc:"))
async def tpl_toggle_col(c: CallbackQuery):
    _, _, tid, col = c.data.split(":")
    t = await templates.get_template(int(tid))
    cfg = t["config"]
    cfg["show"] = [k for k in cfg["show"] if k != col] if col in cfg["show"] else \
        [k for k in ["pos", "team", "P", "W", "D", "L", "GF", "GA", "GD", "PTS"] if k in cfg["show"] or k == col]
    await templates.save_config(int(tid), cfg)
    await c.answer("Saved")
    await tpl_screen(c, int(tid))


@router.callback_query(F.data.startswith("onc:xtv:"))
async def tpl_preview(c: CallbackQuery):
    t = await templates.get_template(int(c.data.split(":")[2]))
    await c.answer("Rendering…")
    pages = render.render(t["type"], t["config"], render.sample(t["type"]), t["bg_path"])
    await c.message.answer_photo(BufferedInputFile(pages[0], "preview.png"), caption=f"👁 PREVIEW — {E(t['name'])}\n<i>sample data</i>")


@router.callback_query(F.data.startswith("onc:xtb:"))
async def tpl_bg_ask(c: CallbackQuery, state: FSMContext):
    tid = int(c.data.split(":")[2])
    await state.set_state(TplSt.bg)
    await state.update_data(tid=tid)
    await show(c, "🖼 Send the <b>BACKGROUND</b> as a PNG or JPG (send it as a file/document for full quality).\n"
               "It is scaled to fill the template canvas.", okb([[ob("❌ CANCEL", f"onc:xt:{tid}")]]))
    await c.answer()


@router.message(TplSt.bg, F.photo | F.document)
async def tpl_bg_save(m: Message, state: FSMContext, bot: Bot):
    d = await state.get_data()
    if m.document:
        mt = (m.document.mime_type or "").lower()
        if mt not in ("image/png", "image/jpeg"):
            return await m.answer("⚠️ Only PNG or JPG files are accepted.")
        fid, ext = m.document.file_id, ".png" if mt == "image/png" else ".jpg"
    else:
        fid, ext = m.photo[-1].file_id, ".jpg"
    path = os.path.join(templates.bg_dir(), f"bg_{d['tid']}_{uuid.uuid4().hex[:8]}{ext}")
    try:
        await bot.download(fid, destination=path)
        from PIL import Image
        Image.open(path).verify()
    except Exception:
        if os.path.exists(path):
            os.remove(path)
        return await m.answer("⚠️ Could not read that image. Send a valid PNG/JPG.")
    old = (await templates.get_template(d["tid"]))["bg_path"]
    await templates.set_bg(d["tid"], path)
    if old and os.path.exists(old) and not await service.dbx.scalar("SELECT 1 FROM onc_templates WHERE bg_path=? AND id<>?", old, d["tid"]):
        os.remove(old)
    await service.audit(m.from_user.id, "TEMPLATE BACKGROUND", str(d["tid"]))
    await state.clear()
    await tpl_screen(m, d["tid"], "✅ Background saved.\n\n")


@router.callback_query(F.data.startswith("onc:xtr:"))
async def tpl_bg_remove(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    t = await templates.get_template(tid)
    await templates.set_bg(tid, None)
    if t["bg_path"] and os.path.exists(t["bg_path"]) and not await service.dbx.scalar("SELECT 1 FROM onc_templates WHERE bg_path=?", t["bg_path"]):
        os.remove(t["bg_path"])
    await c.answer("Removed")
    await tpl_screen(c, tid)


# ----------------------------------------------------------------- position editor
async def editor_screen(c, tid: int, idx: int, step_i: int) -> None:
    t = await templates.get_template(tid)
    cfg = t["config"]
    its = templates.items(cfg)
    idx %= len(its)
    name = its[idx]
    st = templates.item_style(cfg, name)
    if name == "rows":
        info = f"start Y {st['start_y']} · row height {st['row_h']} · gap {st['gap']} · max rows/page {st['max_rows']}"
    elif name == "logo":
        info = f"x {st['x']} · y {st['y']} · size {st['size']}"
    else:
        fl = templates.fonts()
        info = (f"x {st['x']} · y {st.get('y', 0)} · size {st['size']} (min {st.get('min', '-')}) · color {st.get('color')} · "
                f"align {st.get('align')} · max width {st.get('max_w')} · font {fl[st.get('font', 0) % len(fl)][0] if fl else '-'}")
    step = STEPS[step_i]
    rows = [
        [ob("◀️ PREV", f"onc:xe:{tid}:{idx - 1}:{step_i}"), ob(f"{idx + 1}/{len(its)}", "onc:noop"), ob("NEXT ▶️", f"onc:xe:{tid}:{idx + 1}:{step_i}")],
        [ob("⬆️ UP", f"onc:xo:{tid}:{idx}:{step_i}:u")],
        [ob("⬅️ LEFT", f"onc:xo:{tid}:{idx}:{step_i}:l"), ob(f"STEP {step}px 🔁", f"onc:xe:{tid}:{idx}:{(step_i + 1) % len(STEPS)}"), ob("RIGHT ➡️", f"onc:xo:{tid}:{idx}:{step_i}:r")],
        [ob("⬇️ DOWN", f"onc:xo:{tid}:{idx}:{step_i}:d")],
    ]
    if name == "rows":
        rows.append([ob("ROW HEIGHT −", f"onc:xo:{tid}:{idx}:{step_i}:fs-"), ob("ROW HEIGHT +", f"onc:xo:{tid}:{idx}:{step_i}:fs+")])
        rows.append([ob("MAX ROWS −", f"onc:xo:{tid}:{idx}:{step_i}:w-"), ob("MAX ROWS +", f"onc:xo:{tid}:{idx}:{step_i}:w+")])
    elif name == "logo":
        rows.append([ob("SIZE −", f"onc:xo:{tid}:{idx}:{step_i}:fs-"), ob("SIZE +", f"onc:xo:{tid}:{idx}:{step_i}:fs+")])
    else:
        rows.append([ob("FONT SIZE −", f"onc:xo:{tid}:{idx}:{step_i}:fs-"), ob("FONT SIZE +", f"onc:xo:{tid}:{idx}:{step_i}:fs+")])
        rows.append([ob("MAX WIDTH −", f"onc:xo:{tid}:{idx}:{step_i}:w-"), ob("MAX WIDTH +", f"onc:xo:{tid}:{idx}:{step_i}:w+")])
        rows.append([ob("🎨 COLOR", f"onc:xo:{tid}:{idx}:{step_i}:col"), ob("↔️ ALIGN", f"onc:xo:{tid}:{idx}:{step_i}:al"), ob("🔤 FONT", f"onc:xo:{tid}:{idx}:{step_i}:font")])
    rows.append([ob("👁 PREVIEW", f"onc:xtv:{tid}"), ob("✅ DONE", f"onc:xt:{tid}")])
    label = name.replace("col:", "column · ")
    await show(c, f"✏️ <b>POSITION EDITOR</b> — {E(t['name'])}\n\nElement: <b>{E(label)}</b>\n<code>{E(info)}</code>\n\nStep: {step}px", okb(rows))


@router.callback_query(F.data == "onc:noop")
async def noop(c: CallbackQuery):
    await c.answer()


@router.callback_query(F.data.startswith("onc:xe:"))
async def editor_open(c: CallbackQuery):
    _, _, tid, idx, step_i = c.data.split(":")
    await editor_screen(c, int(tid), int(idx), int(step_i))
    await c.answer()


@router.callback_query(F.data.startswith("onc:xo:"))
async def editor_op(c: CallbackQuery):
    _, _, tid, idx, step_i, op = c.data.split(":")
    t = await templates.get_template(int(tid))
    its = templates.items(t["config"])
    name = its[int(idx) % len(its)]
    cfg = templates.apply_op(t["config"], name, op, STEPS[int(step_i)])
    await templates.save_config(int(tid), cfg)
    await c.answer()
    await editor_screen(c, int(tid), int(idx), int(step_i))


# ----------------------------------------------------------------- channel settings
async def channel_screen(c, bot: Bot, tested: bool = False) -> None:
    info = await publish.channel_info(bot) if tested or await service.get_setting("channel_id") else {"id": "", "problems": ["No channel configured"], "ok": False}
    cid = await service.get_setting("channel_id")
    if not cid:
        text = "📢 <b>ONC CHANNEL</b>\n\nNo channel configured.\nAdd the bot as an admin of your ONE NIGHT CHAMPION news channel, then set it here."
    else:
        text = (f"📢 <b>ONC CHANNEL</b>\n\n<b>CHANNEL TITLE:</b> {E(info.get('title') or '—')}\n<b>CHANNEL ID:</b> <code>{E(cid)}</code>\n"
                f"<b>CHANNEL USERNAME:</b> {('@' + E(info['username'])) if info.get('username') else '—'}\n"
                f"<b>CONNECTION STATUS:</b> {'✅ CONNECTED' if info.get('ok') else '❌ PROBLEM'}\n\n"
                f"SEND MESSAGE / SEND PHOTO: {'✅' if info.get('can_post') else '❌'}\nEDIT MESSAGE: {'✅' if info.get('can_edit') else '❌'}")
        if info.get("problems"):
            text += "\n\n⚠️ " + "\n⚠️ ".join(E(p) for p in info["problems"])
    text += "\n\n<i>This is separate from the TRANSFER ADS GROUP. Tournament content is only ever sent here.</i>"
    rows = [[ob("✏️ SET CHANNEL", "onc:chs")]]
    if cid:
        rows += [[ob("🔌 TEST CONNECTION", "onc:cht")], [ob("🗑 REMOVE CHANNEL", "onc:cf:chx:0")]]
    rows.append([ob("🔙 BACK", PANEL)])
    await show(c, text, okb(rows))


@router.callback_query(F.data == "onc:ch")
async def channel_open(c: CallbackQuery, state: FSMContext, bot: Bot):
    await state.clear()
    await channel_screen(c, bot)
    await c.answer()


@router.callback_query(F.data == "onc:cht")
async def channel_test(c: CallbackQuery, bot: Bot):
    await c.answer("Testing…")
    await channel_screen(c, bot, tested=True)


@router.callback_query(F.data == "onc:chs")
async def channel_set(c: CallbackQuery, state: FSMContext):
    await state.set_state(ChanSt.chat)
    await show(c, "✏️ <b>SET ONC CHANNEL</b>\n\nSend the channel as <code>@username</code> or numeric id (<code>-100…</code>), "
               "or <b>forward any post</b> from the channel.\nThe bot must already be an admin of that channel.",
               okb([[ob("❌ CANCEL", "onc:ch")]]))
    await c.answer()


@router.message(ChanSt.chat)
async def channel_set_do(m: Message, state: FSMContext, bot: Bot):
    raw = None
    if m.forward_origin and getattr(m.forward_origin, "chat", None):
        raw = str(m.forward_origin.chat.id)
    elif m.text:
        raw = m.text.strip()
    if not raw or not re.fullmatch(r"@[A-Za-z0-9_]{4,}|-?\d{5,}", raw):
        return await m.answer("⚠️ Send @username, a numeric id like -1001234567890, or forward a channel post.")
    transfer = (await service.main_db.get_setting("publish_chat")).strip()
    try:
        chat = await bot.get_chat(raw)
    except TelegramAPIError as e:
        return await m.answer(f"⚠️ Telegram can't open that chat: {E(str(e))}")
    if transfer and (str(chat.id) == transfer or (chat.username and f"@{chat.username}".lower() == transfer.lower())):
        return await m.answer("⛔ That is the TRANSFER ads group. The ONE NIGHT CHAMPION channel must be a different chat.")
    await service.set_setting("channel_id", str(chat.id))
    await service.audit(m.from_user.id, "SET CHANNEL", f"{chat.title} ({chat.id})")
    await state.clear()
    await channel_screen(m, bot, tested=True)
