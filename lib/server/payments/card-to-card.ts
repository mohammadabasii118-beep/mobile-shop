import { db } from "@/lib/db";
import type { PaymentInstructions, PaymentProvider } from "@/lib/server/payments/types";
import { formatToman } from "@/lib/utils";

export interface PaymentSettings {
  bankName: string;
  accountHolder: string;
  cardNumber: string;
  accountNumber: string;
  iban: string;
  description: string;
}

/** Bank details are edited from the admin panel (SiteSetting "payment"), never hard-coded. */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const row = await db.siteSetting.findUnique({ where: { key: "payment" } });
  const v = (row?.value ?? {}) as Partial<PaymentSettings>;
  return { bankName: v.bankName ?? "", accountHolder: v.accountHolder ?? "", cardNumber: v.cardNumber ?? "", accountNumber: v.accountNumber ?? "", iban: v.iban ?? "", description: v.description ?? "" };
}

export const cardToCard: PaymentProvider = {
  key: "card_to_card",
  label: "کارت به کارت",
  description: "واریز به کارت فروشگاه و ارسال رسید پرداخت",
  enabled: () => true,
  async instructions(order): Promise<PaymentInstructions> {
    const s = await getPaymentSettings();
    const fields = [
      { label: "مبلغ قابل پرداخت", value: formatToman(order.total), copy: false },
      { label: "بانک", value: s.bankName },
      { label: "به نام", value: s.accountHolder },
      { label: "شماره کارت", value: s.cardNumber, copy: true },
      { label: "شماره حساب", value: s.accountNumber, copy: true },
      { label: "شماره شبا", value: s.iban, copy: true },
    ].filter((f) => f.value.trim());
    return { title: "پرداخت کارت به کارت", fields, note: s.description || undefined, requiresReceipt: true };
  },
};
