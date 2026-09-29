import { z } from "zod";
import { db } from "@/lib/db";
import { conflict } from "@/lib/server/errors";
import { parseJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { requireUser } from "@/lib/server/auth/guard";

const schema = z.object({
  name: z.string().trim().min(2).max(80), storeName: z.string().trim().min(2).max(100),
  businessType: z.enum(["instagram_shop", "online_shop", "physical_store", "other"]),
  instagram: z.string().trim().max(80).optional(), website: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(60), address: z.string().trim().min(8).max(400), description: z.string().trim().max(600).optional(),
});

/** A signed-in customer asks to become a wholesale partner; staff review it in the admin panel. */
export const POST = route(async (req) => {
  const user = await requireUser();
  await rateLimit(`wholesale-apply:${user.id}`, 5, 86400);
  const d = await parseJson(req, schema);
  if (user.wholesale) throw conflict("شما همکار عمده هستید.");
  const open = await db.wholesaleApplication.findFirst({ where: { userId: user.id, status: { in: ["PENDING", "CHANGES_REQUESTED"] } } });
  if (open && open.status === "PENDING") throw conflict("درخواست قبلی شما در حال بررسی است.");
  if (open) { await db.wholesaleApplication.update({ where: { id: open.id }, data: { ...d, status: "PENDING", adminNote: null } }); return { id: open.id }; }
  const created = await db.wholesaleApplication.create({ data: { ...d, userId: user.id, phone: user.phone } });
  return { id: created.id };
});
