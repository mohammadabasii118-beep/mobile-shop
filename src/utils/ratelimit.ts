/** Fixed-window in-memory limiter (single instance). */
export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}
  allow(key: string): boolean {
    const t = this.now();
    const h = this.hits.get(key);
    if (!h || h.reset <= t) {
      this.hits.set(key, { count: 1, reset: t + this.windowMs });
      if (this.hits.size > 50_000) this.gc(t);
      return true;
    }
    h.count++;
    return h.count <= this.limit;
  }
  private gc(t: number) {
    for (const [k, v] of this.hits) if (v.reset <= t) this.hits.delete(k);
  }
}
