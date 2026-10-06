-- Phase 3: admin panel support.
ALTER TABLE "InventoryMovement" ADD COLUMN "balanceAfter" INTEGER;
CREATE INDEX "AdminLog_adminId_idx" ON "AdminLog"("adminId");

-- New permissions (idempotent) granted to the two all-access roles.
INSERT INTO "Permission" ("id","key","label") VALUES
  (gen_random_uuid()::text,'wallet.read','مشاهده کیف پول'),
  (gen_random_uuid()::text,'loyalty.read','مشاهده امتیاز وفاداری'),
  (gen_random_uuid()::text,'support.read','مشاهده پشتیبانی')
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id", p."id" FROM "Role" r, "Permission" p
WHERE r."key" IN ('super_admin','admin') AND p."key" IN ('wallet.read','loyalty.read','support.read')
ON CONFLICT DO NOTHING;

-- The audit log is append-only at the database level: no DELETE, and UPDATE only to null the admin link
-- (which ON DELETE SET NULL performs if a user row is ever removed).
CREATE OR REPLACE FUNCTION adminlog_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'AdminLog is append-only'; END IF;
  IF NEW."adminId" IS NULL AND OLD."adminId" IS NOT NULL
     AND NEW."id" = OLD."id" AND NEW."action" = OLD."action" AND NEW."entity" = OLD."entity"
     AND NEW."entityId" IS NOT DISTINCT FROM OLD."entityId"
     AND NEW."oldValue" IS NOT DISTINCT FROM OLD."oldValue" AND NEW."newValue" IS NOT DISTINCT FROM OLD."newValue"
     AND NEW."ip" IS NOT DISTINCT FROM OLD."ip" AND NEW."createdAt" = OLD."createdAt" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'AdminLog is append-only';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER adminlog_no_update BEFORE UPDATE ON "AdminLog" FOR EACH ROW EXECUTE FUNCTION adminlog_immutable();
CREATE TRIGGER adminlog_no_delete BEFORE DELETE ON "AdminLog" FOR EACH ROW EXECUTE FUNCTION adminlog_immutable();
