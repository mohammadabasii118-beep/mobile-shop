import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { JsonLd } from "@/components/json-ld";
import { ChipLinks, Crumbs, Pagination, ProductGrid, SeoText } from "@/components/listing";
import { db } from "@/lib/db";
import { abs, breadcrumbLd, buildMeta, clip, paths } from "@/lib/seo";
import { resolveSlugRedirect } from "@/lib/server/redirects";
import { queryShop } from "@/lib/shop-list";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";
const SIZE = 24;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

async function load(slug: string) {
  return db.category.findFirst({ where: { slug, isActive: true }, include: { parent: { select: { slug: true, name: true } }, children: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } } } });
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const c = await load(slug);
  if (!c) return { robots: { index: false } };
  const list = await queryShop({ cat: slug, page: 1, size: 1 });
  const title = (c.seoTitle || `خرید ${c.name} | ${c.parent ? c.parent.name + " | " : ""}CaseLine`) + (page > 1 ? ` — صفحه ${toFa(page)}` : "");
  return buildMeta({ title, description: c.seoDescription || c.description || `مشاهده و خرید ${c.name} اورجینال با ضمانت سازگاری و ارسال سریع.`, path: page > 1 ? `${paths.category(c.slug)}?page=${page}` : paths.category(c.slug), canonical: page === 1 ? c.canonical : null, image: c.image, noindex: list.total === 0 });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const slug = decodeURIComponent((await params).slug);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const c = await load(slug);
  if (!c) { const to = await resolveSlugRedirect("category", slug); if (to) permanentRedirect(paths.category(to)); notFound(); }
  const catMatch = { OR: [{ slug: c.slug }, { parent: { slug: c.slug } }] };
  const [list, brands] = await Promise.all([
    queryShop({ cat: c.slug, sort: "popular", page, size: SIZE }),
    db.brand.findMany({ where: { isActive: true, OR: [{ products: { some: { isActive: true, category: catMatch } } }, { products: { some: { isActive: true, extraCategories: { some: { category: catMatch } } } } }, { extraProducts: { some: { product: { isActive: true, OR: [{ category: catMatch }, { extraCategories: { some: { category: catMatch } } }] } } } }] }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true }, take: 12 }),
  ]);
  if (page > list.pages && page > 1) notFound();
  const crumbs = [{ name: "خانه", path: "/" }, { name: "فروشگاه", path: "/shop" }, ...(c.parent ? [{ name: c.parent.name, path: paths.category(c.parent.slug) }] : []), { name: c.name, path: paths.category(c.slug) }];
  const ld = [
    breadcrumbLd(crumbs),
    { "@context": "https://schema.org", "@type": "CollectionPage", name: c.name, description: clip(c.seoDescription || c.description), url: abs(paths.category(c.slug)), inLanguage: "fa-IR",
      mainEntity: { "@type": "ItemList", numberOfItems: list.total, itemListElement: list.items.map((p, i) => ({ "@type": "ListItem", position: (page - 1) * SIZE + i + 1, url: abs(paths.product(p.slug)) })) } },
  ];
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="py-6">
        <Container>
          <JsonLd data={ld} />
          <Crumbs items={[{ name: "خانه", href: "/" }, { name: "فروشگاه", href: "/shop" }, ...(c.parent ? [{ name: c.parent.name, href: paths.category(c.parent.slug) }] : []), { name: c.name }]} />
          <h1 className="text-2xl font-black">{c.name}</h1>
          {c.description && <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{c.description}</p>}
          <p className="mt-1 text-xs text-muted">{toFa(list.total)} محصول</p>
          <ChipLinks title="زیرمجموعه‌ها" items={c.children.map((x) => ({ label: x.name, href: paths.category(x.slug) }))} />
          <div className="mt-5"><ProductGrid items={list.items} /></div>
          <Pagination basePath={paths.category(c.slug)} page={page} pages={list.pages} />
          <ChipLinks title="برندهای این دسته" items={brands.map((b) => ({ label: b.name, href: paths.brand(b.slug) }))} />
          {page === 1 && <SeoText text={c.seoContent} />}
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
