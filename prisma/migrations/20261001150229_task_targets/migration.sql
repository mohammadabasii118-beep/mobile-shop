-- AlterTable
ALTER TABLE "ProvisioningTask" ADD COLUMN     "targetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "targetTrafficLimit" BIGINT;
