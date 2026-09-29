-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'ANIMATION');

-- CreateEnum
CREATE TYPE "DesignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('HERO', 'PROMO', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "MotionMode" AS ENUM ('OFF', 'CSS', 'THREE_D', 'VIDEO', 'ANIMATION');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "alt" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignBanner" (
    "id" TEXT NOT NULL,
    "placement" "BannerPlacement" NOT NULL DEFAULT 'HERO',
    "status" "DesignStatus" NOT NULL DEFAULT 'DRAFT',
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "primaryLabel" TEXT,
    "primaryUrl" TEXT,
    "secondaryLabel" TEXT,
    "secondaryUrl" TEXT,
    "desktopImageId" TEXT,
    "mobileImageId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mode" "MotionMode" NOT NULL DEFAULT 'CSS',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "assetId" TEXT,
    "posterId" TEXT,
    "params" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotionSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "logoLight" TEXT,
    "logoDark" TEXT,
    "favicon" TEXT,
    "colors" JSONB,
    "brandTexts" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageLayout" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "status" "DesignStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL,
    "blocks" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "PageLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignBanner_placement_status_isActive_order_idx" ON "DesignBanner"("placement", "status", "isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MotionSetting_key_key" ON "MotionSetting"("key");

-- CreateIndex
CREATE INDEX "PageLayout_pageKey_status_idx" ON "PageLayout"("pageKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PageLayout_pageKey_version_key" ON "PageLayout"("pageKey", "version");

-- CreateIndex
CREATE INDEX "DesignAuditLog_entity_createdAt_idx" ON "DesignAuditLog"("entity", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignBanner" ADD CONSTRAINT "DesignBanner_desktopImageId_fkey" FOREIGN KEY ("desktopImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignBanner" ADD CONSTRAINT "DesignBanner_mobileImageId_fkey" FOREIGN KEY ("mobileImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionSetting" ADD CONSTRAINT "MotionSetting_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionSetting" ADD CONSTRAINT "MotionSetting_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageLayout" ADD CONSTRAINT "PageLayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

