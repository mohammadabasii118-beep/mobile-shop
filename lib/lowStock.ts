import type { Prisma } from "@prisma/client";
import { runAutomationRules } from "@/lib/automation";

// Called right after a REAL stock decrement (checkout only — the one place
// stock actually goes down) to check whether it just crossed the
// low-stock threshold, and if so fire the LOW_STOCK automation trigger.
// Deliberately edge-triggered (previousStock > threshold && newStock <=
// threshold) rather than "fire every time stock is at/below the
// threshold" — otherwise every subsequent sale of an already-low-stock
// item would create another AdminAlert, which is noise, not a warning.
export async function checkLowStockAfterDecrement(
  tx: Prisma.TransactionClient,
  opts: { productId?: string | null; variantId?: string | null; quantitySold: number; nameSnapshot: string }
): Promise<void> {
  const settings = await tx.siteSettings.findUnique({ where: { id: "singleton" } });
  const threshold = settings?.lowStockThreshold ?? 3;

  let newStock: number | null = null;
  let productIdForLink: string | null = null;

  if (opts.variantId) {
    const v = await tx.productVariant.findUnique({ where: { id: opts.variantId }, select: { stock: true, productId: true } });
    if (v) {
      newStock = v.stock;
      productIdForLink = v.productId;
    }
  } else if (opts.productId) {
    const p = await tx.product.findUnique({ where: { id: opts.productId }, select: { stock: true } });
    if (p) {
      newStock = p.stock;
      productIdForLink = opts.productId;
    }
  }

  if (newStock === null) return;

  const previousStock = newStock + opts.quantitySold;
  if (previousStock > threshold && newStock <= threshold) {
    await runAutomationRules(tx, "LOW_STOCK", {
      message: `موجودی «${opts.nameSnapshot}» به ${newStock} عدد رسید (آستانه هشدار: ${threshold} عدد)`,
      link: productIdForLink ? `/admin/products/${productIdForLink}/edit` : undefined,
    });
  }
}
