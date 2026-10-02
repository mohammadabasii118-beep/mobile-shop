/** معماری پرداخت Provider-based — فعلاً هیچ درگاه واقعی متصل نیست. */
export interface PaymentRequest { orderId: string; amount: number; description?: string; callbackUrl?: string }
export interface PaymentResult { paymentId: string; status: PaymentStatus; redirectUrl?: string }
export type PaymentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'refunded';

export interface PaymentProvider {
  id: string;
  title: string;
  createPayment(req: PaymentRequest): Promise<PaymentResult>;
  verifyPayment(paymentId: string): Promise<PaymentResult>;
  refundPayment(paymentId: string, amount?: number): Promise<PaymentResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
}

/** Provider دمو برای توسعه */
export class MockPaymentProvider implements PaymentProvider {
  id = 'mock';
  title = 'پرداخت آنلاین (دمو)';
  private store = new Map<string, PaymentStatus>();
  async createPayment(req: PaymentRequest) {
    const paymentId = `PAY-${req.orderId}-${Date.now()}`;
    this.store.set(paymentId, 'pending');
    return { paymentId, status: 'pending' as const };
  }
  async verifyPayment(paymentId: string) { this.store.set(paymentId, 'paid'); return { paymentId, status: 'paid' as const }; }
  async refundPayment(paymentId: string) { this.store.set(paymentId, 'refunded'); return { paymentId, status: 'refunded' as const }; }
  async getPaymentStatus(paymentId: string) { return this.store.get(paymentId) ?? 'created'; }
}

/** BNPL و سایر سرویس‌ها: بعداً با پیاده‌سازی PaymentProvider اضافه می‌شوند (SnappPay, TorobPay, BalePay) */
const registry = new Map<string, PaymentProvider>();
export const registerProvider = (p: PaymentProvider) => registry.set(p.id, p);
export const getProvider = (id: string) => registry.get(id);
registerProvider(new MockPaymentProvider());
