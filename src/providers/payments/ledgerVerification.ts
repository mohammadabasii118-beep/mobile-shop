import { prisma } from '../../db/client';
import { PaymentVerificationProvider, VerificationContext, VerificationOutcome } from './types';
import { getSetting } from '../../modules/settings/service';

/**
 * Verifies a payment against a LEDGER of real bank credits (BankTransaction rows), fed by a bank API
 * or an SMS/notification gateway through the signed webhook. A screenshot is never evidence here.
 *
 * Matching (all server-side, using the Order's amount):
 *  - by tracking code (strong): tx.trackingCode == payment.trackingCode, amount equal, SUCCESS, unclaimed
 *  - by amount+time window (weak): exactly one unclaimed SUCCESS tx with equal amount in the window
 * Wrong amount with a matching tracking code => NEEDS_REVIEW. Nothing found => UNKNOWN.
 */
export class LedgerVerificationProvider implements PaymentVerificationProvider {
  readonly name = 'ledger';

  async verifyPayment(ctx: VerificationContext): Promise<VerificationOutcome> {
    const { payment, order } = ctx;
    const base = { provider: this.name };
    const cardLast4 = (await getSetting('card.number')).replace(/\D/g, '').slice(-4);
    const destOk = (d: string | null) => !d || !cardLast4 || d.replace(/\D/g, '').slice(-4) === cardLast4;
    const since = new Date(order.createdAt.getTime() - 10 * 60_000);
    const until = new Date(ctx.now.getTime() + 10 * 60_000);

    if (payment.trackingCode) {
      const txs = await prisma.bankTransaction.findMany({ where: { trackingCode: payment.trackingCode } });
      if (txs.length) {
        const tx = txs.find((t) => t.amount === order.finalAmount) ?? txs[0];
        if (tx.claimedByPaymentId && tx.claimedByPaymentId !== payment.id) {
          return { ...base, result: 'NEEDS_REVIEW', reason: 'bank transaction already used by another payment', evidence: { bankTransactionId: tx.id }, matchedBy: 'tracking' };
        }
        if (tx.status !== 'SUCCESS') return { ...base, result: 'REJECTED', reason: `bank transaction status ${tx.status}`, evidence: { bankTransactionId: tx.id } };
        if (tx.amount !== order.finalAmount) {
          return { ...base, result: 'NEEDS_REVIEW', reason: `amount mismatch: paid ${tx.amount}, expected ${order.finalAmount}`, evidence: { bankTransactionId: tx.id, paid: tx.amount }, matchedBy: 'tracking' };
        }
        if (!destOk(tx.destination)) return { ...base, result: 'NEEDS_REVIEW', reason: 'destination account mismatch', evidence: { bankTransactionId: tx.id } };
        if (tx.occurredAt < since || tx.occurredAt.getTime() > until.getTime()) {
          return { ...base, result: 'NEEDS_REVIEW', reason: 'transaction time outside order window', evidence: { bankTransactionId: tx.id, occurredAt: tx.occurredAt } };
        }
        return { ...base, result: 'VERIFIED', matchedBy: 'tracking', bankTransactionId: tx.id, evidence: { bankTransactionId: tx.id, amount: tx.amount, occurredAt: tx.occurredAt } };
      }
    }

    const windowStart = new Date(Math.max(since.getTime(), ctx.now.getTime() - ctx.timeWindowMinutes * 60_000));
    const cands = (
      await prisma.bankTransaction.findMany({
        where: { amount: order.finalAmount, status: 'SUCCESS', claimedByPaymentId: null, occurredAt: { gte: windowStart, lte: until } },
      })
    ).filter((t) => destOk(t.destination));
    if (cands.length === 1) {
      return { ...base, result: 'VERIFIED', matchedBy: 'amount_time', bankTransactionId: cands[0].id, evidence: { bankTransactionId: cands[0].id, amount: cands[0].amount } };
    }
    if (cands.length > 1) return { ...base, result: 'NEEDS_REVIEW', reason: 'multiple ledger candidates for this amount', matchedBy: 'none' };
    return { ...base, result: 'UNKNOWN', reason: 'no matching bank transaction in ledger (yet)', matchedBy: 'none' };
  }
}

/** Used when verification.provider=none: never claims anything is verified. */
export class NullVerificationProvider implements PaymentVerificationProvider {
  readonly name = 'none';
  async verifyPayment(): Promise<VerificationOutcome> {
    return { provider: this.name, result: 'UNKNOWN', reason: 'no verification provider configured' };
  }
}
