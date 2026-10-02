import json
import re

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

from .. import db, services
from ..keyboards import back, btn, kb, pairs
from ..texts import KIND_TITLE, OPTIONAL, STATUS_TITLE, fields_of, fingerprint, fmt_date, money, render_ad
from ..utils import is_admin, show

router = Router()


class AdForm(StatesGroup):
    fill = State()


TG_RE = re.compile(r"^(?:https?://t\.me/|@)?[A-Za-z0-9_]{4,32}$")


# ---- helpers -----------------------------------------------------------
async def reply(event: CallbackQuery | Message, text: str, markup=None) -> None:
    await show(event, text, markup)


def draft_ad(data: dict, user_id: int) -> dict:
    vals = data["vals"]
    photo = vals.get("photo") or vals.get("logo")
    d = {k: v for k, v in vals.items() if k not in ("photo", "logo") and v}
    return {"kind": data["kind"], "special": data["special"], "data": d, "photo": photo, "user_id": user_id}


async def send_ad(bot: Bot, chat_id: int, ad: dict, markup, user: dict | None = None) -> None:
    text = render_ad(ad, user)
    if ad.get("photo"):
        await bot.send_photo(chat_id, ad["photo"], caption=text, reply_markup=markup)
    else:
        await bot.send_message(chat_id, text, reply_markup=markup)


async def ask(event: CallbackQuery | Message, state: FSMContext) -> None:
    data = await state.get_data()
    key, label, kind = fields_of(data["kind"])[data["idx"]]
    hint = "📸 تصویر رو بفرست" if kind == "photo" else "✍️ بنویس و بفرست"
    total = len(fields_of(data["kind"]))
    head = f"<b>{KIND_TITLE[data['kind']]}</b>"
    if data["mode"] == "new":
        head += f" — مرحله {data['idx'] + 1} از {total}"
    text = f"{head}\n\n{label}\n{hint}" + ("\n(اختیاری)" if key in OPTIONAL else "")
    row = []
    if key in OPTIONAL:
        row.append(btn("⏭ رد کردن", "ad:skip"))
    if data["mode"] == "new" and data["idx"] > 0:
        row.append(btn("◀️ مرحله قبل", "ad:prevf"))
    rows = [row] if row else []
    rows.append(back(data.get("back", "menu"), "🔙 لغو"))
    await reply(event, text, kb(rows))


async def show_preview(event: CallbackQuery | Message, state: FSMContext, bot: Bot) -> None:
    data = await state.get_data()
    uid = event.from_user.id
    ad = draft_ad(data, uid)
    price = await db.get_int("price_special" if ad["special"] else "price_normal")
    days = await db.get_int("days_special" if ad["special"] else "days_normal")
    markup = kb([
        [btn("✅ تأیید و ارسال", "ad:ok"), btn("✏️ ویرایش", "ad:edit")],
        back("menu", "❌ لغو"),
    ])
    chat = event.chat.id if isinstance(event, Message) else event.message.chat.id
    if isinstance(event, CallbackQuery):
        try:
            await event.message.delete()
        except Exception:
            pass
    await send_ad(bot, chat, ad, None, await db.get_user(uid))
    await bot.send_message(
        chat,
        f"👆 پیش‌نمایش آگهی\n💰 هزینه: <b>{money(price)}</b> | ⏳ اعتبار: {days} روز\nاگه همه‌چی درسته تأیید کن:",
        reply_markup=markup,
    )


async def advance(event: Message | CallbackQuery, state: FSMContext, bot: Bot) -> None:
    data = await state.get_data()
    if data["mode"] == "new":
        if data["idx"] + 1 < len(fields_of(data["kind"])):
            await state.update_data(idx=data["idx"] + 1)
            await ask(event, state)
        else:
            await show_preview(event, state, bot)
    elif data["mode"] == "new_edit":
        await state.update_data(mode="new")
        await show_preview(event, state, bot)
    else:
        await save_saved_edit(event, state, bot)


