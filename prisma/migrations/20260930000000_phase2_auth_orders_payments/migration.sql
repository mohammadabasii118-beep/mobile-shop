-- Rename (keeps existing rows): payment status UNPAID -> PENDING
ALTER TYPE "PaymentStatus" RENAME VALUE 'UNPAID' TO 'PENDING';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'card_to_card',
ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "priceType" TEXT NOT NULL DEFAULT 'retail';

-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'login';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'card_to_card',
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);


-- Customer-facing order numbers start at 30001
SELECT setval(pg_get_serial_sequence('"Order"', 'number'), GREATEST(COALESCE((SELECT MAX("number") FROM "Order"), 0), 30000));
