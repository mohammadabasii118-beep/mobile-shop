import { z } from "zod";
import { db } from "@/lib/db";
import { parseJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";

export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const where = { userId: user.id, ...(sp.get("unread") === "1" ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 20, skip: (page - 1) * 20, select: { id: true, event: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true } }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { items, total, unread, pages: Math.max(1, Math.ceil(total / 20)) };
});

const readSchema = z.object({ ids: z.array(z.string().max(40)).max(100).optional(), all: z.boolean().optional(), unread: z.boolean().optional() });
/** Mark as read (ids or all) — or back to unread. Always scoped to the signed-in user. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const d = await parseJson(req, readSchema);
  const where = { userId: user.id, ...(d.all ? {} : { id: { in: d.ids ?? [] } }) };
  const r = await db.notification.updateMany({ where, data: { readAt: d.unread ? null : new Date() } });
  return { updated: r.count };
});
