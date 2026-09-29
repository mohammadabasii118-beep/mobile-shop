import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getFilteredProducts } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import FilterSidebar from "@/components/FilterSidebar";
import { getMyPhone } from "@/lib/actions/myPhone";
import { isViewerWholesale, effectivePrice } from "@/lib/wholesalePricing";
import { fa } from "@/lib/format";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return {};
  return {
    title: category.name,
    description: `خرید ${category.name} با ارسال سریع و ضمانت اصالت کالا از کیس لاین.`,
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams: { sort?: string; discount?: string; cat?: string; myphone?: string };
}) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) notFound();

  const baseIds = category.children.length ? category.children.map((c) => c.id) : [category.id];
  const selectedCats = searchParams.cat?.split(",").filter(Boolean) || [];
  const [myPhone, isWholesale] = await Promise.all([getMyPhone(), isViewerWholesale()]);
  const wantsMyPhoneFilter = searchParams.myphone === "1" && !!myPhone?.phoneModelId;

  const products = await getFilteredProducts(baseIds, {
    sort: searchParams.sort,
    onlyDiscount: searchParams.discount === "1",
    categoryIds: selectedCats,
    phoneModelId: wantsMyPhoneFilter ? myPhone!.phoneModelId! : undefined,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <p className="text-sm muted mb-2">
        <Link href="/" className="hover:underline">خانه</Link> ← {category.name}
      </p>
      <h1 className="text-2xl font-extrabold mb-6">{category.name}</h1>
      <div className="flex flex-col md:flex-row gap-8">
        <FilterSidebar
          subcategories={category.children.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
          myPhoneLabel={myPhone ? `${myPhone.brandName || ""} ${myPhone.phoneModelName || ""}`.trim() : null}
        />
        <div className="flex-1">
          <p className="text-sm muted mb-4">{fa(products.length)} محصول</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {products.length ? (
              products.map((p) => (
                <ProductCard
                  key={p.id}
                  p={{
                    id: p.id, slug: p.slug, name: p.name,
                    price: effectivePrice(p.price, p.wholesalePrice, isWholesale),
                    oldPrice: isWholesale && p.wholesalePrice != null ? null : p.oldPrice,
                    images: p.images, isBestSeller: p.isBestSeller, isNew: p.isNew, isTrending: p.isTrending, hasVariants: p.hasVariants, avgRating: p.avgRating, reviewCount: p.reviewCount,
                  }}
                />
              ))
            ) : (
              <p className="col-span-full text-center muted py-16">محصولی با این فیلتر یافت نشد</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
