"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, MapPin, Plus, Ticket, Truck } from "lucide-react";
import { api } from "@/lib/client/api";
import { formatToman, toFa } from "@/lib/utils";

interface Address { id: string; title: string | null; receiver: string; phone: string; province: string; city: string; postalCode: string | null; address: string; isDefault: boolean }
interface Quote {
  lines: { name: string; option: string | null; quantity: number; unitPrice: number; total: number; priceType: string; inStock: boolean }[];
  subtotal: number; discount: number; couponCode: string | null; couponError: string | null;
  shippingMethods: { id: string; name: string; description: string | null; cost: number; freeThreshold: number | null }[];
  shipping: number; total: number; issues: string[]; isWholesale: boolean;
}
interface Provider { key: string; label: string; description: string }

const field = "h-11 w-full rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none transition-colors focus:border-primary";
const card = "rounded-[28px] border border-border bg-surface p-5 shadow-md sm:p-6";

export function CheckoutClient({ initialAddresses, providers, initialCoupon }: { initialAddresses: Address[]; providers: Provider[]; initialCoupon: string | null }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id ?? "");
  const [adding, setAdding] = useState(initialAddresses.length === 0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [empty, setEmpty] = useState(false);
  const [shippingId, setShippingId] = useState("");
  const [couponInput, setCouponInput] = useState(initialCoupon ?? "");
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [payment, setPayment] = useState(providers[0]?.key ?? "card_to_card");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ receiver: "", phone: "", province: "", city: "", postalCode: "", address: "" });
  const [addrErr, setAddrErr] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  // Fetch the server-computed quote whenever the shipping method, coupon or cart changes.
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await api<Quote>("GET", `/api/checkout/quote${shippingId ? `?shippingMethodId=${encodeURIComponent(shippingId)}` : ""}`);
      if (!alive) return;
      if (!r.ok) { if (r.error.code === "cart_empty") setEmpty(true); else setErr(r.error.message); return; }
      setQuote(r.data);
      setShippingId((cur) => cur || r.data.shippingMethods[0]?.id || "");
    })();
    return () => { alive = false; };
  }, [shippingId, refreshKey]);

  async function applyCoupon() {
    setCouponMsg(null);
    const r = await api("POST", "/api/cart/coupon", { code: couponInput });
    if (!r.ok) return setCouponMsg({ ok: false, text: r.error.message });
    setCouponMsg({ ok: true, text: "کد تخفیف اعمال شد." });
    refresh();
  }
  async function removeCoupon() {
    await api("DELETE", "/api/cart/coupon");
    setCouponInput(""); setCouponMsg(null);
    refresh();
  }
  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddrErr("");
    const r = await api<Address>("POST", "/api/addresses", { ...form, postalCode: form.postalCode || undefined });
    if (!r.ok) return setAddrErr(r.error.message);
    setAddresses((a) => [r.data, ...a]); setAddressId(r.data.id); setAdding(false);
    setForm({ receiver: "", phone: "", province: "", city: "", postalCode: "", address: "" });
  }
  async function place() {
    setErr("");
    if (!addressId) return setErr("آدرس تحویل را انتخاب کنید.");
    if (!shippingId) return setErr("روش ارسال را انتخاب کنید.");
    setBusy(true);
    const r = await api<{ number: number }>("POST", "/api/checkout/orders", { addressId, shippingMethodId: shippingId, paymentMethod: payment, note: note || undefined, couponCode: quote?.couponCode ?? undefined });
    if (r.ok) { window.dispatchEvent(new Event("cl:cart-changed")); // Full navigation so the header cart badge and server data are fresh.
 // eslint-disable-next-line @next/next/no-location-assign-relative-destination
 window.location.href = `/account/orders/${r.data.number}`; return; }
    setBusy(false); setErr(r.error.message);
    refresh();
  }

  if (empty) return <div className={`${card} mx-auto max-w-md text-center`}><p className="text-sm text-muted">سبد خرید شما خالی است.</p><Link href="/shop" className="mt-4 flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-fg">مشاهده فروشگاه</Link></div>;

  const F = (k: keyof typeof form, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block space-y-1.5 text-xs font-medium"><span>{label}</span><input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={field} {...extra} /></label>
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <section className={card}>
          <h2 className="mb-4 flex items-center gap-2 text-base font-black"><MapPin className="size-5 text-primary" />آدرس تحویل</h2>
          <div className="space-y-2">
            {addresses.map((a) => (
              <label key={a.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-[13px] leading-6 ${addressId === a.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1.5 accent-[var(--primary)]" />
                <span><b>{a.receiver}</b> <span dir="ltr" className="text-muted">{a.phone}</span><br /><span className="text-muted">{a.province}، {a.city}، {a.address}</span></span>
              </label>
            ))}
          </div>
          {!adding && <button type="button" onClick={() => setAdding(true)} className="mt-3 flex cursor-pointer items-center gap-1.5 text-xs font-bold text-primary"><Plus className="size-4" />افزودن آدرس جدید</button>}
          {adding && (
            <form onSubmit={saveAddress} className="mt-4 space-y-3 rounded-2xl bg-surface-2 p-4">
              <div className="grid gap-3 sm:grid-cols-2">{F("receiver", "نام گیرنده", { required: true })}{F("phone", "شماره تماس", { required: true, dir: "ltr", inputMode: "tel", placeholder: "09xxxxxxxxx" })}{F("province", "استان", { required: true })}{F("city", "شهر", { required: true })}</div>
              {F("postalCode", "کد پستی (اختیاری)", { dir: "ltr", inputMode: "numeric" })}
              <label className="block space-y-1.5 text-xs font-medium"><span>آدرس کامل</span><textarea required rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`${field} h-auto py-3`} /></label>
              <p role="alert" className="min-h-4 text-xs text-hot">{addrErr}</p>
              <div className="flex gap-2"><button type="submit" className="h-11 flex-1 cursor-pointer rounded-xl bg-primary text-sm font-bold text-primary-fg">ذخیره آدرس</button>{addresses.length > 0 && <button type="button" onClick={() => setAdding(false)} className="h-11 cursor-pointer rounded-xl bg-surface px-5 text-sm text-muted">انصراف</button>}</div>
            </form>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-4 flex items-center gap-2 text-base font-black"><Truck className="size-5 text-primary" />روش ارسال</h2>
          <div className="space-y-2">
            {(quote?.shippingMethods ?? []).map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-[13px] ${shippingId === m.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <input type="radio" name="shipping" checked={shippingId === m.id} onChange={() => setShippingId(m.id)} className="accent-[var(--primary)]" />
                <span className="flex-1"><b>{m.name}</b>{m.description && <span className="block text-[11px] text-muted">{m.description}</span>}</span>
                <b className="whitespace-nowrap">{m.cost ? formatToman(m.cost) : "رایگان"}</b>
              </label>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-4 flex items-center gap-2 text-base font-black"><CreditCard className="size-5 text-primary" />روش پرداخت</h2>
          <div className="space-y-2">
            {providers.map((p) => (
              <label key={p.key} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-[13px] ${payment === p.key ? "border-primary bg-primary/5" : "border-border"}`}>
                <input type="radio" name="payment" checked={payment === p.key} onChange={() => setPayment(p.key)} className="accent-[var(--primary)]" />
                <span><b>{p.label}</b><span className="block text-[11px] text-muted">{p.description}</span></span>
              </label>
            ))}
          </div>
          <label className="mt-4 block space-y-1.5 text-xs font-medium"><span>یادداشت سفارش (اختیاری)</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="نکات خاص برای تحویل سفارش" className={`${field} h-auto py-3`} /></label>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <div className={card}>
          <h2 className="mb-2 text-base font-black">سفارش شما</h2>
          <ul className="divide-y divide-border/60 text-xs">
            {(quote?.lines ?? []).map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-2 py-2.5"><span className="min-w-0"><b className="line-clamp-2">{l.name}</b>{l.option && <span className="block text-muted">{l.option}</span>}<span className="text-muted">{formatToman(l.unitPrice)} × {toFa(l.quantity)}{l.priceType === "wholesale" ? " · قیمت همکار" : ""}</span>{!l.inStock && <span className="block font-bold text-hot">موجودی کافی نیست</span>}</span><b className="whitespace-nowrap">{formatToman(l.total)}</b></li>
            ))}
          </ul>
          <div className="mt-3 space-y-1.5 text-xs font-medium">
            <span className="flex items-center gap-1.5"><Ticket className="size-4 text-primary" />کد تخفیف</span>
            {quote?.couponCode ? (
              <div className="flex items-center justify-between rounded-xl bg-success/12 px-3 py-2.5 text-success"><b dir="ltr">{quote.couponCode}</b><button type="button" onClick={removeCoupon} className="cursor-pointer text-[11px] underline">حذف</button></div>
            ) : (
              <div className="flex gap-2"><input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} dir="ltr" placeholder="مثلاً CASE10" className={field} /><button type="button" onClick={applyCoupon} className="h-11 shrink-0 cursor-pointer rounded-xl bg-primary px-4 text-xs font-bold text-primary-fg">اعمال</button></div>
            )}
            {(couponMsg || quote?.couponError) && <p className={`text-[11px] ${couponMsg?.ok ? "text-success" : "text-hot"}`}>{couponMsg?.text ?? quote?.couponError}</p>}
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">جمع جزء</dt><dd className="font-bold">{formatToman(quote?.subtotal ?? 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">تخفیف</dt><dd className="font-bold text-success">{quote?.discount ? `−${formatToman(quote.discount)}` : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">هزینه ارسال</dt><dd className="font-bold">{quote ? (quote.shipping ? formatToman(quote.shipping) : "رایگان") : "—"}</dd></div>
            <div className="flex justify-between border-t border-border pt-3 text-base"><dt className="font-black">مجموع</dt><dd className="font-black text-primary">{formatToman(quote?.total ?? 0)}</dd></div>
          </dl>
          {quote?.issues.map((i) => <p key={i} className="mt-2 text-[11px] font-bold text-hot">{i}</p>)}
        </div>
        <p role="alert" className="min-h-4 text-xs font-bold text-hot">{err}</p>
        <button type="button" disabled={busy || !quote || quote.issues.length > 0} onClick={place} className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-primary text-base font-black text-primary-fg shadow-md hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{busy ? "در حال ثبت…" : "ثبت سفارش"}</button>
      </aside>
    </div>
  );
}
