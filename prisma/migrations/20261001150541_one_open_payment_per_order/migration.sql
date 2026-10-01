-- At most one open (not yet decided) payment per order: prevents double-submit races.
CREATE UNIQUE INDEX "Payment_one_open_per_order" ON "Payment"("orderId") WHERE "status" IN ('PENDING', 'SUBMITTED', 'NEEDS_REVIEW');
