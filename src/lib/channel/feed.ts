import { all, get } from '../db';

export type ChannelPost = {
  id: number; text: string; image: string | null; posted_at: string;
  product_slug: string | null; product_name: string | null;
};

/** فقط پست‌های نمایان؛ لینک محصول فقط اگر محصول منتشرشده باشد. */
export function getChannelPosts(limit: number, offset = 0): ChannelPost[] {
  return all<ChannelPost>(
    `SELECT c.id, c.text, c.image, c.posted_at,
            CASE WHEN p.status = 'published' THEN p.slug END AS product_slug,
            CASE WHEN p.status = 'published' THEN p.name END AS product_name
       FROM channel_posts c LEFT JOIN products p ON p.id = c.product_id
      WHERE c.visible = 1 ORDER BY c.posted_at DESC, c.id DESC LIMIT ? OFFSET ?`, limit, offset);
}
export function countChannelPosts(): number {
  return get<{ n: number }>('SELECT COUNT(*) n FROM channel_posts WHERE visible = 1')!.n;
}

/** متن پست را برای کارت کوتاه می‌کند (بدون HTML؛ React خودش escape می‌کند). */
export function excerpt(text: string, max = 160): string {
  const t = text.replace(/#\S+/g, '').replace(/\n{2,}/g, '\n').trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}
