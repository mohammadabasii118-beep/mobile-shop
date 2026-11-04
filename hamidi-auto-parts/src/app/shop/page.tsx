import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shop/breadcrumbs";
import { Listing } from "@/components/shop/listing";
import { countProducts, listProducts, parseListingParams } from "@/lib/catalog";
import { listingMetadata } from "@/lib/seo";
import { toFa } from "@/lib/utils";

const PATH = "/shop";
const TITLE = "فروشگاه لوازم یدکی نیسان و هوندا";
const DESC = "خرید آنلاین لوازم یدکی اصلی و OEM نیسان و هوندا با قیمت روز: قطعات موتوری، جلوبندی، ترمز، برقی، بدنه و لوازم مصرفی. فیلتر بر اساس مدل خودرو و دسته‌بندی.";

export async function generateMetadata({ searchParams }: PageProps<"/shop">): Promise<Metadata> {
  const p = parseListingParams(await searchParams);
  return listingMetadata({ title: TITLE, description: DESC, path: PATH, page: p.page, filtered: p.filtered });
}

/** Server-rendered (SSR) because results depend on query parameters; filtering is O(n) in memory / one DB query in production. */
export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const params = parseListingParams(await searchParams);
  if (params.page > listProducts({}, params).pages) notFound();
  return (
    <>
      <PageHeader
        title={TITLE}
        subtitle={`${toFa(countProducts())} قطعه اصلی و OEM برای نیسان و هوندا. با فیلتر برند، مدل خودرو و دسته‌بندی، قطعه دقیق خودروی خود را پیدا کنید.`}
        crumbs={[{ label: "فروشگاه", href: PATH }]}
      />
      <div className="container-x mt-8">
        <Listing basePath={PATH} scope={{}} params={params} facets={{ brands: "path", categories: "path" }} listName={TITLE} />
      </div>
    </>
  );
}
