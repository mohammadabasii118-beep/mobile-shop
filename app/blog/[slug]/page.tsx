import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { getBlogPost } from "@/lib/queries";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getBlogPost(decodeURIComponent((await params).slug));
  if (!p) return {};
  return { title: p.seoTitle || `${p.title} | CaseLine`, description: p.seoDescription || p.excerpt || undefined, alternates: p.canonical ? { canonical: p.canonical } : undefined, openGraph: p.featuredImage ? { images: [p.featuredImage] } : undefined };
}

/** Very small, safe formatter: blank line = new paragraph, "## " = heading, "- " lines = list. Everything is escaped by React. */
function Body({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-[15px] leading-8">
      {text.split(/\n{2,}/).map((block, i) => {
        const b = block.trim();
        if (b.startsWith("## ")) return <h2 key={i} className="pt-2 text-lg font-black">{b.slice(3)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) return <ul key={i} className="list-disc space-y-1 ps-6">{lines.map((l, j) => <li key={j}>{l.trim().slice(2)}</li>)}</ul>;
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

export default async function BlogPostPage({ params }: Props) {
  const p = await getBlogPost(decodeURIComponent((await params).slug));
  if (!p) notFound();
  return (
    <>
      <Header />
      <main className="py-6">
        <Container className="max-w-[760px]">
          <article className="rounded-[28px] border border-border bg-surface p-5 shadow-md sm:p-8">
            <nav className="mb-3 text-xs text-muted"><Link href="/blog" className="hover:text-primary">وبلاگ</Link>{p.category && <> › <span>{p.category.name}</span></>}</nav>
            <h1 className="text-xl font-black leading-9 sm:text-2xl">{p.title}</h1>
            <p className="mt-2 text-xs text-muted">{p.publishedAt?.toLocaleDateString("fa-IR", { day: "numeric", month: "long", year: "numeric" })}{p.authorName ? ` · ${p.authorName}` : ""}</p>
            {p.featuredImage && <img src={p.featuredImage} alt={p.title} className="mt-5 max-h-96 w-full rounded-2xl object-cover" />}
            <div className="mt-6"><Body text={p.content} /></div>
            {p.tags.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{p.tags.map((t) => <span key={t} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{t}</span>)}</div>}
          </article>
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
