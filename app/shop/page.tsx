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
  const btn = "flex w-auto shrink-0 cursor-pointer items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-semibold transition-colors hover:border-foreground data-[active=true]:border-foreground data-[active=true]:bg-secondary data-[active=true]:text-secondary-fg lg:w-full lg:rounded-none lg:border-0 lg:border-b lg:bg-transparent lg:px-0 lg:py-3 lg:data-[active=true]:bg-transparent lg:data-[active=true]:text-primary lg:data-[active=true]:shadow-[inset_-2px_0_0_var(--primary)] lg:data-[active=true]:ps-0";
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="pb-10">
        <section className="border-b border-border bg-surface">
          <Container className="py-8 sm:py-12">
            <nav aria-label="مسیر" className="mb-4 flex items-center gap-2 text-[12px] text-muted"><a href="/" className="hover:text-primary">خانه</a><span aria-hidden>/</span><span aria-current="page" className="text-foreground">فروشگاه</span></nav>
            <h1 className="font-display text-[40px] leading-[1.1] sm:text-[56px]">فروشگاه لوازم جانبی موبایل</h1>
            <p className="mt-3 max-w-xl text-[14px] text-muted">قاب، گلس، شارژر، کابل و هندزفری اورجینال، با تضمین سازگاری با مدل گوشی شما.</p>
          </Container>
        </section>
        <Container className="pt-8">
          <BannerSlot placement="shop_top" />
          <JsonLd data={[breadcrumbLd([{ name: "خانه", path: "/" }, { name: "فروشگاه", path: "/shop" }]), !cat && !sub && !model && !q && page === 1 ? listLd : null]} />
          <div data-shop data-cat={cat ?? ""} data-sub={sub ?? ""} data-model={model ?? ""} data-sort={sort} data-q={q ?? ""} data-page={list.page} data-total={total} data-size={SHOP_PAGE_SIZE} className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
            <aside className="space-y-6 lg:sticky lg:top-24">
              <div>
                <h2 className="mb-3 hidden text-[12px] font-bold tracking-wide text-muted lg:block">دسته‌بندی محصولات</h2>
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-t lg:border-border lg:pb-0">
                  <button data-cat-btn="all" data-active={!cat && !sub} className={btn}>
                    <LayoutGrid className="size-4 shrink-0" strokeWidth={1.7} /><span className="flex-1 text-start">همه محصولات</span>
                  </button>
                  {tree.map((c) => {
                    const I = icons[c.slug as keyof typeof icons] ?? Sparkles;
                    return (
                      <div key={c.slug} className="contents lg:block">
                        <button data-cat-btn={c.slug} data-active={cat === c.slug && !sub} className={btn}>
                          <I className="size-4 shrink-0" strokeWidth={1.7} />
                          <span className="flex-1 whitespace-nowrap text-start lg:whitespace-normal">{c.label}</span>
                          <span className="num hidden text-[11px] font-medium text-muted lg:block">{toFa(c.productCount)}</span>
                        </button>
                        {c.subs.length > 0 && (
                          <div data-subs-of={c.slug} data-open={cat === c.slug} className="hidden flex-row gap-1 data-[open=true]:flex lg:flex-col lg:gap-0.5">
                            {c.subs.map((sb) => (
                              <button key={sb.slug} data-sub-btn={sb.slug} data-active={sub === sb.slug} className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-start text-xs font-medium text-muted hover:text-foreground data-[active=true]:border-foreground data-[active=true]:font-bold data-[active=true]:text-foreground lg:rounded-none lg:border-0 lg:py-2 lg:ps-6 lg:data-[active=true]:text-primary">{sb.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="model-filter" className="mb-3 flex items-center gap-2 text-[12px] font-bold tracking-wide text-muted"><Smartphone className="size-4" strokeWidth={1.7} />مدل گوشی شما</label>
                <select id="model-filter" data-model defaultValue={model ?? ""} dir="ltr" className="h-12 w-full cursor-pointer rounded-md border border-border-strong bg-card px-3 text-sm outline-none transition-colors focus:border-foreground">
                  <option value="">همه مدل‌ها</option>
                  {phones.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
            </aside>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                <details data-menu data-sort-menu className="group relative">
                  <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-border-strong bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:border-foreground [&::-webkit-details-marker]:hidden">
                    <ArrowDownUp className="size-4" /><span data-sort-label>{sorts.find(([k]) => k === sort)?.[1]}</span><ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="absolute start-0 top-[calc(100%+6px)] z-30 w-72 rounded-[10px] border border-border bg-card p-1.5 shadow-lg">
                    {sorts.map(([k, l]) => <button key={k} data-sort={k} data-active={k === sort} className="block w-full cursor-pointer rounded-md px-3 py-2.5 text-start text-[13px] font-medium hover:bg-surface-2 data-[active=true]:font-bold data-[active=true]:text-primary">{l}</button>)}
                  </div>
                </details>
                <span data-range className="num text-[12px] text-muted">{total ? `نمایش ۱–${toFa(rows.length)} از ${toFa(total)} نتیجه` : "نتیجه‌ای یافت نشد"}</span>
              </div>

              <div data-grid className="mt-6 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 sm:gap-y-9 md:grid-cols-3 xl:grid-cols-4">
                {rows.map(({ card: p, sub }) => (
                  <div key={p.id} data-item data-cat={p.categorySlug} data-sub={sub}>
                    <ProductCard p={p} showCat />
                  </div>
                ))}
              </div>
              <div data-empty hidden={total > 0} className="mx-auto my-16 max-w-sm text-center"><span className="mx-auto mb-4 grid size-14 place-items-center rounded-[10px] bg-surface-2 text-muted"><Smartphone className="size-6" strokeWidth={1.5} /></span><p className="font-display text-[26px] leading-tight">محصولی با این فیلتر پیدا نشد</p><p className="mt-2 text-[13px] text-muted">فیلترها را عوض کنید یا «همه محصولات» را انتخاب کنید.</p></div>
              <div data-loader hidden role="status" className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs text-muted">
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
