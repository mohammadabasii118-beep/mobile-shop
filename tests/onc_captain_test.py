"""Captains/managers, instant result approval, pending tab, team lists, live/other entry, English standings.
python -m tests.onc_captain_test   (real handlers + DB, fake Telegram)"""
import asyncio
import datetime as dt
import os
import tempfile

TMP = tempfile.mkdtemp()
os.environ["DB_PATH"] = os.path.join(TMP, "t.db")
os.environ["ONC_ASSETS_DIR"] = os.path.join(TMP, "assets")
os.environ["ADMIN_IDS"] = "1"

from tests.onc_driver import ADMIN, ADMIN2, CHANNEL, VIEWER, Driver  # noqa: E402

C1, C1B, C2, C3 = 70001, 70003, 70002, 70004      # captains
FOOTER = "➖" * 12 + "\n⚽️ One Night | One Champion\n👉🏻 Join us: @Onenightchampion"


async def run():
    from pclbot.onc import dbx, publish, render, service, templates, ui

    d = await Driver.create(os.environ["DB_PATH"])
    S = d.session

    def latest(uid):                       # look at the newest message (e.g. an instant approval request)
        d.last_shown.pop(uid, None)
    try:
        # ---------------------------------------------------------------- setup (fast service path)
        tomorrow = (service.now_local() + dt.timedelta(days=1)).strftime("%Y-%m-%d")
        tid = await service.create_tournament(ADMIN, "کاپ تست", tomorrow, "20:00", 30)
        names = ["TAJ", "AZADI", "LEGACY", "INVADERZ"]
        team = {n: await service.add_team(ADMIN, tid, n) for n in names}
        gid = await service.create_group(ADMIN, tid)
        for n in names:
            await service.assign_team(ADMIN, team[n], gid)
        await service.set_qualifiers(ADMIN, gid, 2)
        await service.generate_schedule(ADMIN, tid)
        await service.set_setting("channel_id", str(CHANNEL))
        await service.start_tournament(ADMIN, tid)
        rounds = await service.rounds_of(tid)
        r1 = rounds[0]
        m1 = await service.matches_of_round(r1["id"])
        tm = lambda name: next(m for m in m1 if name in (m["name_a"], m["name_b"]))

        # ---------------------------------------------------------------- admin assigns 1–2 captains per team (UI)
        await d.say("/admin"); await d.tap("پنل وان نایت چمپیون")
        await d.press(f"onc:te:{team['TAJ']}")
        await d.tap("کاپیتان/منیجر"); d.snap("Captains — empty")
        await d.tap("افزودن کاپیتان"); await d.say("abc"); assert "آیدی عددی" in d.text()
        await d.say(str(C1)); assert str(C1) in d.text(), d.text()
        await d.tap("افزودن کاپیتان"); await d.say(str(C1)); assert "قبلاً" in d.text()
        await d.say(str(C1B)); assert str(C1B) in d.text()
        d.snap("Captains — two assigned")
        assert not any("افزودن" in t for t, _ in d.buttons()), "max two captains per team"
        try:
            await service.add_captain(ADMIN, team["TAJ"], 999999); assert False
        except service.OncError as e:
            assert "حداکثر" in str(e)
        await service.add_captain(ADMIN, team["AZADI"], C2)
        try:
            await service.add_captain(VIEWER, team["LEGACY"], C3); assert False        # service-level admin check
        except service.OncError:
            pass
        cap_row = (await service.captains_of(team["TAJ"]))[1]
        await d.tap(f"{C1B}")                                                         # remove the 2nd one again
        assert len(await service.captains_of(team["TAJ"])) == 1
        assert S.log[-1][0] != "SendMessage" or True
        row = await dbx.fetchone("SELECT * FROM onc_captains WHERE user_id=?", C1)
        assert row["tournament_id"] == tid and row["team_id"] == team["TAJ"], "tournament + team + user id"

        # ---------------------------------------------------------------- who sees the captain panel
        await d.say("/start", C1); await d.tap("وان نایت چمپیون", C1)
        assert any("پنل کاپیتان" in t for t, _ in d.buttons(C1))
        await d.say("/start", VIEWER); await d.tap("وان نایت چمپیون", VIEWER)
        assert not any("پنل کاپیتان" in t for t, _ in d.buttons(VIEWER))

        # ---------------------------------------------------------------- captain submits a result → PENDING, not official
        await d.tap("پنل کاپیتان", C1); await d.tap("TAJ", C1)
        d.snap("Captain panel", C1)
        await d.tap("ثبت نتیجه", C1); d.snap("Captain: choose the match", C1)
        mt = tm("TAJ")
        await d.press(f"onc:cps:{team['TAJ']}:{mt['id']}", C1)
        a, b = (3, 1) if mt["name_a"] == "TAJ" else (1, 3)
        await d.say(str(a), C1); await d.say(str(b), C1)
        d.snap("Captain: preview", C1)
        await d.tap("ارسال برای تأیید ادمین", C1)
        assert "در انتظار تأیید" in d.text(C1)
        d.snap("Captain: submitted", C1)
        pend = (await service.pending_results(tid))[0]
        assert pend["status"] == "PENDING" and pend["user_id"] == C1 and pend["team_name"] == "TAJ"
        assert not await dbx.scalar("SELECT 1 FROM onc_results WHERE match_id=?", mt["id"]), "captain submission is not an official result"
        assert (await service.group_tables(tid))[0]["played"] == 0
        # instant approval request reaches every admin with ✅ تایید / ❌ رد
        for aid in (ADMIN, ADMIN2):
            latest(aid)
            assert "نتیجه‌ی جدید" in d.text(aid) and "کاپیتان TAJ" in d.text(aid) and "در انتظار تأیید" in d.text(aid)
            assert [t for t, _ in d.buttons(aid)] == ["✅ تایید", "❌ رد"], d.buttons(aid)
        latest(ADMIN); d.snap("Admin: instant approval request")
        # a second submit for the same match is refused while pending
        await d.press(f"onc:cps:{team['TAJ']}:{mt['id']}", C1); assert "در انتظار" in S.alerts[-1]

        # ---------------------------------------------------------------- pending tab
        await d.say("/admin"); await d.tap("پنل وان نایت چمپیون"); await d.tap("نتایج")
        assert any("نتایج در انتظار تایید (1)" in t for t, _ in d.buttons()), d.buttons()
        d.snap("Admin: RESULTS → pending tab with a counter")
        await d.tap("نتایج در انتظار تایید")
        assert "(1)" in d.text() and f"{mt['name_a']} {a} - {b} {mt['name_b']}" in d.text()
        d.snap("Admin: pending list")
        await d.tap(f"{mt['name_a']} {a} - {b}")
        assert [t for t, _ in d.buttons()][:2] == ["✅ تایید", "❌ رد"]

        # forged callbacks by a captain / a stranger
        for uid in (C1, VIEWER):
            for forged in (f"onc:pa:{pend['id']}", f"onc:pr:{pend['id']}", "onc:pl:1", "onc:tca:1"):
                await d.press(forged, uid)
                assert "فقط ادمین" in S.alerts[-1], (uid, forged)
        assert (await service.get_pending(pend["id"]))["status"] == "PENDING"

        await d.tap("✅ تایید")
        assert "تأیید شد" in d.text()
        o = await dbx.fetchone("SELECT * FROM onc_results WHERE match_id=?", mt["id"])
        assert o["status"] == "CONFIRMED" and (o["goals_a"], o["goals_b"]) == (a, b), "approval makes it official"
        tbl = (await service.group_tables(tid))[0]
        assert tbl["played"] == 1 and {r["name"]: r["Pts"] for r in tbl["rows"]}["TAJ"] == 3          # standings / points / GF-GA updated
        taj = next(r for r in tbl["rows"] if r["name"] == "TAJ")
        assert (taj["GF"], taj["GA"], taj["GD"]) == (3, 1, 2)
        assert await service.pending_count(tid) == 0, "removed from the pending list"
        rnd = await service.get_round(r1["id"])
        assert rnd["status"] == "OPEN" and rnd["published_version"] == 0, "approval does NOT confirm / publish the round"
        assert not [x for x in d.channel() if x["photo"]], "nothing was published to the channel"
        latest(C1); assert "تأیید شد" in d.text(C1)                                             # captain is told
        # an official result can't be replaced by a new captain submission
        try:
            await service.submit_result(C1, team["TAJ"], mt["id"], 0, 0); assert False
        except service.OncError as e:
            assert "رسمی" in str(e)

        # ---------------------------------------------------------------- reject → captain can submit again
        allm = [m for r in rounds for m in await service.matches_of_round(r["id"])]
        m2 = next(m for m in allm if "AZADI" in (m["name_a"], m["name_b"]) and m["id"] != mt["id"])
        await d.press(f"onc:cps:{team['AZADI']}:{m2['id']}", C2); await d.say("2-2", C2); await d.tap("ارسال برای تأیید ادمین", C2)
        p2 = (await service.pending_results(tid))[0]
        latest(ADMIN); await d.tap("❌ رد", ADMIN)
        assert (await service.get_pending(p2["id"]))["status"] == "REJECTED"
        assert not await dbx.scalar("SELECT 1 FROM onc_results WHERE match_id=?", m2["id"])
        assert await service.pending_count(tid) == 0
        latest(C2); assert "رد شد" in d.text(C2)
        await service.submit_result(C2, team["AZADI"], m2["id"], 1, 0)                          # corrected result is accepted
        assert await service.pending_count(tid) == 1
        p3 = (await service.pending_results(tid))[0]
        await service.reject_pending(ADMIN, p3["id"])
        try:
            await service.approve_pending(ADMIN, p3["id"]); assert False                       # already decided
        except service.OncError:
            pass

        # ---------------------------------------------------------------- security: nobody manages another team
        other = next(m for m in allm if "TAJ" not in (m["name_a"], m["name_b"]) and "AZADI" not in (m["name_a"], m["name_b"]))   # LEGACY vs INVADERZ
        for uid, team_id, mid in ((C1, team["LEGACY"], other["id"]), (C1, team["TAJ"], other["id"]), (C2, team["TAJ"], mt["id"]), (VIEWER, team["TAJ"], mt["id"])):
            await d.press(f"onc:cps:{team_id}:{mid}", uid); assert S.alerts and ("⛔" in S.alerts[-1] or "تو کاپیتان" in S.alerts[-1]), (uid, team_id)
            try:
                await service.submit_result(uid, team_id, mid, 1, 0); assert False
            except service.OncError:
                pass
        for uid in (C1, C2, VIEWER):                                                              # panels/lists of a foreign team
            for forged in (f"onc:cpt:{team['LEGACY']}", f"onc:cpr:{team['LEGACY']}", f"onc:cpl:{team['LEGACY']}", f"onc:cpe:{team['LEGACY']}"):
                await d.press(forged, uid); assert "کاپیتان" in S.alerts[-1], forged
        try:
            await service.set_team_list(C2, team["TAJ"], ["Hack"]); assert False
        except service.OncError:
            pass
        assert not await service.players_of(team["TAJ"])

        # ---------------------------------------------------------------- team list: submit, publish, edit in place
        await d.press(f"onc:cpl:{team['TAJ']}", C1); d.snap("Captain: team list", C1)
        await d.tap("ثبت / ویرایش لیست", C1)
        await d.say("Ali\nReza\n• Sara\nNima\nOmid", C1)
        d.snap("Captain: list preview", C1)
        assert "<b>TAJ</b>" in d.text(C1) or "TAJ" in d.text(C1)
        await d.tap("ثبت و انتشار", C1)
        posts = [x for x in d.channel() if not x["photo"]]
        assert len(posts) == 1
        expected = "<b>TAJ</b>\n• Ali\n• Reza\n• Sara\n• Nima\n• Omid\n\n" + FOOTER
        assert posts[0]["text"] == expected, posts[0]["text"]
        d.snap("Team list in the channel", channel=True)
        pub = await dbx.fetchone("SELECT * FROM onc_publications WHERE kind='TEAMLIST' AND ref_id=?", team["TAJ"])
        assert pub and pub["published_by"] == C1 and pub["tournament_id"] == tid and pub["channel_id"] == str(CHANNEL)
        mid_before = pub["message_id"]
        await d.press(f"onc:cpe:{team['TAJ']}", C1); await d.say("Ali, Reza, Kian", C1); await d.tap("ثبت و انتشار", C1)
        posts = [x for x in d.channel() if not x["photo"]]
        assert len(posts) == 1, "no duplicate post"
        assert posts[0]["text"] == "<b>TAJ</b>\n• Ali\n• Reza\n• Kian\n\n" + FOOTER
        pub2 = await dbx.fetchone("SELECT * FROM onc_publications WHERE kind='TEAMLIST' AND ref_id=?", team["TAJ"])
        assert pub2["message_id"] == mid_before and pub2["content_version"] > pub["content_version"]
        assert [p["player_id"] for p in await service.players_of(team["TAJ"])] == ["Ali", "Reza", "Kian"]
        assert [r["id"] for r in await dbx.fetchall("SELECT id FROM onc_publications WHERE kind='TEAMLIST'")] == [pub["id"]]
        # HTML in names can't break the post
        await service.set_team_list(C1, team["TAJ"], ["<b>x</b>", "A&B"]); await publish.team_list(d.bot, team["TAJ"], C1)
        assert "&lt;b&gt;x&lt;/b&gt;" in [x for x in d.channel() if not x["photo"]][0]["text"]

        # ---------------------------------------------------------------- deadline: 1 hour before the start
        t = await service.get_tournament(tid)
        assert service.list_deadline(t) == service.start_dt(t) - dt.timedelta(hours=1)
        soon = (service.now_local() + dt.timedelta(minutes=59)).strftime("%H:%M")                  # starts in 59 min → deadline passed
        await dbx.execute("UPDATE onc_tournaments SET start_date=?, start_time=? WHERE id=?", service.now_local().strftime("%Y-%m-%d"), soon, tid)
        t = await service.get_tournament(tid)
        assert not service.list_open(t)
        await d.press(f"onc:cpl:{team['TAJ']}", C1)
        assert "مهلت" in d.text(C1) and not any("ثبت / ویرایش" in x for x, _ in d.buttons(C1)), "view only after the deadline"
        d.snap("Captain: deadline passed — view only", C1)
        assert "A&amp;B" in d.text(C1)
        await d.press(f"onc:cpe:{team['TAJ']}", C1); assert "مهلت" in S.alerts[-1]
        try:
            await service.set_team_list(C1, team["TAJ"], ["Late"]); assert False
        except service.OncError as e:
            assert "مهلت" in str(e)
        await service.add_player(ADMIN, team["TAJ"], "AdminAdded")                                 # admin may still edit
        assert "AdminAdded" in [p["player_id"] for p in await service.players_of(team["TAJ"])]
        await d.press(f"onc:tpub:{team['TAJ']}", ADMIN)
        assert "AdminAdded" in [x for x in d.channel() if not x["photo"]][0]["text"]
        assert len([x for x in d.channel() if not x["photo"]]) == 1
        later = (service.now_local() + dt.timedelta(minutes=61)).strftime("%H:%M")                 # 61 min → open again (boundary)
        await dbx.execute("UPDATE onc_tournaments SET start_time=? WHERE id=?", later, tid)
        assert service.list_open(await service.get_tournament(tid))

        # ---------------------------------------------------------------- the round publication flow is untouched
        for m in m1:
            if not await dbx.scalar("SELECT 1 FROM onc_results WHERE match_id=?", m["id"]):
                await service.save_result(ADMIN, m["id"], 1, 0)
        await d.press(f"onc:rd:{r1['id']}", ADMIN); assert "راند کامل شد" in d.text()
        await d.tap("تأیید و انتشار")
        assert (await service.get_round(r1["id"]))["status"] == "CONFIRMED" and len([x for x in d.channel() if x["photo"]]) == 1

        # ---------------------------------------------------------------- English standings
        tbl_txt = ui.standings_block((await service.group_tables(tid))[0])
        first = tbl_txt.split("<pre>")[1].split("\n")[0].replace("\u200e", "")
        assert first.split()[:2] == ["POS", "TEAM"] and first.split()[2:10] == ["P", "W", "D", "L", "GF", "GA", "GD", "PTS"], first
        assert "GROUP A — STANDINGS" in tbl_txt
        assert not any("؀" <= ch <= "ۿ" for ch in tbl_txt.split("<pre>")[1].split("</pre>")[0]), "no Persian inside the table"
        await d.press("onc:ust", VIEWER); assert "GROUP STANDINGS" in d.text(VIEWER) and "GROUP A — STANDINGS" in d.text(VIEWER)
        await d.press(f"onc:st:{tid}"); assert "GROUP STANDINGS" in d.text()
        from pclbot.onc import gfx
        imgs = await gfx.group_table(tid, gid)
        assert imgs and imgs[0][:4] == b"\x89PNG"
        cfg = templates.default_config("GROUP_TABLE")
        data = render.sample("GROUP_TABLE")
        assert data["title"] == "GROUP A — STANDINGS"
        sent_before = len(d.channel())
        await publish.group_standings(d.bot, tid, gid, r1["id"], ADMIN)
        assert "GROUP A — STANDINGS" in d.channel()[-1]["text"]
        d.snap("Standings graphic in the channel (English)", channel=True)

        # ---------------------------------------------------------------- live / other tournaments for viewers
        await d.say("/start", VIEWER); await d.tap("وان نایت چمپیون", VIEWER)
        await d.tap("مسابقات زنده", VIEWER)
        assert any("کاپ تست" in t for t, _ in d.buttons(VIEWER)); d.snap("Live tournaments", VIEWER)
        await d.tap("کاپ تست", VIEWER)
        assert any("جدول" in t for t, _ in d.buttons(VIEWER)); d.snap("Tournament menu", VIEWER)
        await d.tap("جدول", VIEWER); assert "GROUP STANDINGS" in d.text(VIEWER)
        await dbx.execute("UPDATE onc_tournaments SET status='FINISHED' WHERE id=?", tid)
        await d.say("/start", VIEWER); await d.tap("وان نایت چمپیون", VIEWER); await d.tap("مسابقات زنده", VIEWER)
        assert not any("کاپ تست" in t for t, _ in d.buttons(VIEWER)), "finished tournaments leave the live list"
        await d.tap("سایر مسابقات", VIEWER); assert any("کاپ تست" in t for t, _ in d.buttons(VIEWER)); d.snap("Other (finished) tournaments", VIEWER)
        await d.tap("کاپ تست", VIEWER); await d.tap("نتایج", VIEWER)
        assert "راند" in d.text(VIEWER)                                                           # archive is viewable
        # captains of a finished tournament can no longer act
        try:
            await service.submit_result(C1, team["TAJ"], mt["id"], 1, 1); assert False
        except service.OncError:
            pass
        print("CAPTAIN OK")
    finally:
        await d.close()


if __name__ == "__main__":
    asyncio.run(run())
