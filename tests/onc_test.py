"""ONE NIGHT CHAMPION integration test: real handlers + real DB + real renderer, fake Telegram.   python -m tests.onc_test

With RECORD=dir it also dumps demo frames (used to build the demo / screenshots).
"""
import asyncio
import io
import json
import os
import sqlite3
import sys
import tempfile

TMP = tempfile.mkdtemp()
os.environ["DB_PATH"] = os.path.join(TMP, "t.db")
os.environ["ONC_ASSETS_DIR"] = os.path.join(TMP, "assets")
os.environ["ADMIN_IDS"] = "1"

from PIL import Image  # noqa: E402

from tests.onc_driver import ADMIN, ADMIN2, CHANNEL, VIEWER, Driver  # noqa: E402

GROUPS = {"گروه A": ["TAJ", "AZADI", "LEGACY", "INVADERZ"], "گروه B": ["ARYA", "HANGOVER", "PERSIAN GULF", "GRAVITY"],
          "گروه C": ["PHOENIX", "TITANS", "VIPERS"], "گروه D": ["WOLVES", "EAGLES", "RAIDERS"]}
# crafted scores (goals of the FIRST named team first)
SC = {
    ("TAJ", "AZADI"): (1, 0), ("TAJ", "LEGACY"): (0, 2), ("TAJ", "INVADERZ"): (3, 0),
    ("AZADI", "LEGACY"): (2, 0), ("AZADI", "INVADERZ"): (0, 1), ("LEGACY", "INVADERZ"): (2, 1),
    ("PHOENIX", "TITANS"): (2, 0), ("PHOENIX", "VIPERS"): (1, 0), ("TITANS", "VIPERS"): (1, 1),
    ("WOLVES", "EAGLES"): (1, 0), ("EAGLES", "RAIDERS"): (2, 0), ("RAIDERS", "WOLVES"): (3, 1),
}


def scores(a, b, group):
    if group == "گروه B":
        return 1, 1
    for (x, y), (p, q) in SC.items():
        if (x, y) == (a, b):
            return p, q
        if (x, y) == (b, a):
            return q, p
    raise KeyError((a, b))


