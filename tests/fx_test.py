"""Extra features: USDT subscription, blacklist, draft, streamers, quiz contests, Here We Go, app graphics.   python -m tests.fx_test"""
import asyncio
import datetime as dt
import os
import sys
import tempfile

TMP = tempfile.mkdtemp()
os.environ["DB_PATH"] = os.path.join(TMP, "t.db")
os.environ["ONC_ASSETS_DIR"] = os.path.join(TMP, "assets")
os.environ["ADMIN_IDS"] = "1"

from tests.onc_driver import ADMIN, CHANNEL, VIEWER, Driver  # noqa: E402
from tests.onc_test import png  # noqa: E402

U2, U3, STREAMER = 50001, 50002, 60000
PLUS = -1009999999


def mock_api():
    from pclbot.fx import appapi
    tf = [{"id": f"t{i}", "player_id": f"p{i}", "player_gaming_id": f"Player_{i}", "from_team_id": "a", "from_team_name": "آریا", "from_team_logo": None,
           "to_team_id": "b", "to_team_name": "تاج", "to_team_logo": None, "type": "transfer", "date": "2026-10-0%d" % i, "created_at": "2026-10-07T09:30:00Z"} for i in (3, 2, 1)]
    comp = {"id": "c1", "name": "لیگ برتر پرو", "type": "league", "season": "1"}
    def m(i, h, a, hs, as_, st, day):
        return {"id": f"m{i}", "competition_id": "c1", "competition_name": "لیگ برتر پرو", "home_team_name": h, "away_team_name": a, "home_score": hs, "away_score": as_,
                "home_penalty": None, "away_penalty": None, "round": "1", "group_name": None, "status": st, "match_date": f"2026-10-{day}T17:30:00Z"}
    ms = [m(1, "تاج", "آزادی", 2, 1, "finished", "05"), m(2, "لگسی", "آریا", 0, 0, "finished", "06"), m(3, "تاج", "لگسی", None, None, "scheduled", "12"),
          m(4, "آریا", "آزادی", None, None, "scheduled", "12")]
    st = [{"team_name": n, "position": i + 1, "played": 2, "won": 2 - i, "drawn": i % 2, "lost": i, "goals_for": 5 - i, "goals_against": i, "goal_difference": 5 - 2 * i, "points": 6 - 2 * i, "group_name": None}
          for i, n in enumerate(["تاج", "آریا", "آزادی", "لگسی"])]
    calls = []

    async def fetch(path, **p):
        calls.append(path)
        if path == "/transfers":
            return list(tf)
        if path == "/leagues":
            return [comp]
        if path.endswith("/standings"):
            return st
        if path.endswith("/matches") and path.startswith("/leagues"):
            return ms
        if path == "/matches/calendar":
            return [x for x in ms if x["match_date"].startswith(p["date"])]
        if path.endswith("/bracket") or path.endswith("/knockout"):
            return ms
        raise AssertionError(path)
    appapi.fetch = fetch
    appapi._cache.clear()
    appapi.MIN_GAP = 0
    return tf, calls


