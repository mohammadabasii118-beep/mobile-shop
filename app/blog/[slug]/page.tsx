import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { SiteImage } from "@/components/site-image";
import { Container } from "@/components/ui";
import { JsonLd } from "@/components/json-ld";
import { db } from "@/lib/db";
import { getBlogPost, getSiteInfo } from "@/lib/queries";
import { abs, breadcrumbLd, buildMeta, clip, paths } from "@/lib/seo";
import { resolveSlugRedirect } from "@/lib/server/redirects";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getBlogPost(decodeURIComponent((await params).slug));
  if (!p) return { robots: { index: false } };
  return buildMeta({ title: p.seoTitle || `${p.title} | وبلاگ CaseLine`, description: p.seoDescription || p.excerpt || p.content, path: paths.post(p.slug), canonical: p.canonical, image: p.featuredImage, type: "article", publishedTime: p.publishedAt, modifiedTime: p.updatedAt });
}

/** Very small, safe formatter: blank line = new paragraph, "## " = heading, "- " lines = list. Everything is escaped by React. */
function Body({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-[15px] leading-8">
      {text.split(/\n{2,}/).map((block, i) => {
        const b = block.trim();
        if (b.startsWith("## ")) return <h2 key={i} className="pt-2 text-lg font-extrabold">{b.slice(3)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) return <ul key={i} className="list-disc space-y-1 ps-6">{lines.map((l, j) => <li key={j}>{l.trim().slice(2)}</li>)}</ul>;
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

export default async function BlogPostPage({ params }: Props) {
  const slug = decodeURIComponent((await params).slug);
  const p = await getBlogPost(slug);
  if (!p) { const to = await resolveSlugRedirect("post", slug); if (to) permanentRedirect(paths.post(to)); notFound(); }
  const [info, more] = await Promise.all([getSiteInfo(), db.blogPost.findMany({ where: { isPublished: true, publishedAt: { lte: new Date() }, id: { not: p.id } }, orderBy: { publishedAt: "desc" }, take: 3, select: { slug: true, title: true } })]);
  const ld = [
    breadcrumbLd([{ name: "خانه", path: "/" }, { name: "وبلاگ", path: "/blog" }, { name: p.title, path: paths.post(p.slug) }]),
    { "@context": "https://schema.org", "@type": "Article", headline: p.title.slice(0, 110), description: clip(p.seoDescription || p.excerpt || p.content), inLanguage: "fa-IR", mainEntityOfPage: abs(paths.post(p.slug)),
      datePublished: p.publishedAt?.toISOString(), dateModified: p.updatedAt.toISOString(), ...(p.featuredImage ? { image: [abs(p.featuredImage)] } : {}),
      author: p.authorName ? { "@type": "Person", name: p.authorName } : { "@type": "Organization", name: info.name },
      publisher: { "@type": "Organization", name: info.name, ...(info.logo ? { logo: { "@type": "ImageObject", url: abs(info.logo) } } : {}) }, ...(p.tags.length ? { keywords: p.tags.join("، ") } : {}) },
  ];
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="py-6">
        <Container className="max-w-[760px]">
          <JsonLd data={ld} />
          <article className="rounded-[16px] border border-border bg-surface p-5 shadow-md sm:p-8">
            <nav className="mb-3 text-xs text-muted"><Link href="/blog" className="hover:text-primary">وبلاگ</Link>{p.category && <> › <span>{p.category.name}</span></>}</nav>
            <h1 className="font-display text-[34px] leading-[1.25] sm:text-[46px]">{p.title}</h1>
            <p className="mt-2 text-xs text-muted">{p.publishedAt?.toLocaleDateString("fa-IR", { day: "numeric", month: "long", year: "numeric" })}{p.authorName ? ` · ${p.authorName}` : ""}</p>
            {p.featuredImage && <span className="relative mt-5 block h-56 w-full overflow-hidden rounded-[16px] sm:h-80"><SiteImage src={p.featuredImage} alt={p.title} priority sizes="(min-width: 768px) 700px, 92vw" /></span>}
            <div className="mt-6"><Body text={p.content} /></div>
            {p.tags.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{p.tags.map((t) => <span key={t} className="rounded-md bg-primary/10 px-3 py-1 text-xs text-primary">{t}</span>)}</div>}
          </article>
          <section aria-label="ادامه مطالعه" className="mt-5 rounded-[16px] border border-border bg-surface p-5 text-sm">
            <h2 className="mb-2 font-extrabold">ادامه مطالعه</h2>
            <ul className="space-y-1.5">{more.map((m) => <li key={m.slug}><Link href={paths.post(m.slug)} className="hover:text-primary">{m.title}</Link></li>)}</ul>
            <p className="mt-3 text-xs text-muted">محصولات مرتبط را در <Link href="/shop" className="font-bold text-primary">فروشگاه</Link> ببینید.</p>
          </section>
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
