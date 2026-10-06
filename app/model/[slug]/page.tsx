import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { JsonLd } from "@/components/json-ld";
import { ChipLinks, Crumbs, Pagination, ProductGrid } from "@/components/listing";
import { db } from "@/lib/db";
import { breadcrumbLd, buildMeta, paths } from "@/lib/seo";
import { resolveSlugRedirect } from "@/lib/server/redirects";
import { queryShop } from "@/lib/shop-list";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";
const SIZE = 24;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
const load = (slug: string) => db.phoneModel.findFirst({ where: { slug, isActive: true }, include: { brand: { select: { slug: true, name: true, isActive: true } } } });

/** A phone-model page exists (and is indexable) only while at least one active product is compatible with it. */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const row = await load(slug);
  if (!row) return { robots: { index: false } };
  const list = await queryShop({ modelSlug: slug, size: 1 });
  const title = (row.seoTitle || `لوازم جانبی ${row.name} | قاب، گلس و شارژر سازگار | CaseLine`) + (page > 1 ? ` — صفحه ${toFa(page)}` : "");
  return buildMeta({ title, description: row.seoDescription || row.description || `قاب، گلس و لوازم جانبی سازگار با ${row.brand.name} ${row.name} با ضمانت سازگاری.`, path: page > 1 ? `${paths.model(row.slug)}?page=${page}` : paths.model(row.slug), image: row.image, noindex: list.total === 0 });
}

export default async function ModelPage({ params, searchParams }: Props) {
  const slug = decodeURIComponent((await params).slug);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const row = await load(slug);
  if (!row) { const to = await resolveSlugRedirect("model", slug); if (to) permanentRedirect(paths.model(to)); notFound(); }
  const [list, cats, siblings] = await Promise.all([
    queryShop({ modelSlug: slug, sort: "popular", page, size: SIZE }),
    db.category.findMany({ where: { isActive: true, products: { some: { isActive: true, phoneModels: { some: { phoneModelId: row.id } } } } }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true }, take: 12 }),
    db.phoneModel.findMany({ where: { brandId: row.brandId, isActive: true, id: { not: row.id }, products: { some: { product: { isActive: true } } } }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true }, take: 12 }),
  ]);
  if (page > list.pages && page > 1) notFound();
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="py-6">
        <Container>
          <JsonLd data={breadcrumbLd([{ name: "خانه", path: "/" }, ...(row.brand.isActive ? [{ name: row.brand.name, path: paths.brand(row.brand.slug) }] : []), { name: row.name, path: paths.model(row.slug) }])} />
          <Crumbs items={[{ name: "خانه", href: "/" }, ...(row.brand.isActive ? [{ name: row.brand.name, href: paths.brand(row.brand.slug) }] : []), { name: row.name }]} />
          <h1 className="font-display text-[38px] leading-[1.15] sm:text-[52px]">لوازم جانبی {row.brand.name} {row.name}</h1>
          {row.description && <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{row.description}</p>}
          <p className="mt-1 text-xs text-muted">{toFa(list.total)} محصول سازگار</p>
          <div className="mt-5"><ProductGrid items={list.items} /></div>
          <Pagination basePath={paths.model(row.slug)} page={page} pages={list.pages} />
          <ChipLinks title="دسته‌بندی‌ها" items={cats.map((c) => ({ label: c.name, href: paths.category(c.slug) }))} />
          <ChipLinks title={`سایر مدل‌های ${row.brand.name}`} items={siblings.map((m) => ({ label: m.name, href: paths.model(m.slug) }))} />
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
