import json
import time
from typing import Any

import aiosqlite

from . import config

DEFAULT_SETTINGS = {
    "price_normal": "20000",
    "price_special": "50000",
    "renew_normal": "15000",
    "renew_special": "40000",
    "upgrade_price": "30000",
    "days_normal": "7",
    "days_special": "14",
    "referral_reward": "10000",
    "min_topup": "10000",
    "publish_chat": "",
    "support_username": "",
    "welcome_text": "👋 به ربات <b>PCL Transfer</b> خوش اومدی!\n\nاینجا می‌تونی آگهی بازیکن آزاد یا جذب بازیکن برای تیم پروکلابت ثبت کنی.",
    "announce_text": "",
    "premium_emoji": "1",
}

DEFAULT_BADGES = [
    ("برنزی", "🥉", 5),
    ("نقره‌ای", "🥈", 15),
    ("طلایی", "🥇", 30),
    ("الماسی", "💎", 50),
    ("افسانه‌ای", "👑", 100),
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY, name TEXT, username TEXT, joined_at INTEGER,
    balance INTEGER DEFAULT 0, referrer_id INTEGER, ref_rewarded INTEGER DEFAULT 0,
    banned INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS ads(
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, kind TEXT, data TEXT,
    photo TEXT, status TEXT, special INTEGER DEFAULT 0, created_at INTEGER,
    expires_at INTEGER, msg_id INTEGER, chat_id TEXT, fingerprint TEXT,
    counted INTEGER DEFAULT 0, reject_reason TEXT);
CREATE TABLE IF NOT EXISTS transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount INTEGER, type TEXT,
    note TEXT, status TEXT DEFAULT 'done', authority TEXT, ref_id TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS gift_codes(
    code TEXT PRIMARY KEY, amount INTEGER, max_uses INTEGER, used INTEGER DEFAULT 0,
    expires_at INTEGER);
CREATE TABLE IF NOT EXISTS gift_uses(code TEXT, user_id INTEGER, PRIMARY KEY(code, user_id));
CREATE TABLE IF NOT EXISTS badges(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, emoji TEXT, min_ads INTEGER);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS custom_emojis(emoji TEXT PRIMARY KEY, emoji_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY, added_by INTEGER, added_at INTEGER);
CREATE TABLE IF NOT EXISTS channels(
    id INTEGER PRIMARY KEY AUTOINCREMENT, chat TEXT UNIQUE, title TEXT, link TEXT);
CREATE INDEX IF NOT EXISTS ads_user ON ads(user_id);
CREATE INDEX IF NOT EXISTS ads_status ON ads(status);
"""

_db: aiosqlite.Connection | None = None


def now() -> int:
    return int(time.time())


async def init() -> None:
    global _db
    _db = await aiosqlite.connect(config.DB_PATH)
    _db.row_factory = aiosqlite.Row
    await _db.executescript(SCHEMA)
    for k, v in DEFAULT_SETTINGS.items():
        await _db.execute("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", (k, v))
    async with _db.execute("SELECT COUNT(*) FROM badges") as cur:
        if (await cur.fetchone())[0] == 0:
            await _db.executemany("INSERT INTO badges(name,emoji,min_ads) VALUES(?,?,?)", DEFAULT_BADGES)
    await _db.commit()


async def close() -> None:
    if _db:
        await _db.close()


async def fetchall(sql: str, *args: Any) -> list[dict]:
    async with _db.execute(sql, args) as cur:
        return [dict(r) for r in await cur.fetchall()]


async def fetchone(sql: str, *args: Any) -> dict | None:
    async with _db.execute(sql, args) as cur:
        row = await cur.fetchone()
        return dict(row) if row else None


async def scalar(sql: str, *args: Any) -> Any:
    async with _db.execute(sql, args) as cur:
        row = await cur.fetchone()
        return row[0] if row else None


async def execute(sql: str, *args: Any) -> int:
    """Run a write statement; returns rowcount (or lastrowid for INSERT)."""
    async with _db.execute(sql, args) as cur:
        await _db.commit()
        return cur.lastrowid if sql.lstrip().upper().startswith("INSERT") else cur.rowcount


# ---- settings ----------------------------------------------------------
async def get_setting(key: str) -> str:
    v = await scalar("SELECT value FROM settings WHERE key=?", key)
    return v if v is not None else DEFAULT_SETTINGS.get(key, "")


async def get_int(key: str) -> int:
    try:
        return int(await get_setting(key))
    except ValueError:
        return int(DEFAULT_SETTINGS.get(key, "0") or 0)


async def set_setting(key: str, value: str) -> None:
    await execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, value)


# ---- users / wallet ----------------------------------------------------
async def get_user(uid: int) -> dict | None:
    return await fetchone("SELECT * FROM users WHERE id=?", uid)


async def ensure_user(uid: int, name: str, username: str | None, referrer: int | None = None) -> tuple[dict, bool]:
    user = await get_user(uid)
    if user:
        await execute("UPDATE users SET name=?, username=? WHERE id=?", name, username, uid)
        return user, False
    if referrer == uid or (referrer and not await get_user(referrer)):
        referrer = None
    await execute("INSERT INTO users(id,name,username,joined_at,referrer_id) VALUES(?,?,?,?,?)", uid, name, username, now(), referrer)
    return await get_user(uid), True


async def add_tx(uid: int, amount: int, type_: str, note: str = "", status: str = "done", authority: str | None = None) -> int:
    return await execute(
        "INSERT INTO transactions(user_id,amount,type,note,status,authority,created_at) VALUES(?,?,?,?,?,?,?)",
        uid, amount, type_, note, status, authority, now(),
    )


async def credit(uid: int, amount: int, type_: str, note: str = "") -> None:
    await execute("UPDATE users SET balance=balance+? WHERE id=?", amount, uid)
    await add_tx(uid, amount, type_, note)


async def charge(uid: int, amount: int, type_: str, note: str = "") -> bool:
    """Atomically deduct from wallet; False if balance is insufficient."""
    if amount <= 0:
        return True
    if await execute("UPDATE users SET balance=balance-? WHERE id=? AND balance>=?", amount, uid, amount) == 0:
        return False
    await add_tx(uid, -amount, type_, note)
    return True


# ---- ads ---------------------------------------------------------------
def ad_row(row: dict | None) -> dict | None:
    if row:
        row["data"] = json.loads(row["data"])
    return row


async def get_ad(ad_id: int) -> dict | None:
    return ad_row(await fetchone("SELECT * FROM ads WHERE id=?", ad_id))


async def user_ads(uid: int, active: bool) -> list[dict]:
    cond = "status IN ('pending','approved')" if active else "status IN ('expired','rejected')"
    rows = await fetchall(f"SELECT * FROM ads WHERE user_id=? AND {cond} ORDER BY id DESC LIMIT 30", uid)
    return [ad_row(r) for r in rows]


# ---- badges ------------------------------------------------------------
async def counted_ads(uid: int) -> int:
    return await scalar("SELECT COUNT(*) FROM ads WHERE user_id=? AND counted=1", uid) or 0


async def badge_for(count: int) -> tuple[dict | None, dict | None]:
    """Returns (current badge, next badge)."""
    badges = await fetchall("SELECT * FROM badges ORDER BY min_ads")
    cur = nxt = None
    for b in badges:
        if count >= b["min_ads"]:
            cur = b
        elif nxt is None:
            nxt = b
    return cur, nxt
