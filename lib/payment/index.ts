/**
 * Payment adapter interface.
 * To switch gateways (IDPay, NextPay, PayPing, ...), implement this interface
 * in a new file under lib/payment/ and change the export in this file.
 * Nothing else in the app needs to change.
 */
export interface PaymentRequest {
  orderId: string;
  orderNumber: string;
  amountToman: number;
  description: string;
  callbackUrl: string;
}

export interface PaymentRequestResult {
  ok: boolean;
  authority?: string; // gateway transaction token
  redirectUrl?: string; // where to send the customer to pay
  error?: string;
}

export interface PaymentVerifyResult {
  ok: boolean;
  refId?: string; // gateway's confirmed payment reference id
  error?: string;
}

export interface PaymentProvider {
  requestPayment(req: PaymentRequest): Promise<PaymentRequestResult>;
  verifyPayment(authority: string, amountToman: number): Promise<PaymentVerifyResult>;
}

import { zarinpalProvider } from "./zarinpal";

// Active gateway. Swap this line to change provider app-wide.
export const paymentProvider: PaymentProvider = zarinpalProvider;
