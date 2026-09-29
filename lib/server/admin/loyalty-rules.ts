import { z } from "zod";

const int = (min: number, max: number, def: number) => z.coerce.number().int().min(min).max(max).default(def);

/** Loyalty rules are edited from the admin settings page (SiteSetting key "loyalty"). */
export const loyaltySchema = z.object({
  enabled: z.boolean().default(true),
  amountPerPoint: int(1, 100_000_000, 10_000), // Toman of qualifying goods per 1 point
  earnOn: z.enum(["payment", "delivery"]).default("payment"), // when points are granted
  minOrderTotal: int(0, 2_000_000_000, 0), // qualifying goods amount below which no points are earned
  redeemEnabled: z.boolean().default(true),
  pointValue: int(1, 1_000_000, 100), // Toman discount per redeemed point
  minRedeemPoints: int(1, 1_000_000, 100),
  maxRedeemPercent: int(1, 100, 30), // max share of the retail goods (after coupon) payable with points
});
export const LOYALTY_DEFAULTS = loyaltySchema.parse({});
