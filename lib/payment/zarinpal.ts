import type { PaymentProvider, PaymentRequest, PaymentRequestResult, PaymentVerifyResult } from "./index";

const SANDBOX = process.env.ZARINPAL_SANDBOX === "true";
const BASE = SANDBOX ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com";
const STARTPAY_BASE = SANDBOX ? "https://sandbox.zarinpal.com/pg/StartPay" : "https://www.zarinpal.com/pg/StartPay";

// Zarinpal expects amounts in Rial. The store's prices are in Toman.
const toRial = (toman: number) => toman * 10;

export const zarinpalProvider: PaymentProvider = {
  async requestPayment(req: PaymentRequest): Promise<PaymentRequestResult> {
    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    if (!merchantId) return { ok: false, error: "ZARINPAL_MERCHANT_ID تنظیم نشده است" };

    try {
      const res = await fetch(`${BASE}/pg/v4/payment/request.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: merchantId,
          amount: toRial(req.amountToman),
          description: req.description,
          callback_url: req.callbackUrl,
          metadata: { order_id: req.orderId },
        }),
      });
      const data = await res.json();
      if (data?.data?.code === 100) {
        const authority = data.data.authority;
        return { ok: true, authority, redirectUrl: `${STARTPAY_BASE}/${authority}` };
      }
      return { ok: false, error: data?.errors?.message || "خطا در اتصال به درگاه پرداخت" };
    } catch (e) {
      return { ok: false, error: "عدم دسترسی به درگاه پرداخت" };
    }
  },

  async verifyPayment(authority: string, amountToman: number): Promise<PaymentVerifyResult> {
    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    if (!merchantId) return { ok: false, error: "ZARINPAL_MERCHANT_ID تنظیم نشده است" };
    try {
      const res = await fetch(`${BASE}/pg/v4/payment/verify.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_id: merchantId, amount: toRial(amountToman), authority }),
      });
      const data = await res.json();
      if (data?.data?.code === 100 || data?.data?.code === 101) {
        return { ok: true, refId: String(data.data.ref_id) };
      }
      return { ok: false, error: data?.errors?.message || "پرداخت تایید نشد" };
    } catch (e) {
      return { ok: false, error: "عدم دسترسی به درگاه پرداخت" };
    }
  },
};
