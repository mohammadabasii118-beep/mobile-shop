import { BannerSlot } from "@/components/banner-slot";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { FileText, Star } from "lucide-react";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container, SectionHeader } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { BuyBox, HotBadge, StickyBar } from "@/components/product-detail";
import { ProductGallery } from "@/components/product-gallery";
import { ProductReviews } from "@/components/product-reviews";
import { getProductReviewsPage, getReviewSummary } from "@/lib/server/reviews";
import { getProductBySlug, getRelatedProducts, getSidebarProducts, toCard } from "@/lib/queries";
import { JsonLd } from "@/components/json-ld";
import { abs, breadcrumbLd, buildMeta, clip, paths, toRial } from "@/lib/seo";
import { resolveSlugRedirect } from "@/lib/server/redirects";
import { getCurrentUser } from "@/lib/server/auth/session";
import { unitPriceFor } from "@/lib/server/pricing";
import { loadActiveDiscounts } from "@/lib/server/price-engine/discounts";
import { buildVariantOptions } from "@/lib/server/price-engine/storefront";
import { getWholesalePolicy } from "@/lib/server/price-engine/wholesale";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

const rules: [string, string][] = [
  ["سازگاری:", "قبل از خرید مدل دقیق گوشی خود را انتخاب کنید؛ محصول فقط برای همان مدل ارسال می‌شود."],
  ["تفاوت رنگ:", "ممکن است رنگ محصول بسته به نمایشگر شما اندکی متفاوت دیده شود و این مورد مشمول مرجوعی نیست."],
  ["زمان ارسال:", "سفارش‌های تهران همان روز و شهرستان‌ها ۲ تا ۴ روز کاری ارسال می‌شود."],
  ["ضمانت:", "محصول ۷ روز ضمانت بازگشت دارد؛ به‌شرط باز نشدن بسته‌بندی یا آسیب ندیدن کالا."],
  ["خارج از ضمانت:", "آسیب فیزیکی، استفاده نادرست و بسته‌بندی آسیب‌دیده مشمول بازگشت وجه نمی‌شود."],
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(decodeURIComponent(slug));
  if (!p) return { robots: { index: false } };
  const models = p.phoneModels.map((m) => m.phoneModel.name);
  return buildMeta({
    title: p.seoTitle || `خرید ${p.name}${models[0] ? ` ${models[0]}` : ""} | ${p.category.name} | CaseLine`,
    description: p.seoDescription || p.shortDescription || p.description || `خرید ${p.name} اورجینال با ضمانت اصالت و ارسال سریع از CaseLine.`,
    path: paths.product(p.slug), canonical: p.canonical, image: p.images.find((i) => i.type === "IMAGE")?.url,
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await getProductBySlug(decodeURIComponent(slug));
  if (!row) { const to = await resolveSlugRedirect("product", decodeURIComponent(slug)); if (to) permanentRedirect(paths.product(to)); notFound(); }
  const [related, others, user, discounts, policy, summary, firstPage] = await Promise.all([getRelatedProducts(row.id, row.categoryId), getSidebarProducts(row.id), getCurrentUser(), loadActiveDiscounts(), getWholesalePolicy(), getReviewSummary(row.id), getProductReviewsPage(row.id, 1)]);
  const realCount = summary.count, realAvg = summary.avg;
  const card = { ...toCard({ ...row, images: row.images.filter((i) => i.type === "IMAGE").slice(0, 1) }, discounts), brand: row.brand?.name ?? null };
  const variantOptions = buildVariantOptions(row, user, discounts, policy);
  const models = row.phoneModels.map((m) => m.phoneModel.name);
  const stock = row.variants.reduce((a, v) => a + (v.inventory?.quantity ?? 0), 0);
  const variant = row.variants[0];
  const opt = variantOptions ? null : row.phoneModels.length
    ? { label: "مدل گوشی خود را انتخاب کنید", options: row.phoneModels.map((m) => ({ value: `m:${m.phoneModelId}`, label: m.phoneModel.name })) }
    : row.variants.length > 1
      ? { label: "گزینه مورد نظر را انتخاب کنید", options: row.variants.map((v) => ({ value: `v:${v.id}`, label: v.name })) }
      : null;
  // Wholesale price is decided on the server from the signed-in user's approved role; anonymous visitors never receive it.
  const ws = user?.wholesale && row.wholesalePrice != null && variant ? unitPriceFor(row, variant, Math.max(1, row.minWholesaleQty), user, undefined, policy.capAtRetail ? card.price : undefined) : null;
  const wholesale = ws && ws.priceType === "wholesale" ? { unit: ws.unitPrice, min: row.minWholesaleQty } : null;
  const title = `خرید ${row.name}${models[0] ? ` ${models[0]}` : ""} با ضمانت اصالت | ارسال فوری`;
  const attrGroups = new Map<string, { order: number; vals: string[] }>();
  for (const a of row.attributeValues) { const g = attrGroups.get(a.value.attribute.name) ?? { order: a.value.attribute.sortOrder, vals: [] }; g.vals.push(a.value.value); attrGroups.set(a.value.attribute.name, g); }
  const specs = { ...Object.fromEntries([...attrGroups].sort((x, y) => x[1].order - y[1].order).map(([n, g]) => [n, g.vals.join("، ")])), ...((row.specifications ?? {}) as Record<string, string>) };
  const cats = [row.category.parent, row.category].filter(Boolean);
  const crumbs = [{ name: "خانه", path: "/" }, { name: "فروشگاه", path: "/shop" }, ...cats.map((c) => ({ name: c!.name, path: paths.category(c!.slug) })), { name: row.name, path: paths.product(row.slug) }];
  const images = row.images.filter((i) => i.type === "IMAGE").map((i) => abs(i.url)!).filter(Boolean);
  // Structured data uses only stored facts. AggregateRating/Review appear only when there are real approved reviews.
  const productLd = {
    "@context": "https://schema.org", "@type": "Product", name: row.name, sku: row.sku, url: abs(paths.product(row.slug)),
    ...(images.length ? { image: images } : {}), description: clip(row.description || row.shortDescription, 300),
    ...(row.brand ? { brand: { "@type": "Brand", name: row.brand.name } } : {}), category: row.category.name,
    offers: { "@type": "Offer", url: abs(paths.product(row.slug)), priceCurrency: "IRR", price: toRial(card.price), itemCondition: "https://schema.org/NewCondition", availability: stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
    ...(realCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Math.round(realAvg * 10) / 10, reviewCount: realCount, bestRating: 5, worstRating: 1 }, review: firstPage.items.map((r) => ({ "@type": "Review", author: { "@type": "Person", name: r.name }, datePublished: r.createdAt.slice(0, 10), ...(r.title ? { name: r.title } : {}), reviewBody: r.body, reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 } })) } : {}),
  };
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="pb-32 lg:pb-24">
        <Container className="pt-6">
          <div className="min-w-0 space-y-14">
            <nav aria-label="مسیر" className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              <JsonLd data={[productLd, breadcrumbLd(crumbs)]} />
              <Link href="/" className="hover:text-primary">خانه</Link>
              {cats.map((c) => c && <span key={c.id} className="flex items-center gap-1.5">‹ <Link href={paths.category(c.slug)} className="hover:text-primary">{c.name}</Link></span>)}
              <span>‹ {row.name}</span>
            </nav>
            <section className="-mt-8">
              <BannerSlot placement="product_top" />
              <div className="mb-8 max-w-3xl border-b border-border pb-6">
              <h1 className="font-display text-[30px] leading-[1.25] sm:text-[40px]">{title}</h1>
              <p className="num mt-3 text-[12px] text-muted">(دیدگاه کاربر {toFa(realCount)}) · <span className="inline-flex items-center gap-1"><Star className="size-3 fill-warning text-warning" />{toFa(Math.round(realAvg * 10) / 10)}</span> · SKU: <span dir="ltr">{row.sku}</span></p>
              </div>
              <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
                <ProductGallery items={row.images.map((m) => ({ id: m.id, type: m.type, url: m.url, alt: m.alt, caption: m.caption, width: m.width, height: m.height }))} fallback={card} brandName={row.brand?.name ?? "CaseLine"} hot={<HotBadge />} hotBadge={card.oldPrice != null} />
                <div>
                  {card.oldPrice != null && !variantOptions && <p className="mb-3 text-[13px] text-muted">قیمت قبل: <s>{formatToman(card.oldPrice)}</s></p>}
                  <BuyBox p={card} opt={opt} variants={variantOptions} inStock={stock > 0} maxQty={Math.max(1, Math.min(99, stock))} wholesale={wholesale} />
                </div>
              </div>
              <p className="mt-10 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-border pt-5 text-[13px] text-muted">دسته‌بندی: {[row.category, ...row.extraCategories.map((e) => e.category)].map((c, i) => <span key={c.id}>{i > 0 && "، "}<Link href={paths.category(c.slug)} className="font-bold text-foreground hover:text-primary">{c.name}</Link></span>)}
                {(row.brand || row.extraBrands.length > 0) && <> · برند: {[...(row.brand ? [row.brand] : []), ...row.extraBrands.map((e) => e.brand)].map((b, i) => <span key={b.id}>{i > 0 && "، "}<Link href={paths.brand(b.slug)} className="font-bold text-foreground hover:text-primary">{b.name}</Link></span>)}</>}
              </p>
              {row.phoneModels.length > 0 && <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">سازگار با: {row.phoneModels.slice(0, 8).map((m) => <Link key={m.phoneModelId} href={paths.model(m.phoneModel.slug)} className="rounded-full bg-surface-2 px-2.5 py-1 font-medium text-foreground hover:text-primary">{m.phoneModel.name}</Link>)}</p>}
            </section>

            <div className="tabs">
              <input type="radio" name="tab" id="tab-desc" defaultChecked className="sr-only" />
              <input type="radio" name="tab" id="tab-faq" className="sr-only" />
              <input type="radio" name="tab" id="tab-rev" className="sr-only" />
              <div className="no-scrollbar mb-8 flex gap-1 overflow-x-auto border-b border-border">
                {[["tab-desc", "توضیحات"], ["tab-faq", "سوالات متداول"], ["tab-rev", "نظرات کاربران"]].map(([f, l]) => <label key={f} htmlFor={f} className="tab-label shrink-0 cursor-pointer px-5 py-3 text-[14px] font-semibold text-muted transition-colors hover:text-foreground">{l}</label>)}
              </div>
              <div className="max-w-[880px] text-[14px] leading-8">
                <div className="panel panel-desc space-y-4">
                  {row.description && <p>{row.description}</p>}
                  {Object.keys(specs).length > 0 && (
                    <dl className="grid gap-x-12 border-t border-border sm:grid-cols-2">
                      {Object.entries(specs).map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-border py-3 text-[13px]"><dt className="text-muted">{k}</dt><dd className="font-semibold">{String(v)}</dd></div>)}
                    </dl>
                  )}
                  <div className="rounded-[10px] bg-surface-2 p-5 sm:p-7">
                    <div className="mb-4 flex items-center gap-3 font-display text-[26px] leading-none"><FileText className="size-5 text-primary" strokeWidth={1.7} />قوانین خرید و ارسال</div>
                    <ol className="space-y-0">
                      {rules.map(([h, t], i) => (
                        <li key={h} className="flex gap-4 border-b border-border py-3 text-[13px] leading-7 last:border-0"><span className="num w-5 shrink-0 pt-px text-[12px] font-bold text-muted">{toFa(i + 1)}</span><span><b className="text-foreground">{h}</b> <span className="text-foreground/80">{t}</span></span></li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div className="panel panel-faq space-y-4">
                  {row.questions.length ? row.questions.map((q) => <div key={q.id}><h3 className="font-black">{q.question}</h3><p className="text-muted">{q.answer}</p></div>) : <p className="text-muted">هنوز سوالی برای این محصول ثبت نشده است.</p>}
                </div>
                <div className="panel panel-rev space-y-4"><ProductReviews slug={row.slug} summary={summary} initial={firstPage.items} hasMore={firstPage.hasMore} /></div>
              </div>
            </div>

            {related.length > 0 && (
              <section>
                <SectionHeader title="محصولات مشابه" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
                  {related.slice(0, 4).map((x) => <div key={x.id}><ProductCard p={x} showCat /></div>)}
                </div>
              </section>
            )}

            {others.length > 0 && (
              <section>
                <SectionHeader title="پیشنهادهای ویژه" href="/shop" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
                  {others.slice(0, 4).map((x) => <div key={x.id}><ProductCard p={x} showCat /></div>)}
                </div>
              </section>
            )}
          </div>
        </Container>
      </main>
      <Footer />
      <StickyBar p={card} />
      <BottomNav />
    </>
  );
}
