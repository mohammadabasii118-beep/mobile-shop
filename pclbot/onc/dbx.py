"""Dedicated sqlite connection for the ONC module.

* PRAGMA foreign_keys=ON (the Transfer connection keeps its old behaviour untouched).
* Every call takes a lock, so a transaction opened by one handler is never interleaved with another handler's queries.
* `async with tx():` gives a real BEGIN IMMEDIATE ... COMMIT/ROLLBACK block; calls made inside it reuse the transaction.
"""
import asyncio
import contextlib
import contextvars
import os
import shutil
import sqlite3
from typing import Any

import aiosqlite

from .. import config
from .schema import SCHEMA

_conn: aiosqlite.Connection | None = None
_lock = asyncio.Lock()
_in_tx: contextvars.ContextVar[bool] = contextvars.ContextVar("onc_in_tx", default=False)


def _backup_sync(path: str) -> str | None:
    """Safe copy of the existing database before the first ONC migration (sqlite online backup API)."""
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        return None
    src = sqlite3.connect(path)
    try:
        if src.execute("SELECT 1 FROM sqlite_master WHERE name='onc_tournaments'").fetchone():
            return None  # already migrated
        dest = path + ".pre-onc.bak"
        dst = sqlite3.connect(dest)
        with dst:
            src.backup(dst)
        dst.close()
        return dest
    finally:
        src.close()


async def init(path: str | None = None) -> str | None:
    """Open the connection, back up the DB once, create the onc_* tables. Returns the backup path (if one was made)."""
    global _conn
    path = path or config.DB_PATH
    backup = await asyncio.to_thread(_backup_sync, path)
    _conn = await aiosqlite.connect(path, isolation_level=None)
    _conn.row_factory = aiosqlite.Row
    await _conn.execute("PRAGMA foreign_keys=ON")
    await _conn.execute("PRAGMA busy_timeout=8000")
    await _conn.executescript(SCHEMA)
    return backup


async def close() -> None:
    global _conn
    if _conn:
        await _conn.close()
        _conn = None


@contextlib.asynccontextmanager
async def _guard():
    if _in_tx.get():
        yield
    else:
        async with _lock:
            yield


async def fetchall(sql: str, *args: Any) -> list[dict]:
    async with _guard():
        async with _conn.execute(sql, args) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def fetchone(sql: str, *args: Any) -> dict | None:
    async with _guard():
        async with _conn.execute(sql, args) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def scalar(sql: str, *args: Any) -> Any:
    async with _guard():
        async with _conn.execute(sql, args) as cur:
            row = await cur.fetchone()
            return row[0] if row else None


async def execute(sql: str, *args: Any) -> int:
    """Write statement; returns lastrowid for INSERT, rowcount otherwise."""
    async with _guard():
        async with _conn.execute(sql, args) as cur:
            return cur.lastrowid if sql.lstrip().upper().startswith("INSERT") else cur.rowcount


@contextlib.asynccontextmanager
async def tx():
    if _in_tx.get():  # nested: join the outer transaction
        yield
        return
    async with _lock:
        await _conn.execute("BEGIN IMMEDIATE")
        token = _in_tx.set(True)
        try:
            yield
        except BaseException:
            await _conn.execute("ROLLBACK")
            raise
        else:
            await _conn.execute("COMMIT")
        finally:
            _in_tx.reset(token)
