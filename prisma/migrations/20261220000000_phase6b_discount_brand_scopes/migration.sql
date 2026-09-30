-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DiscountScope" ADD VALUE 'PRODUCT_BRAND';
ALTER TYPE "DiscountScope" ADD VALUE 'PHONE_BRAND';


-- Existing BRAND rows are left untouched (legacy: they keep matching product brand OR phone brand). New discounts can only use the two explicit scopes.
