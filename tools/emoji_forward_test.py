#!/usr/bin/env python3
"""Does a Premium (custom) emoji survive  group → forwardMessage → channel ?   (run it on the bot's server)

    cd /opt/pcl-transfer && .venv/bin/python tools/emoji_forward_test.py --group -100GROUP --channel -100CHANNEL --emoji 5368324170671202286

--emoji is a custom_emoji_id (the same ID you set in ✨ ایموجی‌ها). BOT_TOKEN is read from the environment or from .env.
Steps: 1) send a test post with the custom emoji to the group  2) forwardMessage the same message to the channel
       3) compare the entities of both API replies and print the verdict.  The bot must be able to post in both chats.
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request


def token() -> str:
    t = os.getenv("BOT_TOKEN")
    if not t and os.path.exists(".env"):
        m = re.search(r"^BOT_TOKEN\s*=\s*(\S+)", open(".env", encoding="utf-8").read(), re.M)
        t = m.group(1).strip("'\"") if m else None
    if not t:
        sys.exit("BOT_TOKEN not found (environment or .env)")
    return t


def call(tok: str, method: str, **params) -> dict:
    req = urllib.request.Request(f"https://api.telegram.org/bot{tok}/{method}", data=urllib.parse.urlencode(params).encode())
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return json.load(e)


def custom_ids(msg: dict) -> list[str]:
    ents = (msg.get("entities") or []) + (msg.get("caption_entities") or [])
    return [e["custom_emoji_id"] for e in ents if e.get("type") == "custom_emoji"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", required=True)
    ap.add_argument("--channel", required=True)
    ap.add_argument("--emoji", required=True, help="custom_emoji_id")
    a = ap.parse_args()
    tok = token()

    print("1) sendMessage → group")
    r1 = call(tok, "sendMessage", chat_id=a.group, parse_mode="HTML", text=f'تست ایموجی پریمیوم <tg-emoji emoji-id="{a.emoji}">🔴</tg-emoji> Streamer')
    print(json.dumps(r1, ensure_ascii=False, indent=2))
    if not r1.get("ok"):
        sys.exit("✗ the group post failed (see description above)")
    sent = r1["result"]
    ids1 = custom_ids(sent)
    print(f"→ custom_emoji in the group post: {ids1 or 'NONE (Telegram turned it into a plain emoji)'}\n")

    print("2) forwardMessage group → channel")
    r2 = call(tok, "forwardMessage", chat_id=a.channel, from_chat_id=a.group, message_id=sent["message_id"])
    print(json.dumps(r2, ensure_ascii=False, indent=2))
    if not r2.get("ok"):
        sys.exit("✗ the forward failed (see description above)")
    ids2 = custom_ids(r2["result"])
    print(f"→ custom_emoji in the channel message: {ids2 or 'NONE'}\n")

    print("2b) sendMessage straight to the channel (what the bot does today)")
    r3 = call(tok, "sendMessage", chat_id=a.channel, parse_mode="HTML", text=f'direct <tg-emoji emoji-id="{a.emoji}">🔴</tg-emoji>')
    ids3 = custom_ids(r3["result"]) if r3.get("ok") else None
    print(f"→ custom_emoji in the direct channel post: {ids3 or 'NONE'}\n")

    print("2c) copyMessage group → channel (no 'forwarded from' header), then read it back to see what the channel really stored")
    r4 = call(tok, "copyMessage", chat_id=a.channel, from_chat_id=a.group, message_id=sent["message_id"])
    ids4 = None
    if r4.get("ok"):
        back = call(tok, "forwardMessage", chat_id=a.group, from_chat_id=a.channel, message_id=r4["result"]["message_id"])
        if back.get("ok"):
            ids4 = custom_ids(back["result"])
            call(tok, "deleteMessage", chat_id=a.group, message_id=back["result"]["message_id"])
    else:
        print(json.dumps(r4, ensure_ascii=False))
    print(f"→ custom_emoji in the copied channel message: {ids4 or 'NONE'}\n")

    print("3) verdict")
    if not ids1:
        print("✗ The emoji was already lost when posting to the group: the bot may not use custom emoji there (Telegram only allows it when the "
              "bot owner has Premium / the bot has an extra username bought on Fragment), or the ID is not a valid custom emoji.")
    else:
        print("group post (sendMessage)        :", "✓ kept" if ids1 else "✗ lost")
        print("channel, direct sendMessage      :", "✓ kept" if ids3 else "✗ lost")
        print("channel, forwardMessage          :", "✓ kept (but shows 'Forwarded from')" if ids1 == ids2 else "✗ lost")
        print("channel, copyMessage (clean post):", "✓ kept  → the relay in the bot will work" if ids4 else "✗ lost  → relay via copyMessage cannot help")
    print("\nIDs to delete the test posts: group", sent["message_id"], "· channel", r2["result"]["message_id"])


if __name__ == "__main__":
    main()
