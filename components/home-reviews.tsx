import Link from "next/link";
import { Container, SectionHeader } from "@/components/ui";
import { SiteImage } from "@/components/site-image";
import { Stars, VerifiedBadge } from "@/components/review-parts";
import type { HomeReview } from "@/lib/server/reviews";

/** Latest approved customer reviews. Renders nothing when there are none (no placeholder, no fake content). */
export function HomeReviews({ reviews }: { reviews: HomeReview[] }) {
  if (!reviews.length) return null;
  return (
    <section id="home-reviews" aria-label="نظرات مشتریان" className="py-4" data-testid="home-reviews">
      <Container>
        <SectionHeader title="نظرات مشتریان" sub="تجربه‌های واقعی خریداران CaseLine" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <article key={r.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4" data-testid="home-review">
              <div className="flex items-center justify-between gap-2"><b className="truncate text-sm">{r.name}</b><Stars value={r.rating} /></div>
              {r.verified && <div><VerifiedBadge /></div>}
              <p className="line-clamp-4 whitespace-pre-line text-[13px] leading-7 text-muted">{r.body}</p>
              <Link href={`/product/${r.product.slug}`} className="mt-auto flex items-center gap-2 rounded-lg bg-surface p-2 text-[11px] font-bold hover:text-primary">
                <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-surface-2">{r.product.img && <SiteImage src={r.product.img} alt="" sizes="36px" />}</span>
                <span className="line-clamp-2">{r.product.name}</span>
              </Link>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
