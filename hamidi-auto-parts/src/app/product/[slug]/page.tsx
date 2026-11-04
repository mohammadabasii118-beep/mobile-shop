import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BadgeCheck, CheckCircle2, Factory, Globe2, RotateCcw, ShieldCheck, Star, Truck } from "lucide-react";
import { discountPercent, type Product } from "@/data/products";
import { getCategory } from "@/data/categories";
import { getBrand, getModel } from "@/data/vehicles";
import { allProducts, categoryPath, modelPath, productPath, relatedProducts, resolveProduct, toCartItem } from "@/lib/catalog";
import { JsonLd, ORG_ID, absoluteUrl, pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductPurchase } from "@/components/shop/product-purchase";
import { CopyCode } from "@/components/shop/copy-code";
import { ProductRail } from "@/components/shop/product-rail";
import { SectionHeading } from "@/components/shop/section-heading";
import { StockBadge } from "@/components/shop/stock-badge";
import { Price } from "@/components/shop/price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { SHOP, toFa, whatsappLink } from "@/lib/utils";

/*
 * Product pages are statically generated at build time and revalidated hourly (ISR).
 * New products not known at build time are rendered on first request and then cached,
 * so the build stays fast even with thousands of SKUs.
 */
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  // In production with a large catalogue, prebuild only the best sellers here.
  return allProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { product: p } = resolveProduct((await params).slug);
  if (!p) notFound();
  const brand = getBrand(p.brand)!;
  const models = p.fitments.slice(0, 3).map((f) => getModel(f.model)?.nameFa).join("، ");
  return pageMetadata({
    title: `${p.name} (${p.oem})`,
    description: `خرید ${p.name} ${p.manufacturer}، کد ${p.sku}، سازگار با ${brand.nameFa} ${models}. قیمت ${p.price.toLocaleString("fa-IR")} تومان با ضمانت اصالت.`,
    path: productPath(p),
    image: { url: p.image, alt: p.name },
  });
}

