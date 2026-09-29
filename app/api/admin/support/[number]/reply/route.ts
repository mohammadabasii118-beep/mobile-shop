import { adminRoute } from "@/lib/server/admin/core";
import { badRequest } from "@/lib/server/errors";
import { adminReply, readForm } from "@/lib/server/support";

export const POST = adminRoute<{ number: string }>("support.reply", async (req, p, a) => {
  if (!/^\d{1,9}$/.test(p.number)) throw badRequest("شماره تیکت نامعتبر است.");
  const { fields, files } = await readForm(req);
  return adminReply(Number(p.number), fields, files, a);
});