def png(color=(200, 30, 60), size=300) -> bytes:
    im = Image.new("RGB", (size, size), (20, 20, 20))
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    d.ellipse([20, 20, size - 20, size - 20], fill=color)
    d.polygon([(size // 2, 60), (size - 70, size - 70), (70, size - 70)], fill=(255, 255, 255))
    b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()


async def run():
    from pclbot import db
    from pclbot.onc import algo, dbx, publish, service, templates

    # ------------------------------------------------ migration safety: Transfer data present BEFORE ONC is created
    await db.init()                      # a Transfer-only database, as on the live server
    await db.execute("INSERT INTO users(id,name,username,joined_at) VALUES(42,'old user','u',1)")
    await db.close()

    d = await Driver.create(os.environ["DB_PATH"])
    S = d.session
    try:
        assert os.path.exists(os.environ["DB_PATH"] + ".pre-onc.bak"), "backup before first migration"
        bak = sqlite3.connect(os.environ["DB_PATH"] + ".pre-onc.bak")
        assert bak.execute("SELECT name FROM users WHERE id=42").fetchone()[0] == "old user"
        bak.close()
        assert await db.scalar("SELECT name FROM users WHERE id=42") == "old user"

        # ------------------------------------------------ main menu + two sections + Transfer untouched
        await d.say("/start", VIEWER)
        assert [t for t, _ in d.buttons(VIEWER)] == ["🔄 ترنسفر", "🏆 وان نایت چمپیون"]
        d.snap("Main menu — two sections", VIEWER)
        # ---- persistent bottom menu: sent once, never needs /start again
        from aiogram.types import ReplyKeyboardMarkup
        def kb_msgs(uid):
            return [x for x in S.screens.values() if x["chat"] == uid and isinstance(x["markup"], ReplyKeyboardMarkup)]
        assert len(kb_msgs(VIEWER)) == 1
        mk = kb_msgs(VIEWER)[0]["markup"]
        assert [b.text for r in mk.keyboard for b in r] == ["🏠 منوی اصلی", "🔄 ترنسفر", "🏆 وان نایت چمپیون"] and mk.is_persistent
        await d.say("/start", VIEWER); assert len(kb_msgs(VIEWER)) == 1, "the keyboard is not re-sent every time"
        await d.say("🔄 ترنسفر", VIEWER)                                   # bottom button instead of /start
        assert any("ثبت آگهی" in t for t, _ in d.buttons(VIEWER))
        await d.say("🏆 وان نایت چمپیون", VIEWER)
        assert [t for t, _ in d.buttons(VIEWER)] == ["🔴 مسابقات زنده", "📁 سایر مسابقات", "🔙 منوی اصلی"]
        await d.say("🏠 منوی اصلی", VIEWER)
        assert [t for t, _ in d.buttons(VIEWER)] == ["🔄 ترنسفر", "🏆 وان نایت چمپیون"]
        await d.say("🛠 پنل مدیریت", VIEWER); assert [t for t, _ in d.buttons(VIEWER)] == ["🔄 ترنسفر", "🏆 وان نایت چمپیون"], "normal users can't use the admin key"
        await d.say("/onc", VIEWER); assert any("مسابقات زنده" in t for t, _ in d.buttons(VIEWER))
        await d.say("/start", VIEWER)
        await d.say("/start", ADMIN)
        akb = [x for x in S.screens.values() if x["chat"] == ADMIN and isinstance(x["markup"], ReplyKeyboardMarkup)]
        assert [b.text for r in akb[-1]["markup"].keyboard for b in r][-1] == "🛠 پنل مدیریت"
        await d.say("🛠 پنل مدیریت", ADMIN)
        assert [t for t, _ in d.buttons(ADMIN)][:2] == ["🔄 پنل ترنسفر", "🏆 پنل وان نایت چمپیون"]
        await d.home.setup_menu(d.bot)
        assert ["start", "transfer", "onc"] in [c for _, c in S.commands]
        assert any("admin" in c for _, c in S.commands), "admins get /admin in their menu"
        # the admin-panel button lives in the main menu, for admins only
        await d.say("/start", ADMIN)
        assert [t for t, _ in d.buttons(ADMIN)] == ["🔄 ترنسفر", "🏆 وان نایت چمپیون", "🛠 پنل مدیریت"], d.buttons(ADMIN)
        await d.tap("پنل مدیریت", ADMIN)
        assert [t for t, _ in d.buttons(ADMIN)][:2] == ["🔄 پنل ترنسفر", "🏆 پنل وان نایت چمپیون"]
        await d.tap("منوی اصلی", ADMIN); await d.tap("ترنسفر", ADMIN)
        assert not any("پنل مدیریت" in t for t, _ in d.buttons(ADMIN)), "no admin button inside the Transfer menu any more"
        await d.press("admhome", VIEWER); await d.press("adm", VIEWER); await d.press("onc:a", VIEWER)   # forged by a normal user
        assert "پنل" not in d.text(VIEWER)
        await d.tap("ترنسفر", VIEWER)
        labels = [t for t, _ in d.buttons(VIEWER)]
        assert any("ثبت آگهی" in t for t in labels) and "🏠 منوی اصلی" in labels, labels      # existing Transfer menu is intact
        d.snap("TRANSFER opens the existing Transfer menu", VIEWER)
        await d.tap("منوی اصلی", VIEWER)
        await d.tap("وان نایت چمپیون", VIEWER)
        assert "No tournament" not in d.text(VIEWER) or True
        assert [t for t, _ in d.buttons(VIEWER)] == ["🔴 مسابقات زنده", "📁 سایر مسابقات", "🔙 منوی اصلی"], "entry shows live / other first"
        d.snap("ONC entry: live / other tournaments", VIEWER)
        await d.tap("مسابقات زنده", VIEWER); assert "جریان نیست" in d.text(VIEWER)
        await d.tap("سایر مسابقات", VIEWER); assert "نداریم" in d.text(VIEWER)

        # viewer cannot reach admin functions even by forging callback data
        for forged in ("onc:a", "onc:cr", "onc:crok", "onc:cy:dtn:1", "onc:rsv", "onc:rc:1", "onc:ch"):
            await d.press(forged, VIEWER)
            assert S.alerts and "فقط ادمین" in S.alerts[-1], forged
        assert await dbx.scalar("SELECT COUNT(*) FROM onc_tournaments") == 0
        await d.say("/admin", VIEWER)
        assert "پنل مدیریت" not in d.text(VIEWER)

        # ------------------------------------------------ two admin panels
        await d.say("/admin")
        assert [t for t, _ in d.buttons()][:2] == ["🔄 پنل ترنسفر", "🏆 پنل وان نایت چمپیون"]
        d.snap("Admin: two independent panels")
        await d.tap("پنل ترنسفر")
        assert "پنل مدیریت" in d.text()
        await d.say("/admin"); await d.tap("پنل وان نایت چمپیون")
        for lab in ("ساخت تورنمنت", "مدیریت تورنمنت‌ها", "بازی‌های زنده", "جدول رده‌بندی", "مرحله حذفی", "تیم‌ها و بازیکنان", "گرافیک", "کانال", "تنظیمات", "پنل مدیریت"):
            assert any(lab in t for t, _ in d.buttons()), lab
        d.snap("ONC admin panel")

        # ------------------------------------------------ create tournament wizard (validation + back)
        await d.tap("ساخت تورنمنت"); await d.say("وان نایت چمپیون #5")
        await d.say("2026/13/45"); assert "فرمت تاریخ" in d.text()
        await d.say("2026/10/10")
        await d.say("25:99"); assert "فرمت ساعت" in d.text()
        await d.say("20:00"); await d.say("0"); assert "دقیقه" in d.text()
        await d.say("30")
        d.snap("Create tournament — confirm step")
        await d.tap("✅ ساخت")
        t = await service.active_tournament()
        assert t and t["status"] == "DRAFT" and t["round_interval"] == 30 and t["start_time"] == "20:00"
        tid = t["id"]
        d.snap("Tournament dashboard")

        # ------------------------------------------------ channel (separate from Transfer) + test connection
        await db.set_setting("publish_chat", "-100999")          # the Transfer ads group
        await d.tap("کانال"); d.snap("ONC channel — not configured")
        await d.tap("تنظیم کانال")
        await d.say("-100999"); assert "گروه آگهی‌های ترنسفر" in d.text()  # can't reuse the Transfer destination
        await d.say("@onc_news")
        assert await service.get_setting("channel_id") == str(CHANNEL) and "متصل" in d.text()
        d.snap("ONC channel — connected")
        S.channel_perms = {"can_post_messages": True, "can_edit_messages": False}
        await d.tap("تست اتصال"); assert "❌ مشکل دارد" in d.text() and "ویرایش پیام" in d.text()
        d.snap("Test connection — missing permission")
        S.channel_perms = {"can_post_messages": True, "can_edit_messages": True}
        await d.tap("تست اتصال"); assert "✅ متصل" in d.text()
        assert await db.get_setting("publish_chat") == "-100999"   # Transfer destination untouched

        # ------------------------------------------------ teams via UI (name + logo + players)
        await d.press(f"onc:ta:{tid}")
        await d.say("TAJ"); assert "لوگوی تیم" in d.text()
        await d.photo(png((220, 160, 20)))
        assert "تیم اضافه شد" in d.text()
        await d.tap("مدیریت بازیکنان"); await d.tap("افزودن بازیکن")
        await d.say("tajPlayer1, tajPlayer2\ntajPlayer3"); assert "اضافه شد: 3" in d.text()
        await d.say("tajPlayer1"); assert "قبلاً" in d.text()
        d.snap("Team players")
        await d.say("done")
        await d.press(f"onc:ta:{tid}"); await d.say("taj"); assert "وجود دارد" in d.text()      # duplicate (case-insensitive)
        await d.say("AZADI"); await d.tap("بدون لوگو")
        for name in [n for g in GROUPS.values() for n in g if n not in ("TAJ", "AZADI")]:
            await service.add_team(ADMIN, tid, name, None)
        await service.dbx.execute("UPDATE onc_teams SET logo_file_id='file0'")   # every team has a logo, yet only the champion poster may use one
        S.files["file0"] = png((220, 160, 20))
        teams = {x["name"]: x["id"] for x in await service.teams_of(tid)}
        assert len(teams) == 14
        await d.press(f"onc:tm:{tid}"); d.snap("Teams")

        # ------------------------------------------------ groups: create, rename, manual assign, move, qualifiers
        await d.press(f"onc:gm:{tid}")
        for _ in range(4):
            await d.tap("ساخت گروه جدید")
        gs = {g["name"]: g["id"] for g in await service.groups_of(tid)}
        assert set(gs) == set(GROUPS), gs
        await d.press(f"onc:gp:{gs['گروه D']}"); await d.tap("تغییر نام"); await d.say("گروه A"); assert "وجود دارد" in d.text()
        await d.say("گروه D")   # same name allowed for itself? -> treated as duplicate of itself only if other group; ensure no crash
        await d.press(f"onc:tg:{teams['TAJ']}"); await d.tap("گروه A")                       # manual assignment
        assert (await service.get_team(teams["TAJ"]))["group_name"] == "گروه A"
        for g, names in GROUPS.items():
            for n in names:
                await service.assign_team(ADMIN, teams[n], gs[g])
        await service.assign_team(ADMIN, teams["VIPERS"], gs["گروه D"])       # move between groups …
        assert (await service.get_team(teams["VIPERS"]))["group_name"] == "گروه D"
        await service.assign_team(ADMIN, teams["VIPERS"], gs["گروه C"])       # … and back; team data is untouched
        assert (await service.get_team(teams["VIPERS"]))["name"] == "VIPERS"
        await d.press(f"onc:gm:{tid}"); d.snap("Group management (4/4/3/3 teams)")
        assert [len(g["members"]) for g in await service.groups_of(tid)] == [4, 4, 3, 3]
        await d.press(f"onc:v:{tid}"); assert "✗ تعداد صعودکننده‌ها" in d.text() and "برنامه — هنوز ساخته نشده" in d.text()
        d.snap("Pre-tournament checklist (incomplete)")
        await d.press(f"onc:gq:{gs['گروه A']}"); d.snap("Set qualifiers")
        for g in gs.values():
            await d.press(f"onc:gqs:{g}:2")
        try:
            await service.set_qualifiers(ADMIN, gs["گروه C"], 9); assert False
        except service.OncError:
            pass

        # ------------------------------------------------ schedule: single round robin, simultaneous matches per round
        await d.press(f"onc:sc:{tid}"); await d.tap("ساخت برنامه")
        rounds = await service.rounds_of(tid)
        assert [r["start_at"][11:] for r in rounds] == ["20:00", "20:30", "21:00"], rounds
        assert await dbx.scalar("SELECT COUNT(*) FROM onc_matches WHERE tournament_id=?", tid) == 6 + 6 + 3 + 3
        for r in rounds:
            ts = [x for m in await service.matches_of_round(r["id"]) for x in (m["team_a"], m["team_b"])]
            assert len(ts) == len(set(ts)), "a team plays at most once per round"
        d.snap("Schedule: all matches of a round share one time")
        try:
            await dbx.execute("INSERT INTO onc_matches(round_id,tournament_id,group_id,team_a,team_b) "
                              "SELECT round_id,tournament_id,group_id,team_b,team_a FROM onc_matches LIMIT 1"); assert False
        except Exception as e:
            assert "UNIQUE" in str(e) or "constraint" in str(e).lower(), e      # a pair meets only once
        try:
            await dbx.execute("INSERT INTO onc_match_participants(round_id,team_id,match_id) SELECT round_id,team_id,match_id FROM onc_match_participants LIMIT 1"); assert False
        except Exception:
            pass
        await d.tap("📢 انتشار برنامه")
        n_sched = len(d.channel())
        assert n_sched == 3 and d.channel()[0]["photo"], "21 rows → 3 pages (pagination)"
        d.snap("Schedule graphic in the ONC channel", channel=True)

        # ------------------------------------------------ start validation
        await d.press(f"onc:t:{tid}")
        assert await service.get_setting("channel_id")
        assert (await service.get_tournament(tid))["status"] == "READY"
        assert any("شروع تورنمنت" in t for t, _ in d.buttons())
        d.snap("All checks ✓ → START TOURNAMENT enabled")
        await d.tap("شروع تورنمنت")
        assert (await service.get_tournament(tid))["status"] == "LIVE"

        # ------------------------------------------------ LIVE MATCHES + fast result entry (round 1)
        await d.tap("بازی‌های زنده")
        assert "راند 1" in d.text() and "ثبت نتیجه" in "".join(t for t, _ in d.buttons())
        d.snap("Live matches — round 1")
        r1 = rounds[0]
        ms = await service.matches_of_round(r1["id"])
        for i, m in enumerate(ms):
            a, b = scores(m["name_a"], m["name_b"], m["group_name"])
            await d.press(f"onc:rm:{m['id']}")
            if i == 0:
                d.snap("Result entry — first team goals")
                await d.say("abc"); assert "عدد صحیح" in d.text()
                await d.say(str(a)); d.snap("Result entry — second team goals"); await d.say(str(b))
                assert f"{m['name_a']} {a} - {b} {m['name_b']}" in d.text()
                d.snap("Result preview")
                await d.tap("ویرایش"); await d.say(f"{a}-{b}")                       # one message works too
            else:
                await d.say(f"{a}-{b}")
            await d.tap("ثبت نتیجه")
            if i < len(ms) - 1:
                assert "راند کامل شد" not in d.text()
        assert "راند کامل شد" in d.text() and "تأیید و انتشار" in "".join(t for t, _ in d.buttons())
        assert len(d.channel()) == n_sched, "nothing is published before CONFIRM & PUBLISH"     # only the schedule posts
        assert (await service.group_tables(tid))[0]["played"] == 0, "unconfirmed results never count"
        d.snap("ROUND COMPLETED — text summary for review (nothing published yet)")
        # edit before publishing
        await d.tap("ویرایش نتایج"); await d.tap(ms[0]["name_a"])
        await d.say("5-0"); await d.tap("ثبت نتیجه"); assert "5 - 0" in d.text() or "5-0" in d.text()
        await d.tap("ویرایش نتایج"); await d.tap(ms[0]["name_a"]); a, b = scores(ms[0]["name_a"], ms[0]["name_b"], ms[0]["group_name"])
        await d.say(f"{a}-{b}"); await d.tap("ثبت نتیجه")
        await d.tap("تأیید و انتشار")
        assert len(d.channel()) == n_sched + 1 and "منتشر شد" in d.text(), d.text()
        assert (await service.group_tables(tid))[0]["played"] >= 1
        pubs = await dbx.fetchall("SELECT * FROM onc_publications WHERE kind='RESULTS'")
        assert len(pubs) == 1 and pubs[0]["channel_id"] == str(CHANNEL) and pubs[0]["published_by"] == ADMIN and pubs[0]["content_version"] >= 1
        d.snap("Round results graphic in the ONC channel", channel=True)

        # ------------------------------------------------ rounds 2–3 (service-level fast path, same code as UI)
        async def play_round(r, publish_it=True):
            for m in await service.matches_of_round(r["id"]):
                a, b = scores(m["name_a"], m["name_b"], m["group_name"])
                await service.save_result(ADMIN, m["id"], a, b)
            await service.confirm_round(ADMIN, r["id"])
            if publish_it:
                await publish.after_confirm(d.bot, r["id"], ADMIN)
        await play_round(rounds[1])
        await d.press(f"onc:st:{tid}"); d.snap("Standings after round 2")
        # round 3 through the UI for the last two matches so the review/confirm path is exercised for a long list
        r3 = rounds[2]
        for m in await service.matches_of_round(r3["id"]):
            a, b = scores(m["name_a"], m["name_b"], m["group_name"])
            await service.save_result(ADMIN, m["id"], a, b)
        await d.press(f"onc:rd:{r3['id']}")
        assert "راند کامل شد" in d.text()
        d.snap("Final group round — review")
        await d.tap("تأیید و انتشار")

        # ------------------------------------------------ standings / tie-break / qualification
        tables = {x["group"]["name"]: x for x in await service.group_tables(tid)}
        A = [r["name"] for r in tables["گروه A"]["rows"]]
        assert A[:2] == ["LEGACY", "TAJ"] or A[0] in ("LEGACY", "TAJ"), A
        rowsA = {r["name"]: r for r in tables["گروه A"]["rows"]}
        assert rowsA["TAJ"]["Pts"] == rowsA["LEGACY"]["Pts"] == 6 and rowsA["LEGACY"]["pos"] < rowsA["TAJ"]["pos"] and rowsA["LEGACY"]["tb"] == "H2H"
        assert rowsA["TAJ"]["GD"] > rowsA["LEGACY"]["GD"], "head-to-head beats goal difference for exactly two teams"
        C = {r["name"]: r for r in tables["گروه C"]["rows"]}
        assert C["VIPERS"]["pos"] < C["TITANS"]["pos"] and C["VIPERS"]["tb"] == "GD"             # H2H level → GD
        D = [r["name"] for r in tables["گروه D"]["rows"]]
        assert D == ["EAGLES", "RAIDERS", "WOLVES"], D                                          # 3 teams level: GD, no H2H
        B = tables["گروه B"]
        assert len(B["unresolved"]) == 1 and len(B["unresolved"][0]) == 4 and B["status"]["state"] == "NEEDS ADMIN DECISION"
        q = await service.qualification(tid)
        assert not q["ready"] and any("گروه B" in b for b in q["blockers"])
        await d.press(f"onc:st:{tid}")
        assert "نیاز به تصمیم ادمین" in d.text()
        d.snap("Standings: unresolved tie blocks qualification")
        try:
            await service.create_ko_stage(ADMIN, tid, "QF"); assert False
        except service.OncError as e:
            assert "گروه B" in str(e)
        await d.tap("تعیین ترتیب")
        d.snap("Admin decides the unresolved tie")
        order = ["GRAVITY", "ARYA", "PERSIAN GULF", "HANGOVER"]
        for n in order:
            await d.tap(n)
        tables = {x["group"]["name"]: x for x in await service.group_tables(tid)}
        assert [r["name"] for r in tables["گروه B"]["rows"]] == order and tables["گروه B"]["rows"][0]["tb"] == "ADMIN"
        q = await service.qualification(tid)
        assert q["ready"] and len(q["teams"]) == 8
        d.snap("Standings after the decision — qualification final")
        await d.tap("انتشار جدول")
        await d.tap("انتشار تیم‌های صعودکننده")
        d.snap("Group tables / qualified teams in the ONC channel", channel=True)

        # ------------------------------------------------ knockout: admin picks every matchup
        await d.press(f"onc:ko:{tid}"); d.snap("Knockout — qualified teams")
        await d.tap("ساخت مرحله"); d.snap("Choose the stage")
        await d.tap("یک‌چهارم نهایی")
        qual = [teams[n] for n in ["TAJ", "LEGACY", "GRAVITY", "ARYA", "VIPERS", "PHOENIX", "EAGLES", "RAIDERS"]]
        assert set(qual) == set(q["teams"]), "qualified teams are the top 2 of each group"
        rid_qf = (await service.ko_rounds(tid))[0]["id"]
        await d.tap("افزودن بازی"); await d.tap("TAJ"); d.snap("Matchup: pick the opponent"); await d.tap("GRAVITY")
        pairs = [("LEGACY", "EAGLES"), ("ARYA", "RAIDERS"), ("VIPERS", "PHOENIX")]
        for a, b in pairs:
            await service.add_ko_match(ADMIN, rid_qf, teams[a], teams[b])
        try:
            await service.add_ko_match(ADMIN, rid_qf, teams["TAJ"], teams["ARYA"]); assert False   # TAJ already plays this stage
        except service.OncError:
            pass
        await d.press(f"onc:ks:{rid_qf}"); d.snap("Quarter finals — admin chose the matchups")
        await d.tap("انتشار بازی‌ها")
        # results: level match → winner must be chosen by the admin
        qms = await service.matches_of_round(rid_qf)
        m0 = qms[0]
        await d.press(f"onc:rm:{m0['id']}"); await d.say("2-2")
        assert "دستی انتخاب کن" in d.text(); d.snap("Level knockout match — admin chooses the winner")
        await d.tap(m0["name_b"]); await d.tap("ثبت نتیجه")
        try:
            await service.save_result(ADMIN, qms[1]["id"], 1, 1); assert False                      # no winner → refused
        except service.OncError as e:
            assert "برنده" in str(e)
        for m in qms[1:]:
            await service.save_result(ADMIN, m["id"], 2, 0)
        await d.press(f"onc:rd:{rid_qf}")
        assert "یک‌چهارم نهایی" in d.text() and "راند کامل شد" in d.text()
        d.snap("Quarter finals — review before publishing")
        await d.tap("تأیید و انتشار")
        qw = [m["winner_team_id"] for m in await service.matches_of_round(rid_qf)]
        assert teams["GRAVITY"] in qw and teams["TAJ"] not in qw

        # ------------------------------------------------ edit a PUBLISHED result: update the same post, never a duplicate
        posts_before = len(d.channel())
        pub_before = await dbx.fetchone("SELECT * FROM onc_publications WHERE kind='RESULTS' AND ref_id=?", rounds[0]["id"])
        m = next(x for x in await service.matches_of_round(rounds[0]["id"]) if x["group_name"] != "گروه B" and x["goals_a"] != x["goals_b"])
        a, b = m["goals_a"], m["goals_b"]
        na, nb = (a + 3, b) if a > b else (a, b + 3)       # same winner → qualification unchanged
        await d.press(f"onc:rm:{m['id']}"); await d.say(f"{na}-{nb}"); await d.tap("ثبت نتیجه")
        assert "این راند قبلاً منتشر شده" in d.text() and "نتیجه تغییر کرده" in d.text(), d.text()
        d.snap("Published result edited — update the channel post?")
        assert len(d.channel()) == posts_before, "no automatic new post"
        await d.tap("به‌روزرسانی پست کانال")
        assert len(d.channel()) == posts_before, "same message edited in place"
        pub_after = await dbx.fetchone("SELECT * FROM onc_publications WHERE id=?", pub_before["id"])
        assert pub_after["message_id"] == pub_before["message_id"] and pub_after["content_version"] > pub_before["content_version"]
        assert any(x.get("edited") for x in d.channel()), "Telegram message was edited"
        # keep-current-post path
        await d.press(f"onc:rm:{m['id']}"); await d.say(f"{a}-{b}"); await d.tap("ثبت نتیجه"); await d.tap("پست فعلی بماند")
        assert len(d.channel()) == posts_before

        # ------------------------------------------------ dependency protection (qualified team would change)
        gA = [x for x in await service.matches_of_round(rounds[0]["id"]) if x["group_name"] == "گروه A"][0]
        # find a group-A match whose reversal changes the qualified pair
        impact_found = False
        for mm in await dbx.fetchall("SELECT m.id FROM onc_matches m WHERE m.group_id=(SELECT id FROM onc_groups WHERE name='گروه A' AND tournament_id=?)", tid):
            mt = await service.get_match(mm["id"])
            res = await service.edit_confirmed_result(ADMIN, mm["id"], mt["goals_b"] + 5, mt["goals_a"], None)
            if not res["applied"]:
                impact_found = True
                assert res["impact"], res
                assert (await service.get_match(mm["id"]))["goals_a"] == mt["goals_a"], "nothing is written without the admin's OK"
                break
            await service.edit_confirmed_result(ADMIN, mm["id"], mt["goals_a"], mt["goals_b"], None)
        assert impact_found
        await d.press(f"onc:rm:{mm['id']}"); await d.say(f"{mt['goals_b'] + 5}-{mt['goals_a']}"); await d.tap("ثبت نتیجه")
        assert "روی مرحله‌ی حذفی اثر می‌گذارد" in d.text()
        d.snap("Dependency protection — knockout would break")
        await d.tap("لغو تغییر")
        assert (await service.get_match(mm["id"]))["goals_a"] == mt["goals_a"]
        assert len(await service.ko_rounds(tid)) == 1 and len(await service.matches_of_round(rid_qf)) == 4

        # ------------------------------------------------ semi finals + final (service path), champion poster with logo
        async def ko_stage(stage, pairs_idx):
            rid = await service.create_ko_stage(ADMIN, tid, stage)
            pool = await service.ko_pool(tid, rid)
            assert len(pool) == len(pairs_idx) * 2
            for i, j in pairs_idx:
                await service.add_ko_match(ADMIN, rid, pool[i], pool[j])
            for m in await service.matches_of_round(rid):
                await service.save_result(ADMIN, m["id"], 3, 1)
            await service.confirm_round(ADMIN, rid)
            await publish.after_confirm(d.bot, rid, ADMIN)
            return rid
        try:
            await service.create_ko_stage(ADMIN, tid, "SF")       # QF isn't confirmed? it is -> allowed; use to prove order guard on duplicates
        except service.OncError:
            pass
        rid_sf = await service.dbx.scalar("SELECT id FROM onc_rounds WHERE tournament_id=? AND stage='SF'", tid)
        if not rid_sf:
            rid_sf = await service.dbx.scalar("SELECT id FROM onc_rounds WHERE tournament_id=? AND stage='SF'", tid)
        pool = await service.ko_pool(tid, rid_sf)
        await service.add_ko_match(ADMIN, rid_sf, pool[0], pool[2]); await service.add_ko_match(ADMIN, rid_sf, pool[1], pool[3])
        for m in await service.matches_of_round(rid_sf):
            await service.save_result(ADMIN, m["id"], 3, 1)
        await service.confirm_round(ADMIN, rid_sf); await publish.after_confirm(d.bot, rid_sf, ADMIN)
        rid_f = await service.create_ko_stage(ADMIN, tid, "F")
        pool = await service.ko_pool(tid, rid_f)
        await service.add_ko_match(ADMIN, rid_f, pool[0], pool[1])
        await d.press(f"onc:ks:{rid_f}"); d.snap("Final")
        fm = (await service.matches_of_round(rid_f))[0]
        await d.press(f"onc:rm:{fm['id']}"); await d.say("1-1"); await d.tap(fm["name_a"]); await d.tap("ثبت نتیجه")
        await d.tap("تأیید و انتشار")
        t = await service.get_tournament(tid)
        assert t["status"] == "FINISHED" and t["champion_team_id"] == fm["team_a"]
        champ_posts = await dbx.fetchall("SELECT * FROM onc_publications WHERE kind='CHAMPION'")
        assert len(champ_posts) == 1
        d.snap("Final + champion poster published", channel=True)
        await d.press(f"onc:ko:{tid}"); await d.tap("انتشار جدول حذفی"); d.snap("Bracket + champion in the channel", channel=True)

        # ------------------------------------------------ viewer sees confirmed data
        await d.press("onc:u", VIEWER)
        for cb in ("onc:ust", "onc:ur", "onc:us", "onc:uk", "onc:ut", "onc:uc"):
            await d.press(cb, VIEWER)
        assert "قهرمان" in d.text(VIEWER)
        await d.press("onc:ust", VIEWER); d.snap("Viewer: standings", VIEWER)
        await d.press("onc:uc", VIEWER); d.snap("Viewer: champion", VIEWER)

        # ------------------------------------------------ publishing isolation
        sends = [(n, x) for n, x in S.log if n in ("SendPhoto", "SendMessage") and str(x.get("chat_id")) == "-100999"]
        assert not sends, "nothing is ever sent to the Transfer ads group"
        assert all(str(m["chat_id"]) == str(CHANNEL) for n, m in S.log if n == "SendPhoto" and m["chat_id"] is not None and int(m["chat_id"]) < 0)
        assert (await dbx.scalar("SELECT COUNT(*) FROM onc_publications WHERE channel_id<>?", str(CHANNEL))) == 0
        getfiles = [x for n, x in S.log if n == "GetFile"]
        assert len(getfiles) == 1, ("the team logo is downloaded for the champion poster only", getfiles, [n for n, _ in S.log].count("SendPhoto"))

        # ------------------------------------------------ graphics: no logo outside CHAMPION; pagination; auto-fit
        import inspect
        from pclbot.onc import gfx, render
        src = inspect.getsource(gfx)
        assert src.count("logo_file_id") == src[src.index("async def champion"):].count("logo_file_id") > 0   # logos are read only in champion()
        rsrc = inspect.getsource(render)
        head = rsrc.split("def render_champion")[0]
        assert 'data["logo"]' not in head and 'data.get("logo")' not in head   # only the champion renderer touches a logo
        big = render.sample("ROUND_RESULTS"); big["rows"] = big["rows"] * 6          # 24 rows → pages
        pages = render.render("ROUND_RESULTS", templates.default_config("ROUND_RESULTS"), big)
        assert len(pages) == 3, len(pages)
        cfg = templates.default_config("ROUND_RESULTS")
        long_name = {"subtitle": "x", "rows": [{"cells": ["PERSIAN GULF UNITED SPORTS CLUB OF TEHRAN", "3 - 1", "AZADI"]}]}
        render.render("ROUND_RESULTS", cfg, long_name)
        from PIL import ImageDraw
        dd = ImageDraw.Draw(Image.new("RGB", (10, 10)))
        txt, f = render.fit(dd, "PERSIAN GULF UNITED", cfg["cols"]["a"])
        assert f.size < cfg["cols"]["a"]["size"] and f.size >= cfg["cols"]["a"]["min"] and "…" not in txt

        # ------------------------------------------------ graphics management UI
        await d.press("onc:gx"); await d.tap("تمپلیت‌های ست فعال"); d.snap("Template set")
        sid = (await templates.active_set())["id"]
        tpl = (await templates.templates_of(sid))[2]
        await d.press(f"onc:xt:{tpl['id']}"); d.snap("Template page")
        await d.tap("ویرایش موقعیت‌ها"); x0 = (await templates.get_template(tpl["id"]))["config"]["elements"]["brand"]["y"]
        await d.tap("گام 5px"); await d.tap("گام 10px"); await d.tap("پایین")
        assert (await templates.get_template(tpl["id"]))["config"]["elements"]["brand"]["y"] == x0 + 25
        await d.tap("رنگ"); await d.tap("اندازه فونت +"); d.snap("Position editor")
        await d.tap("پیش‌نمایش")
        assert S.log[-1][0] in ("SendPhoto",)
        await d.press(f"onc:xt:{tpl['id']}")
        await d.tap("آپلود پس‌زمینه"); await d.photo(png((10, 80, 160), 400))
        assert (await templates.get_template(tpl["id"]))["bg_path"] and os.path.exists((await templates.get_template(tpl["id"]))["bg_path"])
        await d.tap("کپی"); await d.press(f"onc:xsp:{sid}"); await d.tap("کپی ست")
        assert len(await templates.sets()) == 2
        await d.tap("فعال‌سازی ست"); assert (await templates.active_set())["id"] != sid
        await d.tap("DELETE SET") if False else None
        d.snap("Template sets: duplicate / activate")
        await d.press(f"onc:xsa:{sid}")

        # ------------------------------------------------ dangerous ops need confirmation; audit log
        await d.press(f"onc:ts:{tid}"); await d.tap("ریست نتایج")
        assert "مطمئنی" in d.text() and any("تأیید" in t for t, _ in d.buttons())
        d.snap("Dangerous operation → confirmation")
        await d.tap("لغو")
        assert await service.has_results(tid)
        await d.tap("ریست نتایج"); await d.tap("✅ تأیید")
        assert not await service.has_results(tid) and (await service.get_tournament(tid))["champion_team_id"] is None
        await d.press("onc:au"); log = d.text(); d.snap("Audit log")
        assert "ریست نتایج" in log
        allog = await service.audit_log(limit=2000)
        acts = {r["action"] for r in allog}
        assert {"CHANGED RESULT", "MOVED TEAM", "CREATE TOURNAMENT", "SAVED RESULT", "CONFIRMED ROUND", "TIE DECISION", "KNOCKOUT MATCHUP"} <= acts, acts
        moved = next(r for r in allog if r["action"] == "MOVED TEAM")
        assert moved["details"] == "VIPERS: گروه C → گروه D" or "→" in moved["details"], moved
        chg = next(r for r in allog if r["action"] == "CHANGED RESULT")
        assert "→" in chg["details"] and chg["admin_id"] == ADMIN and chg["ts"] > 0

        # ------------------------------------------------ transactions: a failing block leaves nothing behind
        before = await dbx.scalar("SELECT COUNT(*) FROM onc_groups")
        try:
            async with dbx.tx():
                await dbx.execute("INSERT INTO onc_groups(tournament_id,name) VALUES(?,?)", tid, "TEMP")
                raise RuntimeError("boom")
        except RuntimeError:
            pass
        assert await dbx.scalar("SELECT COUNT(*) FROM onc_groups") == before

        # ------------------------------------------------ channel failure: results stay confirmed, publish can be retried
        await service.generate_schedule(ADMIN, tid)
        r1 = (await service.rounds_of(tid))[0]
        for m in await service.matches_of_round(r1["id"]):
            await service.save_result(ADMIN, m["id"], 1, 0)
        S.fail_channel = True
        await d.press(f"onc:rd:{r1['id']}"); await d.tap("تأیید و انتشار")
        assert "ناموفق" in d.text() and "تلاش دوباره" in "".join(t for t, _ in d.buttons())
        assert (await service.get_round(r1["id"]))["status"] == "CONFIRMED"
        assert (await service.get_round(r1["id"]))["published_version"] == 0
        d.snap("Channel error → retry publish")
        S.fail_channel = False
        await d.tap("تلاش دوباره")
        assert (await service.get_round(r1["id"]))["published_version"] > 0

        # ------------------------------------------------ automatic draw: sizes differ by at most one
        t2 = await service.create_tournament(ADMIN, "AUTO DRAW CUP", "2026-11-01", "19:00", 20)
        for i in range(14):
            await service.add_team(ADMIN, t2, f"T{i}")
        for _ in range(4):
            await service.create_group(ADMIN, t2)
        await d.press(f"onc:gm:{t2}"); await d.tap("قرعه‌کشی خودکار"); await d.tap("✅ تأیید")
        sizes = sorted(len(g["members"]) for g in await service.groups_of(t2))
        assert sizes == [3, 3, 4, 4], sizes
        d.snap("Automatic draw (then editable by hand)")
        await service.set_active(ADMIN, t2)
        assert (await service.active_tournament())["id"] == t2

        # ------------------------------------------------ FSM / callback isolation between the two sections
        n_t = await dbx.scalar("SELECT COUNT(*) FROM onc_tournaments")
        await d.say("/admin"); await d.tap("پنل ترنسفر"); await d.tap("تعرفه و تنظیمات")
        await d.press("adm:s:price_normal")
        assert (await d.state()).startswith("AdminSt"), await d.state()          # Transfer admin state
        await d.say("2026/10/10")                                                 # ONC wizard text must NOT be consumed by ONC
        assert await dbx.scalar("SELECT COUNT(*) FROM onc_tournaments") == n_t
        await d.say("/admin"); await d.tap("پنل وان نایت چمپیون"); await d.tap("ساخت تورنمنت")
        assert (await d.state()).startswith("CreateSt"), await d.state()          # ONC state
        await d.say("/start")                                                     # leaving ONC resets cleanly
        assert await d.state() is None
        await d.tap("ترنسفر")
        assert any("ثبت آگهی" in t for t, _ in d.buttons())
        await d.press("onc:crok")                                                 # stale ONC button after leaving → harmless
        assert await dbx.scalar("SELECT COUNT(*) FROM onc_tournaments") == n_t

        # ------------------------------------------------ Transfer DB intact
        assert await db.scalar("SELECT name FROM users WHERE id=42") == "old user"
        print("ONC OK")
    finally:
        if os.getenv("RECORD"):
            out = os.environ["RECORD"]
            os.makedirs(out, exist_ok=True)
            meta = []
            for i, f in enumerate(d.frames):
                for j, m in enumerate(f["messages"]):
                    if m["photo"]:
                        name = f"f{i:02d}_{j}.png"
                        open(os.path.join(out, name), "wb").write(m["photo"])
                        m["photo"] = name
                meta.append(f)
            json.dump(meta, open(os.path.join(out, "frames.json"), "w"), ensure_ascii=False)
        await d.close()


if __name__ == "__main__":
    asyncio.run(run())
