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
    text = (f"🎨 <b>گرافیک</b>\n\nست تمپلیت فعال: <b>{E(s['name']) if s else '—'}</b>\n"
            + ("⚠️ تمپلیت فعال ندارد: " + ", ".join(miss) if miss else "✅ هر ۷ نوع گرافیک تمپلیت فعال دارند")
            + "\n\n<i>لوگوی تیم‌ها فقط روی پوستر قهرمان نمایش داده می‌شود.</i>")
    rows = [[ob("🗂 ست‌های تمپلیت", "onc:xs")]]
    if s:
        rows.append([ob("🎨 تمپلیت‌های ست فعال", f"onc:xsp:{s['id']}")])
    rows.append([ob("🔙 بازگشت", PANEL)])
    await show(c, text, okb(rows))
    await c.answer()


async def sets_screen(c) -> None:
    ss = await templates.sets()
    rows = [[ob(("✅ " if s["is_active"] else "") + s["name"], f"onc:xsp:{s['id']}")] for s in ss]
    await show(c, "🗂 <b>ست‌های تمپلیت</b>\n\nهر ست برای هر نوع گرافیک یک تمپلیت دارد (برنامه، جدول گروه، نتایج راند، "
               "صعودکننده‌ها، بازی‌های حذفی، جدول حذفی، قهرمان).", okb(rows + [[ob("➕ ست جدید", "onc:xsn")], [ob("🔙 بازگشت", "onc:gx")]]))


