import Link from "next/link";
import Form from "next/form";
import { ArrowDownWideNarrow, Check, PackageSearch, Search, SlidersHorizontal, X } from "lucide-react";
import { BRANDS, modelsOf, yearsOf, type BrandId } from "@/data/vehicles";
import { CATEGORIES, getCategory } from "@/data/categories";
import {
  PRICE_RANGES, SORT_OPTIONS, categoryFacets, categoryPath, listProducts, modelFacets, modelPath,
  type ListingParams, type Scope,
} from "@/lib/catalog";
import { JsonLd, itemListLd } from "@/lib/seo";
import { ProductGrid } from "./product-card";
import { Pagination } from "./pagination";
import { cn, toFa } from "@/lib/utils";

type Facets = {
  /** category links: "path" → clean category pages (indexable); "param" → ?cat= inside the current scope */
  categories?: "path" | "param";
  /** brand links: "path" → /nissan; "param" → ?brand= */
  brands?: "path" | "param";
  /** list models of this brand as links to their own pages */
  modelsOf?: BrandId;
  /** offer a year filter for this model */
  yearsFor?: string;
};

/**
 * Server-rendered product listing. Every filter, sort option and page is a
 * real <a href>, so crawlers and no-JS users see exactly what users see.
 * Faceted URLs are rel="nofollow" prefetch={false} and set to noindex by the page metadata.
 */
