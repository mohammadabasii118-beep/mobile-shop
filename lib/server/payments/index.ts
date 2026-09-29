import { cardToCard } from "@/lib/server/payments/card-to-card";
import type { PaymentProvider } from "@/lib/server/payments/types";

const disabled = (key: string, label: string): PaymentProvider => ({
  key, label, description: "به‌زودی", enabled: () => false,
  async instructions() { throw new Error(`${key} is not enabled`); },
});

/** Registry of payment methods. Turn a provider on by implementing it and flipping `enabled()`. */
const registry: PaymentProvider[] = [cardToCard, disabled("snapppay", "اسنپ‌پی"), disabled("torobpay", "ترب‌پی"), disabled("balepay", "بله‌پی")];

export const getEnabledProviders = () => registry.filter((p) => p.enabled());
export const getProvider = (key: string) => registry.find((p) => p.key === key && p.enabled());