# ---- creation flow -----------------------------------------------------
@router.callback_query(F.data == "ad:new")
async def new_ad(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show(c, "📝 <b>ثبت آگهی جدید</b>\n\nنوع آگهی رو انتخاب کن:", kb([
        [btn("🎮 بازیکن آزاد", "ad:k:player"), btn("🛡 جذب بازیکن", "ad:k:team")],
        back(),
    ]))
    await c.answer()


@router.callback_query(F.data.startswith("ad:k:"))
async def choose_kind(c: CallbackQuery):
    kind = c.data[5:]
    pn, ps = await db.get_int("price_normal"), await db.get_int("price_special")
    dn, ds = await db.get_int("days_normal"), await db.get_int("days_special")
    await show(c, f"<b>{KIND_TITLE[kind]}</b>\n\nنوع انتشار رو انتخاب کن:\n\n"
                  f"📄 عادی: {money(pn)} — {dn} روز\n⭐️ ویژه (با نشان مخصوص): {money(ps)} — {ds} روز", kb([
        [btn("📄 عادی", f"ad:s:{kind}:0"), btn("⭐️ ویژه", f"ad:s:{kind}:1")],
        back("ad:new"),
    ]))
    await c.answer()


@router.callback_query(F.data.startswith("ad:s:"))
async def start_fill(c: CallbackQuery, state: FSMContext):
    _, _, kind, special = c.data.split(":")
    await state.clear()
    await state.set_state(AdForm.fill)
    await state.update_data(kind=kind, special=int(special), vals={}, idx=0, mode="new", back="ad:new")
    await ask(c, state)
    await c.answer()


@router.callback_query(AdForm.fill, F.data == "ad:prevf")
async def prev_field(c: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(idx=max(0, data["idx"] - 1))
    await ask(c, state)
    await c.answer()


@router.callback_query(AdForm.fill, F.data == "ad:skip")
async def skip_field(c: CallbackQuery, state: FSMContext, bot: Bot):
    data = await state.get_data()
    key = fields_of(data["kind"])[data["idx"]][0]
    if key not in OPTIONAL:
        return await c.answer("این مورد اجباریه", show_alert=True)
    vals = data["vals"]
    vals[key] = None
    await state.update_data(vals=vals)
    await c.answer()
    await advance(c, state, bot)


@router.message(AdForm.fill)
async def got_value(m: Message, state: FSMContext, bot: Bot):
    data = await state.get_data()
    key, label, kind = fields_of(data["kind"])[data["idx"]]
    if kind == "photo":
        if not m.photo:
            return await m.answer("📸 لطفاً یک عکس بفرست (یا رد کن).")
        value = m.photo[-1].file_id
    else:
        if not m.text:
            return await m.answer("✍️ لطفاً متن بفرست.")
        value = m.text.strip()
        limit = 500 if key == "notes" else 200
        if len(value) > limit:
            return await m.answer(f"⚠️ حداکثر {limit} کاراکتر مجازه. کوتاه‌ترش کن.")
        if key == "captain_tg" and not TG_RE.match(value):
            return await m.answer("⚠️ آیدی تلگرام معتبر نیست. مثل: @captain_pcl")
    vals = data["vals"]
    vals[key] = value
    await state.update_data(vals=vals)
    await advance(m, state, bot)


@router.callback_query(F.data == "ad:edit")
async def edit_menu(c: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if "vals" not in data:
        return await c.answer("زمان این آگهی تموم شده، دوباره شروع کن.", show_alert=True)
    await state.set_state(AdForm.fill)
    await state.update_data(mode="new_edit")
    fields = fields_of(data["kind"])
    btns = [btn(label, f"ad:ef:{i}") for i, (_, label, _) in enumerate(fields)]
    await show(c, "✏️ کدوم بخش رو ویرایش کنیم؟", kb(pairs(btns) + [[btn("🔙 بازگشت به پیش‌نمایش", "ad:resume")]]))
    await c.answer()


@router.callback_query(F.data.startswith("ad:ef:"))
async def edit_field(c: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if "kind" not in data:
        return await c.answer("زمان این ویرایش تموم شده.", show_alert=True)
    await state.set_state(AdForm.fill)
    await state.update_data(idx=int(c.data[6:]))
    await ask(c, state)
    await c.answer()


@router.callback_query(F.data == "ad:resume")
async def resume(c: CallbackQuery, state: FSMContext, bot: Bot):
    data = await state.get_data()
    if "vals" not in data or len(data["vals"]) < len([f for f in fields_of(data["kind"]) if f[0] not in OPTIONAL]):
        return await c.answer("آگهی نیمه‌کاره‌ای پیدا نشد؛ از اول شروع کن.", show_alert=True)
    await state.update_data(mode="new")
    await c.answer()
    await show_preview(c, state, bot)


@router.callback_query(F.data == "ad:ok")
async def confirm(c: CallbackQuery, state: FSMContext, bot: Bot):
    data = await state.get_data()
    if "vals" not in data:
        return await c.answer("زمان این آگهی تموم شده، دوباره شروع کن.", show_alert=True)
    uid = c.from_user.id
    draft = draft_ad(data, uid)
    fp = fingerprint(draft["kind"], draft["data"])
    if await db.scalar("SELECT COUNT(*) FROM ads WHERE user_id=? AND fingerprint=? AND status IN ('pending','approved')", uid, fp):
        await c.answer()
        return await show(c, "⚠️ یه آگهی فعال یا در انتظار با همین مشخصات داری. می‌تونی تمدید یا ویرایشش کنی.",
                          kb([[btn("🗄 آگهی‌های من", "myads")], back()]))
    price = await db.get_int("price_special" if draft["special"] else "price_normal")
    ad_id = await db.execute(
        "INSERT INTO ads(user_id,kind,data,photo,status,special,created_at,fingerprint) VALUES(?,?,?,?,?,?,?,?)",
        uid, draft["kind"], json.dumps(draft["data"], ensure_ascii=False), draft["photo"], "pending", draft["special"], db.now(), fp,
    )
    if not await db.charge(uid, price, "ad", f"ad:{ad_id}"):
        await db.execute("DELETE FROM ads WHERE id=?", ad_id)
        bal = (await db.get_user(uid))["balance"]
        short = price - bal
        await c.answer()
        return await show(c, f"💰 موجودی کافی نیست.\nهزینه: {money(price)}\nموجودی تو: {money(bal)}\n\n"
                             "بعد از شارژ، همین پیام رو باز کن و «ادامه ثبت آگهی» رو بزن؛ اطلاعاتت حفظ می‌شه.", kb([
            [btn(f"💳 شارژ {money(short)}", f"wallet:pay:{short}")],
            [btn("▶️ ادامه ثبت آگهی", "ad:resume")],
            back(),
        ]))
    await state.clear()
    await c.answer()
    await show(c, f"✅ آگهی شماره <b>{ad_id}</b> ثبت شد و بعد از تأیید مدیر منتشر می‌شه.\n💰 {money(price)} از کیفت کسر شد.",
               kb([[btn("🗄 آگهی‌های من", "myads")], back()]))
    await notify_admins_new(bot, ad_id)


async def notify_admins_new(bot: Bot, ad_id: int, edited: bool = False) -> None:
    from .. import admins
    ad = await db.get_ad(ad_id)
    user = await db.get_user(ad["user_id"])
    markup = kb([[btn("✅ تأیید", f"adm:ok:{ad_id}"), btn("❌ رد", f"adm:no:{ad_id}")],
                 [btn("✏️ ویرایش", f"ad:ed:{ad_id}"), btn("🗑 حذف", f"adm:del:{ad_id}")]])
    for aid in admins.all_ids():
        try:
            await bot.send_message(aid, f"{'✏️ ویرایش آگهی' if edited else '🆕 آگهی جدید'} #{ad_id} از {user['name']} (<code>{user['id']}</code>)")
            await send_ad(bot, aid, ad, markup, user)
        except Exception:
            pass


# ---- my ads ------------------------------------------------------------
@router.callback_query(F.data == "myads")
async def my_ads(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show(c, "🗄 <b>آگهی‌های ثبت‌شده</b>", kb([
        [btn("🟢 فعال و در انتظار", "myl:a"), btn("🔴 منقضی و ردشده", "myl:x")],
        back(),
    ]))
    await c.answer()


@router.callback_query(F.data.startswith("myl:"))
async def my_list(c: CallbackQuery):
    active = c.data[4:] == "a"
    ads = await db.user_ads(c.from_user.id, active)
    if not ads:
        await show(c, "📭 آگهی‌ای در این بخش نداری.", kb([back("myads")]))
        return await c.answer()
    btns = []
    for a in ads:
        name = a["data"].get("name") or a["data"].get("team") or ""
        icon = "⭐️" if a["special"] else ("🎮" if a["kind"] == "player" else "🛡")
        btns.append(btn(f"{icon} #{a['id']} {name}"[:40], f"ad:v:{a['id']}"))
    await show(c, "یکی از آگهی‌ها رو انتخاب کن:", kb(pairs(btns) + [back("myads")]))
    await c.answer()


async def owned(c: CallbackQuery, ad_id: int) -> dict | None:
    ad = await db.get_ad(ad_id)
    if not ad or (ad["user_id"] != c.from_user.id and not is_admin(c.from_user.id)):
        await c.answer("آگهی پیدا نشد.", show_alert=True)
        return None
    return ad


@router.callback_query(F.data.startswith("ad:v:"))
async def view_ad(c: CallbackQuery, state: FSMContext):
    await state.clear()
    ad = await owned(c, int(c.data[5:]))
    if not ad:
        return
    st = STATUS_TITLE[ad["status"]]
    info = f"\n\n📌 وضعیت: <b>{st}</b>"
    if ad["status"] == "rejected" and ad["reject_reason"]:
        info += f"\n💬 دلیل: {ad['reject_reason']}"
    if ad["expires_at"] and ad["status"] in ("approved", "expired"):
        info += f"\n⏳ انقضا: {fmt_date(ad['expires_at'])}"
    if ad["photo"]:
        info += "\n🖼 تصویر: دارد"
    first = []
    if ad["status"] in ("pending", "approved"):
        first.append(btn("✏️ ویرایش", f"ad:ed:{ad['id']}"))
    if ad["status"] in ("approved", "expired"):
        first.append(btn("🔁 تمدید", f"ad:rn:{ad['id']}"))
    rows = [first] if first else []
    second = [btn("🗑 حذف", f"ad:del:{ad['id']}")]
    if ad["status"] in ("pending", "approved") and not ad["special"]:
        second.insert(0, btn("⭐️ ارتقا به ویژه", f"ad:up:{ad['id']}"))
    rows.append(second)
    rows.append(back("myl:a" if ad["status"] in ("pending", "approved") else "myl:x"))
    await show(c, render_ad(ad, await db.get_user(ad["user_id"])) + info, kb(rows))
    await c.answer()


@router.callback_query(F.data.startswith("ad:del:"))
async def delete_ask(c: CallbackQuery):
    ad = await owned(c, int(c.data[7:]))
    if ad:
        note = "\n↩️ چون هنوز تأیید نشده، هزینه به کیفت برمی‌گرده." if ad["status"] == "pending" else ""
        await show(c, f"🗑 آگهی #{ad['id']} حذف بشه؟{note}", kb([[btn("✅ بله، حذف کن", f"ad:delok:{ad['id']}"), btn("🔙 نه", f"ad:v:{ad['id']}")]]))
        await c.answer()


@router.callback_query(F.data.startswith("ad:delok:"))
async def delete_do(c: CallbackQuery, bot: Bot):
    ad = await owned(c, int(c.data[9:]))
    if not ad:
        return
    if ad["status"] == "pending":
        paid = await db.scalar("SELECT -SUM(amount) FROM transactions WHERE note=? AND type='ad'", f"ad:{ad['id']}") or 0
        if paid > 0:
            await db.credit(ad["user_id"], paid, "refund", f"ad:{ad['id']}")
    await services.delete_ad(bot, ad["id"])
    await show(c, "🗑 آگهی حذف شد.", kb([back("myads")]))
    await c.answer()


@router.callback_query(F.data.startswith("ad:rn:"))
async def renew_ask(c: CallbackQuery):
    ad = await owned(c, int(c.data[6:]))
    if not ad:
        return
    sp = ad["special"]
    price = await db.get_int("renew_special" if sp else "renew_normal")
    days = await db.get_int("days_special" if sp else "days_normal")
    await show(c, f"🔁 تمدید آگهی #{ad['id']}\n💰 هزینه: <b>{money(price)}</b>\n⏳ مدت: {days} روز", kb([
        [btn("✅ پرداخت از کیف پول", f"ad:rnok:{ad['id']}")], back(f"ad:v:{ad['id']}")]))
    await c.answer()


@router.callback_query(F.data.startswith("ad:rnok:"))
async def renew_do(c: CallbackQuery, bot: Bot):
    ad = await owned(c, int(c.data[8:]))
    if not ad or ad["status"] not in ("approved", "expired") or ad["user_id"] != c.from_user.id:
        return await c.answer("این آگهی قابل تمدید نیست.", show_alert=True)
    sp = ad["special"]
    price = await db.get_int("renew_special" if sp else "renew_normal")
    days = await db.get_int("days_special" if sp else "days_normal")
    if not await db.charge(c.from_user.id, price, "renew", f"renew:{ad['id']}"):
        await c.answer()
        return await show(c, f"💰 موجودی کافی نیست ({money(price)} لازمه).", kb([[btn("💳 افزایش موجودی", "wallet")], back(f"ad:v:{ad['id']}")]))
    base = max(db.now(), ad["expires_at"] or 0)
    await db.execute("UPDATE ads SET status='approved', expires_at=? WHERE id=?", base + days * 86400, ad["id"])
    ad = await db.get_ad(ad["id"])
    if not ad["msg_id"]:
        await services.publish(bot, ad)
    await show(c, f"✅ آگهی تمدید شد تا {fmt_date(ad['expires_at'])}.", kb([back("myads")]))
    await c.answer()


@router.callback_query(F.data.startswith("ad:up:"))
async def upgrade_ask(c: CallbackQuery):
    ad = await owned(c, int(c.data[6:]))
    if ad:
        price = await db.get_int("upgrade_price")
        await show(c, f"⭐️ ارتقای آگهی #{ad['id']} به ویژه\n💰 هزینه: <b>{money(price)}</b>\nآگهی با نشان ویژه منتشر می‌شه.", kb([
            [btn("✅ پرداخت از کیف پول", f"ad:upok:{ad['id']}")], back(f"ad:v:{ad['id']}")]))
        await c.answer()


@router.callback_query(F.data.startswith("ad:upok:"))
async def upgrade_do(c: CallbackQuery, bot: Bot):
    ad = await owned(c, int(c.data[8:]))
    if not ad or ad["special"] or ad["status"] not in ("pending", "approved") or ad["user_id"] != c.from_user.id:
        return await c.answer("این آگهی قابل ارتقا نیست.", show_alert=True)
    price = await db.get_int("upgrade_price")
    if not await db.charge(c.from_user.id, price, "upgrade", f"upgrade:{ad['id']}"):
        await c.answer()
        return await show(c, f"💰 موجودی کافی نیست ({money(price)} لازمه).", kb([[btn("💳 افزایش موجودی", "wallet")], back(f"ad:v:{ad['id']}")]))
    await db.execute("UPDATE ads SET special=1 WHERE id=?", ad["id"])
    if ad["status"] == "approved":
        await services.publish(bot, await db.get_ad(ad["id"]))
    await show(c, "⭐️ آگهی به حالت ویژه ارتقا پیدا کرد.", kb([back(f"ad:v:{ad['id']}")]))
    await c.answer()


# ---- editing a saved ad (owner or admin) -------------------------------
@router.callback_query(F.data.startswith("ad:ed:"))
async def saved_edit_menu(c: CallbackQuery, state: FSMContext):
    ad = await owned(c, int(c.data[6:]))
    if not ad:
        return
    admin_view = is_admin(c.from_user.id) and ad["user_id"] != c.from_user.id
    back_to = f"adm:ad:{ad['id']}" if admin_view else f"ad:v:{ad['id']}"
    await state.clear()
    await state.set_state(AdForm.fill)
    vals = dict(ad["data"])
    vals["photo" if ad["kind"] == "player" else "logo"] = ad["photo"]
    await state.update_data(kind=ad["kind"], special=ad["special"], vals=vals, idx=0, mode="saved", ad_id=ad["id"], back=back_to)
    btns = [btn(label, f"ad:ef:{i}") for i, (_, label, _) in enumerate(fields_of(ad["kind"]))]
    note = "" if admin_view else "\n⚠️ بعد از ویرایش، آگهی دوباره برای تأیید مدیر ارسال می‌شه."
    await show(c, f"✏️ کدوم بخش آگهی #{ad['id']} رو ویرایش کنیم؟{note}", kb(pairs(btns) + [back(back_to)]))
    await c.answer()


async def save_saved_edit(event: Message | CallbackQuery, state: FSMContext, bot: Bot) -> None:
    data = await state.get_data()
    ad = await db.get_ad(data["ad_id"])
    uid = event.from_user.id
    await state.clear()
    if not ad:
        return
    draft = draft_ad(data, ad["user_id"])
    fp = fingerprint(ad["kind"], draft["data"])
    await db.execute("UPDATE ads SET data=?, photo=?, fingerprint=? WHERE id=?",
                     json.dumps(draft["data"], ensure_ascii=False), draft["photo"], fp, ad["id"])
    by_admin = is_admin(uid) and ad["user_id"] != uid
    if by_admin:
        if ad["status"] == "approved":
            await services.publish(bot, await db.get_ad(ad["id"]))
        text, markup = "✅ ویرایش انجام شد.", kb([back(f"adm:ad:{ad['id']}")])
    else:
        # Owner edits need re-approval; counted/expires_at stay untouched so edits never inflate badge counts.
        if ad["status"] == "approved":
            await services.unpublish(bot, ad)
        await db.execute("UPDATE ads SET status='pending' WHERE id=?", ad["id"])
        await notify_admins_new(bot, ad["id"], edited=True)
        text, markup = "✅ ویرایش ثبت شد و برای تأیید مجدد مدیر ارسال شد.", kb([[btn("🗄 آگهی‌های من", "myads")], back()])
    await reply(event, text, markup)
