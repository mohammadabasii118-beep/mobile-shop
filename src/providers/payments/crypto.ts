import { Order, PaymentStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { getBool } from '../../modules/settings/service';
import { ValidationError } from '../../utils/errors';
import { PaymentProvider, SubmitInput, VerificationOutcome } from './types';

/** Real on-chain verifier contract (to be implemented per network: USDT-TRC20, TON, BTC...). */
export interface ChainVerifier {
  readonly networks: string[];
  verifyTransfer(q: { network: string; asset: string; address: string; amount: string; txHash: string }): Promise<{
    found: boolean; confirmed: boolean; confirmations: number; amount?: string; toAddress?: string;
  }>;
}

/**
 * Architecture only. Stays DISABLED until a real ChainVerifier is registered AND crypto.enabled=true.
 * Screenshots are never accepted as proof for crypto.
 */
export class CryptoPaymentProvider implements PaymentProvider {
  readonly method = 'CRYPTO' as const;
  constructor(private verifier?: ChainVerifier) {}

  async isEnabled() {
    return !!this.verifier && (await getBool('crypto.enabled'));
  }
  async createPayment(_order: Order): Promise<never> {
    throw new ValidationError('پرداخت کریپتو هنوز پیکربندی نشده است');
  }
  async submitPayment(paymentId: string, input: SubmitInput) {
    if (!(await this.isEnabled())) throw new ValidationError('crypto disabled');
    return prisma.payment.update({ where: { id: paymentId }, data: { txHash: input.txHash, submittedAt: new Date(), status: 'SUBMITTED' } });
  }
  async verifyPayment(paymentId: string): Promise<VerificationOutcome> {
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (!this.verifier || !p.txHash || !p.network || !p.asset || !p.address || !p.cryptoAmount) {
      return { provider: 'crypto', result: 'UNKNOWN', reason: 'no chain verifier / missing tx data' };
    }
    const r = await this.verifier.verifyTransfer({ network: p.network, asset: p.asset, address: p.address, amount: p.cryptoAmount, txHash: p.txHash });
    if (!r.found) return { provider: 'crypto', result: 'UNKNOWN', reason: 'tx not found' };
    if (r.toAddress !== p.address || r.amount !== p.cryptoAmount) return { provider: 'crypto', result: 'NEEDS_REVIEW', reason: 'destination/amount mismatch' };
    return r.confirmed ? { provider: 'crypto', result: 'VERIFIED', matchedBy: 'tracking', evidence: { confirmations: r.confirmations } } : { provider: 'crypto', result: 'UNKNOWN', reason: 'not enough confirmations' };
  }
  async getStatus(paymentId: string): Promise<PaymentStatus> {
    return (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status;
  }
  async cancelPayment(paymentId: string) {
    await prisma.payment.updateMany({ where: { id: paymentId, status: { in: ['PENDING', 'SUBMITTED'] } }, data: { status: 'CANCELLED' } });
  }
}
