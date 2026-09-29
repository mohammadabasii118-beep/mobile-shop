"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartContext";
import { fmtToman } from "@/lib/format";

export default function CheckoutPage() {
  const { lines, total, clearCart } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ shippingName: "", shippingPhone: "", shippingAddress: "", shippingCity: "", shippingPostal: "", discountCode: "" });
  const [paymentMethod, setPaymentMethod] = useState<"ZARINPAL" | "CARD_TRANSFER" | "WALLET">("ZARINPAL");
  // null = not logged in (or not checked yet) → wallet/loyalty options
  // hidden entirely, never shown as a fake/disabled option for a guest.
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);
  // Partial wallet contribution, usable alongside ZARINPAL/CARD_TRANSFER.
  // Purely a UI convenience number — the server re-clamps this to the real
  // balance and the real order total, so a stale/manipulated value here can
  // never cost the customer more or debit more than what's actually owed.
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmountInput, setWalletAmountInput] = useState(0);
  const [redeemPointsInput, setRedeemPointsInput] = useState(0);

  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((d) => {
        setWalletBalance(d.balance);
        setLoyaltyPoints(d.loyaltyPoints);
      })
      .catch(() => {
        setWalletBalance(null);
        setLoyaltyPoints(null);
      });
  }, []);

  const walletCoversTotal = walletBalance !== null && walletBalance >= total;
  // Client-side estimate only, for display — the server independently
  // re-clamps to the real balance and MAX_LOYALTY_DISCOUNT_SHARE of the
  // real (server-computed) order total before ever touching the database.
  const maxRedeemablePointsEstimate = loyaltyPoints !== null ? Math.max(0, Math.min(loyaltyPoints, Math.floor((total * 0.5) / 1000))) : 0;

  if (lines.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-lg font-bold mb-2">سبد خرید شما خالی است</p>
        <a href="/" className="inline-block mt-4 px-8 h-12 leading-[48px] rounded-full text-white font-bold" style={{ background: "var(--ink)" }}>بازگشت به فروشگاه</a>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, quantity: l.qty })),
          ...form,
          paymentMethod,
          useWalletAmount: paymentMethod !== "WALLET" && useWallet ? walletAmountInput : 0,
          redeemPoints: redeemPointsInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "خطایی رخ داد"); setLoading(false); return; }
      clearCart();
      if (data.walletPaid) {
        router.push(`/checkout/success?order=${data.orderNumber}&status=paid`);
      } else if (data.cardTransfer) {
        const q = data.guestToken ? `?t=${encodeURIComponent(data.guestToken)}` : "";
        router.push(`/checkout/card-transfer/${data.orderId}${q}`);
      } else if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        router.push(`/checkout/success?order=${data.orderNumber}${data.paymentError ? "&status=pending" : ""}`);
      }
    } catch {
      setError("خطا در ارتباط با سرور");
      setLoading(false);
    }
  }

  const field = (name: keyof typeof form, label: string, type = "text") => (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input
        required={name !== "shippingPostal" && name !== "discountCode"}
        type={type}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none"
      />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      <h1 className="text-2xl font-extrabold mb-6">تکمیل خرید</h1>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-4 mb-8">
        {field("shippingName", "نام و نام‌خانوادگی گیرنده")}
        {field("shippingPhone", "شماره موبایل", "tel")}
        <div className="md:col-span-2">{field("shippingAddress", "آدرس کامل")}</div>
        {field("shippingCity", "شهر")}
        {field("shippingPostal", "کد پستی (اختیاری)")}
        <div className="md:col-span-2">{field("discountCode", "کد تخفیف (اختیاری)")}</div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium block mb-2">روش پرداخت</label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label
              className="flex items-center gap-3 border line rounded-xl p-3 cursor-pointer"
              style={paymentMethod === "ZARINPAL" ? { borderColor: "var(--ink)" } : undefined}
            >
              <input type="radio" name="paymentMethod" checked={paymentMethod === "ZARINPAL"} onChange={() => setPaymentMethod("ZARINPAL")} />
              <div>
                <div className="text-sm font-medium">پرداخت آنلاین (زرین‌پال)</div>
                <div className="text-xs muted">پرداخت امن و آنی از طریق درگاه بانکی</div>
              </div>
            </label>
            <label
              className="flex items-center gap-3 border line rounded-xl p-3 cursor-pointer"
              style={paymentMethod === "CARD_TRANSFER" ? { borderColor: "var(--ink)" } : undefined}
            >
              <input type="radio" name="paymentMethod" checked={paymentMethod === "CARD_TRANSFER"} onChange={() => setPaymentMethod("CARD_TRANSFER")} />
              <div>
                <div className="text-sm font-medium">کارت‌به‌کارت</div>
                <div className="text-xs muted">واریز به کارت و ارسال رسید، تأیید دستی توسط مدیر</div>
              </div>
            </label>
            {walletBalance !== null && walletBalance > 0 && (
              <label
                className="flex items-center gap-3 border line rounded-xl p-3 cursor-pointer"
                style={
                  !walletCoversTotal
                    ? { opacity: 0.5, cursor: "not-allowed" }
                    : paymentMethod === "WALLET"
                    ? { borderColor: "var(--ink)" }
                    : undefined
                }
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "WALLET"}
                  disabled={!walletCoversTotal}
                  onChange={() => setPaymentMethod("WALLET")}
                />
                <div>
                  <div className="text-sm font-medium">پرداخت از کیف پول ({fmtToman(walletBalance)})</div>
                  <div className="text-xs muted">
                    {walletCoversTotal ? "پرداخت آنی و کامل، بدون نیاز به درگاه" : "موجودی کیف پول برای این سفارش کافی نیست"}
                  </div>
                </div>
              </label>
            )}
          </div>
        </div>

        {loyaltyPoints !== null && loyaltyPoints > 0 && (
          <div className="md:col-span-2 border line rounded-xl p-3">
            <label className="text-sm font-medium block mb-1">استفاده از امتیاز باشگاه مشتریان (موجودی: {loyaltyPoints} امتیاز)</label>
            <input
              type="number"
              min={0}
              max={maxRedeemablePointsEstimate}
              value={redeemPointsInput}
              onChange={(e) => setRedeemPointsInput(Math.max(0, Math.min(Number(e.target.value) || 0, maxRedeemablePointsEstimate)))}
              className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none"
            />
            <p className="text-xs muted mt-1">هر امتیاز معادل ۱٬۰۰۰ تومان تخفیف است؛ حداکثر تا سقف {maxRedeemablePointsEstimate} امتیاز برای این سفارش قابل استفاده است.</p>
          </div>
        )}

        {walletBalance !== null && walletBalance > 0 && paymentMethod !== "WALLET" && (
          <div className="md:col-span-2 border line rounded-xl p-3">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <input
                type="checkbox"
                checked={useWallet}
                onChange={(e) => {
                  setUseWallet(e.target.checked);
                  if (e.target.checked) setWalletAmountInput(Math.min(walletBalance, total));
                }}
              />
              استفاده از بخشی از کیف پول ({fmtToman(walletBalance)}) در کنار این روش پرداخت
            </label>
            {useWallet && (
              <input
                type="number"
                min={0}
                max={Math.min(walletBalance, total)}
                value={walletAmountInput}
                onChange={(e) => setWalletAmountInput(Math.max(0, Math.min(Number(e.target.value) || 0, walletBalance, total)))}
                className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none"
              />
            )}
          </div>
        )}

        {error && <p className="md:col-span-2 text-sm" style={{ color: "#a24e56" }}>{error}</p>}
        <div className="md:col-span-2 flex items-center justify-between border-t line pt-6 mt-2">
          <span className="font-bold text-lg">جمع کل: {fmtToman(total)}</span>
          <button disabled={loading} className="px-8 h-12 rounded-full text-white font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
            {loading
              ? "در حال ثبت…"
              : paymentMethod === "CARD_TRANSFER"
              ? "ثبت سفارش"
              : paymentMethod === "WALLET"
              ? "پرداخت از کیف پول"
              : "پرداخت و ثبت سفارش"}
          </button>
        </div>
      </form>
    </div>
  );
}
