import Link from 'next/link';
import type { Category, Settings } from '@/lib/catalog';
import NewsletterForm from './NewsletterForm';

export default function Footer({ settings, categories }: { settings: Settings; categories: Category[] }) {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="f-top">
          <div>
            <Link className="logo" href="/" style={{ color: '#fff' }}>
              {settings.store_name}
              <i style={{ boxShadow: '0 0 0 2px #fff' }} />
            </Link>
            <p style={{ marginTop: 12, maxWidth: '34ch' }}>{settings.footer_about}</p>
            <NewsletterForm />
          </div>
          <div className="f-cols">
            <div>
              <h4>فروشگاه</h4>
              <ul>
                {categories.filter((c) => !c.parent_id).slice(0, 5).map((c) => <li key={c.id}><Link href={`/category/${c.slug}`}>{c.name}</Link></li>)}
              </ul>
            </div>
            <div>
              <h4>حساب من</h4>
              <ul>
                <li><Link href="/account">سفارش‌های من</Link></li>
                <li><Link href="/wishlist">علاقه‌مندی‌ها</Link></li>
                <li><Link href="/cart">سبد خرید</Link></li>
                <li><Link href="/shop?sale=1">تخفیف‌ها</Link></li>
              </ul>
            </div>
            <div>
              <h4>تماس با ما</h4>
              <ul>
                <li className="num">{settings.phone}</li>
                <li dir="ltr" style={{ textAlign: 'right' }}>{settings.email}</li>
                <li>{settings.address}</li>
                {settings.instagram && <li><a href={settings.instagram} rel="noopener noreferrer" target="_blank">اینستاگرام</a></li>}
                {settings.telegram && <li><a href={settings.telegram} rel="noopener noreferrer" target="_blank">تلگرام</a></li>}
              </ul>
            </div>
          </div>
        </div>
        <div className="f-bot">
          <span>© {new Date().toLocaleDateString('fa-IR-u-ca-persian', { year: 'numeric' })} {settings.store_name}. همه‌ی حقوق محفوظ است.</span>
          <span>گارانتی اصالت و سلامت فیزیکی کالا</span>
        </div>
      </div>
    </footer>
  );
}
