import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";

export function Breadcrumbs({ items, dark }: { items: { href?: string; label: string }[]; dark?: boolean }) {
  return (
    <nav aria-label="مسیر صفحه" className={dark ? "text-neutral-400" : "text-neutral-500"}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        <li><Link href="/" className="flex items-center gap-1 hover:text-primary"><Home className="size-3.5" />خانه</Link></li>
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <ChevronLeft className="size-3 opacity-50" />
            {it.href ? <Link href={it.href} className="hover:text-primary">{it.label}</Link> : <span className={dark ? "text-white" : "font-semibold text-neutral-900"}>{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, subtitle, crumbs, children }: { title: string; subtitle?: string; crumbs: { href?: string; label: string }[]; children?: React.ReactNode }) {
  return (
    <section className="carbon relative overflow-hidden">
      <div className="bg-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-primary/25 blur-3xl" />
      <div className="container-x relative py-10 sm:py-14">
        <Breadcrumbs items={crumbs} dark />
        <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-400 sm:text-base">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}
