-- Phase 7: product media + reviews (additive; no data removed)
-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "orderItemId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ProductImage_productId_type_idx" ON "ProductImage"("productId", "type");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_productId_status_createdAt_idx" ON "Review"("productId", "status", "createdAt");


-- Media: exactly one primary IMAGE per product. Normalise legacy rows first (keep the first by sortOrder), then enforce.
UPDATE "ProductImage" pi SET "isPrimary" = false
WHERE pi."isPrimary" AND pi."id" <> (
  SELECT x."id" FROM "ProductImage" x WHERE x."productId" = pi."productId" AND x."isPrimary"
  ORDER BY x."sortOrder", x."id" LIMIT 1);
UPDATE "ProductImage" pi SET "isPrimary" = true
WHERE pi."id" = (SELECT x."id" FROM "ProductImage" x WHERE x."productId" = pi."productId" ORDER BY x."sortOrder", x."id" LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "ProductImage" y WHERE y."productId" = pi."productId" AND y."isPrimary");
CREATE UNIQUE INDEX "ProductImage_one_primary_per_product" ON "ProductImage"("productId") WHERE "isPrimary";
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_video_not_primary" CHECK (NOT ("type" = 'VIDEO' AND "isPrimary"));

-- Reviews: backfill provenance for legacy rows (they were only ever creatable for DELIVERED orders).
UPDATE "Review" r SET "verifiedPurchase" = true,
  "orderItemId" = (SELECT oi."id" FROM "OrderItem" oi WHERE oi."orderId" = r."orderId" AND oi."productId" = r."productId" ORDER BY oi."id" LIMIT 1)
WHERE r."orderId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "OrderItem" oi WHERE oi."orderId" = r."orderId" AND oi."productId" = r."productId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Review" ADD CONSTRAINT "Review_status_valid" CHECK ("status" IN ('pending','approved','rejected'));
