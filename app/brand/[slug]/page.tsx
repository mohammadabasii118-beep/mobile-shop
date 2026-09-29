import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { db } from "@/lib/db";
import { getProducts } from "@/lib/queries";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

const load = async (slug: string) => {
  const s = decodeURIComponent(slug);
  return db.brand.findFirst({ where: { slug: s, isActive: true } });
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = await load((await params).slug);
  if (!row) return {};
  return { title: row.seoTitle || `برند ${row.name} | CaseLine`, description: row.seoDescription || undefined };
}

export default async function Page({ params }: Props) {
  const row = await load((await params).slug);
  if (!row) notFound();
  const items = await getProducts({ brandId: row.id }, { orderBy: { soldCount: "desc" } });
  return (
    <>
      <Header />
      <main className="py-8">
        <Container>
          <h1 className="text-2xl font-black">برند {row.name}</h1>
          {row.description && <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{row.description}</p>}
          <p className="mt-1 text-sm text-muted">{toFa(items.length)} محصول</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => <ProductCard key={p.id} p={p} showCat />)}
          </div>
          {items.length === 0 && <p className="mt-10 text-center text-muted">فعلاً محصولی در این بخش موجود نیست.</p>}
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
