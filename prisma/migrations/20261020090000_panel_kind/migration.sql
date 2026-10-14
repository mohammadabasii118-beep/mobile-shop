-- AlterTable
ALTER TABLE "Panel" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'xui',
ADD COLUMN "options" JSONB;
