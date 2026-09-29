# Technical Debt

| # | Item | Found in | Must be fixed in | Notes |
|---|------|----------|------------------|-------|
| 1 | **Coupon usage is not rolled back when an order is cancelled.** `cancelOrder()` restocks inventory but leaves `Coupon.usedCount` and the `CouponUsage` row untouched, so a cancelled order still consumes the coupon's global limit and the customer's per-user limit. | Phase 2 | Order Cancellation / Refund design phase (must be handled together with wallet refunds) | Approved by the product owner to stay open for now. The admin coupon screen shows `usedCount`, so the effect is visible. Fix: in the same transaction as the cancel, delete the order's `CouponUsage` and `UPDATE Coupon SET usedCount = usedCount - 1 WHERE usedCount > 0`; add an e2e test for the per-user limit after cancellation. |
| 2 | Account tickets (`/account/tickets`) are browser-side demo data. | Phase 2 | Phase 4+ (support) | Approved to stay. |
| 3 | Wallet and loyalty are schema-only; not connected to checkout/refund flows. | Phase 2 | later | Approved to stay. Admin shows balances read-only. |
| 4 | Notifications (SMS/e-mail/Telegram) are not delivered; only in-app rows are created. | Phase 2 | later | Approved to stay. |
