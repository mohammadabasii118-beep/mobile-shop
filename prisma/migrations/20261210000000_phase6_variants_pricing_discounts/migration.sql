-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "RuleScope" AS ENUM ('GLOBAL', 'CATEGORY', 'PRODUCT', 'VARIANT');

-- CreateEnum
CREATE TYPE "MarginType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('ALL', 'PRODUCT', 'CATEGORY', 'VARIANT', 'BRAND', 'MODEL');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "colorName" TEXT,
ADD COLUMN     "couponDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountLabel" TEXT,
ADD COLUMN     "finalTotal" INTEGER,
ADD COLUMN     "modelName" TEXT,
ADD COLUMN     "originalPrice" INTEGER;

-- AlterTable
ALTER TABLE "PriceHistory" ADD COLUMN     "newCost" INTEGER,
ADD COLUMN     "newRule" TEXT,
ADD COLUMN     "oldCost" INTEGER,
ADD COLUMN     "oldRule" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costPrice" INTEGER,
ADD COLUMN     "pricingMode" "PricingMode" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "colorId" TEXT,
ADD COLUMN     "costPrice" INTEGER,
ADD COLUMN     "phoneModelId" TEXT,
ADD COLUMN     "pricingMode" "PricingMode" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "Color" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Color_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "scope" "RuleScope" NOT NULL,
    "targetId" TEXT NOT NULL DEFAULT '',
    "marginType" "MarginType" NOT NULL DEFAULT 'PERCENT',
    "marginValue" INTEGER NOT NULL,
    "roundTo" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "scope" "DiscountScope" NOT NULL,
    "targetId" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "minOrder" INTEGER NOT NULL DEFAULT 0,
    "usageLimit" INTEGER,
    "perUserLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountUsage" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "userId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Color_name_key" ON "Color"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PricingRule_scope_targetId_key" ON "PricingRule"("scope", "targetId");

-- CreateIndex
CREATE INDEX "Discount_isActive_startsAt_endsAt_idx" ON "Discount"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "DiscountUsage_discountId_userId_idx" ON "DiscountUsage"("discountId", "userId");

-- CreateIndex
CREATE INDEX "DiscountUsage_orderId_idx" ON "DiscountUsage"("orderId");

-- CreateIndex
CREATE INDEX "PriceHistory_variantId_createdAt_idx" ON "PriceHistory"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductVariant_phoneModelId_idx" ON "ProductVariant"("phoneModelId");

-- CreateIndex
CREATE INDEX "ProductVariant_colorId_idx" ON "ProductVariant"("colorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_phoneModelId_colorId_key" ON "ProductVariant"("productId", "phoneModelId", "colorId");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_phoneModelId_fkey" FOREIGN KEY ("phoneModelId") REFERENCES "PhoneModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Data: new permissions (idempotent) for the pricing / discount admin areas, granted to the two owner roles.
INSERT INTO "Permission" ("id","key","label") VALUES
  (gen_random_uuid()::text,'pricing.read','مشاهده قیمت‌گذاری و هزینه خرید'),
  (gen_random_uuid()::text,'pricing.write','مدیریت قیمت‌گذاری، قوانین و تغییر گروهی قیمت'),
  (gen_random_uuid()::text,'discount.write','مدیریت تخفیف‌ها')
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."key" IN ('super_admin','admin') AND p."key" IN ('pricing.read','pricing.write','discount.write')
ON CONFLICT DO NOTHING;

-- Data: promote existing free-text variant colours to managed Colour rows (only where a colour is set; nothing is removed or rewritten).
INSERT INTO "Color" ("id","name","hex")
SELECT gen_random_uuid()::text, v."color", max(v."colorHex")
FROM "ProductVariant" v WHERE v."color" IS NOT NULL AND v."color" <> ''
GROUP BY v."color"
ON CONFLICT ("name") DO NOTHING;
UPDATE "ProductVariant" v SET "colorId" = c."id" FROM "Color" c WHERE v."color" = c."name" AND v."colorId" IS NULL;
