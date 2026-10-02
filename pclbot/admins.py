"""Admin registry: env ADMIN_IDS are super admins; others are stored in the DB."""
from . import config, db

_ids: set[int] = set(config.ADMIN_IDS)


async def load() -> None:
    rows = await db.fetchall("SELECT id FROM admins")
    _ids.clear()
    _ids.update(config.ADMIN_IDS)
    _ids.update(r["id"] for r in rows)


def is_admin(uid: int) -> bool:
    return uid in _ids


def is_super(uid: int) -> bool:
    return uid in config.ADMIN_IDS


def all_ids() -> list[int]:
    return sorted(_ids)


async def add(uid: int, by: int) -> None:
    await db.execute("INSERT OR IGNORE INTO admins(id,added_by,added_at) VALUES(?,?,?)", uid, by, db.now())
    await load()


async def remove(uid: int) -> bool:
    if is_super(uid):
        return False
    await db.execute("DELETE FROM admins WHERE id=?", uid)
    await load()
    return True
