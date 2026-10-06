import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * The storefront's effective (payable) retail price of a product, computed IN SQL so listings can ORDER BY it:
 *
 *   effective = cheapest active variant of ( base price − best single discount )
 *   best discount = largest of the legacy per-product discount and every currently usable promotion that matches
 *
 * This is the SAME rule as `resolveUnitDiscount` + `toCard` in TypeScript (discounts.ts / queries.ts): scope matching, the time window,
 * global capacity, "no minimum order" (a promotion with a minimum needs a cart, so it never shows on listings), integer
 * flooring of percentages, and the no-active-variant fallback to the product's own price. The e2e test
 * "shop sort = effective price" compares this ordering with the prices the pages show, so the two cannot drift apart silently.
 * The customer-facing prices themselves (cards, cart, checkout) are still produced by the TypeScript engine, never by the browser.
 *
 * Usage: `FROM "Product" p ${EFFECTIVE_PRICE_JOIN} … ORDER BY eff."price"`.
 */
export const EFFECTIVE_PRICE_JOIN = Prisma.sql`
  LEFT JOIN "Category" pc ON pc."id" = p."categoryId"
  LEFT JOIN LATERAL (
    SELECT MIN(GREATEST(0, b."base" - COALESCE(x."best", 0))) AS "price"
    FROM (
      SELECT v."id" AS "vid", v."phoneModelId" AS "pm", COALESCE(v."retailPrice", p."retailPrice") AS "base", v."salePrice" AS "sale"
      FROM "ProductVariant" v WHERE v."productId" = p."id" AND v."isActive" = true
      UNION ALL
      SELECT NULL::text, NULL::text, p."retailPrice", NULL::int
      WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" v2 WHERE v2."productId" = p."id" AND v2."isActive" = true)
    ) b
    LEFT JOIN LATERAL (
      SELECT MAX(c."cand") AS "best" FROM (
        SELECT LEAST(b."base", p."retailDiscount") AS "cand" WHERE p."retailDiscount" > 0
        UNION ALL
        SELECT b."base" - b."sale" WHERE b."sale" IS NOT NULL AND b."sale" < b."base"
        UNION ALL
        SELECT LEAST(b."base", CASE WHEN d."type" = 'PERCENT' THEN ((b."base"::bigint * d."value") / 100)::int ELSE d."value" END)
        FROM "Discount" d
        WHERE d."isActive" = true
          AND (d."startsAt" IS NULL OR d."startsAt" <= now()) AND (d."endsAt" IS NULL OR d."endsAt" >= now())
          AND (d."usageLimit" IS NULL OR d."usedCount" < d."usageLimit")
          AND d."minOrder" = 0
          AND (
            d."scope" = 'ALL'
            OR (d."scope" = 'PRODUCT' AND d."targetId" = p."id")
            OR (d."scope" = 'VARIANT' AND b."vid" IS NOT NULL AND d."targetId" = b."vid")
            OR (d."scope" = 'CATEGORY' AND (d."targetId" = p."categoryId" OR d."targetId" = pc."parentId"
              OR EXISTS (SELECT 1 FROM "ProductCategory" xc LEFT JOIN "Category" xcc ON xcc."id" = xc."categoryId"
                         WHERE xc."productId" = p."id" AND (d."targetId" = xc."categoryId" OR d."targetId" = xcc."parentId"))))
            OR (d."scope" = 'MODEL' AND b."pm" IS NOT NULL AND d."targetId" = b."pm")
            OR (d."scope" = 'PRODUCT_BRAND' AND (d."targetId" = p."brandId" OR EXISTS (SELECT 1 FROM "ProductBrand" xb WHERE xb."productId" = p."id" AND xb."brandId" = d."targetId")))
            OR (d."scope" = 'PHONE_BRAND' AND b."pm" IS NOT NULL AND d."targetId" = (SELECT m."brandId" FROM "PhoneModel" m WHERE m."id" = b."pm"))
            OR (d."scope" = 'BRAND' AND (d."targetId" = p."brandId" OR EXISTS (SELECT 1 FROM "ProductBrand" xb WHERE xb."productId" = p."id" AND xb."brandId" = d."targetId") OR (b."pm" IS NOT NULL AND d."targetId" = (SELECT m."brandId" FROM "PhoneModel" m WHERE m."id" = b."pm"))))
          )
      ) c
    ) x ON true
  ) eff ON true`;
