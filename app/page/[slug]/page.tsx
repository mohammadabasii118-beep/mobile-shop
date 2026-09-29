import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await db.page.findUnique({ where: { slug: params.slug } });
  if (!page || !page.isPublished) return {};
  return { title: page.title };
}

export default async function CmsPage({ params }: { params: { slug: string } }) {
  const page = await db.page.findUnique({ where: { slug: params.slug } });
  if (!page || !page.isPublished) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-14">
      <h1 className="text-2xl font-extrabold mb-6">{page.title}</h1>
      {/* Plain text content, paragraph-per-blank-line — deliberately not
          raw HTML, so nothing an admin types here can inject markup or
          scripts into the public site. */}
      <div className="text-sm leading-8 muted flex flex-col gap-4">
        {page.body.split(/\n\s*\n/).map((para, i) => (
          <p key={i} className="whitespace-pre-wrap">{para}</p>
        ))}
      </div>
    </div>
  );
}
