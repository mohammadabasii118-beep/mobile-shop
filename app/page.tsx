import type { Metadata } from "next";
import { buildMeta, getSeoSetting } from "@/lib/seo";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { BannerSlot } from "@/components/banner-slot";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { BlogSection, BrandMarquee, CategoryTiles, ProductRail, TelegramBanner } from "@/components/home-sections";
import { getBanner, getBlogPosts, getBrandNames, getCategoryTree, getHomeSections, getNewestProducts, getProductsByCategory, getProductsByIds } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSetting("home");
  return buildMeta({ title: seo.title || "CaseLine | فروشگاه لوازم جانبی موبایل", description: seo.description || "قاب، گلس، شارژر، کابل و هندزفری با تضمین سازگاری با مدل گوشی شما", path: "/", image: seo.ogImage, robots: seo.robots });
}
const faDate = (d: Date | null) => (d ? d.toLocaleDateString("fa-IR", { day: "numeric", month: "long", year: "numeric" }) : "");

export default async function Home() {
  const [sections, tree] = await Promise.all([getHomeSections(), getCategoryTree()]);
  const blocks = await Promise.all(
    sections.map(async (s) => {
      const cfg = (s.config ?? {}) as { categorySlug?: string; productIds?: string[]; limit?: number; placement?: string };
      switch (s.type) {
        case "hero":
          return <Hero key={s.key} chips={["قاب آیفون", "گلس", "شارژر", "کابل", "ایرپاد"]} />;
        case "marquee":
          return <BrandMarquee key={s.key} brands={await getBrandNames()} />;
        case "product_rail": {
          const slug = cfg.categorySlug ?? "";
          const items = cfg.productIds?.length ? await getProductsByIds(cfg.productIds) : await getProductsByCategory(slug, cfg.limit ?? 5);
          return <ProductRail key={s.key} id={slug} title={s.title ?? slug} items={items} href={s.link ?? `/shop#${slug}`} />;
        }
        case "newest":
          return <ProductRail key={s.key} id="new" title={s.title ?? "تازه‌ترین محصولات"} items={await getNewestProducts(cfg.limit ?? 5)} href={s.link ?? "/shop"} />;
        case "categories":
          return <CategoryTiles key={s.key} title={s.title ?? "دسته‌بندی‌ها"} categories={tree} />;
        case "banner": {
          // A homepage banner section shows whatever banners are assigned to its placement (default: the Telegram strip).
          if (cfg.placement && cfg.placement !== "home_telegram") return <div key={s.key} className="mx-auto w-full max-w-[980px] px-4 sm:px-6 lg:px-8"><BannerSlot placement={cfg.placement} className="my-4 space-y-3" /></div>;
          const b = await getBanner("home_telegram");
          return b ? <TelegramBanner key={s.key} title={b.title} subtitle={b.subtitle} buttonText={b.buttonText} link={b.buttonLink} /> : null;
        }
        case "blog": {
          const posts = await getBlogPosts(3);
          return <BlogSection key={s.key} title={s.title ?? "آخرین وبلاگ‌ها"} posts={posts.map((p) => ({ slug: p.slug, title: p.title, category: p.category?.name ?? null, date: faDate(p.publishedAt) }))} />;
        }
        default:
          return null;
      }
    }),
  );
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>{blocks}</main>
      <Footer />
      <BottomNav />
    </>
  );
}
