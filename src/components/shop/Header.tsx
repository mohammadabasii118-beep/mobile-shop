import Link from 'next/link';
import type { Settings, Category } from '@/lib/catalog';
import SearchBox from './SearchBox';
import MobileMenu from './MobileMenu';
import HeaderActions from './HeaderActions';
import CatNav from './CatNav';

export default function Header({ settings, categories, userName }: { settings: Settings; categories: Category[]; userName: string | null }) {
  const msgs = settings.announcements.split('\n').map((s) => s.trim()).filter(Boolean);
  const top = categories.filter((c) => !c.parent_id);
  return (
    <>
      {msgs.length > 0 && (
        <div className="utility">
          <div className="wrap">{msgs.map((m, i) => <span key={i}>{m}</span>)}</div>
        </div>
      )}
      <header className="hdr">
        <div className="wrap">
          <div className="bar">
            <MobileMenu categories={top} storeName={settings.store_name} phone={settings.phone} />
            <Link className="logo" href="/" aria-label={`${settings.store_name}، صفحه اصلی`}>
              {settings.store_name}
              <i />
            </Link>
            <SearchBox />
            <HeaderActions loggedIn={!!userName} />
          </div>
          <div className="m-search"><SearchBox mobile /></div>
        </div>
        <CatNav categories={top} />
      </header>
    </>
  );
}
