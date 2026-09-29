import type { Order } from "@/lib/generated/prisma/client";

export interface PaymentInstructions {
  title: string;
  fields: { label: string; value: string; copy?: boolean }[];
  note?: string;
  /** Whether the customer must upload a receipt (manual methods) or is redirected (gateways). */
  requiresReceipt: boolean;
}

/**
 * Every payment method implements this. Gateways such as SnappPay, TorobPay or BalePay plug in here
 * later (createPayment → redirect URL, verify callback) without touching checkout or order code.
 */
export interface PaymentProvider {
  key: string;
  label: string;
  description: string;
  /** Disabled providers are registered but never offered at checkout. */
  enabled(): boolean;
  instructions(order: Pick<Order, "number" | "total">): Promise<PaymentInstructions>;
}
