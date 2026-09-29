import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { BannerSlot } from "@/components/banner-slot";
import { Container } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";
import { getBlogCategories, getBlogPosts } from "@/lib/queries";
import { toFa } from "@/lib/utils";

export const metadata: Metadata = { title: "وبلاگ | CaseLine" };
export const dynamic = "force-dynamic";
const KINDS = ["case", "glass", "charger", "cable", "earbuds", "powerbank", "holder", "lens", "airpods", "watch"];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const faDate = (d: Date | null) => (d ? d.toLocaleDateString("fa-IR", { day: "numeric", month: "long", year: "numeric" }) : "");

function Cover({ title, kind, hue }: { title: string; kind: string; hue: number }) {
  return (
    <div className="relative flex aspect-[16/10] items-center overflow-hidden rounded-[18px] p-4" style={{ background: `linear-gradient(135deg, hsl(${hue} 90% 96%), hsl(${(hue + 30) % 360} 80% 84%))` }}>
      <ProductVisual kind={kind} hue={hue} className="absolute -start-2 bottom-0 h-[92%] w-[46%]" />
      <div className="relative ms-auto w-[52%] text-end">
        <div className="text-[15px] font-black leading-7" style={{ color: `hsl(${hue} 60% 22%)` }}>{title}</div>
      </div>
      <span dir="ltr" className="absolute bottom-2 end-3 text-[11px] font-black text-primary">Caseline<span className="text-foreground">.ir</span></span>
    </div>
  );
}

export default async function BlogPage() {
  const [posts, cats] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  return (
    <>
      <Header />
      <main className="py-6">
        <Container>
          <div data-blog>
            <BannerSlot placement="blog_top" />
            <section className="rounded-[28px] border border-border bg-surface px-5 py-6 text-center shadow-md">
              <h1 className="text-xl font-black sm:text-2xl">وبلاگ</h1>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                <button data-chip="all" data-active="true" className="cursor-pointer rounded-full border border-border bg-surface px-4 py-2 font-bold data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-fg">همه</button>
                {cats.map((c) => (
                  <button key={c.id} data-chip={c.name} data-active="false" className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface py-1.5 pe-4 ps-1.5 font-medium data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
                    <span className="grid size-6 place-items-center rounded-full bg-primary/12 text-[10px] font-bold text-primary">{toFa(c._count.posts)}</span>{c.name}
                  </button>
                ))}
              </div>
            </section>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <article key={p.slug} data-post data-cat={p.category?.name ?? ""} className="flex flex-col rounded-[22px] border border-border bg-surface p-2 shadow-sm transition-shadow hover:shadow-md">
                  {p.featuredImage ? <div className="aspect-[16/10] overflow-hidden rounded-[18px]"><img src={p.featuredImage} alt={p.title} loading="lazy" className="size-full object-cover" /></div> : <Cover title={p.title.split(/[؟?،:]/)[0].slice(0, 34)} kind={KINDS[hash(p.slug) % KINDS.length]} hue={hash(p.slug) % 360} />}
                  <div className="flex flex-1 flex-col gap-3 p-3">
                    <div className="flex items-center justify-between text-[11px] text-muted"><span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">{p.category?.name}</span><span>{faDate(p.publishedAt)}</span></div>
                    <h2 className="line-clamp-2 text-[15px] font-black leading-7">{p.title}</h2>
                    <p className="line-clamp-2 text-xs leading-6 text-muted">{p.excerpt}</p>
                    <Link href={`/blog/${p.slug}`} className="mt-auto text-xs font-bold text-primary">ادامه مطلب ‹</Link>
                  </div>
                </article>
              ))}
            </div>

            <p data-empty hidden className="py-10 text-center text-sm text-muted">هنوز مطلبی در این دسته منتشر نشده است.</p>
            <div data-loader hidden role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
              <Loader2 className="size-4 animate-spin text-primary" />در حال بارگذاری موارد بیشتر…
            </div>
            <div data-sentinel className="h-px" />
          </div>
        </Container>
      </main>
      <Footer />
      <BottomNav />
      <Script src="/blog.js" strategy="afterInteractive" />
    </>
  );
}
