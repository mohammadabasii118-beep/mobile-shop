/* Demo orders so the admin "payment review" and "orders" screens have real rows on a fresh database (dev only). */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../lib/generated/prisma/client";

// A small but valid PNG "receipt" (stored in the private upload dir, never public).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

export async function seedDemoOrders(db: PrismaClient) {
  if ((await db.order.count()) > 0) return;
  const ship = await db.shippingMethod.findFirstOrThrow({ where: { key: "post" } });
  const products = await db.product.findMany({ take: 6, orderBy: { soldCount: "desc" }, include: { variants: { include: { inventory: true }, take: 1 }, images: { take: 1 } } });
  const buyers = await db.user.findMany({ where: { phone: { in: ["09120000002", "09120000004", "09120000005"] } }, orderBy: { phone: "asc" } });
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? "./storage");
  const plan: { buyer: number; product: number; qty: number; status: "PENDING_PAYMENT" | "PAYMENT_REVIEW"; ref?: string }[] = [
    { buyer: 0, product: 0, qty: 2, status: "PAYMENT_REVIEW", ref: "746291" },
    { buyer: 1, product: 1, qty: 1, status: "PAYMENT_REVIEW", ref: "118420" },
    { buyer: 2, product: 2, qty: 3, status: "PENDING_PAYMENT" },
  ];
  for (const p of plan) {
    const u = buyers[p.buyer]!, prod = products[p.product]!, v = prod.variants[0]!;
    const unit = prod.retailPrice - prod.retailDiscount, subtotal = unit * p.qty, shipping = subtotal >= 2_000_000 ? 0 : ship.cost, total = subtotal + shipping;
    const order = await db.order.create({
      data: {
        userId: u.id, status: p.status, paymentStatus: p.status === "PAYMENT_REVIEW" ? "REVIEW" : "PENDING", customerName: u.displayName ?? u.phone ?? "مشتری", customerPhone: u.phone ?? "",
        shippingAddress: { receiver: u.displayName ?? "گیرنده", phone: u.phone ?? "", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، نبش کوچه نمونه، پلاک ۱۲" },
        shippingMethodId: ship.id, subtotal, shippingCost: shipping, total,
        items: { create: [{ variantId: v.id, productId: prod.id, name: prod.name, sku: v.sku, image: prod.images[0]?.url ?? null, unitPrice: unit, priceType: "retail", quantity: p.qty, total: subtotal }] },
        history: { create: [{ status: "PENDING_PAYMENT", description: "سفارش ثبت شد." }, ...(p.status === "PAYMENT_REVIEW" ? [{ status: "PAYMENT_REVIEW" as const, description: "رسید پرداخت ارسال شد و در انتظار بررسی است." }] : [])] },
      },
    });
    const payment = await db.payment.create({ data: { orderId: order.id, amount: total, status: p.status === "PAYMENT_REVIEW" ? "REVIEW" : "PENDING", referenceNumber: p.ref ?? null, submittedAt: p.ref ? new Date() : null } });
    if (p.ref) {
      const key = `receipts/${order.id}/${randomUUID()}.png`;
      await mkdir(path.dirname(path.join(uploadDir, key)), { recursive: true, mode: 0o700 });
      await writeFile(path.join(uploadDir, key), PNG, { mode: 0o600 });
      await db.paymentProof.create({ data: { paymentId: payment.id, storageKey: key, originalName: "receipt.png", mime: "image/png", size: PNG.length } });
    }
    if (v.inventory) {
      const inv = await db.inventory.update({ where: { id: v.inventory.id }, data: { quantity: { decrement: p.qty } } });
      await db.inventoryMovement.create({ data: { inventoryId: inv.id, delta: -p.qty, balanceAfter: inv.quantity, reason: "order", orderId: order.id } });
    }
  }
}
