import { z } from "zod";
import { getDb } from "@/database/store";
import { api, notFound, parseBody } from "@/lib/api";
import { logActivity } from "@/services/activity";
import { saveTelegramState } from "@/services/telegram/storage";

export const PATCH = api<{ id: string }>(async ({ request, params }) => {
  const { status } = await parseBody(request, z.object({ status: z.enum(["ready", "posted"]) }));
  const db = getDb();
  const item = db.readyPosts.find((x) => x.id === params.id);
  if (!item) throw notFound("Item");
  item.status = status;
  saveTelegramState({ ready: db.readyPosts });
  if (status === "posted") logActivity("instagram.post", "success", "Marked as posted on Instagram", item.title);
  return item;
}, { role: "editor" });
