import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shop/breadcrumbs";
import { Listing } from "@/components/shop/listing";
import { parseListingParams } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";

const EXAMPLES = ["لنت", "مورانو", "15400-PLM-A02", "HAP-NS-3041", "واترپمپ آکورد", "سنسور"];

/** Internal search results are never indexed (thin/duplicate content), but links are followed. */
export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = String((await searchParams).q ?? "").slice(0, 80);
  return pageMetadata({
    title: q ? `نتایج جستجو برای «${q}»` : "جستجوی قطعات",
    description: "جستجوی لوازم یدکی نیسان و هوندا بر اساس نام قطعه، کد فنی یا شماره OEM.",
    path: "/search",
    index: false,
  });
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 80);
  const params = parseListingParams(sp);
  return (
    <>
      <PageHeader title={q ? `نتایج جستجو برای «${q}»` : "جستجوی قطعات"} subtitle="بر اساس نام قطعه، کد فنی فروشگاه (مثل HAP-NS-1021) یا شماره OEM (مثل 15208-65F0E) جستجو کنید." crumbs={[{ href: "/search", label: "جستجو" }]}>
        <div className="mt-8 max-w-3xl">
          <Form action="/search" role="search" className="relative">
            <label htmlFor="search-page-q" className="sr-only">عبارت جستجو</label>
            <Search className="pointer-events-none absolute top-1/2 right-5 size-5 -translate-y-1/2 text-neutral-500" aria-hidden />
            <input id="search-page-q" name="q" type="search" defaultValue={q} required minLength={2} placeholder="مثلاً: کمک‌فنر ایکس‌تریل یا 40206-JA00A" className="h-16 w-full rounded-2xl border border-white/10 bg-white pr-14 pl-32 text-base text-neutral-950 shadow-2xl outline-none focus:ring-4 focus:ring-primary/30" />
            <button className="absolute top-2 bottom-2 left-2 cursor-pointer rounded-xl bg-primary px-6 text-sm font-bold text-white transition hover:bg-brand-red-dark">جستجو</button>
          </Form>
          <ul className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-300">
            <li>نمونه‌ها:</li>
            {EXAMPLES.map((e) => (
              <li key={e}><Link href={`/search?q=${encodeURIComponent(e)}`} className="block rounded-full bg-white/10 px-3 py-1 text-neutral-100 transition hover:bg-primary">{e}</Link></li>
            ))}
          </ul>
        </div>
      </PageHeader>
      <div className="container-x mt-8">
        {q.length >= 2 ? (
          <Listing basePath="/search" scope={{ q }} params={params} keep={{ q }} facets={{ brands: "param", categories: "param" }} listName={`جستجو: ${q}`} />
        ) : (
          <p className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-neutral-600">عبارت مورد نظر خود را (حداقل ۲ حرف) وارد کنید.</p>
        )}
      </div>
    </>
  );
}
