import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";
import { JsonLd, breadcrumbLd, type Crumb } from "@/lib/seo";
import { cn } from "@/lib/utils";

/** Visible breadcrumb trail + matching BreadcrumbList structured data. */
export function Breadcrumbs({ items, dark }: { items: Crumb[]; dark?: boolean }) {
  return (
    <>
      <JsonLd data={breadcrumbLd(items)} />
      <nav aria-label="مسیر صفحه" className={dark ? "text-neutral-300" : "text-neutral-600"}>
        <ol className="flex flex-wrap items-center gap-1.5 text-xs">
          <li><Link href="/" className="flex items-center gap-1 hover:text-primary"><Home className="size-3.5" aria-hidden />خانه</Link></li>
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <ChevronLeft className="size-3 opacity-50" aria-hidden />
              {it.href && i < items.length - 1 ? (
                <Link href={it.href} className="hover:text-primary">{it.label}</Link>
              ) : (
                <span aria-current="page" className={cn("font-semibold", dark ? "text-white" : "text-neutral-900")}>{it.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

export function PageHeader({ title, subtitle, crumbs, children }: { title: string; subtitle?: string; crumbs: Crumb[]; children?: React.ReactNode }) {
  return (
    <section className="carbon relative overflow-hidden" aria-labelledby="page-title">
      <div className="bg-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
      <div className="pointer-events-none absolute hidden sm:block -top-24 -left-24 size-80 rounded-full bg-primary/25 blur-3xl" aria-hidden />
      <div className="container-x relative py-10 sm:py-14">
        <Breadcrumbs items={crumbs} dark />
        <h1 id="page-title" className="mt-4 text-3xl font-black text-white sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-300 sm:text-base">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}