function productLd(p: Product) {
  const brand = getBrand(p.brand)!;
  const priceValidUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${absoluteUrl(productPath(p))}#product`,
    name: p.name,
    alternateName: p.nameEn,
    description: p.description,
    image: [absoluteUrl(p.image)],
    sku: p.sku,
    mpn: p.oem,
    category: getCategory(p.category)?.nameFa,
    brand: { "@type": "Brand", name: p.manufacturer },
    manufacturer: { "@type": "Organization", name: p.manufacturer },
    countryOfOrigin: p.origin,
    itemCondition: "https://schema.org/NewCondition",
    isAccessoryOrSparePartFor: p.fitments.map((f) => ({
      "@type": "Car",
      name: `${brand.nameEn} ${getModel(f.model)?.nameEn ?? f.model}`,
      brand: { "@type": "Brand", name: brand.nameEn },
      model: getModel(f.model)?.nameEn,
      vehicleModelDate: `${f.from}/${f.to}`,
    })),
    aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating.toFixed(1), reviewCount: p.reviews, bestRating: 5, worstRating: 1 },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(productPath(p)),
      priceCurrency: "IRR",
      // prices are stored in Toman; schema.org expects the ISO currency (1 Toman = 10 Rial)
      price: p.price * 10,
      priceValidUntil,
      availability:
        p.stock === "out-of-stock" ? "https://schema.org/OutOfStock" : p.stock === "low-stock" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ORG_ID },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "IR" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 4, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "IR",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { product: p, redirect } = resolveProduct((await params).slug);
  if (redirect) permanentRedirect(redirect);
  if (!p) notFound();
  const cat = getCategory(p.category)!;
  const brand = getBrand(p.brand)!;
  const off = discountPercent(p);
  const related = relatedProducts(p);
  const firstModel = getModel(p.fitments[0].model)!;

  return (
    <>
      <JsonLd data={productLd(p)} />
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="container-x py-4">
          <Breadcrumbs items={[{ href: `/${p.brand}`, label: `لوازم یدکی ${brand.nameFa}` }, { href: categoryPath(cat.id), label: cat.nameFa }, { href: productPath(p), label: p.name }]} />
        </div>
      </div>

      <article aria-labelledby="product-title">
        <div className="container-x mt-8 grid gap-8 lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.1fr_1fr_340px]">
          <ProductGallery
            src={p.image}
            alt={`${p.name} — ${p.manufacturer}`}
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
              <Link href={categoryPath(cat.id)} className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-200">{cat.nameFa}</Link>
              <span className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-brand-red-dark">{p.quality}</span>
            </div>
            <h1 id="product-title" className="mt-4 text-2xl leading-snug font-black sm:text-3xl">{p.name}</h1>
            <p className="mt-1 text-right text-sm text-neutral-600" lang="en">{p.nameEn}</p>
            <p className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1"><Star className="size-4 fill-amber-400 text-amber-500" aria-hidden /><b>{toFa(p.rating.toFixed(1))}</b><span className="text-neutral-600">از ۵ ({toFa(p.reviews)} نظر)</span></span>
              <span className="text-neutral-300" aria-hidden>|</span>
              <span className="text-neutral-600">{p.sold.toLocaleString("fa-IR")} فروش موفق</span>
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <CopyCode label="کد فنی فروشگاه" value={p.sku} />
              <CopyCode label="شماره فنی OEM" value={p.oem} />
            </div>

            <section className="mt-6 rounded-2xl border border-neutral-200 p-4" aria-labelledby="fit-summary">
              <h2 id="fit-summary" className="mb-3 flex items-center gap-2 text-sm font-extrabold"><CheckCircle2 className="size-4 text-emerald-600" aria-hidden />سازگار با خودروهای زیر</h2>
              <ul className="space-y-2">
                {p.fitments.slice(0, 5).map((f) => {
                  const m = getModel(f.model);
                  return (
                    <li key={f.model} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                      <Link href={modelPath(p.brand, f.model)} className="font-semibold hover:text-primary">{brand.nameFa} {m?.nameFa} <span className="text-xs font-normal text-neutral-600" lang="en">{m?.nameEn}</span></Link>
                      <span className="text-xs text-neutral-700">{toFa(f.from)} تا {toFa(f.to)}</span>
                    </li>
                  );
                })}
              </ul>
              {p.fitments.length > 5 && <a href="#compatibility" className="mt-2 inline-block text-xs font-semibold text-primary">مشاهده همه {toFa(p.fitments.length)} مدل سازگار ↓</a>}
            </section>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2"><Factory className="size-4 text-neutral-500" aria-hidden /><dt className="text-neutral-600">سازنده:</dt><dd className="font-semibold">{p.manufacturer}</dd></div>
              <div className="flex items-center gap-2"><Globe2 className="size-4 text-neutral-500" aria-hidden /><dt className="text-neutral-600">کشور:</dt><dd className="font-semibold">{p.origin}</dd></div>
            </dl>
          </div>

          <aside className="lg:col-span-2 xl:col-span-1" aria-label="خرید محصول">
            <div className="sticky top-44 space-y-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_30px_60px_-40px_rgba(0,0,0,.4)]">
              <div className="flex items-center justify-between">
                <StockBadge status={p.stock} qty={p.stockQty} />
                {off > 0 && <Badge>٪{toFa(off)}</Badge>}
              </div>
              <Price value={p.price} old={p.oldPrice} size="lg" />
              <ProductPurchase item={toCartItem(p)} />
              <Button variant="whatsapp" size="lg" className="h-12 w-full" asChild>
                <a href={whatsappLink(`سلام، درباره قطعه «${p.name}» با کد ${p.sku} سؤال دارم.`)} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="size-5" />
                  استعلام و مشاوره در واتساپ
                </a>
              </Button>
              <ul className="space-y-3 border-t border-dashed border-neutral-200 pt-4 text-[13px] text-neutral-700">
                <li className="flex items-center gap-2.5"><ShieldCheck className="size-[18px] text-primary" aria-hidden />{p.warranty}</li>
                <li className="flex items-center gap-2.5"><BadgeCheck className="size-[18px] text-primary" aria-hidden />ضمانت اصالت و تطابق با کد فنی</li>
                <li className="flex items-center gap-2.5"><Truck className="size-[18px] text-primary" aria-hidden />ارسال سریع تهران و سراسر کشور</li>
                <li className="flex items-center gap-2.5"><RotateCcw className="size-[18px] text-primary" aria-hidden />۷ روز ضمانت بازگشت در صورت عدم تطابق</li>
              </ul>
            </div>
          </aside>
        </div>

        <div className="container-x mt-12">
          <nav aria-label="بخش‌های صفحه محصول" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-neutral-200 px-4 sm:mx-0 sm:px-0">
            {[["description", "توضیحات"], ["specs", "مشخصات فنی"], ["compatibility", `سازگاری (${toFa(p.fitments.length)} مدل)`], ["shipping", "ارسال و ضمانت"]].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="shrink-0 px-4 pt-2 pb-3 text-sm font-semibold text-neutral-700 hover:text-primary">{label}</a>
            ))}
          </nav>

          <div className="grid gap-10 py-8 lg:grid-cols-2">
            <section id="description" className="scroll-mt-48" aria-labelledby="description-title">
              <h2 id="description-title" className="mb-4 text-xl font-black">توضیحات {p.name}</h2>
              <p className="text-[15px] leading-8 text-neutral-800">{p.description}</p>
              <p className="mt-4 text-[15px] leading-8 text-neutral-800">
                قبل از خرید، برای اطمینان صددرصدی از تطابق، می‌توانید شماره شاسی (VIN) خودروی خود را از طریق واتساپ برای کارشناسان {SHOP.nameFa} ارسال کنید تا قطعه بر اساس کاتالوگ رسمی بررسی شود.
                سایر قطعات این خودرو را در صفحه <Link href={modelPath(p.brand, firstModel.id)} className="font-semibold text-primary hover:underline">لوازم یدکی {brand.nameFa} {firstModel.nameFa}</Link> و همه <Link href={categoryPath(cat.id)} className="font-semibold text-primary hover:underline">{cat.nameFa}</Link> را در دسته‌بندی مربوطه ببینید.
              </p>
            </section>

            <section id="specs" className="scroll-mt-48" aria-labelledby="specs-title">
              <h2 id="specs-title" className="mb-4 text-xl font-black">مشخصات فنی</h2>
              <table className="w-full overflow-hidden rounded-2xl text-sm ring-1 ring-neutral-200">
                <tbody>
                  {[...p.specs, { label: "دسته‌بندی", value: cat.nameFa }, { label: "برند خودرو", value: brand.nameFa }, { label: "گارانتی", value: p.warranty }].map((s) => (
                    <tr key={s.label} className="border-b border-neutral-200 last:border-0 odd:bg-neutral-50">
                      <th scope="row" className="w-40 px-4 py-3 text-right font-normal text-neutral-600">{s.label}</th>
                      <td className="px-4 py-3 font-semibold" {...(/^[\x00-\x7F]+$/.test(s.value) ? { dir: "ltr", lang: "en" } : {})} style={{ textAlign: "right" }}>{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section id="compatibility" className="scroll-mt-48" aria-labelledby="compat-title">
              <h2 id="compat-title" className="mb-4 text-xl font-black">جدول سازگاری با خودرو</h2>
              <table className="w-full overflow-hidden rounded-2xl text-sm ring-1 ring-neutral-200">
                <caption className="sr-only">مدل‌ها و سال‌های سازگار با {p.name}</caption>
                <thead className="bg-neutral-950 text-white">
                  <tr><th scope="col" className="px-4 py-3 text-right font-semibold">برند</th><th scope="col" className="px-4 py-3 text-right font-semibold">مدل</th><th scope="col" className="px-4 py-3 text-right font-semibold">سال ساخت</th></tr>
                </thead>
                <tbody>
                  {p.fitments.map((f) => (
                    <tr key={f.model} className="border-t border-neutral-200 even:bg-neutral-50">
                      <td className="px-4 py-3">{brand.nameFa}</td>
                      <td className="px-4 py-3 font-semibold"><Link href={modelPath(p.brand, f.model)} className="hover:text-primary">{getModel(f.model)?.nameFa}</Link> <span className="text-xs font-normal text-neutral-600" lang="en">{getModel(f.model)?.nameEn}</span></td>
                      <td className="px-4 py-3">{toFa(f.from)} – {toFa(f.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section id="shipping" className="scroll-mt-48" aria-labelledby="ship-title">
              <h2 id="ship-title" className="mb-4 text-xl font-black">ارسال و ضمانت</h2>
              <ul className="list-disc space-y-2 pr-5 text-[15px] leading-8 text-neutral-800 marker:text-primary">
                <li>سفارش‌های تهران تا ساعت ۱۴ همان روز با پیک ارسال می‌شوند.</li>
                <li>ارسال به شهرستان‌ها از طریق پست پیشتاز و باربری، معمولاً ۲ تا ۴ روز کاری.</li>
                <li>تمام قطعات دارای ضمانت اصالت هستند و در صورت عدم تطابق تا ۷ روز امکان مرجوعی وجود دارد.</li>
                <li>قطعات برقی پس از نصب و تست، قابل مرجوع نیستند.</li>
              </ul>
            </section>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="container-x cv-auto mt-8" aria-labelledby="related-title">
          <SectionHeading id="related-title" eyebrow="پیشنهاد ما" title="محصولات مرتبط" href={categoryPath(cat.id)} linkLabel={`همه ${cat.nameFa}`} />
          <ProductRail products={related} label="محصولات مرتبط" />
        </section>
      )}
    </>
  );
}
