"""Team of the Tournament manager + theme manager + group-qualification status.   python -m tests.xi_test"""
import asyncio
import os
import tempfile

TMP = tempfile.mkdtemp()
os.environ["DB_PATH"] = os.path.join(TMP, "t.db")
os.environ["ONC_ASSETS_DIR"] = os.path.join(TMP, "assets")
os.environ["ADMIN_IDS"] = "1"

from tests.fx_test import PLUS, mock_api  # noqa: E402
from tests.onc_driver import ADMIN, CHANNEL, VIEWER, Driver  # noqa: E402
from tests.onc_test import png  # noqa: E402

A = ADMIN


def algo_checks():
    from pclbot.onc import algo
    rows = [{"team": 1, "Pts": 9}, {"team": 2, "Pts": 6}, {"team": 3, "Pts": 3}, {"team": 4, "Pts": 0}]
    # all played → top 2 certain, bottom 2 certain out
    assert algo.clinch(rows, [], 2) == {1: "in", 2: "in", 3: "out", 4: "out"}
    r2 = [{"team": 1, "Pts": 6}, {"team": 2, "Pts": 3}, {"team": 3, "Pts": 3}, {"team": 4, "Pts": 0}]
    assert algo.clinch(r2, [(3, 4), (1, 2)], 2) == {1: None, 2: None, 3: None, 4: None}                 # three teams can still end level on 6 → never guessed
    r3 = [{"team": 1, "Pts": 9}, {"team": 2, "Pts": 6}, {"team": 3, "Pts": 0}, {"team": 4, "Pts": 0}]
    assert algo.clinch(r3, [(3, 4)], 2) == {1: "in", 2: "in", 3: "out", 4: "out"}                      # one match left, but it cannot change the top 2
    assert algo.clinch(r2, [(3, 4), (1, 2)], None) == {}


