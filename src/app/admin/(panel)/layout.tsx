import { requireAdmin } from '@/lib/auth';
import { get } from '@/lib/db';
import { getSettings } from '@/lib/catalog';
import AdminNav, { type NavGroup } from '@/components/admin/AdminNav';
import { adminLogout } from '@/lib/actions/admin-auth';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const s = getSettings();
  const low = Number(s.low_stock) || 5;
  const pendingOrders = get<{ n: number }>("SELECT COUNT(*) n FROM orders WHERE status = 'pending'")!.n;
  const pendingReviews = get<{ n: number }>('SELECT COUNT(*) n FROM reviews WHERE approved = 0')!.n;
  const lowStock = get<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM products WHERE type = 'simple' AND status = 'published' AND stock <= ?)
          + (SELECT COUNT(*) FROM variations v JOIN products p ON p.id = v.product_id WHERE v.status = 'active' AND p.status = 'published' AND v.stock <= ?) AS n`, low, low)!.n;

  const groups: NavGroup[] = [
    { title: 'نمای کلی', items: [{ href: '/admin', label: 'داشبورد', icon: 'dashboard', keywords: 'خانه نمای کلی' }] },
    {
      title: 'فروش', items: [
        { href: '/admin/orders', label: 'سفارش‌ها', icon: 'orders', badge: pendingOrders, warn: true, keywords: 'خرید فاکتور ارسال' },
        { href: '/admin/payments', label: 'پرداخت‌ها', icon: 'payments', keywords: 'تراکنش درگاه' },
        { href: '/admin/payment-methods', label: 'روش‌های پرداخت', icon: 'payments', keywords: 'درگاه کارت به کارت اسنپ پی ترب پی بله' },
        { href: '/admin/discounts', label: 'تخفیف‌ها', icon: 'discounts', keywords: 'حراج درصد' },
        { href: '/admin/coupons', label: 'کد تخفیف', icon: 'coupons', keywords: 'کوپن' },
      ],
    },
    {
      title: 'کاتالوگ', items: [
        { href: '/admin/products', label: 'محصولات', icon: 'products', keywords: 'کالا قاب گلس شارژر' },
        { href: '/admin/attributes', label: 'ویژگی‌ها (رنگ، مدل)', icon: 'attributes', keywords: 'رنگ مدل گوشی برند گوشی متغیر' },
        { href: '/admin/categories', label: 'دسته‌بندی‌ها', icon: 'categories' },
        { href: '/admin/brands', label: 'برندها', icon: 'brands' },
        { href: '/admin/inventory', label: 'موجودی', icon: 'inventory', badge: lowStock, warn: true, keywords: 'انبار استوک' },
        { href: '/admin/reviews', label: 'نظرات', icon: 'reviews', badge: pendingReviews, warn: true, keywords: 'کامنت امتیاز' },
      ],
    },
    { title: 'مشتریان', items: [{ href: '/admin/users', label: 'کاربران', icon: 'users', keywords: 'مشتری مدیر' }] },
    { title: 'محتوا', items: [{ href: '/admin/banners', label: 'بنرها و اسلایدر', icon: 'banners', keywords: 'هیرو اسلایدر تبلیغ' }] },
    {
      title: 'سیستم', items: [
        { href: '/admin/reports', label: 'گزارش‌ها', icon: 'reports', keywords: 'فروش آمار' },
        { href: '/admin/settings', label: 'تنظیمات فروشگاه', icon: 'settings', keywords: 'ارسال پرداخت رمز' },
      ],
    },
  ];

  return <AdminNav groups={groups} storeName={s.store_name} userName={user.name || user.login} logout={adminLogout}>{children}</AdminNav>;
}
