-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'VARIABLE');

-- AlterTable
ALTER TABLE "PhoneModel" ADD COLUMN     "seriesId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'SIMPLE';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "imageId" TEXT,
ADD COLUMN     "salePrice" INTEGER;

-- CreateTable
CREATE TABLE "PhoneSeries" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PhoneSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attribute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "systemKey" TEXT,
    "usedForVariants" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeValue" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "hex" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeValue" (
    "productId" TEXT NOT NULL,
    "valueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("productId","valueId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneSeries_slug_key" ON "PhoneSeries"("slug");

-- CreateIndex
CREATE INDEX "PhoneSeries_brandId_sortOrder_idx" ON "PhoneSeries"("brandId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_slug_key" ON "Attribute"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_systemKey_key" ON "Attribute"("systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeValue_attributeId_value_key" ON "AttributeValue"("attributeId", "value");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_valueId_idx" ON "ProductAttributeValue"("valueId");

-- CreateIndex
CREATE INDEX "PhoneModel_seriesId_idx" ON "PhoneModel"("seriesId");

-- AddForeignKey
ALTER TABLE "PhoneModel" ADD CONSTRAINT "PhoneModel_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "PhoneSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneSeries" ADD CONSTRAINT "PhoneSeries_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "AttributeValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ProductImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Data step (only sets the new column / seeds the two system attributes; nothing existing is changed):
-- products that already use model/colour axes or have more than one variant become VARIABLE, everything else stays SIMPLE.
UPDATE "Product" p SET "productType" = 'VARIABLE'
WHERE EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id" AND (v."phoneModelId" IS NOT NULL OR v."colorId" IS NOT NULL))
   OR (SELECT COUNT(*) FROM "ProductVariant" v WHERE v."productId" = p."id") > 1;

INSERT INTO "Attribute" ("id", "name", "slug", "isSystem", "systemKey", "usedForVariants", "sortOrder")
VALUES ('attr_system_model', 'مدل گوشی', 'model', true, 'model', true, 0),
       ('attr_system_color', 'رنگ', 'color', true, 'color', true, 1)
ON CONFLICT DO NOTHING;
