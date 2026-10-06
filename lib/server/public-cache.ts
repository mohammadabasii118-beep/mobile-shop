import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

/** Tag shared by every cached "storefront chrome" query (menus, categories, settings, banners …). */
export const PUBLIC_TAG = "public";

/**
 * Caches a read that is identical for every visitor. Any admin write calls invalidatePublic(), so edits in the
 * panel are visible on the very next request; the TTL is only a safety net (and bounds banner schedule drift).
 */
export function cachedPublic<A extends unknown[], R>(key: string, fn: (...args: A) => Promise<R>, ttlSeconds = 300) {
  return unstable_cache(fn, ["public", key], { tags: [PUBLIC_TAG], revalidate: ttlSeconds });
}

export function invalidatePublic() {
  try { revalidateTag(PUBLIC_TAG, { expire: 0 }); } catch { /* outside a request scope (scripts/tests): nothing cached to invalidate */ }
}
