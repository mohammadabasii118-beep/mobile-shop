import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { getActiveCategories, getHomepageSections, getActiveBanner, getProductsFor, getDiscountedProducts } from "@/lib/homepage";
import { getFeaturedReviews } from "@/lib/actions/reviews";
import { isViewerWholesale, effectivePrice } from "@/lib/wholesalePricing";
import CategoryStrip from "@/components/CategoryStrip";
import ProductRail from "@/components/ProductRail";
import Icon from "@/components/Icon";
import HeroPhonePicker from "@/components/HeroPhonePicker";

export default async function HomePage() {
  const [categories, sections, banner, featuredReviews, isWholesale, brands, phoneModels] = await Promise.all([
    getActiveCategories(),
    getHomepageSections(),
    getActiveBanner(),
    getFeaturedReviews(),
    isViewerWholesale(),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.phoneModel.findMany({ where: { brandId: { not: null } }, orderBy: { name: "asc" }, select: { id: true, name: true, brandId: true } }),
  ]);

  const [bestSellers, newArrivals, trending, discounted] = await Promise.all([
    getProductsFor("isBestSeller"),
    getProductsFor("isNew"),
    getProductsFor("isTrending"),
    getDiscountedProducts(),
  ]);

  const dataByType: Record<string, any> = {
    BEST_SELLERS: bestSellers,
    NEW_ARRIVALS: newArrivals,
    TRENDING: trending,
    DISCOUNTED: discounted,
  };
  const titleByType: Record<string, string> = {
    BEST_SELLERS: "پرفروش‌ترین‌ها",
    NEW_ARRIVALS: "جدیدترین‌ها",
    TRENDING: "پرطرفدارترین‌ها",
    DISCOUNTED: "تخفیف‌های ویژه",
  };
  const hrefByType: Record<string, string> = { BEST_SELLERS: "/category/case" };

  return (
    <div>
      {sections.map((s) => {
        switch (s.type) {
          case "HERO":
            return (
              <section key={s.id} className="max-w-7xl mx-auto px-4 md:px-8 pt-10 pb-16 md:pt-14 md:pb-20">
                <div className="grid md:grid-cols-2 gap-10 items-center">
                  <div className="text-center md:text-right order-2 md:order-1">
                    <p className="text-xs font-medium mb-4" style={{ color: "#404040" }}>کالکشن پاییز ۱۴۰۴</p>
                    <h1 className="text-3xl md:text-5xl font-extrabold leading-[1.4] mb-5">ظرافتی که<br />همراه توست</h1>
                    <p className="muted text-sm mb-6 max-w-xs mx-auto md:mx-0">قاب و اکسسوری‌هایی برای سبک همیشگی تو.</p>
                    {brands.length > 0 && (
                      <div className="mb-6">
                        <HeroPhonePicker brands={brands} models={phoneModels as any} />
                      </div>
                    )}
                    <Link href="/category/case" className="inline-block px-8 h-12 leading-[48px] rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>
                      مشاهده کالکشن
                    </Link>
                  </div>
                  <div className="order-1 md:order-2 flex justify-center">
                    <div className="w-48 h-64 md:w-56 md:h-72 rounded-[2rem] flex items-center justify-center" style={{ background: "linear-gradient(160deg,#f2f2f0,#c9c9c7)" }}><Icon name="case" className="w-20 h-20 opacity-80" /></div>
                  </div>
                </div>
              </section>
            );
          case "CATEGORY_STRIP":
            return <CategoryStrip key={s.id} categories={categories.map((c) => ({ slug: c.slug, name: c.name, imageUrl: c.imageUrl }))} />;
          case "BANNER":
            if (!banner) return null;
            return (
              <section key={s.id} className="max-w-7xl mx-auto px-4 md:px-8 py-6">
                <div className="rounded-3xl overflow-hidden grid md:grid-cols-2 items-center surface2">
                  <div className="p-10 md:p-14 text-center md:text-right">
                    {banner.subtitle && <p className="text-xs mb-3" style={{ color: "#404040" }}>{banner.subtitle}</p>}
                    <h3 className="text-xl md:text-2xl font-bold mb-4">{banner.title}</h3>
                    {banner.linkUrl && (
                      <Link href={banner.linkUrl} className="text-sm font-bold underline underline-offset-4">مشاهده مجموعه</Link>
                    )}
                  </div>
                  <div className="flex items-center justify-center py-8 md:py-14">
                    <div className="w-36 h-36 md:w-44 md:h-44 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(160deg,#f2f2f0,#c9c9c7)" }}><Icon name="accessory" className="w-14 h-14 opacity-80" /></div>
                  </div>
                </div>
              </section>
            );
          case "CUSTOM_BLOCK": {
            // A free-form block an admin created themselves in
            // /admin/homepage (the homepage "page builder") — content
            // comes entirely from HomepageSection.config, never invented
            // here. A block with no title (shouldn't happen — title is
            // required at creation) is simply skipped rather than
            // rendering an empty section.
            const cfg = (s.config as { title?: string; body?: string; imageUrl?: string; linkUrl?: string; linkLabel?: string } | null) || {};
            if (!cfg.title) return null;
            return (
              <section key={s.id} className="max-w-7xl mx-auto px-4 md:px-8 py-6">
                <div className="rounded-3xl overflow-hidden grid md:grid-cols-2 items-center surface2">
                  <div className="p-10 md:p-14 text-center md:text-right">
                    <h3 className="text-xl md:text-2xl font-bold mb-4">{cfg.title}</h3>
                    {cfg.body && <p className="text-sm muted mb-4 leading-7">{cfg.body}</p>}
                    {cfg.linkUrl && (
                      <Link href={cfg.linkUrl} className="text-sm font-bold underline underline-offset-4">
                        {cfg.linkLabel || "مشاهده"}
                      </Link>
                    )}
                  </div>
                  {cfg.imageUrl ? (
                    <div className="relative h-48 md:h-64">
                      <Image src={cfg.imageUrl} alt={cfg.title} fill sizes="500px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 md:py-14">
                      <div className="w-36 h-36 md:w-44 md:h-44 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(160deg,#f2f2f0,#c9c9c7)" }}>
                        <Icon name="accessory" className="w-14 h-14 opacity-80" />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          }
          case "WHY_US":
            return (
              <section key={s.id} className="max-w-3xl mx-auto px-4 md:px-8 py-12">
                <div className="flex justify-between md:justify-center md:gap-16">
                  {[["truck", "ارسال سریع"], ["shield", "ضمانت اصالت"], ["card", "پرداخت امن"], ["return", "۷ روز بازگشت"]].map(([iconName, label]) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <Icon name={iconName} className="w-6 h-6 opacity-70" />
                      <span className="text-[11px] md:text-xs muted whitespace-nowrap">{label}</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          case "TESTIMONIALS": {
            // Only real, submitted reviews are shown here — see
            // lib/actions/reviews.ts's getFeaturedReviews(). If nobody has
            // reviewed anything yet, the section is simply not rendered:
            // inventing placeholder testimonials is explicitly against
            // this project's rules.
            if (featuredReviews.length === 0) return null;
            return (
              <section key={s.id} className="max-w-xl mx-auto px-4 md:px-8 py-14 text-center">
                <h2 className="text-lg md:text-xl font-bold mb-8">نظرات مشتریان</h2>
                <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory">
                  {featuredReviews.map((r) => (
                    <Link key={r.id} href={`/product/${r.productSlug}`} className="snap-center shrink-0 w-full px-6">
                      <div className="mb-4">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                      <p className="text-sm leading-8 muted mb-4 clamp2">{r.comment}</p>
                      <span className="text-sm font-medium">{r.userName}</span>
                      <span className="text-xs muted block mt-1">درباره‌ی {r.productName}</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          }
          default: {
            const products = dataByType[s.type];
            if (!products) return null;
            return (
              <ProductRail
                key={s.id}
                title={s.title || titleByType[s.type]}
                products={products.map((p: any) => ({
                  id: p.id, slug: p.slug, name: p.name,
                  price: effectivePrice(p.price, p.wholesalePrice, isWholesale),
                  // A retail "قبل" price only makes sense next to the retail
                  // price — hide it once a wholesale price is actually applied,
                  // rather than showing a misleading discount percentage.
                  oldPrice: isWholesale && p.wholesalePrice != null ? null : p.oldPrice,
                  images: p.images, isBestSeller: p.isBestSeller, isNew: p.isNew, isTrending: p.isTrending, hasVariants: p.hasVariants, avgRating: p.avgRating, reviewCount: p.reviewCount,
                }))}
                viewAllHref={hrefByType[s.type]}
              />
            );
          }
        }
      })}
    </div>
  );
}
