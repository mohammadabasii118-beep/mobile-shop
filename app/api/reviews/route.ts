import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/server/errors";
import { parseJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { requireUser } from "@/lib/server/auth/guard";

const schema = z.object({ orderNumber: z.coerce.number().int().positive(), productId: z.string().min(1).max(40), rating: z.coerce.number().int().min(1).max(5), body: z.string().trim().min(5, "نظر را کمی کامل‌تر بنویسید.").max(1500) });

/** Only a customer whose order was DELIVERED can review a product from it (once per product per order). Reviews are moderated before they appear. */
export const POST = route(async (req) => {
  const user = await requireUser();
  await rateLimit(`review:${user.id}`, 10, 3600);
  const d = await parseJson(req, schema);
  const order = await db.order.findFirst({ where: { number: d.orderNumber, userId: user.id, status: "DELIVERED", items: { some: { productId: d.productId } } }, select: { id: true } });
  if (!order) throw notFound("این سفارش تحویل‌شده نیست یا این محصول در آن وجود ندارد.");
  if (await db.review.findFirst({ where: { userId: user.id, productId: d.productId, orderId: order.id } })) throw conflict("برای این محصول قبلاً نظر ثبت کرده‌اید.", "review_exists");
  const r = await db.review.create({ data: { productId: d.productId, userId: user.id, orderId: order.id, rating: d.rating, body: d.body } });
  return { id: r.id, status: r.status };
});
