/**
 * Supplier sync scaffold — run with: npx tsx scripts/syncSupplier.ts
 * Does nothing useful until lib/supplier is wired to a real API (see that file).
 */
import { db } from "@/lib/db";
import { getSupplierClient } from "@/lib/supplier";
import { calculateSellPrice } from "@/lib/pricing";

async function main() {
  const client = getSupplierClient();
  const items = await client.fetchProducts(); // will throw until configured

  for (const item of items) {
    const [cost, stock, images] = await Promise.all([
      client.fetchPrice(item.sku),
      client.fetchStock(item.sku),
      client.fetchImages(item.sku),
    ]);
    const sellPrice = (await calculateSellPrice(cost)) ?? cost;

    await db.product.upsert({
      where: { sku: item.sku },
      update: { costPrice: cost, price: sellPrice, stock, images },
      create: {
        name: item.name,
        slug: item.sku.toLowerCase(),
        description: item.name,
        sku: item.sku,
        costPrice: cost,
        price: sellPrice,
        stock,
        images,
        categoryId: "REPLACE_WITH_DEFAULT_CATEGORY_ID",
      },
    });
  }
  console.log(`Synced ${items.length} products.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