@router.callback_query(F.data == "onc:xs")
async def sets_open(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await sets_screen(c)
    await c.answer()


@router.callback_query(F.data == "onc:xsn")
async def set_new(c: CallbackQuery):
    rows = [[ob(f"🎨 {templates.THEME_FA[t]}", f"onc:xsc:{t}") for t in templates.THEMES]]
    await show(c, "➕ <b>ست تمپلیت جدید</b>\n\nیک رنگ‌بندی انتخاب کن (بعداً می‌توانی پس‌زمینه‌ی خودت را آپلود کنی):", okb(rows + [[ob("🔙 بازگشت", "onc:xs")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:xsc:"))
async def set_create(c: CallbackQuery):
    theme = c.data.split(":")[2]
    sid = await templates.create_set(f"وان نایت چمپیون — {templates.THEME_FA[theme]}", theme)
    await service.audit(c.from_user.id, "ADD TEMPLATE SET", theme)
    await c.answer("ست ساخته شد")
    await set_screen(c, sid)


async def set_screen(c, sid: int) -> None:
    s = await templates.get_set(sid)
    ts = await templates.templates_of(sid)
    rows = [[ob(f"{'🟢' if t['active'] else '⚪'} {t['name']}" + (" 🖼" if t["bg_path"] else ""), f"onc:xt:{t['id']}")] for t in ts]
    text = f"🗂 <b>{E(s['name'])}</b> {'✅ فعال' if s['is_active'] else ''}\n\n🟢 تمپلیت فعال · ⚪ غیرفعال · 🖼 پس‌زمینه‌ی دلخواه"
    act = [] if s["is_active"] else [ob("✅ فعال‌سازی ست", f"onc:xsa:{sid}")]
    rows += [[ob("➕ افزودن تمپلیت", f"onc:xta:{sid}")],
             act + [ob("📑 کپی ست", f"onc:xsd:{sid}"), ob("✏️ تغییر نام", f"onc:xsr:{sid}")],
             ([ob("🗑 حذف ست", f"onc:cf:dss:{sid}")] if not s["is_active"] else []),
             [ob("🔙 ست‌ها", "onc:xs")]]
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
    await c.answer("✅ فعال شد")
    await set_screen(c, sid)


@router.callback_query(F.data.startswith("onc:xsd:"))
async def set_duplicate(c: CallbackQuery):
    new = await templates.duplicate_set(int(c.data.split(":")[2]))
    await service.audit(c.from_user.id, "DUPLICATE TEMPLATE SET", str(new))
    await c.answer("کپی شد")
    await set_screen(c, new)


@router.callback_query(F.data.startswith("onc:xsr:"))
async def set_rename(c: CallbackQuery, state: FSMContext):
    sid = int(c.data.split(":")[2])
    await state.set_state(TplSt.set_name)
    await state.update_data(sid=sid)
    await show(c, "✏️ <b>نام جدید ست</b> را بفرست", okb([[ob("❌ لغو", f"onc:xsp:{sid}")]]))
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
    await show(c, "➕ <b>افزودن تمپلیت</b>\n\nنوع تمپلیت را انتخاب کن:", okb(rows + [[ob("🔙 بازگشت", f"onc:xsp:{sid}")]]))
    await c.answer()


@router.callback_query(F.data.startswith("onc:xtn:"))
async def tpl_add(c: CallbackQuery):
    _, _, sid, i = c.data.split(":")
    tid = await templates.add_template(int(sid), templates.TYPES[int(i)])
    await service.audit(c.from_user.id, "ADD TEMPLATE", templates.TYPES[int(i)])
    await c.answer("تمپلیت اضافه شد (غیرفعال)")
    await tpl_screen(c, tid)


# ----------------------------------------------------------------- one template
async def tpl_screen(c, tid: int, note: str = "") -> None:
    t = await templates.get_template(tid)
    cfg = t["config"]
    text = (f"{note}🎨 <b>{E(t['name'])}</b>\nنوع: {templates.TYPE_LABEL[t['type']]}\nوضعیت: {'🟢 فعال' if t['active'] else '⚪ غیرفعال'}\n"
            f"پس‌زمینه: {'🖼 دلخواه' if t['bg_path'] else 'پیش‌فرض (رنگ‌بندی ست)'}\nابعاد: {cfg['w']}×{cfg['h']}")
    rows = [
        [ob("👁 پیش‌نمایش", f"onc:xtv:{tid}"), ob("✏️ ویرایش موقعیت‌ها", f"onc:xe:{tid}:0:1")],
        [ob("🖼 آپلود پس‌زمینه", f"onc:xtb:{tid}")] + ([ob("🧽 حذف پس‌زمینه", f"onc:xtr:{tid}")] if t["bg_path"] else []),
        [ob("⛔ غیرفعال‌سازی" if t["active"] else "✅ فعال‌سازی", f"onc:xtt:{tid}"), ob("📑 کپی", f"onc:xtd:{tid}")],
    ]
    if t["type"] == "GROUP_TABLE":
        rows.append([ob(("✓ " if k in cfg["show"] else "✗ ") + templates.ELEMENT_FA["col:" + k], f"onc:xtc:{tid}:{k}") for k in ("W", "D", "L", "GF", "GA", "GD")])
    rows += [[ob("🗑 حذف", f"onc:cf:dtp:{tid}")], [ob("🔙 ست", f"onc:xsp:{t['set_id']}")]]
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
    await c.answer("انجام شد")
    await tpl_screen(c, tid)


@router.callback_query(F.data.startswith("onc:xtd:"))
async def tpl_dup(c: CallbackQuery):
    new = await templates.duplicate_template(int(c.data.split(":")[2]))
    await c.answer("کپی شد (غیرفعال)")
    await tpl_screen(c, new)


@router.callback_query(F.data.startswith("onc:xtc:"))
async def tpl_toggle_col(c: CallbackQuery):
    _, _, tid, col = c.data.split(":")
    t = await templates.get_template(int(tid))
    cfg = t["config"]
    cfg["show"] = [k for k in cfg["show"] if k != col] if col in cfg["show"] else \
        [k for k in ["pos", "team", "P", "W", "D", "L", "GF", "GA", "GD", "PTS"] if k in cfg["show"] or k == col]
    await templates.save_config(int(tid), cfg)
    await c.answer("ذخیره شد")
    await tpl_screen(c, int(tid))


@router.callback_query(F.data.startswith("onc:xtv:"))
async def tpl_preview(c: CallbackQuery):
    t = await templates.get_template(int(c.data.split(":")[2]))
    await c.answer("در حال ساخت…")
    pages = render.render(t["type"], t["config"], render.sample(t["type"]), t["bg_path"])
    await c.message.answer_photo(BufferedInputFile(pages[0], "preview.png"), caption=f"👁 پیش‌نمایش — {E(t['name'])}\n<i>داده‌ی نمونه</i>")


@router.callback_query(F.data.startswith("onc:xtb:"))
async def tpl_bg_ask(c: CallbackQuery, state: FSMContext):
    tid = int(c.data.split(":")[2])
    await state.set_state(TplSt.bg)
    await state.update_data(tid=tid)
    await show(c, "🖼 <b>پس‌زمینه</b> را به‌صورت PNG یا JPG بفرست (برای کیفیت کامل به‌صورت فایل/Document بفرست).\n"
               "تصویر به اندازه‌ی بوم تمپلیت تنظیم می‌شود.", okb([[ob("❌ لغو", f"onc:xt:{tid}")]]))
    await c.answer()


@router.message(TplSt.bg, F.photo | F.document)
async def tpl_bg_save(m: Message, state: FSMContext, bot: Bot):
    d = await state.get_data()
    if m.document:
        mt = (m.document.mime_type or "").lower()
        if mt not in ("image/png", "image/jpeg"):
            return await m.answer("⚠️ فقط فایل PNG یا JPG قبول است.")
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
        return await m.answer("⚠️ این تصویر خوانده نشد. یک PNG/JPG معتبر بفرست.")
    old = (await templates.get_template(d["tid"]))["bg_path"]
    await templates.set_bg(d["tid"], path)
    if old and os.path.exists(old) and not await service.dbx.scalar("SELECT 1 FROM onc_templates WHERE bg_path=? AND id<>?", old, d["tid"]):
        os.remove(old)
    await service.audit(m.from_user.id, "TEMPLATE BACKGROUND", str(d["tid"]))
    await state.clear()
    await tpl_screen(m, d["tid"], "✅ پس‌زمینه ذخیره شد.\n\n")


@router.callback_query(F.data.startswith("onc:xtr:"))
async def tpl_bg_remove(c: CallbackQuery):
    tid = int(c.data.split(":")[2])
    t = await templates.get_template(tid)
    await templates.set_bg(tid, None)
    if t["bg_path"] and os.path.exists(t["bg_path"]) and not await service.dbx.scalar("SELECT 1 FROM onc_templates WHERE bg_path=?", t["bg_path"]):
        os.remove(t["bg_path"])
    await c.answer("حذف شد")
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
        info = f"start Y {st['start_y']} · ارتفاع ردیف {st['row_h']} · فاصله {st['gap']} · حداکثر ردیف هر صفحه {st['max_rows']}"
    elif name == "logo":
        info = f"x {st['x']} · y {st['y']} · اندازه {st['size']}"
    else:
        fl = templates.fonts()
        info = (f"x {st['x']} · y {st.get('y', 0)} · اندازه {st['size']} (حداقل {st.get('min', '-')}) · رنگ {st.get('color')} · "
                f"تراز {st.get('align')} · حداکثر عرض {st.get('max_w')} · فونت {fl[st.get('font', 0) % len(fl)][0] if fl else '-'}")
    step = STEPS[step_i]
    rows = [
        [ob("◀️ قبلی", f"onc:xe:{tid}:{idx - 1}:{step_i}"), ob(f"{idx + 1}/{len(its)}", "onc:noop"), ob("بعدی ▶️", f"onc:xe:{tid}:{idx + 1}:{step_i}")],
        [ob("⬆️ بالا", f"onc:xo:{tid}:{idx}:{step_i}:u")],
        [ob("⬅️ چپ", f"onc:xo:{tid}:{idx}:{step_i}:l"), ob(f"گام {step}px 🔁", f"onc:xe:{tid}:{idx}:{(step_i + 1) % len(STEPS)}"), ob("راست ➡️", f"onc:xo:{tid}:{idx}:{step_i}:r")],
        [ob("⬇️ پایین", f"onc:xo:{tid}:{idx}:{step_i}:d")],
    ]
    if name == "rows":
        rows.append([ob("ارتفاع ردیف −", f"onc:xo:{tid}:{idx}:{step_i}:fs-"), ob("ارتفاع ردیف +", f"onc:xo:{tid}:{idx}:{step_i}:fs+")])
        rows.append([ob("حداکثر ردیف −", f"onc:xo:{tid}:{idx}:{step_i}:w-"), ob("حداکثر ردیف +", f"onc:xo:{tid}:{idx}:{step_i}:w+")])
    elif name == "logo":
        rows.append([ob("اندازه −", f"onc:xo:{tid}:{idx}:{step_i}:fs-"), ob("اندازه +", f"onc:xo:{tid}:{idx}:{step_i}:fs+")])
    else:
        rows.append([ob("اندازه فونت −", f"onc:xo:{tid}:{idx}:{step_i}:fs-"), ob("اندازه فونت +", f"onc:xo:{tid}:{idx}:{step_i}:fs+")])
        rows.append([ob("حداکثر عرض −", f"onc:xo:{tid}:{idx}:{step_i}:w-"), ob("حداکثر عرض +", f"onc:xo:{tid}:{idx}:{step_i}:w+")])
        rows.append([ob("🎨 رنگ", f"onc:xo:{tid}:{idx}:{step_i}:col"), ob("↔️ تراز", f"onc:xo:{tid}:{idx}:{step_i}:al"), ob("🔤 فونت", f"onc:xo:{tid}:{idx}:{step_i}:font")])
    rows.append([ob("👁 پیش‌نمایش", f"onc:xtv:{tid}"), ob("✅ تمام", f"onc:xt:{tid}")])
    label = templates.ELEMENT_FA.get(name, name)
    await show(c, f"✏️ <b>ویرایش موقعیت</b> — {E(t['name'])}\n\nالمان: <b>{E(label)}</b>\n<code>{E(info)}</code>\n\nگام: {step}px", okb(rows))


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
        text = "📢 <b>کانال وان نایت چمپیون</b>\n\nکانالی تنظیم نشده.\nربات را ادمین کانال خبری وان نایت چمپیون کن و بعد اینجا تنظیمش کن."
    else:
        text = (f"📢 <b>کانال وان نایت چمپیون</b>\n\n<b>عنوان کانال:</b> {E(info.get('title') or '—')}\n<b>آیدی کانال:</b> <code>{E(cid)}</code>\n"
                f"<b>یوزرنیم کانال:</b> {('@' + E(info['username'])) if info.get('username') else '—'}\n"
                f"<b>وضعیت اتصال:</b> {'✅ متصل' if info.get('ok') else '❌ مشکل دارد'}\n\n"
                f"ارسال پیام / ارسال عکس: {'✅' if info.get('can_post') else '❌'}\nویرایش پیام: {'✅' if info.get('can_edit') else '❌'}")
        if info.get("problems"):
            text += "\n\n⚠️ " + "\n⚠️ ".join(E(p) for p in info["problems"])
    text += "\n\n<i>این کانال از گروه آگهی‌های ترنسفر کاملاً جداست. محتوای تورنمنت فقط اینجا منتشر می‌شود.</i>"
    rows = [[ob("✏️ تنظیم کانال", "onc:chs")]]
    if cid:
        rows += [[ob("🔌 تست اتصال", "onc:cht")], [ob("🗑 حذف کانال", "onc:cf:chx:0")]]
    rows.append([ob("🔙 بازگشت", PANEL)])
    await show(c, text, okb(rows))


@router.callback_query(F.data == "onc:ch")
async def channel_open(c: CallbackQuery, state: FSMContext, bot: Bot):
    await state.clear()
    await channel_screen(c, bot)
    await c.answer()


@router.callback_query(F.data == "onc:cht")
async def channel_test(c: CallbackQuery, bot: Bot):
    await c.answer("در حال تست…")
    await channel_screen(c, bot, tested=True)


@router.callback_query(F.data == "onc:chs")
async def channel_set(c: CallbackQuery, state: FSMContext):
    await state.set_state(ChanSt.chat)
    await show(c, "✏️ <b>تنظیم کانال</b>\n\nکانال را به‌صورت <code>@username</code> یا آیدی عددی (<code>-100…</code>) بفرست، "
               "یا <b>یک پست از کانال را فوروارد کن</b>.\nربات باید از قبل ادمین آن کانال باشد.",
               okb([[ob("❌ لغو", "onc:ch")]]))
    await c.answer()


@router.message(ChanSt.chat)
async def channel_set_do(m: Message, state: FSMContext, bot: Bot):
    raw = None
    if m.forward_origin and getattr(m.forward_origin, "chat", None):
        raw = str(m.forward_origin.chat.id)
    elif m.text:
        raw = m.text.strip()
    if not raw or not re.fullmatch(r"@[A-Za-z0-9_]{4,}|-?\d{5,}", raw):
        return await m.answer("⚠️ @username، آیدی عددی مثل -1001234567890 یا یک پست فورواردشده از کانال بفرست.")
    transfer = (await service.main_db.get_setting("publish_chat")).strip()
    try:
        chat = await bot.get_chat(raw)
    except TelegramAPIError as e:
        return await m.answer(f"⚠️ تلگرام این چت را باز نکرد: {E(str(e))}")
    if transfer and (str(chat.id) == transfer or (chat.username and f"@{chat.username}".lower() == transfer.lower())):
        return await m.answer("⛔ این همان گروه آگهی‌های ترنسفر است. کانال وان نایت چمپیون باید چت دیگری باشد.")
    await service.set_setting("channel_id", str(chat.id))
    await service.audit(m.from_user.id, "SET CHANNEL", f"{chat.title} ({chat.id})")
    await state.clear()
    await channel_screen(m, bot, tested=True)
