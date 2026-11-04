import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shop/breadcrumbs";
import { Explorer } from "@/components/shop/explorer-boundary";
import { CATEGORIES, getCategory } from "@/data/categories";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: getCategory(slug)?.nameFa ?? "دسته‌بندی" };
}

export default async function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const c = getCategory(slug);
  if (!c) notFound();
  return (
    <>
      <PageHeader title={c.nameFa} subtitle={`${c.description} — مناسب خودروهای نیسان و هوندا.`} crumbs={[{ href: "/categories", label: "دسته‌بندی‌ها" }, { label: c.nameFa }]}>
        <div className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {CATEGORIES.map((x) => (
            <Link key={x.id} href={`/categories/${x.id}`} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition", x.id === c.id ? "bg-primary text-white" : "bg-white/10 text-neutral-300 hover:bg-white/20 hover:text-white")}>
              <x.icon className="size-3.5" />
              {x.nameFa}
            </Link>
          ))}
        </div>
      </PageHeader>
      <div className="container-x mt-8">
        <Explorer fixedCategory={c.id} />
      </div>
    </>
  );
}
