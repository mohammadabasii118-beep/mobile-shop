import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Star } from "lucide-react";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { BuyBox, HotBadge, StickyBar, Thumb } from "@/components/product-detail";
import { getProductBySlug, getRelatedProducts, getSidebarProducts, toCard } from "@/lib/queries";
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
  if (!p) return {};
  return {
    title: p.seoTitle ?? `خرید ${p.name} | CaseLine`,
    description: p.seoDescription ?? p.shortDescription ?? undefined,
    alternates: p.canonical ? { canonical: p.canonical } : undefined,
    openGraph: { title: p.seoTitle ?? p.name, description: p.seoDescription ?? p.shortDescription ?? undefined, images: p.images[0] ? [p.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await getProductBySlug(decodeURIComponent(slug));
  if (!row) notFound();
  const [related, others] = await Promise.all([getRelatedProducts(row.id, row.categoryId), getSidebarProducts(row.id)]);
  const card = { ...toCard({ ...row, variants: row.variants }), brand: row.brand?.name ?? null };
  const models = row.phoneModels.map((m) => m.phoneModel.name);
  const stock = row.variants.reduce((a, v) => a + (v.inventory?.quantity ?? 0), 0);
  const opt = models.length
    ? { label: "مدل گوشی خود را انتخاب کنید", options: models }
    : row.variants.length > 1
      ? { label: "گزینه مورد نظر را انتخاب کنید", options: row.variants.map((v) => v.name) }
      : { label: "رنگ خود را انتخاب کنید", options: ["مشکی", "سفید", "آبی", "نقره‌ای"] };
  const title = `خرید ${row.name}${models[0] ? ` ${models[0]}` : ""} با ضمانت اصالت | ارسال فوری`;
  const specs = (row.specifications ?? {}) as Record<string, string>;
  const cats = [row.category.parent, row.category].filter(Boolean);
  return (
    <>
      <Header />
      <main className="pt-6">
        <Container className="grid items-start gap-4 lg:grid-cols-[1fr_230px]">
          <div className="min-w-0 space-y-4">
            <nav aria-label="مسیر" className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
              <Link href="/" className="hover:text-primary">خانه</Link>
              {cats.map((c) => c && <span key={c.id} className="flex items-center gap-1.5">‹ <Link href={`/shop#${c.slug}`} className="hover:text-primary">{c.name}</Link></span>)}
              <span>‹ {row.name}</span>
            </nav>
            <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
              <h1 className="text-lg font-black leading-9 sm:text-xl">{title}</h1>
              <p className="mt-1 text-xs text-muted">(دیدگاه کاربر {toFa(row.reviews.length)}) · <span className="inline-flex items-center gap-1"><Star className="size-3 fill-warning text-warning" />{toFa(row.ratingAvg)}</span> · SKU: <span dir="ltr">{row.sku}</span></p>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <div className="relative mx-auto aspect-square w-full max-w-sm md:order-2">
                  <Thumb p={card} className="size-full rounded-[32px]" />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 rounded-b-[32px] bg-black/80 py-4 text-white">
                    <span dir="ltr" className="text-2xl font-black tracking-wide">{row.brand?.name ?? "CaseLine"}</span>
                    <span dir="ltr" className="text-[10px] font-bold tracking-[0.3em] text-accent">Caseline.ir</span>
                  </div>
                  {row.retailDiscount > 0 && <div className="absolute end-3 top-3"><HotBadge /></div>}
                </div>
                <div className="md:order-1">
                  {row.retailDiscount > 0 && <p className="mb-2 text-xs text-muted">قیمت قبل: <s>{formatToman(row.retailPrice)}</s></p>}
                  <BuyBox p={card} opt={opt} inStock={stock > 0} />
                </div>
              </div>
              <p className="mt-5 text-sm text-muted">دسته‌بندی: <b className="text-foreground">{row.category.name}</b></p>
            </section>

            <div className="tabs">
              <input type="radio" name="tab" id="tab-desc" defaultChecked className="sr-only" />
              <input type="radio" name="tab" id="tab-faq" className="sr-only" />
              <input type="radio" name="tab" id="tab-rev" className="sr-only" />
              <div className="mx-auto mb-3 flex w-fit rounded-full border border-border bg-surface p-1 text-sm shadow-sm">
                {[["tab-desc", "توضیحات"], ["tab-faq", "سوالات متداول"], ["tab-rev", "نظرات کاربران"]].map(([f, l]) => <label key={f} htmlFor={f} className="tab-label cursor-pointer rounded-full px-4 py-2 text-muted">{l}</label>)}
              </div>
              <div className="rounded-xl border border-border bg-surface p-5 text-[13px] leading-8 shadow-sm sm:p-8">
                <div className="panel panel-desc space-y-4">
                  {row.description && <p>{row.description}</p>}
                  {Object.keys(specs).length > 0 && (
                    <dl className="grid gap-2 rounded-lg bg-surface-2 p-4 sm:grid-cols-2">
                      {Object.entries(specs).map(([k, v]) => <div key={k} className="flex justify-between gap-3 text-xs"><dt className="text-muted">{k}</dt><dd className="font-bold">{String(v)}</dd></div>)}
                    </dl>
                  )}
                  <div className="rounded-lg bg-surface-2 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between font-black"><span className="grid size-8 place-items-center rounded-md bg-primary/12 text-primary"><FileText className="size-4" /></span>قوانین خرید و ارسال</div>
                    <ol className="space-y-3">
                      {rules.map(([h, t], i) => (
                        <li key={h} className="flex gap-3 rounded-md bg-surface p-3 text-[12px] leading-7"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/12 text-[10px] font-bold text-primary">{toFa(i + 1)}</span><span><b className="text-primary">{h}</b> {t}</span></li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div className="panel panel-faq space-y-4">
                  {row.questions.length ? row.questions.map((q) => <div key={q.id}><h3 className="font-black">{q.question}</h3><p className="text-muted">{q.answer}</p></div>) : <p className="text-muted">هنوز سوالی برای این محصول ثبت نشده است.</p>}
                </div>
                <div className="panel panel-rev space-y-4">
                  {row.reviews.length ? row.reviews.map((r) => <div key={r.id} className="rounded-md bg-surface-2 p-4"><div className="flex items-center justify-between"><b>{r.user.displayName ?? r.user.firstName ?? "کاربر"}</b><span className="text-warning">{"★".repeat(r.rating)}</span></div><p className="mt-1 text-muted">{r.body}</p></div>) : <p className="text-muted">هنوز نظری ثبت نشده است.</p>}
                </div>
              </div>
            </div>

            {related.length > 0 && (
              <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
                <h2 className="mb-4 text-sm font-black">محصولات مشابه</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {related.map((x, i) => <div key={x.id} className={i === 2 ? "hidden sm:block" : ""}><ProductCard p={x} showCat /></div>)}
                </div>
              </section>
            )}
          </div>

          <aside className="rounded-xl border border-border bg-surface p-3 shadow-sm lg:sticky lg:top-20">
            <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-black">پیشنهادهای ویژه</h2><Link href="/shop" className="text-[11px] font-bold text-primary">همه</Link></div>
            <ul className="space-y-2">
              {others.map((x) => (
                <li key={x.id}><Link href={`/product/${x.slug}`} className="flex items-center gap-2 rounded-lg bg-surface-2 p-2 hover:shadow-sm">
                  <Thumb p={x} className="size-12 shrink-0 rounded-lg" />
                  <span className="min-w-0"><span className="line-clamp-2 block text-[10.5px] font-medium leading-5">خرید {x.name}</span><span className="text-[10px] font-bold text-primary">{formatToman(x.price)}</span></span>
                </Link></li>
              ))}
            </ul>
          </aside>
        </Container>
      </main>
      <Footer />
      <StickyBar p={card} />
      <BottomNav />
    </>
  );
}
