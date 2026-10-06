-- Phone model: optional image and description (managed from the admin panel).
ALTER TABLE "PhoneModel" ADD COLUMN "description" TEXT, ADD COLUMN "image" TEXT;
