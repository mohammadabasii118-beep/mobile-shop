import { useSEO } from '@/utils/seo';
import { Hero } from '@/features/home/Hero';
import { Bestsellers, Categories, Deals, Featured, NewArrivals, Newsletter, Promo3D, Trust, WhyUs } from '@/features/home/Sections';

export default function Home() {
  useSEO({});
  return (<><Hero /><Categories /><Featured /><WhyUs /><Promo3D /><NewArrivals /><Bestsellers /><Deals /><Trust /><Newsletter /></>);
}