export function Listing({
  basePath,
  scope,
  params,
  facets,
  keep,
  listName,
}: {
  basePath: string;
  scope: Scope;
  params: ListingParams;
  facets: Facets;
  /** extra query params to preserve, e.g. { q } on the search page */
  keep?: Record<string, string>;
  listName: string;
}) {
  const result = listProducts(scope, params);

  const href = (patch: Partial<Record<"cat" | "brand" | "year" | "price" | "stock" | "sort" | "page", string | null>>) => {
    const state: Record<string, string | undefined> = {
      ...keep,
      cat: params.cats.join(",") || undefined,
      brand: params.brand,
      year: params.year ? String(params.year) : undefined,
      price: params.price,
      stock: params.inStock ? "1" : undefined,
      sort: params.sort === "popular" ? undefined : params.sort,
    };
    for (const [k, v] of Object.entries(patch)) state[k] = v ?? undefined;
    if (!("page" in patch)) delete state.page;
    if (state.page === "1") delete state.page;
    const qs = new URLSearchParams(Object.entries(state).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const toggleCat = (id: string) => {
    const next = params.cats.includes(id) ? params.cats.filter((c) => c !== id) : [...params.cats, id];
    return href({ cat: next.join(",") || null });
  };

  const chips: { label: string; href: string }[] = [];
  if (params.brand) chips.push({ label: BRANDS.find((b) => b.id === params.brand)!.nameFa, href: href({ brand: null }) });
  if (params.year) chips.push({ label: `مدل ${toFa(params.year)}`, href: href({ year: null }) });
  params.cats.forEach((c) => chips.push({ label: getCategory(c)!.nameFa, href: toggleCat(c) }));
  if (params.price) chips.push({ label: PRICE_RANGES.find((r) => r.id === params.price)!.label, href: href({ price: null }) });
  if (params.inStock) chips.push({ label: "فقط موجود", href: href({ stock: null }) });

  const catCounts = categoryFacets(scope);
  const facetLink = "rounded-lg px-2.5 py-2 text-sm transition hover:bg-neutral-100";

  const filterPanel = (
    <div className="space-y-6">
      {keep?.q !== undefined && (
        <Form action={basePath} className="relative" role="search">
          <label htmlFor="listing-q" className="sr-only">جستجو در نتایج</label>
          <input id="listing-q" name="q" defaultValue={keep.q} placeholder="نام قطعه، کد فنی، OEM…" className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pr-10 pl-3 text-sm outline-none focus:border-neutral-950 focus:bg-white" />
          <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-500" aria-hidden />
        </Form>
      )}

      {facets.brands && (
        <FilterGroup title="برند خودرو">
          <div className="grid grid-cols-2 gap-1.5">
            {BRANDS.map((b) => {
              const active = params.brand === b.id;
              const to = facets.brands === "path" ? `/${b.id}` : href({ brand: active ? null : b.id });
              return (
                <Link key={b.id} href={to} rel={facets.brands === "param" ? "nofollow" : undefined} prefetch={facets.brands === "param" ? false : undefined} aria-current={active ? "true" : undefined} className={cn("rounded-xl border py-2 text-center text-sm font-semibold transition", active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 hover:border-neutral-500")}>
                  {b.nameFa}
                </Link>
              );
            })}
          </div>
        </FilterGroup>
      )}

      {facets.modelsOf && (
        <FilterGroup title="مدل خودرو">
          <ul className="max-h-72 space-y-0.5 overflow-y-auto pl-1">
            {modelsOf(facets.modelsOf).map((m) => {
              const n = modelFacets({ brand: facets.modelsOf }).get(m.id) ?? 0;
              const active = scope.model === m.id;
              return (
                <li key={m.id}>
                  <Link href={active ? `/${m.brand}` : modelPath(m.brand, m.id)} aria-current={active ? "page" : undefined} className={cn("flex items-center justify-between", facetLink, active && "bg-red-50 font-bold text-primary")}>
                    <span className="flex items-center gap-2">
                      {m.nameFa}
                      <span className="text-[11px] text-neutral-500" dir="ltr">{m.nameEn}</span>
                    </span>
                    <span className="text-[11px] text-neutral-500">{toFa(n)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </FilterGroup>
      )}

      {facets.yearsFor && (
        <FilterGroup title="سال ساخت">
          <div className="grid grid-cols-4 gap-1.5">
            {yearsOf(facets.yearsFor).map((y) => {
              const active = params.year === y;
              return (
                <Link key={y} href={href({ year: active ? null : String(y) })} rel="nofollow" prefetch={false} aria-current={active ? "true" : undefined} className={cn("rounded-lg border py-1.5 text-center text-xs font-semibold transition", active ? "border-primary bg-primary text-white" : "border-neutral-200 hover:border-neutral-500")}>
                  {toFa(y)}
                </Link>
              );
            })}
          </div>
        </FilterGroup>
      )}

      {facets.categories && (
        <FilterGroup title="دسته‌بندی قطعه">
          <ul className="max-h-80 space-y-0.5 overflow-y-auto pl-1">
            {CATEGORIES.map((c) => {
              const n = catCounts.get(c.id) ?? 0;
              if (!n) return null;
              const checked = params.cats.includes(c.id);
              const isPath = facets.categories === "path";
              return (
                <li key={c.id}>
                  <Link href={isPath ? categoryPath(c.id) : toggleCat(c.id)} rel={isPath ? undefined : "nofollow"} prefetch={isPath ? undefined : false} aria-current={checked ? "true" : undefined} className={cn("flex items-center justify-between", facetLink)}>
                    <span className="flex items-center gap-2.5">
                      {!isPath && (
                        <span className={cn("grid size-4 place-items-center rounded border", checked ? "border-primary bg-primary text-white" : "border-neutral-400")} aria-hidden>
                          {checked && <Check className="size-3" />}
                        </span>
                      )}
                      {c.nameFa}
                    </span>
                    <span className="text-[11px] text-neutral-500">{toFa(n)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </FilterGroup>
      )}

      <FilterGroup title="محدوده قیمت (تومان)">
        <div className="grid grid-cols-2 gap-1.5">
          {PRICE_RANGES.map((r) => {
            const active = params.price === r.id;
            return (
              <Link key={r.id} href={href({ price: active ? null : r.id })} rel="nofollow" prefetch={false} aria-current={active ? "true" : undefined} className={cn("rounded-xl border px-2 py-2 text-center text-xs font-semibold transition", active ? "border-primary bg-red-50 text-primary" : "border-neutral-200 hover:border-neutral-500")}>
                {r.label}
              </Link>
            );
          })}
        </div>
      </FilterGroup>

      <Link href={href({ stock: params.inStock ? null : "1" })} rel="nofollow" prefetch={false} role="switch" aria-checked={params.inStock} className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 text-sm font-semibold">
        فقط کالاهای موجود
        <span className={cn("relative block h-6 w-11 rounded-full transition", params.inStock ? "bg-primary" : "bg-neutral-300")} aria-hidden>
          <span className={cn("absolute top-1 right-1 size-4 rounded-full bg-white shadow transition", params.inStock && "-translate-x-5")} />
        </span>
      </Link>
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      {result.items.length > 0 && <JsonLd data={itemListLd(listName, result.items.map((p) => `/product/${p.slug}`))} />}

      {/* Mobile: CSS-only bottom sheet (checkbox toggle) – no JavaScript needed */}
      <input type="checkbox" id="filters-toggle" className="peer sr-only" aria-label="نمایش فیلترها" />
      <aside aria-label="فیلتر محصولات" className="fixed inset-x-0 bottom-0 z-50 hidden max-h-[85dvh] flex-col rounded-t-3xl bg-white shadow-2xl peer-checked:flex lg:static lg:z-auto lg:flex lg:max-h-none lg:rounded-none lg:bg-transparent lg:shadow-none">
        <div className="flex items-center justify-between border-b p-4 lg:hidden">
          <p className="text-lg font-black">فیلتر محصولات</p>
          <label htmlFor="filters-toggle" className="grid size-9 cursor-pointer place-items-center rounded-full bg-neutral-100" aria-label="بستن فیلترها"><X className="size-4" /></label>
        </div>
        <div className="overflow-y-auto p-5 lg:sticky lg:top-44 lg:max-h-[calc(100dvh-12rem)] lg:rounded-2xl lg:border lg:border-neutral-200 lg:bg-white">{filterPanel}</div>
        <div className="border-t p-4 lg:hidden">
          <label htmlFor="filters-toggle" className="flex h-12 cursor-pointer items-center justify-center rounded-xl bg-primary font-bold text-white">نمایش {toFa(result.total)} محصول</label>
        </div>
      </aside>
      <label htmlFor="filters-toggle" className="fixed inset-0 z-40 hidden bg-black/50 peer-checked:block lg:hidden!" aria-hidden />

      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
          <label htmlFor="filters-toggle" className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 px-4 text-sm font-semibold lg:hidden">
            <SlidersHorizontal className="size-4" aria-hidden />
            فیلترها
            {chips.length > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-white">{toFa(chips.length)}</span>}
          </label>
          <p className="text-sm text-neutral-700" aria-live="polite">
            <span className="font-extrabold text-neutral-950">{toFa(result.total)}</span> محصول
          </p>
          <div className="mr-auto flex items-center gap-2">
            <ArrowDownWideNarrow className="hidden size-4 text-neutral-500 sm:block" aria-hidden />
            <span className="hidden text-sm text-neutral-600 sm:inline">مرتب‌سازی:</span>
            <ul className="hidden gap-1 xl:flex">
              {SORT_OPTIONS.map((o) => (
                <li key={o.value}>
                  <Link href={href({ sort: o.value === "popular" ? null : o.value })} rel="nofollow" prefetch={false} aria-current={params.sort === o.value ? "true" : undefined} className={cn("block rounded-lg px-3 py-1.5 text-sm transition", params.sort === o.value ? "bg-neutral-950 font-semibold text-white" : "text-neutral-700 hover:bg-neutral-100")}>
                    {o.label}
                  </Link>
                </li>
              ))}
            </ul>
            <details className="group relative xl:hidden">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-neutral-200 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {SORT_OPTIONS.find((o) => o.value === params.sort)!.label}
              </summary>
              <ul className="absolute left-0 z-20 mt-1 w-44 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl">
                {SORT_OPTIONS.map((o) => (
                  <li key={o.value}>
                    <Link href={href({ sort: o.value === "popular" ? null : o.value })} rel="nofollow" prefetch={false} className={cn("block rounded-lg px-3 py-2 text-sm", params.sort === o.value ? "bg-neutral-100 font-bold" : "hover:bg-neutral-50")}>{o.label}</Link>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>

        {chips.length > 0 && (
          <ul className="mb-5 flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال">
            {chips.map((c) => (
              <li key={c.label}>
                <Link href={c.href} rel="nofollow" prefetch={false} className="group flex items-center gap-1.5 rounded-full bg-neutral-950 py-1.5 pr-3.5 pl-2 text-xs font-semibold text-white transition hover:bg-primary" aria-label={`حذف فیلتر ${c.label}`}>
                  {c.label}
                  <X className="size-3.5 opacity-70 group-hover:opacity-100" aria-hidden />
                </Link>
              </li>
            ))}
            <li><Link href={keep?.q ? `${basePath}?q=${encodeURIComponent(keep.q)}` : basePath} className="px-2 text-xs font-semibold text-primary hover:underline">حذف همه فیلترها</Link></li>
          </ul>
        )}

        {result.items.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-white text-neutral-500 shadow-sm"><PackageSearch className="size-8" aria-hidden /></span>
            <h2 className="mt-5 text-lg font-bold">محصولی با این مشخصات پیدا نشد</h2>
            <p className="mt-2 max-w-md text-sm text-neutral-600">فیلترها را تغییر دهید یا کد فنی قطعه را برای کارشناسان ما بفرستید تا از انبار مرکزی استعلام شود.</p>
            <div className="mt-6 flex gap-2">
              <Link href={basePath} className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-semibold">حذف فیلترها</Link>
              <Link href="/contact" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white">استعلام قطعه</Link>
            </div>
          </div>
        ) : (
          <>
            <ProductGrid products={result.items} className="xl:grid-cols-3" headingLevel="h2" preloadFirst />
            <Pagination page={result.page} pages={result.pages} hrefFor={(n) => href({ page: n > 1 ? String(n) : null })} />
          </>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-extrabold text-neutral-950">{title}</h2>
      {children}
    </section>
  );
}
