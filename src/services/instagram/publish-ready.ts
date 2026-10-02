import { getDb, nextId } from "@/database/store";
import { sidecarConfig } from "@/config/instagram";
import { HttpError } from "@/lib/api";
import { logActivity, notify } from "@/services/activity";
import { tgFile } from "@/services/telegram/client";
import { saveTelegramState } from "@/services/telegram/storage";
import { sidecarPublish } from "./sidecar";

async function loadImage(imageUrl: string) {
  const id = new URL(imageUrl, "http://x").searchParams.get("id");
  if (!imageUrl.startsWith("/api/telegram/media") || !id) throw new HttpError(400, "This post has no photo to publish");
  const res = await tgFile(id);
  return new Uint8Array(await res.arrayBuffer());
}

/** Publishes a queued Telegram post to Instagram through the sidecar. Enforces the daily limit. */
export async function publishReadyPost(id: string, kinds: ("photo" | "story")[]) {
  const db = getDb();
  const item = db.readyPosts.find((x) => x.id === id);
  if (!item) throw new HttpError(404, "Item not found");
  if (item.status === "posted") throw new HttpError(409, "Already posted");

  const { dailyLimit } = sidecarConfig();
  const since = Date.now() - 24 * 3600_000;
  const recent = db.readyPosts.filter((x) => x.publishedAt && new Date(x.publishedAt).getTime() > since).length;
  if (recent >= dailyLimit) throw new HttpError(429, `Daily limit reached (${dailyLimit} posts / 24h). This protects your account.`);

  const image = await loadImage(item.imageUrl);
  try {
    for (const kind of kinds) {
      const r = await sidecarPublish(kind, image, item.caption);
      if (kind === "photo") {
        db.instagramPosts.unshift({ id: nextId("ig"), caption: item.caption, imageUrl: item.imageUrl, kind: "post", likes: 0, comments: 0, date: new Date().toISOString(), status: "published", source: "telegram", telegramPostId: item.telegramPostId });
        db.stats.published++;
        item.instagramPostId = r.id;
      } else {
        db.stories.unshift({ id: nextId("st"), imageUrl: item.imageUrl, label: item.title.slice(0, 18), status: "published", publishedAt: new Date().toISOString(), source: "telegram", views: 0 });
      }
      logActivity(kind === "photo" ? "instagram.post" : "instagram.story", "success", kind === "photo" ? "Instagram Post Published" : "Instagram Story Published", item.title);
    }
  } catch (e) {
    logActivity("instagram.post", "error", "Instagram Post Failed", e instanceof Error ? e.message : "Unknown error");
    notify("warning", "Instagram post failed to publish");
    throw e;
  }
  item.status = "posted";
  item.publishedAt = new Date().toISOString();
  saveTelegramState({ ready: db.readyPosts });
  return item;
}
