import { Order, PaymentStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { getBool, getSetting } from '../../modules/settings/service';
import { formatMoney } from '../../utils/misc';
import { ValidationError } from '../../utils/errors';
import { PaymentInstructions, PaymentProvider, SubmitInput, VerificationOutcome } from './types';

export class CardToCardProvider implements PaymentProvider {
  readonly method = 'CARD_TO_CARD' as const;
  constructor(private verify: (paymentId: string) => Promise<VerificationOutcome>) {}

  isEnabled() {
    return getBool('card.enabled');
  }

  async createPayment(order: Order) {
    if (!(await this.isEnabled())) throw new ValidationError('کارت‌به‌کارت غیرفعال است');
    const [holder, number, bank, extra] = await Promise.all([getSetting('card.holder'), getSetting('card.number'), getSetting('card.bank'), getSetting('card.instructions')]);
    if (!number) throw new ValidationError('شماره کارت تنظیم نشده است');
    // Amount is ALWAYS read from the order, never from the client.
    const open = () => prisma.payment.findFirst({ where: { orderId: order.id, status: 'PENDING' } });
    let payment = await open();
    if (!payment) {
      try {
        payment = await prisma.payment.create({
          data: { orderId: order.id, userId: order.userId, provider: this.method, amount: order.finalAmount, currency: order.currency },
        });
      } catch (e: any) {
        // partial unique index: another open payment exists (race) — reuse the pending one if any
        if (e?.code !== 'P2002') throw e;
        payment = await open();
        if (!payment) throw new ValidationError('برای این سفارش پرداخت دیگری در حال بررسی است');
      }
    }
    const lines = [
      { label: 'مبلغ دقیق', value: formatMoney(order.finalAmount, order.currency) },
      { label: 'شماره کارت', value: number },
      { label: 'به نام', value: holder },
      { label: 'بانک', value: bank },
    ].filter((l) => l.value);
    const text = lines.map((l) => `${l.label}: ${l.value}`).join('\n') + (extra ? `\n\n${extra}` : '');
    const instructions: PaymentInstructions = { method: this.method, lines, text };
    return { payment, instructions };
  }

  async submitPayment(paymentId: string, input: SubmitInput) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        receiptFileId: input.receiptFileId, receiptPath: input.receiptPath, receiptHash: input.receiptHash,
        trackingCode: input.trackingCode, receiptData: input.receiptData as any, submittedAmount: input.submittedAmount,
        submittedAt: new Date(), status: 'SUBMITTED',
      },
    });
  }

  verifyPayment(paymentId: string) {
    return this.verify(paymentId);
  }

  async getStatus(paymentId: string): Promise<PaymentStatus> {
    return (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status;
  }

  async cancelPayment(paymentId: string) {
    await prisma.payment.updateMany({ where: { id: paymentId, status: { in: ['PENDING', 'SUBMITTED'] } }, data: { status: 'CANCELLED' } });
  }
}
