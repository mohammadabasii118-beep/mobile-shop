"""Read-only client for the PCL app's public API (https://api.pclproclub.ir/api/v1).

The API allows 60 requests/minute per route group, so every call goes through a small global throttle and a short
cache. `fetch` is the single network entry point (tests patch it).
"""
import asyncio
import logging
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import aiohttp

log = logging.getLogger("pclbot.fx.appapi")
BASE = "https://api.pclproclub.ir/api/v1"
TEHRAN = ZoneInfo("Asia/Tehran")
MIN_GAP = 1.2            # seconds between two requests  (≈50/min worst case)
CACHE_TTL = 60.0

_lock = asyncio.Lock()
_last = 0.0
_cache: dict[tuple, tuple[float, object]] = {}


class AppApiError(Exception):
    pass


async def fetch(path: str, **params):
    """GET {BASE}{path}; returns parsed JSON. Raises AppApiError with a Persian message."""
    global _last
    async with _lock:
        wait = MIN_GAP - (time.monotonic() - _last)
        if wait > 0:
            await asyncio.sleep(wait)
        _last = time.monotonic()
    params = {k: v for k, v in params.items() if v is not None}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as s:
            async with s.get(BASE + path, params=params) as r:
                if r.status == 429:
                    raise AppApiError("محدودیت تعداد درخواست API؛ چند لحظه بعد دوباره امتحان کن.")
                if r.status >= 400:
                    raise AppApiError(f"API پاسخ {r.status} داد.")
                return await r.json()
    except (aiohttp.ClientError, asyncio.TimeoutError) as ex:
        raise AppApiError("اتصال به API اپ برقرار نشد.") from ex


async def get(path: str, ttl: float = CACHE_TTL, **params):
    key = (path, tuple(sorted(params.items())))
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < ttl:
        return hit[1]
    data = await fetch(path, **params)
    _cache[key] = (time.monotonic(), data)
    return data


def tehran(iso: str) -> datetime:
    """An API timestamp (UTC) → aware Asia/Tehran datetime."""
    d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(TEHRAN)


# ------------------------------------------------------------------ typed helpers
async def transfers(limit: int = 20) -> list[dict]:
    return await get("/transfers", ttl=0, page=1, limit=limit)


async def competitions(kind: str | None = None) -> list[dict]:
    out = await get("/leagues", type=kind, page=1, per_page=50)
    return out["items"] if isinstance(out, dict) and "items" in out else out


async def standings(comp: dict, group: str | None = None) -> list[dict]:
    t = comp.get("type")
    if t == "champions":
        return await get(f"/champions/{comp['id']}/groups", group=group)
    return await get(f"/leagues/{comp['id']}/standings", group=group)


async def comp_matches(comp: dict, status: str | None = None) -> list[dict]:
    t = comp.get("type")
    if t == "cup":
        return await get(f"/cups/{comp['id']}/matches")
    if t == "champions":
        return await get(f"/champions/{comp['id']}/group-matches")
    return await get(f"/leagues/{comp['id']}/matches", status=status)


async def bracket(comp: dict) -> list[dict]:
    if comp.get("type") == "champions":
        return await get(f"/champions/{comp['id']}/knockout")
    return await get(f"/cups/{comp['id']}/bracket")


async def day_matches(day) -> list[dict]:
    """Matches of one Tehran calendar day (the API's `date` is a UTC day, so ask for both neighbours)."""
    from datetime import timedelta
    seen: dict[str, dict] = {}
    for d in (day - timedelta(days=1), day):
        for m in await get("/matches/calendar", date=d.isoformat()):
            t = tehran(m["match_date"])
            if t.date() == day:
                m["tehran_time"] = t
                seen[m["id"]] = m
    return sorted(seen.values(), key=lambda m: m["tehran_time"])
