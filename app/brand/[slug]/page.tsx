import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { JsonLd } from "@/components/json-ld";
import { ChipLinks, Crumbs, Pagination, ProductGrid } from "@/components/listing";
import { db } from "@/lib/db";
import { abs, breadcrumbLd, buildMeta, paths } from "@/lib/seo";
import { resolveSlugRedirect } from "@/lib/server/redirects";
import { queryShop } from "@/lib/shop-list";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";
const SIZE = 24;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
const load = (slug: string) => db.brand.findFirst({ where: { slug, isActive: true } });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const row = await load(slug);
  if (!row) return { robots: { index: false } };
  const list = await queryShop({ brandSlug: slug, size: 1 });
  const title = (row.seoTitle || `خرید لوازم جانبی ${row.name} اورجینال | CaseLine`) + (page > 1 ? ` — صفحه ${toFa(page)}` : "");
  return buildMeta({ title, description: row.seoDescription || row.description || `مشاهده و خرید محصولات ${row.name} با ضمانت اصالت و ارسال سریع.`, path: page > 1 ? `${paths.brand(row.slug)}?page=${page}` : paths.brand(row.slug), image: row.logo, noindex: list.total === 0 });
}

export default async function BrandPage({ params, searchParams }: Props) {
  const slug = decodeURIComponent((await params).slug);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const row = await load(slug);
  if (!row) { const to = await resolveSlugRedirect("brand", slug); if (to) permanentRedirect(paths.brand(to)); notFound(); }
  const [list, models, cats] = await Promise.all([
    queryShop({ brandSlug: slug, sort: "popular", page, size: SIZE }),
    db.phoneModel.findMany({ where: { brandId: row.id, isActive: true, products: { some: { product: { isActive: true } } } }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true }, take: 30 }),
    db.category.findMany({ where: { isActive: true, OR: [{ products: { some: { brandId: row.id, isActive: true } } }, { products: { some: { isActive: true, extraBrands: { some: { brandId: row.id } } } } }, { extraProducts: { some: { product: { isActive: true, OR: [{ brandId: row.id }, { extraBrands: { some: { brandId: row.id } } }] } } } }] }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true }, take: 12 }),
  ]);
  if (page > list.pages && page > 1) notFound();
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="py-6">
        <Container>
          <JsonLd data={[breadcrumbLd([{ name: "خانه", path: "/" }, { name: "برندها", path: "/shop" }, { name: row.name, path: paths.brand(row.slug) }]), { "@context": "https://schema.org", "@type": "Brand", name: row.name, url: abs(paths.brand(row.slug)), ...(row.logo ? { logo: abs(row.logo) } : {}), ...(row.description ? { description: row.description } : {}) }]} />
          <Crumbs items={[{ name: "خانه", href: "/" }, { name: "فروشگاه", href: "/shop" }, { name: row.name }]} />
          <h1 className="font-display text-[38px] leading-[1.15] sm:text-[52px]">برند {row.name}</h1>
          {row.description && <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{row.description}</p>}
          <p className="mt-1 text-xs text-muted">{toFa(list.total)} محصول</p>
          <div className="mt-5"><ProductGrid items={list.items} /></div>
          <Pagination basePath={paths.brand(row.slug)} page={page} pages={list.pages} />
          <ChipLinks title={`مدل‌های گوشی ${row.name}`} items={models.map((m) => ({ label: m.name, href: paths.model(m.slug) }))} />
          <ChipLinks title="دسته‌بندی‌های محصولات این برند" items={cats.map((c) => ({ label: c.name, href: paths.category(c.slug) }))} />
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
