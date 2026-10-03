import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { ADMIN_NAV } from "@/features/admin/nav";

export function generateStaticParams() {
  return ADMIN_NAV.filter((n) => n.slug).map((n) => ({ section: n.slug }));
}

export default async function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = ADMIN_NAV.find((n) => n.slug === section);
  if (!item) notFound();
  return (
    <div className="grid min-h-[60dvh] place-items-center text-center">
      <div>
        <Construction className="mx-auto mb-4 size-10 text-muted" aria-hidden />
        <h1 className="t-h2">{item.label}</h1>
        <p className="t-body mt-2 text-muted">این بخش پس از تأیید Design System و Demo پیاده‌سازی می‌شود.</p>
        <a href="/admin" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold">بازگشت به داشبورد</a>
      </div>
    </div>
  );
}
