import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { BlogSection, BrandMarquee, CategoryTiles, ProductRail, TelegramBanner } from "@/components/home-sections";
import { getBanner, getBlogPosts, getBrandNames, getCategoryTree, getHomeSections, getNewestProducts, getProductsByCategory, getProductsByIds } from "@/lib/queries";

export const dynamic = "force-dynamic";
const faDate = (d: Date | null) => (d ? d.toLocaleDateString("fa-IR", { day: "numeric", month: "long", year: "numeric" }) : "");

export default async function Home() {
  const [sections, tree] = await Promise.all([getHomeSections(), getCategoryTree()]);
  const blocks = await Promise.all(
    sections.map(async (s) => {
      const cfg = (s.config ?? {}) as { categorySlug?: string; productIds?: string[]; limit?: number };
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
      <main>{blocks}</main>
      <Footer />
      <BottomNav />
    </>
  );
}
