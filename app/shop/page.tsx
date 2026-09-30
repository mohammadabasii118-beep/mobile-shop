import type { Metadata } from "next";
import Script from "next/script";
import { ArrowDownUp, Watch, ChevronDown, Headphones, LayoutGrid, Loader2, Smartphone, Sparkles, Zap } from "lucide-react";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { BannerSlot } from "@/components/banner-slot";
import { getCategoryTree, getPhoneModels } from "@/lib/queries";
import { JsonLd } from "@/components/json-ld";
import { SHOP_PAGE_SIZE, SORTS, queryShop, type ShopSort } from "@/lib/shop-list";
import { abs, breadcrumbLd, buildMeta, getSeoSetting, paths } from "@/lib/seo";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";
type SP = Promise<{ cat?: string; sub?: string; model?: string; sort?: string; q?: string; page?: string }>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 80);

/**
 * /shop is the interactive listing. Filtered/sorted/paged variants are not separate pages for search engines:
 * they are noindex and canonicalised (a single category → its dedicated /category/<slug> page).
 */
export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const seo = await getSeoSetting("shop");
  const base = await buildMeta({ title: seo.title || "فروشگاه لوازم جانبی موبایل | CaseLine", description: seo.description || "قاب، گلس، شارژر، کابل و هندزفری اورجینال با تضمین سازگاری با مدل گوشی شما", path: "/shop", image: seo.ogImage, robots: seo.robots });
  const filtered = !!(sp.sub || sp.model || sp.sort || sp.q || (sp.page && sp.page !== "1"));
  if (sp.cat && !filtered) return { ...base, alternates: { canonical: paths.category(sp.cat) }, robots: { index: false, follow: true } };
  return filtered || sp.cat ? { ...base, robots: { index: false, follow: true } } : base;
}
const icons = { cases: Smartphone, airpods: Headphones, watch: Watch, electric: Zap, accessories: Sparkles };
const sorts: [string, string][] = [["default", "مرتب سازی پیش فرض"], ["popular", "مرتب سازی بر اساس محبوبیت"], ["rating", "مرتب سازی بر اساس میانگین رتبه"], ["newest", "مرتب سازی بر اساس جدیدترین"], ["asc", "مرتب سازی بر اساس هزینه: کم به زیاد"], ["desc", "مرتب سازی بر اساس هزینه: زیاد به کم"]];

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const cat = one(sp.cat), sub = one(sp.sub), model = one(sp.model), q = one(sp.q);
  const sort = (SORTS as readonly string[]).includes(one(sp.sort) ?? "") ? (one(sp.sort) as ShopSort) : "default";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [list, tree, phones] = await Promise.all([queryShop({ cat, sub, model, q, sort, page }), getCategoryTree(), getPhoneModels()]);
  const rows = list.items.map((card, i) => ({ card, sub: list.subs[i] ?? "" }));
  const total = list.total;
  const listLd = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: rows.slice(0, 12).map(({ card }, i) => ({ "@type": "ListItem", position: i + 1, url: abs(paths.product(card.slug)) })) };
  const btn = "flex w-full shrink-0 cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-[13px] font-bold transition-colors hover:bg-primary/5 data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary";
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="py-6">
        <Container>
          <h1 className="sr-only">فروشگاه لوازم جانبی موبایل</h1>
          <BannerSlot placement="shop_top" />
          <JsonLd data={[breadcrumbLd([{ name: "خانه", path: "/" }, { name: "فروشگاه", path: "/shop" }]), !cat && !sub && !model && !q && page === 1 ? listLd : null]} />
          <div data-shop data-cat={cat ?? ""} data-sub={sub ?? ""} data-model={model ?? ""} data-sort={sort} data-q={q ?? ""} data-page={list.page} data-total={total} data-size={SHOP_PAGE_SIZE} className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="space-y-4 lg:sticky lg:top-20">
              <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
                <h2 className="mb-2 hidden px-1 text-sm font-black lg:block">دسته‌بندی محصولات</h2>
                <div className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                  <button data-cat-btn="all" data-active={!cat && !sub} className={btn}>
                    <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-fg"><LayoutGrid className="size-4" /></span><span className="flex-1 text-start">همه محصولات</span>
                  </button>
                  {tree.map((c) => {
                    const I = icons[c.slug as keyof typeof icons] ?? Sparkles;
                    return (
                      <div key={c.slug} className="contents lg:block">
                        <button data-cat-btn={c.slug} data-active={cat === c.slug && !sub} className={btn}>
                          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><I className="size-4" /></span>
                          <span className="flex-1 whitespace-nowrap text-start lg:whitespace-normal">{c.label}</span>
                          <span className="hidden size-6 place-items-center rounded-full bg-surface-2 text-[10px] text-muted lg:grid">{toFa(c.productCount)}</span>
                        </button>
                        {c.subs.length > 0 && (
                          <div data-subs-of={c.slug} data-open={cat === c.slug} className="hidden flex-row gap-1 data-[open=true]:flex lg:flex-col lg:gap-0.5">
                            {c.subs.map((sb) => (
                              <button key={sb.slug} data-sub-btn={sb.slug} data-active={sub === sb.slug} className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-start text-xs font-medium text-muted hover:text-primary data-[active=true]:border-primary data-[active=true]:font-bold data-[active=true]:text-primary lg:me-3 lg:rounded-md lg:border-0 lg:border-e-2">{sb.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
                <label htmlFor="model-filter" className="mb-2 flex items-center gap-2 px-1 text-sm font-black"><Smartphone className="size-4 text-primary" />مدل گوشی شما</label>
                <select id="model-filter" data-model defaultValue={model ?? ""} dir="ltr" className="h-11 w-full cursor-pointer rounded-lg border border-primary/30 bg-surface px-3 text-sm outline-none focus:border-primary">
                  <option value="">همه مدل‌ها</option>
                  {phones.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
            </aside>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-2.5 shadow-sm">
                <details data-menu data-sort-menu className="group relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-primary/30 bg-surface px-3 py-2 text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                    <ArrowDownUp className="size-4" /><span data-sort-label>{sorts.find(([k]) => k === sort)?.[1]}</span><ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="absolute start-0 top-[calc(100%+6px)] z-30 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
                    {sorts.map(([k, l]) => <button key={k} data-sort={k} data-active={k === sort} className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-start text-xs font-medium hover:bg-primary/5 data-[active=true]:bg-primary/10 data-[active=true]:font-bold data-[active=true]:text-primary">{l}</button>)}
                  </div>
                </details>
                <span data-range className="text-[11px] text-muted">{total ? `نمایش ۱–${toFa(rows.length)} از ${toFa(total)} نتیجه` : "نتیجه‌ای یافت نشد"}</span>
              </div>

              <div data-grid className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                {rows.map(({ card: p, sub }) => (
                  <div key={p.id} data-item data-cat={p.categorySlug} data-sub={sub}>
                    <ProductCard p={p} showCat />
                  </div>
                ))}
              </div>
              <p data-empty hidden={total > 0} className="py-16 text-center text-sm text-muted">محصولی با این فیلتر پیدا نشد.</p>
              <div data-loader hidden role="status" className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted shadow-sm">
                <Loader2 className="size-4 animate-spin text-primary" />در حال بارگذاری موارد بیشتر…
              </div>
              <div data-sentinel className="h-px" />
            </div>

          </div>
        </Container>
      </main>
      <Footer />
      <BottomNav />
      <Script src="/shop.js" strategy="afterInteractive" />
    </>
  );
}