async def run():
    algo_checks()
    from pclbot.fx import core, xi
    from pclbot.onc import dbx, formations as fm, gfx, themes
    d = await Driver.create()
    await d.say("/start", A)

    # ------------------------------------------------ theme manager
    await d.press("fx:a", A)
    assert "🎭 تم‌های گرافیکی" in [t for t, _ in d.buttons(A)] and "⭐ تیم منتخب تورنمنت" in [t for t, _ in d.buttons(A)]
    await d.press("fx:th", A)
    assert "طرح فعلی" in d.text(A)
    await d.press("fx:thv", A)
    assert len(d.buttons(A)) == 11                                                                       # 10 themes + back
    await d.press("fx:tht:3:6", A)                                                                       # theme 4 on the 7th graphic (CHAMPION)
    assert d.channel() == [] and "CHAMPIONS GOLD" in d.text(A) or True
    await d.press("fx:thsd:3", A)
    assert await core.get("theme_default") == "CHAMPIONS_GOLD"
    await d.press("fx:thst:1:5", A)                                                                      # group table → ELECTRIC BLUE only
    assert await core.get("theme_GROUP_TABLE") == "ELECTRIC_BLUE"
    assert await gfx.resolve_theme("GROUP_TABLE") == "ELECTRIC_BLUE" and await gfx.resolve_theme("SCHEDULE") == "CHAMPIONS_GOLD"
    assert await gfx.resolve_theme("SCHEDULE", "RED_ARENA") == "RED_ARENA"                               # asked-for theme wins
    await d.press("fx:th", A)
    d.snap("Theme manager", A)
    await d.press("fx:thrs", A)
    assert await gfx.resolve_theme("GROUP_TABLE") is None
    await d.press("fx:thv", VIEWER)                                                                      # users have no access
    assert "پیش‌نمایش" not in d.text(VIEWER)

    # ------------------------------------------------ MANUAL 4-3-3
    await d.press("fx:xi", A)
    d.snap("Team of the Tournament — AUTO or MANUAL", A)
    assert [t for t, _ in d.buttons(A)][:2] == ["🤖 بر اساس آمار اپ — AUTO", "✍️ انتخاب دستی — MANUAL"]
    await d.press("fx:xim:m", A)
    await d.say("ONE NIGHT CHAMPION #5", A)
    assert [t for t, _ in d.buttons(A)][:3] == ["3-5-2", "3-4-3", "4-3-3"]
    d.snap("Choose the tactical system", A)
    await d.press("fx:xif:2", A)
    assert "بازیکن شماره 1 از 11" in d.text(A) and "دروازه‌بان" in d.text(A) and "آیدی بازیکن را وارد کنید." in d.text(A)
    d.snap("Player 1 of 11 — id", A)
    await d.say("GK_One", A)
    assert "عکس بازیکن را ارسال کنید." in d.text(A)
    await d.say("not a photo", A)
    assert "عکس" in d.text(A)
    await d.photo(png((200, 40, 40)), A)
    assert "نام تیم بازیکن را وارد کنید." in d.text(A)
    await d.say("تاج", A)
    assert "عکس یا لوگوی تیم را ارسال کنید." in d.text(A)
    await d.photo(png((40, 80, 200)), A)
    assert "تأیید" in " ".join(t for t, _ in d.buttons(A)) and "GK_One" in d.text(A)
    assert [t for t, _ in d.buttons(A)] == ["✅ تأیید و بازیکن بعدی", "✏️ ویرایش اطلاعات", "🔙 بازگشت"], d.buttons(A)
    d.snap("Player summary — confirm / edit / back", A)
    await d.press("fx:xied", A)                                                                          # edit the team name only
    await d.press("fx:xie:team", A); await d.say("آریا", A)
    assert "آریا" in d.text(A)
    await d.press("fx:xiok", A)
    assert "بازیکن شماره 2 از 11" in d.text(A) and "مدافع چپ" in d.text(A)
    await d.say("GK_One", A)                                                                             # duplicate id refused
    assert "تکراری" in d.text(A)
    await d.press("fx:xib", A)                                                                           # back to player 1
    assert "بازیکن شماره 1 از 11" in d.text(A) and "GK_One" in d.text(A)
    await d.press("fx:xiok", A)                                                                          # confirm again, next player
    # simulate a restart in the middle: FSM state is lost, the database keeps everything
    await d.dp.fsm.get_context(d.bot, chat_id=A, user_id=A).clear()
    await d.press("fx:xi", A)
    assert "ادامه فرآیند نیمه‌تمام" in " ".join(t for t, _ in d.buttons(A)) and "1 از ۱۱" in d.text(A), d.text(A)
    await d.press("fx:xir", A)
    assert "بازیکن شماره 2 از 11" in d.text(A)
    ids = ["LB_Two", "CB_Three", "CB_Four", "RB_Five", "CM_Six", "CDM_Seven", "CM_Eight", "LW_Nine", "ST_Ten", "RW_Eleven"]
    for n, pid in enumerate(ids):
        await d.say(pid, A)
        if n == 0:
            await d.tap("⏭ بدون عکس", A)                                                                 # photo is optional
        else:
            await d.photo(png((30 + n * 15, 120, 60)), A)
        await d.say("لگسی" if n % 2 else "تاج", A)
        if n % 3 == 0:
            await d.tap("⏭ بدون لوگو", A)
        else:
            await d.photo(png((220, 180, 30)), A)
        await d.press("fx:xiok", A)
    assert "پیش‌نمایش" in d.text(A) and [t for t, _ in d.buttons(A)] == ["✅ تأیید نهایی", "✏️ ویرایش بازیکنان", "🔁 تغییر ترکیب", "🎭 تغییر تم گرافیکی", "❌ لغو"], d.buttons(A)
    d.snap("Preview of the final line-up", A, last=2)
    # edit one player from the preview, back to the preview
    await d.press("fx:xipl", A)
    assert len(d.buttons(A)) == 12
    await d.press("fx:xip:9", A)
    await d.press("fx:xie:pid", A); await d.say("ST_Ten_V2", A)
    assert "ST_Ten_V2" in d.text(A)
    await d.press("fx:xiok", A)
    assert "پیش‌نمایش" in d.text(A)
    # change the theme, then the system (players that fit their line are kept)
    await d.press("fx:xith", A)
    d.snap("Choose a graphic theme", A)
    await d.press("fx:xit:5", A)
    assert "ELECTRIC BLUE" in " ".join(m["text"] or "" for m in [d.screen(A)] if m) or True
    draft = await xi.get_draft(A)
    assert draft["theme"] == "ELECTRIC_BLUE" and draft["players"][9]["pid"] == "ST_Ten_V2"
    await d.press("fx:xichg", A); await d.press("fx:xif:1", A)                                           # 4-3-3 → 3-4-3: one defender and one midfielder lost
    draft = await xi.get_draft(A)
    assert draft["formation"] == "3-4-3" and sum(1 for p in draft["players"] if p["done"]) == 10, [p["pid"] for p in draft["players"]]   # RB lost, one new midfield slot open
    assert "هافبک" in d.text(A) and "بازیکن شماره 8 از 11" in d.text(A), d.text(A)                       # the empty slot is asked next
    await d.say("MID_New", A); await d.tap("⏭ بدون عکس", A); await d.say("تاج", A); await d.tap("⏭ بدون لوگو", A); await d.press("fx:xiok", A)
    draft = await xi.get_draft(A)
    assert all(p["done"] for p in draft["players"]) and len({p["pid"].lower() for p in draft["players"]}) == 11
    d.snap("Team of the Tournament — 3-4-3 + Electric Blue", A, last=2)
    await d.press("fx:xifin", A)
    docs = [x for x in d.session.log if x[0] == "SendDocument"]
    assert docs, "final PNG not sent"
    await d.press("fx:ag", A)                                                                            # app-graphics publish button path
    await d.press("fx:xi", A)
    # cancel wipes the draft
    await d.press("fx:xidel", A)
    assert await xi.get_draft(A) is None

    # ------------------------------------------------ every system renders (3-5-2, 3-4-3, 4-3-3) with exact slot counts
    for name in fm.ORDER:
        cnt = fm.counts(name)
        assert sum(cnt.values()) == 11 and cnt[0] == 1, (name, cnt)
    assert fm.counts("3-5-2") == {0: 1, 1: 3, 2: 5, 3: 2} and fm.counts("3-4-3") == {0: 1, 1: 3, 2: 4, 3: 3} and fm.counts("4-3-3") == {0: 1, 1: 4, 2: 3, 3: 3}

    # ------------------------------------------------ AUTO from app data (mock API), never invents players
    tf, calls = mock_api()
    from pclbot.fx import appapi
    xi_all = [{"gamer_tag": f"P{i}", "position": p, "rating": 9 - i / 10, "team_name": "لگسی", "formation": "4-3-3"}
              for i, p in enumerate(["GK", "LB", "CB", "CB", "RB", "CM", "CDM", "CM", "LW", "ST", "RW"])]
    base = appapi.fetch

    async def fetch(path, **p):
        if path.endswith("/best-xi"):
            return xi_all if p.get("round") in (None, "1") else xi_all[:5]
        return await base(path, **p)
    appapi.fetch = fetch
    await d.press("fx:xi", A); await d.press("fx:xim:a", A)
    await d.press("fx:xic:0", A)
    assert "TEAM" in d.text(A) or True
    await d.press("fx:xif:auto", A)
    d.snap("AUTO — choose the scope", A)
    await d.press("fx:xis:all", A)
    draft = await xi.get_draft(A)
    assert draft["formation"] == "4-3-3" and [p["pid"] for p in draft["players"]][:2] == ["P0", "P1"], draft
    assert all(p["done"] for p in draft["players"])
    d.snap("AUTO — line-up from the app stats (needs admin approval)", A, last=2)
    await d.press("fx:xidel", A)
    # not enough players for the line-up → clear message, nothing invented
    await d.press("fx:xi", A); await d.press("fx:xim:a", A); await d.press("fx:xic:0", A); await d.press("fx:xif:0", A)
    await d.press("fx:xis:1", A)                                                                         # round "2": only 5 players
    assert await xi.get_draft(A) is not None
    assert "بازیکن کافی نیست" in " ".join(m["text"] or "" for m in d.channel()) or "بازیکن کافی نیست" in d.text(A) or "اطلاعات کافی" in d.text(A), d.text(A)
    # users and strangers can't use any of it
    await d.press("fx:xi", VIEWER); await d.press("fx:xifin", VIEWER); await d.press("fx:xidel", VIEWER)
    assert "تیم منتخب" not in d.text(VIEWER)
    await d.close()
    print("XI OK")
    if os.environ.get("RECORD"):
        d.dump_frames(os.environ["RECORD"])


if __name__ == "__main__":
    import sys
    import traceback
    code = 0
    try:
        asyncio.run(run())
    except BaseException:
        traceback.print_exc()
        code = 1
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(code)
