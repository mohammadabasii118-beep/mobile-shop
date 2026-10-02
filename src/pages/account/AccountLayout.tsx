import { NavLink, Outlet } from 'react-router-dom';
import { Heart, MapPin, Package, Settings, Sparkles, User, Wallet, LayoutDashboard, LogOut } from 'lucide-react';
import { useShop } from '@/store';
import { useSEO } from '@/utils/seo';
import { PageShell } from '@/components/PageShell';

const items = [
  { to: '/account', label: 'داشبورد', I: LayoutDashboard, end: true }, { to: '/account/profile', label: 'پروفایل', I: User },
  { to: '/account/orders', label: 'سفارش‌های من', I: Package }, { to: '/account/addresses', label: 'آدرس‌ها', I: MapPin },
  { to: '/account/wishlist', label: 'علاقه‌مندی‌ها', I: Heart }, { to: '/account/wallet', label: 'کیف پول', I: Wallet },
  { to: '/account/points', label: 'امتیازات', I: Sparkles }, { to: '/account/settings', label: 'تنظیمات', I: Settings },
];

export default function AccountLayout() {
  useSEO({ title: 'حساب کاربری' });
  const { user, login, logout } = useShop();
  if (!user.loggedIn) return (
    <PageShell title="ورود به CaseLine" subtitle="برای مشاهده سفارش‌ها، کیف پول و امتیازات وارد شوید.">
      <form className="card mx-auto max-w-md space-y-4 p-8" onSubmit={(e) => { e.preventDefault(); login({}); }}>
        <input className="input" placeholder="شماره موبایل" dir="ltr" defaultValue="09121234567" /><input className="input" type="password" placeholder="رمز عبور" dir="ltr" defaultValue="demo1234" />
        <button className="btn btn-primary w-full">ورود (دمو)</button>
      </form>
    </PageShell>
  );
  return (
    <PageShell title={`سلام ${user.name.split(' ')[0]} 👋`}>
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <nav className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {items.map(({ to, label, I, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${isActive ? 'bg-violet/20 text-white' : 'text-mist/70 hover:bg-white/5'}`}><I size={18} />{label}</NavLink>)}
          <button onClick={logout} className="flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10"><LogOut size={18} />خروج</button>
        </nav>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </PageShell>
  );
}
