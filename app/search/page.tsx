import type { Metadata } from "next";
import { searchProducts, getAllActiveCategoriesFlat } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import FilterSidebar from "@/components/FilterSidebar";
import { getMyPhone } from "@/lib/actions/myPhone";
import { isViewerWholesale, effectivePrice } from "@/lib/wholesalePricing";
import { fa } from "@/lib/format";

export const metadata: Metadata = { title: "نتایج جستجو" };

export default async function SearchPage(
  props: {
    searchParams: Promise<{ q?: string; sort?: string; discount?: string; cat?: string; myphone?: string; model?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const q = searchParams.q?.trim() || "";
  const selectedCats = searchParams.cat?.split(",").filter(Boolean) || [];
  const [myPhone, isWholesale] = await Promise.all([getMyPhone(), isViewerWholesale()]);
  const wantsMyPhoneFilter = searchParams.myphone === "1" && !!myPhone?.phoneModelId;
  // `model` is a direct, anonymous phone-model filter (e.g. from the
  // homepage's quick model picker) — independent of the logged-in user's
  // saved "My Phone". If both were somehow present, the explicit `model`
  // query param wins, since it's the more specific, just-made choice.
  const phoneModelId = searchParams.model || (wantsMyPhoneFilter ? myPhone!.phoneModelId! : undefined);
  const [products, categories] = await Promise.all([
    searchProducts(q, {
      sort: searchParams.sort,
      onlyDiscount: searchParams.discount === "1",
      categoryIds: selectedCats,
      phoneModelId,
    }),
    getAllActiveCategoriesFlat(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-2xl font-extrabold mb-1">نتایج جستجو</h1>
      <p className="text-sm muted mb-6">{q ? `برای «${q}» — ` : ""}{fa(products.length)} محصول یافت شد</p>
      <div className="flex flex-col md:flex-row gap-8">
        <FilterSidebar
          subcategories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
          myPhoneLabel={myPhone ? `${myPhone.brandName || ""} ${myPhone.phoneModelName || ""}`.trim() : null}
        />
        <div className="flex-1">
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
              <p className="col-span-full text-center muted py-16">محصولی یافت نشد. عبارت دیگری را امتحان کنید.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
