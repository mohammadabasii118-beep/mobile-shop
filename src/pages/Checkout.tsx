import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCircle2 } from 'lucide-react';
import { provinces } from '@/data/account';
import { useShop } from '@/store';
import { useSEO } from '@/utils/seo';
import { formatPrice } from '@/utils/format';
import { getProvider } from '@/features/payment/PaymentProvider';
import { loyalty, wallet } from '@/features/wallet-loyalty';
import { PageShell } from '@/components/PageShell';
import { TotalsTable, useCartTotals } from '@/components/CartSummary';

const steps = ['اطلاعات مشتری', 'آدرس ارسال', 'روش ارسال', 'پرداخت', 'بررسی سفارش'];


type FormShape = Record<string, string | boolean>;
function Field({ f, set, k, label, ...r }: { f: FormShape; set: (k: string, v: string) => void; k: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block text-xs font-bold text-mist/70">{label}<input className="input mt-1.5" value={String(f[k])} onChange={(e) => set(k, e.target.value)} {...r} /></label>;
}
function Choice({ on, onClick, title, desc }: { on: boolean; onClick: () => void; title: string; desc: string }) {
  return <button type="button" onClick={onClick} className={`w-full rounded-2xl border p-4 text-right transition ${on ? 'border-violet bg-violet/10' : 'border-line hover:border-white/30'}`}><b className="text-sm text-white">{title}</b><p className="text-xs text-mist/60">{desc}</p></button>;
}

export default function Checkout() {
  useSEO({ title: 'تسویه حساب' });
  const { cart, clearCart, notify, user } = useShop();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<string | null>(null);
  const [f, setF] = useState({ name: user.name, phone: user.phone, email: user.email, province: provinces[0], city: '', address: '', zip: '', ship: 'standard' as 'standard' | 'express', pay: 'online', useWallet: false });
  const t = useCartTotals(f.ship);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const walletUse = f.useWallet ? Math.min(wallet.balance, t.total) : 0;

  const valid = [
    f.name.trim().length > 2 && /^09\d{9}$/.test(f.phone) && /\S+@\S+\.\S+/.test(f.email),
    !!f.city.trim() && f.address.trim().length > 5 && /^\d{10}$/.test(f.zip),
    true, true, true,
  ][step];

  const place = async () => {
    const provider = getProvider('mock')!;
    const orderId = `CL-${Math.floor(10600 + Math.random() * 400)}`;
    const pay = await provider.createPayment({ orderId, amount: t.total - walletUse });
    await provider.verifyPayment(pay.paymentId);
    clearCart(); setDone(orderId); notify('سفارش شما ثبت شد');
  };

  if (done) return (
    <PageShell title="سفارش ثبت شد"><div className="card grid place-items-center gap-4 p-14 text-center"><CheckCircle2 size={64} className="text-emerald-400" /><p className="text-lg font-black text-white">شماره سفارش: {done}</p><p className="text-sm text-mist/60">پرداخت با درگاه آزمایشی تأیید شد.</p><Link to="/account/orders" className="btn btn-primary">سفارش‌های من</Link></div></PageShell>
  );
  if (!cart.length) return <PageShell title="تسویه حساب"><div className="card grid place-items-center gap-4 p-14 text-center"><p className="font-bold text-white">سبد خرید خالی است</p><Link to="/shop" className="btn btn-primary">مشاهده فروشگاه</Link></div></PageShell>;

  return (
    <PageShell title="تسویه حساب">
      <ol className="mb-8 flex gap-2 overflow-x-auto no-scrollbar">{steps.map((s, i) => <li key={s} className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${i === step ? 'border-violet bg-violet/20 text-white' : i < step ? 'border-emerald-500/40 text-emerald-400' : 'border-line text-mist/50'}`}>{i < step ? <Check size={14} /> : <span>{i + 1}</span>}{s}</li>)}</ol>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="card space-y-5 p-5 sm:p-8">
          {step === 0 && <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field f={f} set={set} k="name" label="نام و نام خانوادگی" /></div><Field f={f} set={set} k="phone" label="شماره موبایل" inputMode="numeric" dir="ltr" placeholder="09123456789" /><Field f={f} set={set} k="email" label="ایمیل" type="email" dir="ltr" /></div>}
          {step === 1 && <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-bold text-mist/70">استان<select className="input mt-1.5" value={f.province} onChange={(e) => set('province', e.target.value)}>{provinces.map((p) => <option key={p}>{p}</option>)}</select></label><Field f={f} set={set} k="city" label="شهر" /><div className="sm:col-span-2"><Field f={f} set={set} k="address" label="آدرس" /></div><Field f={f} set={set} k="zip" label="کد پستی" inputMode="numeric" dir="ltr" maxLength={10} /></div>}
          {step === 2 && <div className="space-y-3"><Choice on={f.ship === 'standard'} onClick={() => set('ship', 'standard')} title="ارسال عادی" desc="۲ تا ۵ روز کاری · رایگان بالای ۳۵۰ هزار تومان" /><Choice on={f.ship === 'express'} onClick={() => set('ship', 'express')} title="ارسال اکسپرس" desc="تحویل ۲۴ ساعته · ۹۵٬۰۰۰ تومان" /></div>}
          {step === 3 && <div className="space-y-3"><Choice on={f.pay === 'online'} onClick={() => set('pay', 'online')} title="پرداخت آنلاین" desc="درگاه آزمایشی (Mock) — آماده اتصال به درگاه واقعی" />
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-line p-4"><span><b className="text-sm text-white">استفاده از کیف پول</b><p className="text-xs text-mist/60">موجودی: {formatPrice(wallet.balance)}</p></span><input type="checkbox" checked={f.useWallet} onChange={(e) => set('useWallet', e.target.checked)} className="h-5 w-5 accent-violet" /></label>
            <p className="text-xs text-mist/50">امتیاز وفاداری شما {loyalty.points} است و جدا از کیف پول محاسبه می‌شود. پرداخت اعتباری (اسنپ‌پی، ترب‌پی، بله‌پی) فعلاً فعال نیست.</p></div>}
          {step === 4 && <div className="space-y-3 text-sm text-mist/80"><p><b className="text-white">مشتری:</b> {f.name} · {f.phone}</p><p><b className="text-white">آدرس:</b> {f.province}، {f.city}، {f.address} ({f.zip})</p><p><b className="text-white">ارسال:</b> {f.ship === 'express' ? 'اکسپرس' : 'عادی'}</p><p><b className="text-white">پرداخت:</b> آنلاین{walletUse ? ` + ${formatPrice(walletUse)} از کیف پول` : ''}</p></div>}
          <div className="flex justify-between pt-2">
            <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>مرحله قبل</button>
            {step < 4 ? <button className="btn btn-primary" disabled={!valid} onClick={() => setStep(step + 1)}>مرحله بعد</button> : <button className="btn btn-primary" onClick={place}>ثبت و پرداخت</button>}
          </div>
          {!valid && <p className="text-xs text-amber">لطفاً فیلدها را به‌درستی تکمیل کنید (موبایل با ۰۹ شروع شود و کد پستی ۱۰ رقم باشد).</p>}
        </div>
        <aside className="card h-fit space-y-4 p-6 lg:sticky lg:top-24"><h3 className="font-black text-white">خلاصه سفارش</h3><TotalsTable t={t} />{walletUse > 0 && <p className="flex justify-between text-sm text-emerald-400"><span>از کیف پول</span><span>− {formatPrice(walletUse)}</span></p>}</aside>
      </div>
    </PageShell>
  );
}
