import { Order, Payment, PaymentMethod, PaymentStatus, VerificationStatus } from '@prisma/client';
import { ReceiptData } from '../../modules/payments/receipt';

export interface PaymentInstructions {
  method: PaymentMethod;
  lines: { label: string; value: string }[];
  text: string;
}

export interface SubmitInput {
  receiptFileId?: string;
  receiptPath?: string;
  receiptHash?: string;
  trackingCode?: string;
  receiptData?: ReceiptData;
  submittedAmount?: number;
  txHash?: string;
}

export interface PaymentProvider {
  readonly method: PaymentMethod;
  isEnabled(): Promise<boolean>;
  createPayment(order: Order): Promise<{ payment: Payment; instructions: PaymentInstructions }>;
  submitPayment(paymentId: string, input: SubmitInput): Promise<Payment>;
  verifyPayment(paymentId: string): Promise<VerificationOutcome>;
  getStatus(paymentId: string): Promise<PaymentStatus>;
  cancelPayment(paymentId: string): Promise<void>;
}

export interface VerificationOutcome {
  result: VerificationStatus;
  provider: string;
  reason?: string;
  evidence?: Record<string, unknown>;
  matchedBy?: 'tracking' | 'amount_time' | 'none';
  bankTransactionId?: string;
}

/** Context handed to verification providers; amounts always come from the Order (server side). */
export interface VerificationContext {
  payment: Payment;
  order: Order;
  now: Date;
  timeWindowMinutes: number;
}

export interface PaymentVerificationProvider {
  readonly name: string;
  verifyPayment(ctx: VerificationContext): Promise<VerificationOutcome>;
}
