// Fixed-window in-memory limiter. Swap the Map for Redis/Upstash in production (same signature).
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  h.count++;
  return { ok: h.count <= limit, remaining: Math.max(0, limit - h.count) };
}
