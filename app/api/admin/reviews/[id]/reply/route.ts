import { z } from "zod";
import { db } from "@/lib/db";
import { adminRoute, audit } from "@/lib/server/admin/core";
import { notFound } from "@/lib/server/errors";
import { notify } from "@/lib/server/notify";

const schema = z.object({ reply: z.string().trim().max(800) });
export const POST = adminRoute<{ id: string }>("review.moderate", async (req, p, a) => {
  const { reply } = schema.parse(await req.json().catch(() => ({})));
  return db.$transaction(async (tx) => {
    const r = await tx.review.findUnique({ where: { id: p.id }, include: { product: { select: { name: true, slug: true } } } });
    if (!r) throw notFound("نظر پیدا نشد.");
    await tx.review.update({ where: { id: r.id }, data: { adminReply: reply || null, repliedAt: reply ? new Date() : null } });
    if (reply) await notify(tx, r.userId, "review_reply", { title: "پاسخ فروشگاه به نظر شما", body: reply.slice(0, 140), link: `/product/${r.product.slug}` });
    await audit(a, "review.reply", "review", r.id, { adminReply: r.adminReply }, { adminReply: reply || null }, tx);
    return { ok: true };
  });
});
