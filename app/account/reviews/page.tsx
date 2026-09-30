import type { Metadata } from "next";
import Link from "next/link";
import { AccountShell } from "@/components/account-shell";
import { MyReviewCard } from "@/components/account/my-review-card";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "نظرات من | CaseLine", robots: { index: false } };

export default async function MyReviewsPage() {
  const user = await requirePageUser("/account/reviews");
  // Ownership is part of the query: a user can only ever load their own reviews.
  const rows = await db.review.findMany({
    relationLoadStrategy: "join", where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
    select: { id: true, status: true, rating: true, title: true, body: true, verifiedPurchase: true, rejectionReason: true, createdAt: true, adminReply: true, product: { select: { name: true, slug: true, images: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } } } } },
  });
  return (
    <AccountShell active="reviews">
      <h1 className="mb-4 text-lg font-black">نظرات من</h1>
      {rows.length ? (
        <div className="space-y-3">{rows.map((r) => <MyReviewCard key={r.id} r={{ id: r.id, status: r.status, rating: r.rating, title: r.title, body: r.body, verified: r.verifiedPurchase, rejectionReason: r.rejectionReason, createdAt: r.createdAt.toISOString(), reply: r.status === "approved" ? r.adminReply : null, product: { name: r.product.name, slug: r.product.slug, img: r.product.images[0]?.url ?? null } }} />)}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">هنوز نظری ثبت نکرده‌اید. پس از تحویل سفارش، از صفحه <Link href="/account/orders" className="font-bold text-primary">سفارش‌ها</Link> می‌توانید برای کالاها نظر بدهید.</div>
      )}
    </AccountShell>
  );
}
