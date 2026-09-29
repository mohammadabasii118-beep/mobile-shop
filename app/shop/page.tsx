import type { Metadata } from "next";
import Script from "next/script";
import { ArrowDownUp, Watch, ChevronDown, Headphones, LayoutGrid, Loader2, Smartphone, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { catalog, shopCatOf, shopCats, shopModels, shopSubOf } from "@/lib/data";
import { toFa } from "@/lib/utils";

export const metadata: Metadata = { title: "فروشگاه | CaseLine" };
const base = process.env.PAGES === "1" ? "/mobile-shop" : "";
const icons = { phone: Smartphone, shield: ShieldCheck, zap: Zap, headphones: Headphones, sparkles: Sparkles, watch: Watch };
const sorts: [string, string][] = [["default", "مرتب سازی پیش فرض"], ["popular", "مرتب سازی بر اساس محبوبیت"], ["rating", "مرتب سازی بر اساس میانگین رتبه"], ["newest", "مرتب سازی بر اساس جدیدترین"], ["asc", "مرتب سازی بر اساس هزینه: کم به زیاد"], ["desc", "مرتب سازی بر اساس هزینه: زیاد به کم"]];

export default function ShopPage() {
  const items = catalog.map((p) => ({ p, cat: shopCatOf(p), sub: shopSubOf(p) }));
  const btn = "flex w-full shrink-0 cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-[13px] font-bold transition-colors hover:bg-primary/5 data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary";
  return (
    <>
      <Header />
      <main className="py-6">
        <Container>
          <div data-shop className="grid items-start gap-4 lg:grid-cols-[230px_1fr]">
            <aside className="space-y-4 lg:sticky lg:top-20">
              <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
                <h2 className="mb-2 hidden px-1 text-sm font-black lg:block">دسته‌بندی محصولات</h2>
                <div className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                  <button data-cat-btn="all" data-active="true" className={btn}>
                    <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-fg"><LayoutGrid className="size-4" /></span><span className="flex-1 text-start">همه محصولات</span>
                  </button>
                  {shopCats.map((c) => {
                    const I = icons[c.icon as keyof typeof icons];
                    return (
                      <div key={c.slug} className="contents lg:block">
                        <button data-cat-btn={c.slug} data-active="false" className={btn}>
                          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><I className="size-4" /></span>
                          <span className="flex-1 whitespace-nowrap text-start lg:whitespace-normal">{c.label}</span>
                          <span className="hidden size-6 place-items-center rounded-full bg-surface-2 text-[10px] text-muted lg:grid">{toFa(items.filter((x) => x.cat === c.slug).length)}</span>
                        </button>
                        {c.subs.length > 0 && (
                          <div data-subs-of={c.slug} className="hidden flex-row gap-1 data-[open=true]:flex lg:flex-col lg:gap-0.5">
                            {c.subs.map((sb) => (
                              <button key={sb.slug} data-sub-btn={sb.slug} data-active="false" className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-start text-xs font-medium text-muted hover:text-primary data-[active=true]:border-primary data-[active=true]:font-bold data-[active=true]:text-primary lg:me-3 lg:rounded-md lg:border-0 lg:border-e-2">{sb.label}</button>
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
                <select id="model-filter" data-model dir="ltr" className="h-11 w-full cursor-pointer rounded-lg border border-primary/30 bg-surface px-3 text-sm outline-none focus:border-primary">
                  <option value="">همه مدل‌ها</option>
                  {shopModels.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </aside>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-2.5 shadow-sm">
                <details data-menu data-sort-menu className="group relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-primary/30 bg-surface px-3 py-2 text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                    <ArrowDownUp className="size-4" /><span data-sort-label>مرتب سازی پیش فرض</span><ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="absolute start-0 top-[calc(100%+6px)] z-30 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
                    {sorts.map(([k, l]) => <button key={k} data-sort={k} data-active={k === "default"} className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-start text-xs font-medium hover:bg-primary/5 data-[active=true]:bg-primary/10 data-[active=true]:font-bold data-[active=true]:text-primary">{l}</button>)}
                  </div>
                </details>
                <span data-range className="text-[11px] text-muted">نمایش ۱–۱۲ از {toFa(catalog.length)} نتیجه</span>
              </div>

              <div data-grid className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                {items.map(({ p, cat, sub }) => (
                  <div key={p.id} data-item data-cat={cat} data-sub={sub} data-price={p.price} data-pop={p.reviews} data-rating={p.rating} data-new={p.badge === "جدید" ? 1 : 0} data-compat={p.compat ?? ""}>
                    <ProductCard p={p} showCat />
                  </div>
                ))}
              </div>
              <p data-empty hidden className="py-16 text-center text-sm text-muted">محصولی با این فیلتر پیدا نشد.</p>
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
      <Script src={`${base}/shop.js`} strategy="afterInteractive" />
    </>
  );
}
