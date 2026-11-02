import CinematicHome from "@/components/home/cinematic/CinematicHome";
import Categories from "@/components/home/Categories";
import ProductRail from "@/components/home/ProductRail";
import OfferBanner from "@/components/home/OfferBanner";
import Benefits from "@/components/home/Benefits";
import Testimonials from "@/components/home/Testimonials";
import Brands from "@/components/home/Brands";
import { productsByBadge, products } from "@/lib/products";

export default function HomePage() {
  const newest = productsByBadge("new");
  const bestsellers = productsByBadge("bestseller");

  return (
    <>
      {/* 5-scene cinematic scroll experience → ends in a real product grid */}
      <CinematicHome />

      {/* seamless continuation into the full storefront */}
      <Categories />

      <OfferBanner />

      <ProductRail
        accent="تازه رسید"
        title="جدیدترین محصولات"
        subtitle="آخرین افزوده‌ها به فروشگاه"
        products={newest.length ? newest : products}
        href="/products?sort=newest"
      />

      <ProductRail
        accent="محبوب‌ترین‌ها"
        title="پرفروش‌ترین محصولات"
        subtitle="انتخاب هزاران مشتری"
        products={bestsellers}
        href="/products?sort=bestseller"
      />

      <Benefits />
      <Testimonials />
      <Brands />
    </>
  );
}
