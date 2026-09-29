import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isViewerWholesale, effectivePrice } from "@/lib/wholesalePricing";

const MAX_IDS = 4;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") || "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ products: [] });

  const [products, isWholesale] = await Promise.all([
    db.product.findMany({
      where: { id: { in: ids }, isActive: true },
      include: { category: true, brand: true },
    }),
    isViewerWholesale(),
  ]);

  // Preserve the order the client asked for (comparison-list order), not
  // whatever order the database happens to return.
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof products;

  return NextResponse.json({
    products: ordered.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: effectivePrice(p.price, p.wholesalePrice, isWholesale),
      oldPrice: isWholesale && p.wholesalePrice != null ? null : p.oldPrice,
      images: p.images,
      stock: p.stock,
      hasVariants: p.hasVariants,
      categoryName: p.category.name,
      brandName: p.brand?.name || null,
      // Real specs only — this is exactly what an admin entered for the
      // product in the admin panel, never inferred or invented here.
      specs: (p.specs as Record<string, string> | null) || null,
    })),
  });
}
