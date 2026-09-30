-- Phase 8: e-mail registration + partner sign-up. Relaxing/additive only: no data is changed or removed.

-- Accounts created with e-mail + password have no phone number (the unique index stays; several NULLs are allowed).
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;

-- Partner applications also keep the applicant's e-mail and province.
ALTER TABLE "WholesaleApplication" ADD COLUMN "email" TEXT,
ADD COLUMN "province" TEXT;
