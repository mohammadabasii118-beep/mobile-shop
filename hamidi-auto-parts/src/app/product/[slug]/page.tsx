import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CheckCircle2, Factory, Globe2, RotateCcw, ShieldCheck, Star, Truck } from "lucide-react";
import { PRODUCTS, discountPercent, getProduct } from "@/data/products";
import { getCategory } from "@/data/categories";
import { getBrand, getModel } from "@/data/vehicles";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductPurchase } from "@/components/shop/product-purchase";
import { CopyCode } from "@/components/shop/copy-code";
import { ProductTabs } from "@/components/shop/product-tabs";
import { ProductRail } from "@/components/shop/product-rail";
import { SectionHeading } from "@/components/shop/section-heading";
import { StockBadge } from "@/components/shop/stock-badge";
import { Price } from "@/components/shop/price";
import { Badge } from "@/components/ui/badge";
import { toFa } from "@/lib/utils";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = getProduct(slug);
  return { title: p ? `${p.name} | ${p.sku}` : "محصول", description: p?.description };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) notFound();
  const cat = getCategory(p.category)!;
  const brand = getBrand(p.brand)!;
  const off = discountPercent(p);
  const related = PRODUCTS.filter((x) => x.id !== p.id && (x.category === p.category || (x.brand === p.brand && x.fitments.some((f) => p.fitments.some((g) => g.model === f.model)))))
    .sort((a, b) => Number(b.category === p.category) - Number(a.category === p.category) || b.sold - a.sold)
    .slice(0, 10);

  return (
    <>
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="container-x py-4">
          <Breadcrumbs items={[{ href: "/shop", label: "فروشگاه" }, { href: `/${p.brand}`, label: brand.nameFa }, { href: `/categories/${cat.id}`, label: cat.nameFa }, { label: p.name }]} />
        </div>
      </div>

      <section className="container-x mt-8 grid gap-8 lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.1fr_1fr_340px]">
        <ProductGallery
          src={p.image}
          alt={p.name}
          badges={
            <>
              {off > 0 && <Badge className="px-2.5 py-1 text-xs">٪{toFa(off)} تخفیف</Badge>}
              {p.badges.includes("new") && <Badge variant="dark" className="px-2.5 py-1 text-xs">جدید</Badge>}
              {p.badges.includes("bestseller") && <Badge variant="outline" className="bg-white px-2.5 py-1 text-xs">پرفروش</Badge>}
            </>
          }
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/${p.brand}`} className="rounded-md bg-neutral-950 px-2.5 py-1 text-[11px] font-black tracking-widest text-white" dir="ltr">{brand.nameEn}</Link>
            <Link href={`/categories/${cat.id}`} className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-200">{cat.nameFa}</Link>
            <span className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-primary">{p.quality}</span>
          </div>
          <h1 className="mt-4 text-2xl leading-snug font-black sm:text-3xl">{p.name}</h1>
          <p className="mt-1 text-sm text-neutral-400" dir="ltr" style={{ textAlign: "right" }}>{p.nameEn}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1"><Star className="size-4 fill-amber-400 text-amber-400" /><b>{toFa(p.rating.toFixed(1))}</b><span className="text-neutral-400">({toFa(p.reviews)} نظر)</span></span>
            <span className="text-neutral-300">|</span>
            <span className="text-neutral-500">{toFa(p.sold.toLocaleString("en-US").replace(/,/g, "٬"))} فروش موفق</span>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <CopyCode label="کد فنی فروشگاه" value={p.sku} />
            <CopyCode label="شماره فنی OEM" value={p.oem} />
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-200 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><CheckCircle2 className="size-4 text-emerald-600" />سازگار با خودروهای زیر</p>
            <ul className="space-y-2">
              {p.fitments.slice(0, 6).map((f) => {
                const m = getModel(f.model);
                return (
                  <li key={f.model} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                    <Link href={`/${p.brand}?model=${f.model}`} className="font-semibold hover:text-primary">{brand.nameFa} {m?.nameFa} <span className="text-xs font-normal text-neutral-400" dir="ltr">{m?.nameEn}</span></Link>
                    <span className="text-xs text-neutral-600">{toFa(f.from)} تا {toFa(f.to)}</span>
                  </li>
                );
              })}
              {p.fitments.length > 6 && <li className="text-xs text-neutral-500">+ {toFa(p.fitments.length - 6)} مدل دیگر (تب «سازگاری» را ببینید)</li>}
            </ul>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><Factory className="size-4 text-neutral-400" /><dt className="text-neutral-500">سازنده:</dt><dd className="font-semibold">{p.manufacturer}</dd></div>
            <div className="flex items-center gap-2"><Globe2 className="size-4 text-neutral-400" /><dt className="text-neutral-500">کشور:</dt><dd className="font-semibold">{p.origin}</dd></div>
          </dl>
        </div>

        <aside className="lg:col-span-2 xl:col-span-1">
          <div className="sticky top-44 space-y-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_30px_60px_-40px_rgba(0,0,0,.4)]">
            <div className="flex items-center justify-between">
              <StockBadge status={p.stock} qty={p.stockQty} />
              {off > 0 && <Badge>٪{toFa(off)}</Badge>}
            </div>
            <Price value={p.price} old={p.oldPrice} size="lg" />
            <ProductPurchase product={p} />
            <ul className="space-y-3 border-t border-dashed border-neutral-200 pt-4 text-[13px] text-neutral-600">
              <li className="flex items-center gap-2.5"><ShieldCheck className="size-[18px] text-primary" />{p.warranty}</li>
              <li className="flex items-center gap-2.5"><BadgeCheck className="size-[18px] text-primary" />ضمانت اصالت و تطابق با کد فنی</li>
              <li className="flex items-center gap-2.5"><Truck className="size-[18px] text-primary" />ارسال سریع تهران و سراسر کشور</li>
              <li className="flex items-center gap-2.5"><RotateCcw className="size-[18px] text-primary" />۷ روز ضمانت بازگشت در صورت عدم تطابق</li>
            </ul>
          </div>
        </aside>
      </section>

      <section className="container-x mt-12">
        <ProductTabs
          tabs={[
            {
              id: "desc",
              label: "توضیحات محصول",
              content: (
                <div className="max-w-3xl space-y-4 text-[15px] leading-8 text-neutral-700">
                  <p>{p.description}</p>
                  <p>قبل از خرید، برای اطمینان صددرصدی از تطابق، می‌توانید شماره شاسی (VIN) خودروی خود را از طریق واتساپ برای کارشناسان فروشگاه حمیدی ارسال کنید تا قطعه بر اساس کاتالوگ رسمی بررسی شود.</p>
                </div>
              ),
            },
            {
              id: "specs",
              label: "مشخصات فنی",
              content: (
                <dl className="grid max-w-3xl overflow-hidden rounded-2xl border border-neutral-200 sm:grid-cols-2">
                  {[...p.specs, { label: "دسته‌بندی", value: cat.nameFa }, { label: "برند خودرو", value: brand.nameFa }, { label: "گارانتی", value: p.warranty }].map((s) => (
                    <div key={s.label} className="flex justify-between gap-4 border-b border-neutral-200 px-4 py-3 text-sm odd:bg-neutral-50 sm:odd:border-l">
                      <dt className="text-neutral-500">{s.label}</dt>
                      <dd className="text-left font-semibold" dir={/^[\x00-\x7F]+$/.test(s.value) ? "ltr" : undefined}>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              ),
            },
            {
              id: "fit",
              label: `سازگاری (${toFa(p.fitments.length)} مدل)`,
              content: (
                <div className="max-w-3xl overflow-hidden rounded-2xl border border-neutral-200">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-950 text-white">
                      <tr><th className="px-4 py-3 text-right font-semibold">برند</th><th className="px-4 py-3 text-right font-semibold">مدل</th><th className="px-4 py-3 text-right font-semibold">سال ساخت</th></tr>
                    </thead>
                    <tbody>
                      {p.fitments.map((f) => (
                        <tr key={f.model} className="border-t border-neutral-200 even:bg-neutral-50">
                          <td className="px-4 py-3">{brand.nameFa}</td>
                          <td className="px-4 py-3 font-semibold">{getModel(f.model)?.nameFa} <span className="text-xs font-normal text-neutral-400" dir="ltr">{getModel(f.model)?.nameEn}</span></td>
                          <td className="px-4 py-3">{toFa(f.from)} – {toFa(f.to)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
            },
            {
              id: "ship",
              label: "ارسال و ضمانت",
              content: (
                <ul className="max-w-3xl list-disc space-y-2 pr-5 text-[15px] leading-8 text-neutral-700 marker:text-primary">
                  <li>سفارش‌های تهران تا ساعت ۱۴ همان روز با پیک ارسال می‌شوند.</li>
                  <li>ارسال به شهرستان‌ها از طریق پست پیشتاز و باربری، معمولاً ۲ تا ۴ روز کاری.</li>
                  <li>تمام قطعات دارای ضمانت اصالت هستند و در صورت عدم تطابق تا ۷ روز امکان مرجوعی وجود دارد.</li>
                  <li>قطعات برقی پس از نصب و تست، قابل مرجوع نیستند.</li>
                </ul>
              ),
            },
          ]}
        />
      </section>

      {related.length > 0 && (
        <section className="container-x mt-16">
          <SectionHeading eyebrow="پیشنهاد ما" title="محصولات مرتبط" href={`/categories/${cat.id}`} linkLabel={`همه ${cat.nameFa}`} />
          <ProductRail products={related} />
        </section>
      )}
    </>
  );
}