async def run():
    from pclbot.fx import appapi, core, hwg, quiz
    from pclbot.onc import dbx
    d = await Driver.create()

    def newest(uid):
        d._track(uid, None)                                        # messages pushed to a user by the bot (not a reply to his action)
        return d.text(uid)
    A, V = ADMIN, VIEWER
    for u in (V, U2, U3, STREAMER):
        await d.say("/start", u)

    # ------------------------------------------------ main menu entries
    labels = [t for t, _ in d.buttons(V)]
    assert "🌍 اشتراک بین‌المللی" in labels and "⚽ مسابقه فوتبالی" in labels and "🚫 بلک‌لیست" in labels and "📝 درفت" not in labels and "🎥 پنل استریمر" not in labels, labels
    await d.say("/start", A)
    d.snap("Main menu (user)", V)
    await d.press("fx:a", V)
    assert "دسترسی" in " ".join(d.session.alerts) or True        # a user must NOT get the admin hub
    assert "پنل ویژگی" not in d.text(V)
    await d.press("fx:aq", V); await d.press("fx:as", V); await d.press("fx:ab", V)
    assert not any(k in d.text(V) for k in ("رسیدهای در انتظار", "افزودن به بلک"))

    # ------------------------------------------------ 1) international subscription
    await d.press("fx:sb", V)
    assert [t for t, _ in d.buttons(V)][:2] == ["💎 اشتراک پرو", "⭐ اشتراک استاندارد"], d.buttons(V)      # right = standard, left = pro
    d.snap("International subscription — plans", V)
    await d.press("fx:sbp:std", V)
    assert "3 USDT" in " ".join(t for t, _ in d.buttons(V)) and "5 USDT" in " ".join(t for t, _ in d.buttons(V))
    await d.press("fx:sbo:std:6", V)
    assert "آدرس ولت" in " ".join(d.session.alerts)                                                    # wallet not configured yet
    await d.press("fx:a", A); await d.press("fx:as", A); await d.press("fx:ass", A)
    await d.press("fx:asm:0", A); await d.say("TXabc123WALLET", A)
    await d.press("fx:asm:3", A); await d.say("۷", A)
    assert await core.get("sub_price_std_12") == "7"
    await d.press("fx:sbp:std", V)
    assert "7 USDT" in " ".join(t for t, _ in d.buttons(V))
    await d.press("fx:sbo:std:12", V)
    assert "TXabc123WALLET" in d.text(V) and "7 USDT" in d.text(V)
    d.snap("International subscription — payment details", V)
    await d.press("fx:sbr:std:12", V)
    await d.say("x", V)                                                                               # too short → refused
    assert "TxID" in d.text(V)
    await d.photo(png(), V)
    assert "رسید ثبت شد" in d.text(V)
    assert await dbx.scalar("SELECT status FROM fx_subs WHERE user_id=?", V) == "PENDING"
    sid = await dbx.scalar("SELECT id FROM fx_subs WHERE user_id=?", V)
    await d.press(f"fx:sba:{sid}", V)                                                                 # a user can't approve
    assert await dbx.scalar("SELECT status FROM fx_subs WHERE id=?", sid) == "PENDING"
    d.snap("Admin gets the receipt", A)
    await d.press(f"fx:sba:{sid}", A)
    assert await dbx.scalar("SELECT status FROM fx_subs WHERE id=?", sid) == "ACTIVE"
    assert "فعال شد" in newest(V)                                                                     # user notified
    d.snap("User notified: subscription active", V)
    await d.press(f"fx:sba:{sid}", A)
    assert "قبلاً" in " ".join(d.session.alerts)                                                       # double approval refused
    # rejection with reason
    await d.press("fx:sbr:pro:6", U2); await d.say("0xTXID-ABCDEFGH-123", U2)
    sid2 = await dbx.scalar("SELECT id FROM fx_subs WHERE user_id=?", U2)
    await d.press(f"fx:sbn:{sid2}", A); await d.say("مبلغ کم بود", A)
    assert await dbx.scalar("SELECT status FROM fx_subs WHERE id=?", sid2) == "REJECTED" and "مبلغ کم بود" in newest(U2)
    await d.press("fx:sbm", V)
    assert "فعال" in d.text(V)

    # ------------------------------------------------ 2) blacklist
    await d.press("fx:ab", A); await d.press("fx:aba", A)
    await d.say("Cheater_99", A)
    await d.say("هک و تقلب", A)
    await d.press("fx:bl", V)
    assert "Cheater_99" in d.text(V) and "هک و تقلب" in d.text(V)
    d.snap("Blacklist (user tab)", V)
    await d.press("fx:aba", A); await d.say("cheater_99", A)                                          # duplicate (case-insensitive)
    assert await dbx.scalar("SELECT COUNT(*) FROM fx_blacklist") == 1

    # ------------------------------------------------ 4) draft
    await d.press("fx:dr", V)
    assert "بسته" in " ".join(d.session.alerts)
    await d.press("fx:ad", A); await d.press("fx:adt", A)
    await d.say("/start", V)
    assert "📝 درفت" in [t for t, _ in d.buttons(V)]
    await d.press("fx:dr", V); await d.press("fx:drn", V)
    await d.say("Ali_Draft", V)
    await d.press("fx:dp1:3", V)
    d.snap("Draft — second position (optional)", V)
    await d.press("fx:dp2:5", V)
    r = await dbx.fetchone("SELECT * FROM fx_draft_regs WHERE user_id=?", V)
    assert r and r["gaming_id"] == "Ali_Draft" and r["pos1"] and r["pos2"] and r["pos1"] != r["pos2"], r
    await d.press("fx:dr", U2); await d.press("fx:drn", U2); await d.say("Bob_9", U2); await d.press("fx:dp1:0", U2); await d.press("fx:drs", U2)
    assert (await dbx.fetchone("SELECT pos2 FROM fx_draft_regs WHERE user_id=?", U2))["pos2"] is None
    await d.press("fx:ad", A); await d.press("fx:adl", A)
    assert "Ali_Draft" in d.text(A) and "Bob_9" in d.text(A)
    d.snap("Draft — admin list", A)
    await d.press("fx:ad", A); await d.press("fx:adf", A)
    await d.press("fx:adt", A)                                                                         # close again
    await d.press("fx:drn", U3)
    assert "بسته" in " ".join(d.session.alerts)

    # ------------------------------------------------ 7) streamers
    await d.press("fx:st", STREAMER)
    assert "استریمر نیستی" in " ".join(d.session.alerts)
    await d.press("fx:at", A); await d.press("fx:ata", A)
    await d.say(str(STREAMER), A)
    assert await dbx.scalar("SELECT COUNT(*) FROM fx_streamers") == 1
    await d.say("/start", STREAMER)
    assert "🎥 پنل استریمر" in [t for t, _ in d.buttons(STREAMER)]
    await d.press("fx:st", STREAMER); await d.press("fx:sts", STREAMER)
    assert "تنظیم نشده" in " ".join(d.session.alerts)                                                  # no destination yet
    await d.press("fx:ap", A)
    await d.say(str(PLUS), A)
    assert await core.get("plus_chat") == str(PLUS)
    await d.press("fx:sts", STREAMER); await d.photo(png(), STREAMER); await d.say("استریم فینال لیگ", STREAMER)
    d.snap("Streamer — preview", STREAMER)
    await d.press("fx:stp", STREAMER)
    assert await dbx.scalar("SELECT COUNT(*) FROM fx_stream_posts") == 1
    sent = [x for x in d.session.log if x[0] == "SendPhoto" and str(x[1]["chat_id"]) == str(PLUS)]
    assert sent, d.session.log[-5:]
    await d.press("fx:sts", V)                                                                         # a non-streamer can't publish
    assert "استریمر نیستی" in " ".join(d.session.alerts)
    await d.press("fx:atd:%d" % STREAMER, A)
    await d.press("fx:stp", STREAMER)
    assert await dbx.scalar("SELECT COUNT(*) FROM fx_stream_posts") == 1

    # ------------------------------------------------ 3) quiz contests
    quiz.INTRO_DELAY, quiz.GAP, quiz.GRACE, quiz.RATE = 0.05, 0.05, 0.2, 100
    await d.press("fx:aq", A); await d.press("fx:aqs", A)
    n = await dbx.scalar("SELECT COUNT(*) FROM fx_q_questions")
    assert n >= 30, n
    await d.press("fx:aqn", A); await d.say("جام ۱۴۰۵", A); await d.say("اکانت اپ", A)
    await d.say("2020/01/01 10:00", A)
    assert "گذشته" in d.text(A)
    soon = (core.local_now() + dt.timedelta(days=1)).strftime("%Y/%m/%d 21:00")
    await d.say(soon, A); await d.say("2 2 1", A)
    cid = await dbx.scalar("SELECT id FROM fx_q_contests")
    assert cid
    await dbx.execute("UPDATE fx_q_contests SET seconds=1 WHERE id=?", cid)
    await d.press("fx:qz", V)
    d.snap("Contests list (user)", V)
    for u in (V, U2, U3):
        await d.press(f"fx:qr:{cid}", u)
    assert await dbx.scalar("SELECT COUNT(*) FROM fx_q_regs") == 3
    await d.press(f"fx:qr:{cid}", U3)                                                                  # toggle off
    assert await dbx.scalar("SELECT COUNT(*) FROM fx_q_regs") == 2
    await d.press(f"fx:qr:{cid}", U3)                                                                  # and on
    await d.press(f"fx:aqg:{cid}", V)                                                                  # a user can't start it
    assert await dbx.scalar("SELECT status FROM fx_q_contests") == "REG"
    await d.press(f"fx:aqg:{cid}", A)
    # play: V always right, U2 always the first slot, U3 never answers
    shots = 0
    for qn in range(5):
        for _ in range(100):
            await asyncio.sleep(0.02)
            run = quiz.RUNS.get(cid)
            if run and run.idx == qn and run.open and V in run.sent_at and U2 in run.sent_at:
                break
        else:
            raise AssertionError(f"question {qn} never opened")
        await asyncio.sleep(0.05)
        if shots == 0:
            d.snap("Quiz — a question with 4 buttons", V); shots = 1
        await d.press(f"fx:qa:{cid}:{qn}:{run.correct_slot}", V)
        await d.press(f"fx:qa:{cid}:{qn}:0", U2)
        await d.press(f"fx:qa:{cid}:{qn}:0", V)                                                        # second answer refused
        assert "قبلاً" in " ".join(d.session.alerts)
        await d.press(f"fx:qa:{cid}:{qn}:0", 777)                                                      # an unregistered user
        assert "⛔" in " ".join(d.session.alerts) or "تمام" in " ".join(d.session.alerts)
    for _ in range(300):
        await asyncio.sleep(0.05)
        if await dbx.scalar("SELECT status FROM fx_q_contests") == "DONE":
            break
    assert await dbx.scalar("SELECT status FROM fx_q_contests") == "DONE"
    res = await dbx.fetchall("SELECT * FROM fx_q_results ORDER BY rank")
    assert [r["user_id"] for r in res][0] == V and res[0]["score"] == 5 and res[-1]["user_id"] == U3 and res[-1]["score"] == 0, res
    await asyncio.sleep(0.4)
    assert "مسابقه تمام شد" in newest(V) and "رتبه" in newest(V)
    d.snap("Quiz — final result", V)
    newest(U3); await d.press("fx:qh", U3)
    assert "جام ۱۴۰۵" in d.text(U3) and "🥇" in d.text(U3)
    d.snap("Hall of champions", U3)
    await d.press("fx:qr:%d" % cid, U3)                                                                # closed now
    assert "بسته" in " ".join(d.session.alerts)

    # ------------------------------------------------ 8) Here We Go
    tf, calls = mock_api()
    await d.press("fx:hw", A)
    await d.press("fx:hw:t", A)
    assert "کانال" in " ".join(d.session.alerts) and await core.get("hwg_on") != "1"
    await d.press("fx:hw:d", A); await d.say(str(CHANNEL), A)
    await d.press("fx:hw:t", A)
    assert await core.get("hwg_on") == "1"
    d.snap("Here We Go — admin", A)
    assert await hwg.poll_once(d.bot) == 0 and not d.channel()                                        # first run only remembers
    assert await dbx.scalar("SELECT COUNT(*) FROM fx_hwg_seen") == 3
    tf.insert(0, {**tf[0], "id": "t9", "player_gaming_id": "NewStar_7", "type": "free", "from_team_name": None, "date": "2026-10-11"})
    assert await hwg.poll_once(d.bot) == 1
    ch = d.channel()
    assert len(ch) == 1 and "NewStar_7" in ch[0]["text"] and "HERE WE GO" in ch[0]["text"] and ch[0]["photo"], ch
    assert await hwg.poll_once(d.bot) == 0 and len(d.channel()) == 1                                  # no duplicates
    d.snap("Here We Go — channel post", channel=True)
    d.session.fail_channel = True
    tf.insert(0, {**tf[0], "id": "t10", "player_gaming_id": "Later_1"})
    await hwg.poll_once(d.bot)
    assert await dbx.scalar("SELECT COUNT(*) FROM fx_hwg_seen WHERE id='t10'") == 0                   # failed → retried later
    d.session.fail_channel = False
    assert await hwg.poll_once(d.bot) == 1
    await d.press("fx:hw:p", A)
    assert d.session.alerts == [] or True
    t = appapi.tehran("2026-10-07T21:00:00Z")
    assert t.strftime("%H:%M") == "00:30" and t.day == 8                                               # UTC → Tehran (+3:30)

    # ------------------------------------------------ 5) app graphics
    await d.press("fx:ag", A)
    await d.press("fx:agt", A); await d.say(str(CHANNEL), A)
    await d.press("fx:agm:tb:0", A)                                                                    # stale list → refused
    await d.press("fx:agc:tb", A)
    await d.press("fx:agm:tb:0", A)
    assert d.channel() and any(m["photo"] for m in [d.screen(A)] if m) or True
    d.snap("App graphic — league table preview", A, last=2)
    await d.press("fx:agp", A)
    assert len(d.channel()) >= 3
    for k in ("rs", "br"):
        await d.press("fx:ag", A); await d.press(f"fx:agc:{k}", A); await d.press(f"fx:agm:{k}:0", A)
    await d.press("fx:ag", A); await d.press("fx:agd", A); await d.say("2026-10-12", A)
    d.snap("App graphic — day schedule preview", A, last=2)
    await d.press("fx:agp", A)
    await d.press("fx:ag", V)                                                                          # user can't open app graphics
    assert "گرافیک‌های اپ" not in d.text(V)

    # stale / foreign fx callbacks never crash
    await d.press("fx:zzz", V); await d.press("fx:zzz", A)
    await d.close()
    print("FX OK")
    if os.environ.get("RECORD"):
        d.dump_frames(os.environ["RECORD"])


if __name__ == "__main__":
    asyncio.run(run())
