import type { Metadata } from 'next';
import Listing, { Crumbs, type SP } from '@/components/shop/Listing';

export const metadata: Metadata = { title: 'فروشگاه', description: 'همه‌ی لوازم جانبی موبایل: قاب، گلس، شارژر، کابل، پاوربانک، هندزفری و بیشتر.' };

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  return (
    <>
      <Crumbs items={[{ label: 'فروشگاه' }]} />
      <div className="wrap page-head"><h1>فروشگاه</h1><p>همه‌ی لوازم جانبی؛ با فیلتر مدل گوشی فقط کالاهای سازگار را ببینید.</p></div>
      <Listing basePath="/shop" sp={sp} showCategories />
    </>
  );
}
