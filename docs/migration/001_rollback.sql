-- Rollback for 001_super_admin_and_design_tables.sql.
-- Run ONLY after taking a fresh backup. Design content (banners, layouts, media rows) is lost;
-- uploaded files on disk are not touched. Orders/products/users are not affected.
BEGIN;

-- 1) No account may still hold the new role.
UPDATE "User" SET "role" = 'ADMIN' WHERE "role" = 'SUPER_ADMIN';
UPDATE "SupportMessage" SET "senderRole" = 'ADMIN' WHERE "senderRole" = 'SUPER_ADMIN';

-- 2) Drop the additive tables (children first).
DROP TABLE IF EXISTS "DesignAuditLog";
DROP TABLE IF EXISTS "PageLayout";
DROP TABLE IF EXISTS "ThemeSettings";
DROP TABLE IF EXISTS "MotionSetting";
DROP TABLE IF EXISTS "DesignBanner";
DROP TABLE IF EXISTS "MediaAsset";
DROP TYPE IF EXISTS "MotionMode";
DROP TYPE IF EXISTS "BannerPlacement";
DROP TYPE IF EXISTS "DesignStatus";
DROP TYPE IF EXISTS "MediaKind";

-- 3) PostgreSQL cannot DROP a single enum value. Rebuild "Role" without SUPER_ADMIN.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN', 'STAFF');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
ALTER TABLE "SupportMessage" ALTER COLUMN "senderRole" TYPE "Role" USING ("senderRole"::text::"Role");
DROP TYPE "Role_old";

COMMIT;
