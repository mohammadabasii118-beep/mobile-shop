"""⚽ Football quiz contests (giveaways) + 🏆 hall of champions.

Admin creates a contest (title, prize, start time, how many easy/medium/hard questions); users register («اعلام آمادگی»);
at the exact start time every registered user gets the same questions at the same moment as a 4-option inline keyboard,
10 seconds each. Ranking: most correct answers, then the lowest total time on the correct answers.
"""
import asyncio
import csv
import datetime as dt
import io
import json
import random
import re
import time

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from .. import db as main_db
from ..onc import dbx
from ..onc.ui import ob, okb
from ..utils import is_admin, show
from . import core
from .core import E
from .quiz_seed import Q as SEED
from .states import QuizSt

router = Router()
admin_router = Router()
admin_router.message.filter(lambda m: is_admin(m.from_user.id))
admin_router.callback_query.filter(lambda c: is_admin(c.from_user.id))

LEVEL = {"easy": "آسان", "medium": "متوسط", "hard": "سخت"}
MEDAL = {1: "🥇", 2: "🥈", 3: "🥉"}
# pacing knobs (tests shrink them)
INTRO_DELAY = 5.0
GAP = 3.0
RATE = 25                     # Telegram allows ~30 messages/second overall
GRACE = 0.6                   # network slack added to each question's time window


# ================================================================= questions
async def level_counts() -> dict[str, int]:
    rows = await dbx.fetchall("SELECT level, COUNT(*) n FROM fx_q_questions WHERE active=1 GROUP BY level")
    out = {k: 0 for k in LEVEL}
    out.update({r["level"]: r["n"] for r in rows})
    return out


async def add_question(level: str, text: str, options: list[str], correct: int) -> bool:
    if level not in LEVEL or len(options) != 4 or not (0 <= correct < 4) or not text.strip() or any(not o.strip() for o in options):
        raise ValueError("سؤال نامعتبر است.")
    try:
        await dbx.execute("INSERT INTO fx_q_questions(level,text,a,b,c,d,correct) VALUES(?,?,?,?,?,?,?)", level, text.strip(), *[o.strip() for o in options], correct)
        return True
    except Exception as ex:                        # duplicate text
        if "UNIQUE" in str(ex):
            return False
        raise


async def seed() -> tuple[int, int]:
    added = skipped = 0
    for i, (lv, text, right, *wrong) in enumerate(SEED):
        opts = list(wrong)
        pos = i % 4
        opts.insert(pos, right)
        if await add_question(lv, text, opts, pos):
            added += 1
        else:
            skipped += 1
    return added, skipped


_LEVEL_ALIASES = {"easy": "easy", "آسان": "easy", "ساده": "easy", "medium": "medium", "متوسط": "medium", "hard": "hard", "سخت": "hard", "1": "easy", "2": "medium", "3": "hard"}


def parse_questions(raw: bytes, filename: str) -> list[tuple[str, str, list[str], int]]:
    """JSON: [{"level","question","options":[4],"correct":1-4}]  or CSV: level,question,a,b,c,d,correct(1-4 or a-d)."""
    text = raw.decode("utf-8-sig")
    items = []
    if filename.lower().endswith(".json") or text.lstrip().startswith(("[", "{")):
        data = json.loads(text)
        data = data.get("questions", data) if isinstance(data, dict) else data
        for it in data:
            opts = it.get("options") or [it.get(k) for k in "abcd"]
            cor = it.get("correct", it.get("answer"))
            items.append((it.get("level") or it.get("difficulty"), it.get("question") or it.get("text") or it.get("q"), opts, cor))
    else:
        for row in csv.reader(io.StringIO(text)):
            if len(row) < 7 or row[0].strip().lower() in ("level", "difficulty"):
                continue
            items.append((row[0], row[1], row[2:6], row[6]))
    out = []
    for lv, q, opts, cor in items:
        lv = _LEVEL_ALIASES.get(str(lv).strip().lower())
        s = str(cor).strip().lower()
        idx = {"a": 0, "b": 1, "c": 2, "d": 3}.get(s)
        if idx is None:
            idx = int(core.norm(s)) - 1
        if lv and q and opts and len(opts) == 4:
            out.append((lv, str(q), [str(o) for o in opts], idx))
    return out


