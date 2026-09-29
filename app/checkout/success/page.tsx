import Link from "next/link";
import Icon from "@/components/Icon";

export default function CheckoutSuccessPage({ searchParams }: { searchParams: { order?: string; status?: string; error?: string } }) {
  const { order, status } = searchParams;

  if (searchParams.error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <h1 className="text-xl font-bold mb-3">سفارش پیدا نشد</h1>
        <Link href="/" className="text-sm underline">بازگشت به فروشگاه</Link>
      </div>
    );
  }

  const map: Record<string, { icon: string; title: string; desc: string }> = {
    paid: { icon: "check", title: "پرداخت شما با موفقیت انجام شد", desc: "سفارش شما ثبت شد و به‌زودی آماده‌سازی می‌شود." },
    failed: { icon: "x", title: "پرداخت ناموفق بود", desc: "مبلغی از حساب شما کسر نشده است. می‌توانید دوباره تلاش کنید." },
    canceled: { icon: "alert", title: "پرداخت لغو شد", desc: "سفارش شما لغو شد." },
    pending: { icon: "clock", title: "سفارش شما ثبت شد", desc: "درگاه پرداخت هنوز پیکربندی نشده — این سفارش در انتظار پرداخت باقی مانده است." },
  };
  const info = map[status || "pending"] || map.pending;

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <Icon name={info.icon} className="w-14 h-14 mx-auto mb-4 opacity-80" />
      <h1 className="text-xl font-bold mb-2">{info.title}</h1>
      <p className="muted text-sm mb-2">{info.desc}</p>
      <p className="text-sm font-bold mb-8">شماره سفارش: {order}</p>
      <div className="flex items-center justify-center gap-3">
        <Link href={`/order/track?order=${order}`} className="px-6 h-11 leading-[44px] rounded-full border line text-sm">پیگیری سفارش</Link>
        <Link href="/" className="px-6 h-11 leading-[44px] rounded-full text-white text-sm" style={{ background: "var(--ink)" }}>بازگشت به فروشگاه</Link>
      </div>
    </div>
  );
}
