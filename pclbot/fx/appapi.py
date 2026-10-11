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
def rows(data) -> list[dict]:
    """The API returns a plain list, but a paged object ({items|data|results: [...]}) is accepted too."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ("items", "data", "results", "matches", "players", "standings"):
            if isinstance(data.get(k), list):
                return data[k]
    return []


PREFIX = {"league": "leagues", "cup": "cups", "champions": "champions"}


def base(comp: dict) -> str:
    return f"/{PREFIX.get(comp.get('type'), 'leagues')}/{comp['id']}"


async def transfers(limit: int = 20) -> list[dict]:
    return rows(await get("/transfers", ttl=0, page=1, limit=limit))


async def competitions() -> list[dict]:
    out: list[dict] = []
    for page in (1, 2, 3):
        got = rows(await get("/leagues", page=page, per_page=20))
        out += [x for x in got if x["id"] not in {y["id"] for y in out}]
        if len(got) < 20:
            break
    order = {"active": 0, "open": 1, "full": 1, "closed": 2, "finished": 3, "suspended": 3}
    return sorted(out, key=lambda x: order.get(x.get("status"), 2))


async def standings(comp: dict, group: str | None = None) -> list[dict]:
    path = f"/champions/{comp['id']}/groups" if comp.get("type") == "champions" else f"/leagues/{comp['id']}/standings"
    return rows(await get(path, group=group))


async def all_matches(comp: dict) -> list[dict]:
    """Every match of the competition (league pages are walked until they stop returning new matches)."""
    t = comp.get("type")
    seen: dict[str, dict] = {}
    if t == "cup":
        sources = [(f"/cups/{comp['id']}/matches", False)]
    elif t == "champions":
        sources = [(f"/champions/{comp['id']}/group-matches", False), (f"/champions/{comp['id']}/knockout", False)]
    else:
        sources = [(f"/leagues/{comp['id']}/matches", True)]
    for path, paged in sources:
        for page in range(1, 9 if paged else 2):
            try:
                got = rows(await get(path, page=page if paged else None, limit=100 if paged else None))
            except AppApiError:
                if page == 1 and not seen:
                    raise
                break
            new = [m for m in got if m["id"] not in seen]
            for m in new:
                seen[m["id"]] = m
            if not paged or not new:
                break
    return list(seen.values())


async def bracket(comp: dict) -> list[dict]:
    path = f"/champions/{comp['id']}/knockout" if comp.get("type") == "champions" else f"/cups/{comp['id']}/bracket"
    return rows(await get(path))


async def stats(comp: dict, category: str, limit: int = 3) -> list[dict]:
    return rows(await get(base(comp) + "/stats", category=category, page=1, limit=limit))


async def best_xi(comp: dict, round_: str | None = None) -> list[dict]:
    return rows(await get(base(comp) + "/best-xi", round=round_))


async def day_matches(day) -> list[dict]:
    """Matches of one Tehran calendar day (the API's `date` is a UTC day, so ask for both neighbours)."""
    from datetime import timedelta
    seen: dict[str, dict] = {}
    for d in (day - timedelta(days=1), day):
        for m in rows(await get("/matches/calendar", date=d.isoformat())):
            t = tehran(m["match_date"])
            if t.date() == day:
                m["tehran_time"] = t
                seen[m["id"]] = m
    return sorted(seen.values(), key=lambda m: m["tehran_time"])