# ================================================================= contests
def parse_when(s: str) -> str:
    s = core.norm(s).replace("/", "-")
    m = re.fullmatch(r"(\d{4}-\d{1,2}-\d{1,2})[ T](\d{1,2}):(\d{2})", s)
    if not m:
        raise ValueError("فرمت درست: 2026/10/12 21:00")
    d = dt.datetime.strptime(f"{m.group(1)} {int(m.group(2)):02d}:{m.group(3)}", "%Y-%m-%d %H:%M")
    return d.strftime("%Y-%m-%d %H:%M")


async def create_contest(admin: int, title: str, prize: str, start_at: str, n_easy: int, n_medium: int, n_hard: int, seconds: int = 10) -> int:
    have = await level_counts()
    for lv, n in (("easy", n_easy), ("medium", n_medium), ("hard", n_hard)):
        if n < 0 or n > have[lv]:
            raise ValueError(f"از سطح «{LEVEL[lv]}» فقط {have[lv]} سؤال داریم.")
    if n_easy + n_medium + n_hard < 1:
        raise ValueError("حداقل یک سؤال لازم است.")
    return await dbx.execute("INSERT INTO fx_q_contests(title,prize,start_at,n_easy,n_medium,n_hard,seconds,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                             title.strip(), prize.strip(), start_at, n_easy, n_medium, n_hard, seconds, admin, core.now())


async def upcoming() -> list[dict]:
    return await dbx.fetchall("SELECT c.*, (SELECT COUNT(*) FROM fx_q_regs r WHERE r.contest_id=c.id) AS regs FROM fx_q_contests c "
                              "WHERE c.status IN ('REG','RUNNING') ORDER BY c.start_at")


async def is_registered(cid: int, uid: int) -> bool:
    return bool(await dbx.scalar("SELECT 1 FROM fx_q_regs WHERE contest_id=? AND user_id=?", cid, uid))


# ================================================================= the live run
class Run:
    def __init__(self, cid: int, seconds: int):
        self.cid, self.seconds = cid, seconds
        self.idx = -1
        self.sent_at: dict[int, float] = {}
        self.msg: dict[int, int] = {}
        self.perm: list[int] = []
        self.correct_slot = 0
        self.open = False


RUNS: dict[int, Run] = {}


async def _spread(items: list, fn) -> None:
    """Run fn(item) for all items without exceeding RATE calls per second."""
    for i in range(0, len(items), RATE):
        t0 = time.monotonic()
        await asyncio.gather(*(fn(x) for x in items[i:i + RATE]), return_exceptions=True)
        if i + RATE < len(items):
            await asyncio.sleep(max(0.0, 1.05 - (time.monotonic() - t0)))


def _slot_markup(cid: int, idx: int, texts: list[str]):
    return okb([[ob(f"{'ABCD'[i]}) {t}"[:60], f"fx:qa:{cid}:{idx}:{i}")] for i, t in enumerate(texts)])


async def run_contest(bot: Bot, cid: int) -> None:
    c = await dbx.fetchone("SELECT * FROM fx_q_contests WHERE id=?", cid)
    regs = [r["user_id"] for r in await dbx.fetchall("SELECT user_id FROM fx_q_regs WHERE contest_id=?", cid)]
    if not regs:
        await dbx.execute("UPDATE fx_q_contests SET status='DONE', finished_at=? WHERE id=?", core.now(), cid)
        return await core.notify_admins(bot, f"⚽ مسابقه «{E(c['title'])}» شروع شد ولی هیچ‌کس اعلام آمادگی نکرده بود.")
    picked: list[dict] = []
    for lv, n in (("easy", c["n_easy"]), ("medium", c["n_medium"]), ("hard", c["n_hard"])):
        pool = await dbx.fetchall("SELECT * FROM fx_q_questions WHERE level=? AND active=1", lv)
        picked += random.sample(pool, min(n, len(pool)))
    async with dbx.tx():
        await dbx.execute("DELETE FROM fx_q_cq WHERE contest_id=?", cid)
        for i, q in enumerate(picked):
            perm = random.sample(range(4), 4)                 # slot i shows original option perm[i]
            await dbx.execute("INSERT INTO fx_q_cq(contest_id,idx,question_id,perm) VALUES(?,?,?,?)", cid, i, q["id"], json.dumps(perm))
    run = Run(cid, c["seconds"])
    RUNS[cid] = run
    try:
        await _spread(regs, lambda u: core.tell(bot, u, f"🏁 <b>مسابقه «{E(c['title'])}» شروع می‌شود!</b>\n\n{len(picked)} سؤال چهارگزینه‌ای، هر سؤال {c['seconds']} ثانیه.\n"
                                                    "آماده باش؛ اولین سؤال چند ثانیه‌ی دیگر می‌آید… ⏳"))
        await asyncio.sleep(INTRO_DELAY)
        for i, q in enumerate(picked):
            await _ask(bot, run, c, regs, i, q, len(picked))
        await asyncio.sleep(GAP)
        await _finish(bot, c, regs, len(picked))
    except Exception:                                          # never leave a contest stuck in RUNNING
        import logging
        logging.getLogger("pclbot").exception("quiz run failed")
        await dbx.execute("UPDATE fx_q_contests SET status='CANCELLED' WHERE id=? AND status='RUNNING'", cid)
        await core.notify_admins(bot, f"⚠️ مسابقه «{E(c['title'])}» به‌خاطر خطا متوقف شد.")
    finally:
        RUNS.pop(cid, None)


async def _ask(bot: Bot, run: Run, c: dict, regs: list[int], idx: int, q: dict, total: int) -> None:
    perm = json.loads((await dbx.fetchone("SELECT perm FROM fx_q_cq WHERE contest_id=? AND idx=?", run.cid, idx))["perm"])
    opts = [q["abcd"[p]] for p in perm]
    run.idx, run.perm, run.correct_slot, run.open = idx, perm, perm.index(q["correct"]), True
    run.sent_at.clear(); run.msg.clear()
    text = f"❓ <b>سؤال {idx + 1} از {total}</b> · {LEVEL[q['level']]}\n\n{E(q['text'])}\n\n⏱ {run.seconds} ثانیه فرصت داری"
    markup = _slot_markup(run.cid, idx, [E(o) for o in opts])

    async def send(u: int):
        try:
            m = await bot.send_message(u, text, reply_markup=markup)
            run.msg[u] = m.message_id
            run.sent_at[u] = time.monotonic()
        except TelegramAPIError:
            pass

    await _spread(regs, send)
    await asyncio.sleep(run.seconds + GRACE)                       # every user's window = his own send time + seconds
    run.open = False
    answers = {a["user_id"]: a for a in await dbx.fetchall("SELECT * FROM fx_q_answers WHERE contest_id=? AND idx=?", run.cid, idx)}
    right = opts[run.correct_slot]

    msgs = dict(run.msg)                                           # snapshot: the next question resets run.msg

    async def reveal(u: int):
        a = answers.get(u)
        mark = "⏰ جواب ندادی" if not a else ("✅ درست!" if a["correct"] else "❌ نادرست")
        try:
            await bot.edit_message_text(f"❓ <b>سؤال {idx + 1} از {total}</b>\n\n{E(q['text'])}\n\n✔️ جواب درست: <b>{E(right)}</b>\n{mark}",
                                        chat_id=u, message_id=msgs[u])
        except (TelegramAPIError, KeyError):
            pass

    asyncio.create_task(_spread(list(msgs), reveal))            # revealing must not delay the next question
    if idx < total - 1:
        await asyncio.sleep(GAP)


async def _finish(bot: Bot, c: dict, regs: list[int], total: int) -> None:
    rows = await dbx.fetchall("SELECT user_id, SUM(correct) AS score, SUM(CASE WHEN correct=1 THEN ms ELSE 0 END) AS ms "
                              "FROM fx_q_answers WHERE contest_id=? GROUP BY user_id", c["id"])
    got = {r["user_id"]: (r["score"] or 0, r["ms"] or 0) for r in rows}
    board = sorted(((u, *got.get(u, (0, 0))) for u in regs), key=lambda t: (-t[1], t[2], t[0]))
    names = {}
    for u in regs:
        r = await main_db.fetchone("SELECT name, username FROM users WHERE id=?", u)
        names[u] = (r["name"] if r and r["name"] else None) or (f"@{r['username']}" if r and r["username"] else str(u))
    async with dbx.tx():
        await dbx.execute("DELETE FROM fx_q_results WHERE contest_id=?", c["id"])
        for rank, (u, score, ms) in enumerate(board, 1):
            await dbx.execute("INSERT INTO fx_q_results(contest_id,user_id,name,score,total_ms,rank) VALUES(?,?,?,?,?,?)", c["id"], u, names[u], score, ms, rank)
        await dbx.execute("UPDATE fx_q_contests SET status='DONE', finished_at=? WHERE id=?", core.now(), c["id"])
    top = "\n".join(f"{MEDAL.get(i, f'{i}.')} {E(names[u])} — {s}/{total} ({ms / 1000:.1f}s)" for i, (u, s, ms) in enumerate(board[:10], 1))
    rank_of = {u: i for i, (u, _, _) in enumerate(board, 1)}

    async def bye(u: int):
        s, ms = got.get(u, (0, 0))
        await core.tell(bot, u, f"🏁 <b>مسابقه تمام شد!</b>\n\nامتیاز تو: <b>{s} از {total}</b>\nرتبه‌ی تو: <b>{rank_of[u]} از {len(regs)}</b>\n\n🏆 <b>برترین‌ها</b>\n{top}"
                                + (f"\n\n🎁 جایزه: {E(c['prize'])}\nبرندگان توسط ادمین مطلع می‌شوند." if c["prize"] and rank_of[u] <= 3 else ""))

    await _spread(regs, bye)
    await core.notify_admins(bot, f"🏁 مسابقه «{E(c['title'])}» تمام شد.\n\n🏆 <b>برترین‌ها</b>\n{top}\n\n🎁 جایزه: {E(c['prize']) or '—'}")


async def scheduler_loop(bot: Bot) -> None:
    """Starts contests at their exact time (+ a 5-minute reminder). Runs for the lifetime of the bot."""
    while True:
        try:
            now = core.local_now().strftime("%Y-%m-%d %H:%M")
            soon = (core.local_now() + dt.timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M")
            for c in await dbx.fetchall("SELECT * FROM fx_q_contests WHERE status='REG' AND reminded=0 AND start_at<=? AND start_at>?", soon, now):
                await dbx.execute("UPDATE fx_q_contests SET reminded=1 WHERE id=?", c["id"])
                regs = [r["user_id"] for r in await dbx.fetchall("SELECT user_id FROM fx_q_regs WHERE contest_id=?", c["id"])]
                asyncio.create_task(_spread(regs, lambda u, c=c: core.tell(bot, u, f"⏰ مسابقه «{E(c['title'])}» ساعت {c['start_at'][11:]} شروع می‌شود. آماده باش!")))
            for c in await dbx.fetchall("SELECT * FROM fx_q_contests WHERE status='REG' AND start_at<=?", now):
                if await dbx.execute("UPDATE fx_q_contests SET status='RUNNING', started_at=? WHERE id=? AND status='REG'", core.now(), c["id"]):
                    asyncio.create_task(run_contest(bot, c["id"]))
        except Exception:
            import logging
            logging.getLogger("pclbot").exception("quiz scheduler tick failed")
        await asyncio.sleep(5)


# ================================================================= user side
@router.callback_query(F.data == "fx:qz")
async def entry(c: CallbackQuery, state: FSMContext):
    await state.clear()
    cs = await upcoming()
    rows, lines = [], []
    for x in cs:
        reg = await is_registered(x["id"], c.from_user.id)
        lines.append(f"⚽ <b>{E(x['title'])}</b>\n🕐 {x['start_at'].replace('-', '/')} · {x['n_easy'] + x['n_medium'] + x['n_hard']} سؤال\n🎁 {E(x['prize']) or '—'}\n"
                     f"👥 {x['regs']} نفر آماده · {'🟢 در حال برگزاری' if x['status'] == 'RUNNING' else ('✅ تو آماده‌ای' if reg else 'ثبت‌نام باز')}")
        if x["status"] == "REG":
            rows.append([ob("❌ انصراف" if reg else f"✅ اعلام آمادگی — {x['title']}", f"fx:qr:{x['id']}")])
    await show(c, "⚽ <b>مسابقه فوتبالی</b>\n\n" + ("\n\n".join(lines) if lines else "فعلاً مسابقه‌ای ثبت نشده. منتظر اطلاعیه باش!"),
               okb(rows + [[ob("🏆 تالار قهرمانان", "fx:qh")], [ob("📜 قوانین", "fx:qrl")], [ob("🔙 منوی اصلی", "home")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:qr:(\d+)$"))
async def toggle_reg(c: CallbackQuery, state: FSMContext):
    cid = int(c.data.split(":")[2])
    x = await dbx.fetchone("SELECT * FROM fx_q_contests WHERE id=?", cid)
    if not x or x["status"] != "REG":
        return await c.answer("ثبت‌نام این مسابقه بسته است.", show_alert=True)
    if await is_registered(cid, c.from_user.id):
        await dbx.execute("DELETE FROM fx_q_regs WHERE contest_id=? AND user_id=?", cid, c.from_user.id)
        await c.answer("انصراف ثبت شد")
    else:
        await dbx.execute("INSERT OR IGNORE INTO fx_q_regs(contest_id,user_id,joined_at) VALUES(?,?,?)", cid, c.from_user.id, core.now())
        await c.answer("✅ آماده‌ای! سر ساعت سؤال‌ها همین‌جا می‌آید.", show_alert=True)
    await entry(c, state)


@router.callback_query(F.data == "fx:qrl")
async def rules(c: CallbackQuery):
    await show(c, "📜 <b>قوانین مسابقه</b>\n\n• قبل از شروع «اعلام آمادگی» را بزن.\n• سر ساعت مسابقه، سؤال‌ها خودکار برایت می‌آید.\n• هر سؤال ۴ گزینه دارد و ۱۰ ثانیه وقت داری.\n"
               "• امتیاز = تعداد جواب‌های درست؛ در تساوی، سریع‌تر برنده است.\n• جواب را فقط یک‌بار می‌شود زد.", okb([[ob("🔙 بازگشت", "fx:qz")]]))
    await c.answer()


@router.callback_query(F.data == "fx:qh")
async def hall(c: CallbackQuery):
    done = await dbx.fetchall("SELECT * FROM fx_q_contests WHERE status='DONE' ORDER BY finished_at DESC, id DESC LIMIT 12")
    blocks = []
    for x in done:
        top = await dbx.fetchall("SELECT * FROM fx_q_results WHERE contest_id=? AND rank<=3 ORDER BY rank", x["id"])
        if top:
            blocks.append(f"⚽ <b>{E(x['title'])}</b> · {x['start_at'][:10].replace('-', '/')}\n" + "\n".join(f"{MEDAL[r['rank']]} {E(r['name'])} — {r['score']} امتیاز" for r in top))
    await show(c, "🏆 <b>تالار قهرمانان</b>\n\n" + ("\n\n".join(blocks) if blocks else "هنوز دوره‌ای برگزار نشده."), okb([[ob("🔙 بازگشت", "fx:qz")]]))
    await c.answer()


@router.callback_query(F.data.regexp(r"^fx:qa:(\d+):(\d+):([0-3])$"))
async def answer(c: CallbackQuery):
    _, _, cid, idx, slot = c.data.split(":")
    cid, idx, slot = int(cid), int(idx), int(slot)
    run = RUNS.get(cid)
    uid = c.from_user.id
    if not run or run.idx != idx or not run.open or uid not in run.sent_at:
        return await c.answer("⏰ زمان این سؤال تمام شده.", show_alert=True)
    elapsed = time.monotonic() - run.sent_at[uid]
    if elapsed > run.seconds + GRACE:
        return await c.answer("⏰ زمان این سؤال تمام شد.", show_alert=True)
    if not await is_registered(cid, uid):
        return await c.answer("⛔ تو در این مسابقه ثبت‌نام نکرده‌ای.", show_alert=True)
    ok = 1 if slot == run.correct_slot else 0
    try:
        await dbx.execute("INSERT INTO fx_q_answers(contest_id,idx,user_id,choice,ms,correct) VALUES(?,?,?,?,?,?)", cid, idx, uid, run.perm[slot], int(elapsed * 1000), ok)
    except Exception:
        return await c.answer("قبلاً جواب دادی.", show_alert=True)
    await c.answer("✅ جوابت ثبت شد")


# ================================================================= admin side
@admin_router.callback_query(F.data == "fx:aq")
async def admin_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    have = await level_counts()
    cs = await upcoming()
    rows = [[ob(f"{x['title']} · {x['start_at'][5:]} · {x['regs']}👥", f"fx:aqc:{x['id']}")] for x in cs]
    await show(c, f"⚽ <b>مسابقه فوتبالی</b>\n\nبانک سوال: آسان {have['easy']} · متوسط {have['medium']} · سخت {have['hard']}",
               okb([[ob("➕ ساخت مسابقه", "fx:aqn")]] + rows + [[ob("📥 ورود سوال از فایل", "fx:aqi"), ob("🌱 افزودن سوالات نمونه", "fx:aqs")],
                                                            [ob("🏆 تالار قهرمانان", "fx:qh")], [ob("🔙 بازگشت", "fx:a")]]))
    await c.answer()


@admin_router.callback_query(F.data == "fx:aqs")
async def seed_do(c: CallbackQuery, state: FSMContext):
    added, skipped = await seed()
    await c.answer(f"{added} سؤال اضافه شد" + (f" ({skipped} تکراری)" if skipped else ""), show_alert=True)
    await admin_home(c, state)


@admin_router.callback_query(F.data == "fx:aqi")
async def import_ask(c: CallbackQuery, state: FSMContext):
    await state.set_state(QuizSt.import_file)
    await show(c, "📥 <b>ورود سوال</b>\n\nفایل <b>JSON</b> یا <b>CSV</b> را بفرست.\n\nCSV (بدون عنوان یا با عنوان):\n<code>level,question,a,b,c,d,correct</code>\n"
               "level: easy / medium / hard (یا آسان / متوسط / سخت) — correct: عدد ۱ تا ۴ یا a تا d\n\nJSON:\n"
               "<code>[{\"level\":\"easy\",\"question\":\"...\",\"options\":[\"..\",\"..\",\"..\",\"..\"],\"correct\":2}]</code>", okb([[ob("❌ لغو", "fx:aq")]]))
    await c.answer()


@admin_router.message(QuizSt.import_file, F.document)
async def import_do(m: Message, state: FSMContext, bot: Bot):
    buf = io.BytesIO()
    await bot.download(m.document.file_id, destination=buf)
    try:
        items = parse_questions(buf.getvalue(), m.document.file_name or "")
    except Exception as ex:
        return await m.answer(f"⚠️ فایل خوانده نشد: {E(str(ex)[:150])}")
    added = skipped = bad = 0
    for lv, q, opts, cor in items:
        try:
            if await add_question(lv, q, opts, cor):
                added += 1
            else:
                skipped += 1
        except ValueError:
            bad += 1
    await state.clear()
    await m.answer(f"✅ {added} سؤال اضافه شد · {skipped} تکراری · {bad} نامعتبر", reply_markup=okb([[ob("🔙 بازگشت", "fx:aq")]]))


# ---- create contest wizard
@admin_router.callback_query(F.data == "fx:aqn")
async def wiz_start(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await state.set_state(QuizSt.title)
    await show(c, "➕ <b>ساخت مسابقه</b> — ۱ از ۴\n\n<b>عنوان مسابقه</b> را بفرست:", okb([[ob("❌ لغو", "fx:aq")]]))
    await c.answer()


@admin_router.message(QuizSt.title, F.text)
async def wiz_title(m: Message, state: FSMContext):
    await state.update_data(title=m.text.strip()[:80])
    await state.set_state(QuizSt.prize)
    await m.answer("➕ <b>ساخت مسابقه</b> — ۲ از ۴\n\n<b>جایزه</b> را بنویس (مثلاً: کد هدیه ۵۰ هزار تومانی / اکانت اپ):")


@admin_router.message(QuizSt.prize, F.text)
async def wiz_prize(m: Message, state: FSMContext):
    await state.update_data(prize=m.text.strip()[:200])
    await state.set_state(QuizSt.when)
    await m.answer("➕ <b>ساخت مسابقه</b> — ۳ از ۴\n\n<b>تاریخ و ساعت شروع</b> (به وقت تهران):\nمثال: <code>2026/10/12 21:00</code>")


@admin_router.message(QuizSt.when, F.text)
async def wiz_when(m: Message, state: FSMContext):
    try:
        when = parse_when(m.text)
    except ValueError as e:
        return await m.answer(f"⚠️ {e}")
    if when <= core.local_now().strftime("%Y-%m-%d %H:%M"):
        return await m.answer("⚠️ این زمان گذشته است.")
    await state.update_data(when=when)
    await state.set_state(QuizSt.counts)
    have = await level_counts()
    await m.answer(f"➕ <b>ساخت مسابقه</b> — ۴ از ۴\n\nتعداد سؤال از هر سطح را به ترتیب <b>آسان متوسط سخت</b> بفرست.\nمثال: <code>5 5 3</code>\n"
                   f"موجودی بانک: آسان {have['easy']} · متوسط {have['medium']} · سخت {have['hard']}")


@admin_router.message(QuizSt.counts, F.text)
async def wiz_counts(m: Message, state: FSMContext):
    nums = re.findall(r"\d+", core.norm(m.text))
    if len(nums) != 3:
        return await m.answer("⚠️ سه عدد بفرست: آسان متوسط سخت (مثلاً 5 5 3).")
    d = await state.get_data()
    try:
        cid = await create_contest(m.from_user.id, d["title"], d["prize"], d["when"], *map(int, nums))
    except ValueError as e:
        return await m.answer(f"⚠️ {e}")
    await state.clear()
    await m.answer(f"✅ مسابقه ساخته شد و ثبت‌نام باز است.\n\n⚽ <b>{E(d['title'])}</b>\n🕐 {d['when'].replace('-', '/')}", reply_markup=okb(
        [[ob("📣 اطلاع‌رسانی به همه‌ی کاربران", f"fx:aqb:{cid}")], [ob("🔙 مسابقات", "fx:aq")]]))


@admin_router.callback_query(F.data.regexp(r"^fx:aqc:(\d+)$"))
async def contest_page(c: CallbackQuery):
    x = await dbx.fetchone("SELECT c.*, (SELECT COUNT(*) FROM fx_q_regs r WHERE r.contest_id=c.id) regs FROM fx_q_contests c WHERE id=?", int(c.data.split(":")[2]))
    if not x:
        return await c.answer("پیدا نشد", show_alert=True)
    rows = []
    if x["status"] == "REG":
        rows += [[ob("▶️ شروع فوری", f"fx:aqg:{x['id']}")], [ob("📣 اطلاع‌رسانی به همه", f"fx:aqb:{x['id']}")], [ob("❌ لغو مسابقه", f"fx:aqx:{x['id']}")]]
    await show(c, f"⚽ <b>{E(x['title'])}</b>\n🕐 {x['start_at'].replace('-', '/')}\n🎁 {E(x['prize']) or '—'}\n❓ {x['n_easy']}/{x['n_medium']}/{x['n_hard']} (آسان/متوسط/سخت) · {x['seconds']} ثانیه\n"
               f"👥 آماده‌ها: {x['regs']}\nوضعیت: {x['status']}", okb(rows + [[ob("🔙 بازگشت", "fx:aq")]]))
    await c.answer()


@admin_router.callback_query(F.data.regexp(r"^fx:aqg:(\d+)$"))
async def start_now(c: CallbackQuery, bot: Bot):
    cid = int(c.data.split(":")[2])
    if await dbx.execute("UPDATE fx_q_contests SET status='RUNNING', started_at=?, start_at=? WHERE id=? AND status='REG'", core.now(),
                         core.local_now().strftime("%Y-%m-%d %H:%M"), cid):
        asyncio.create_task(run_contest(bot, cid))
        await c.answer("▶️ شروع شد")
    else:
        await c.answer("این مسابقه قابل شروع نیست.", show_alert=True)


@admin_router.callback_query(F.data.regexp(r"^fx:aqx:(\d+)$"))
async def cancel(c: CallbackQuery, state: FSMContext):
    await dbx.execute("UPDATE fx_q_contests SET status='CANCELLED' WHERE id=? AND status='REG'", int(c.data.split(":")[2]))
    await c.answer("لغو شد")
    await admin_home(c, state)


@admin_router.callback_query(F.data.regexp(r"^fx:aqb:(\d+)$"))
async def announce(c: CallbackQuery, bot: Bot):
    x = await dbx.fetchone("SELECT * FROM fx_q_contests WHERE id=?", int(c.data.split(":")[2]))
    if not x or x["status"] != "REG":
        return await c.answer("ثبت‌نام بسته است.", show_alert=True)
    users = [r["id"] for r in await main_db.fetchall("SELECT id FROM users WHERE banned=0")]
    text = (f"⚽ <b>مسابقه فوتبالی جدید!</b>\n\n<b>{E(x['title'])}</b>\n🕐 {x['start_at'].replace('-', '/')}\n🎁 {E(x['prize']) or '—'}\n\n"
            "برای شرکت: منوی اصلی ← «⚽ مسابقه فوتبالی» ← «اعلام آمادگی»")
    await c.answer(f"در حال ارسال برای {len(users)} نفر…", show_alert=True)
    asyncio.create_task(_spread(users, lambda u: core.tell(bot, u, text, okb([[ob("⚽ ورود به مسابقه", "fx:qz")]]))))
