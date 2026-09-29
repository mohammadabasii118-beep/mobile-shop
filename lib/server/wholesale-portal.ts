import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { conflict, forbidden, notFound } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/rate-limit";
import { getStorage } from "@/lib/server/storage";
import { validateReceipt } from "@/lib/server/upload";
import { unitPriceFor } from "@/lib/server/pricing";
import type { SessionUser } from "@/lib/server/auth/session";
import type { UploadedFile } from "@/lib/server/support";

const MAX_DOCS = 5;
const EDITABLE = ["PENDING", "CHANGES_REQUESTED"];

export const myApplication = (userId: string) =>
  db.wholesaleApplication.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { files: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, mime: true, size: true, createdAt: true } } } });

export async function uploadDocument(user: SessionUser, applicationId: string, file: UploadedFile) {
  await rateLimit(`wholesale:doc:${user.id}`, 20, 3600);
  const app = await db.wholesaleApplication.findFirst({ where: { id: applicationId, userId: user.id }, include: { _count: { select: { files: true } } } });
  if (!app) throw notFound("درخواست پیدا نشد.");
  if (!EDITABLE.includes(app.status)) throw conflict("این درخواست دیگر قابل ویرایش نیست.", "not_editable");
  if (app._count.files >= MAX_DOCS) throw conflict(`حداکثر ${MAX_DOCS} مدرک مجاز است.`, "too_many_docs");
  const v = validateReceipt(file, file.buffer);
  const storageKey = `wholesale/${app.id}/${randomUUID()}.${v.ext}`;
  await getStorage().put(storageKey, file.buffer);
  try {
    const row = await db.wholesaleDocument.create({ data: { applicationId: app.id, storageKey, originalName: v.originalName, mime: v.mime, size: v.size } });
    return { id: row.id, originalName: row.originalName };
  } catch (e) { await getStorage().delete(storageKey).catch(() => {}); throw e; }
}

export async function deleteDocument(user: SessionUser, id: string) {
  const d = await db.wholesaleDocument.findFirst({ where: { id, application: { userId: user.id } }, include: { application: true } });
  if (!d) throw notFound();
  if (!EDITABLE.includes(d.application.status)) throw conflict("این درخواست دیگر قابل ویرایش نیست.", "not_editable");
  await db.wholesaleDocument.delete({ where: { id } });
  await getStorage().delete(d.storageKey).catch(() => {});
  return { deleted: true };
}

/** Owner of the application or staff with wholesale.review only. */
export async function openDocument(user: SessionUser, id: string) {
  const d = await db.wholesaleDocument.findUnique({ where: { id }, include: { application: { select: { userId: true } } } });
  if (!d) throw notFound();
  const staff = user.isStaff && user.permissions.includes("wholesale.review");
  if (!staff && d.application.userId !== user.id) throw forbidden();
  const obj = await getStorage().get(d.storageKey);
  return { ...obj, mime: d.mime, name: d.originalName };
}

/** What an approved partner sees in their account: tier, allowed prices, wholesale orders and what they saved. All numbers come from the DB. */
export async function partnerOverview(user: SessionUser, q = "") {
  const w = user.wholesale;
  if (!w) return null;
  const [products, orders, itemsAgg, discountAgg] = await Promise.all([
    db.product.findMany({ where: { isActive: true, wholesalePrice: { not: null }, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { slug: { contains: q, mode: "insensitive" as const } }] } : {}) }, orderBy: [{ soldCount: "desc" }, { name: "asc" }], take: 30, select: { slug: true, name: true, retailPrice: true, retailDiscount: true, wholesalePrice: true, wholesaleDiscount: true, minWholesaleQty: true } }),
    db.order.findMany({ where: { userId: user.id, type: "WHOLESALE" }, orderBy: { createdAt: "desc" }, take: 20, select: { number: true, status: true, paymentStatus: true, total: true, createdAt: true } }),
    db.orderItem.findMany({ where: { priceType: "wholesale", listPrice: { not: null }, order: { userId: user.id, paymentStatus: "PAID" } }, select: { listPrice: true, unitPrice: true, quantity: true } }),
    db.order.aggregate({ where: { userId: user.id, paymentStatus: "PAID" }, _sum: { discountTotal: true } }),
  ]);
  const prices = products.map((p) => {
    const priced = unitPriceFor(p, { retailPrice: null, wholesalePrice: null }, p.minWholesaleQty, { wholesale: w });
    return { slug: p.slug, name: p.name, retail: Math.max(0, p.retailPrice - p.retailDiscount), wholesale: priced.priceType === "wholesale" ? priced.unitPrice : null, minQty: p.minWholesaleQty };
  });
  const wholesaleSavings = itemsAgg.reduce((a, i) => a + Math.max(0, (i.listPrice ?? 0) - i.unitPrice) * i.quantity, 0);
  return { tier: { key: w.tierKey, name: w.tierName, minOrder: w.minOrder, extraDiscountPercent: w.discountPercent }, storeName: w.storeName, prices, orders, savings: { wholesale: wholesaleSavings, couponAndPoints: discountAgg._sum.discountTotal ?? 0 } };
}
