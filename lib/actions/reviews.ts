"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { reviewSchema } from "@/lib/validation";

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("برای ثبت نظر ابتدا وارد حساب کاربری شوید");
  return session.user.id as string;
}

/** Recomputes Product.avgRating/reviewCount from the real Review rows for
 * one product — called after every write (create/update/delete) so the
 * cached numbers shown on product cards never drift from the actual
 * reviews. Always run inside the same transaction as the write it follows. */
async function recomputeProductRating(tx: Prisma.TransactionClient, productId: string) {
  const agg = await tx.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: { rating: true } });
  await tx.product.update({
    where: { id: productId },
    data: { avgRating: agg._count.rating > 0 ? agg._avg.rating : null, reviewCount: agg._count.rating },
  });
}

export type ReviewFormState = { error?: string; success?: boolean };

/**
 * Creates or updates the current user's review for a product. Whether the
 * review is a "verified purchase" is derived server-side from the user's
 * own paid order history for this exact product — never trusted from the
 * client — so this label can't be faked.
 */
export async function submitReview(productId: string, formData: FormData): Promise<ReviewFormState> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e: any) {
    return { error: e.message };
  }

  const parsed = reviewSchema.safeParse({
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "اطلاعات نامعتبر است" };
  }

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return { error: "محصول پیدا نشد" };

  const hasPaidOrder = await db.orderItem.findFirst({
    where: {
      productId,
      order: { userId, status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } },
    },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    await tx.review.upsert({
      where: { userId_productId: { userId, productId } },
      create: {
        userId,
        productId,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        isVerifiedPurchase: !!hasPaidOrder,
      },
      update: {
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        isVerifiedPurchase: !!hasPaidOrder,
      },
    });
    await recomputeProductRating(tx, productId);
  });

  revalidatePath("/product");
  revalidatePath("/");
  revalidatePath("/category");
  revalidatePath("/search");
  return { success: true };
}

export async function deleteMyReview(productId: string) {
  const userId = await requireUserId();
  await db.$transaction(async (tx) => {
    await tx.review.deleteMany({ where: { userId, productId } });
    await recomputeProductRating(tx, productId);
  });
  revalidatePath("/product");
  revalidatePath("/");
  revalidatePath("/category");
  revalidatePath("/search");
}

export async function getProductReviews(productId: string) {
  const [reviews, agg] = await Promise.all([
    db.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    db.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: { rating: true } }),
  ]);

  return {
    reviews: reviews.map((r) => ({
      id: r.id,
      userName: r.user.name,
      rating: r.rating,
      comment: r.comment,
      isVerifiedPurchase: r.isVerifiedPurchase,
      createdAt: r.createdAt.toISOString(),
    })),
    average: agg._avg.rating || 0,
    count: agg._count.rating,
  };
}

/**
 * Real, high-rated reviews for the homepage "نظرات مشتریان" section. Only
 * genuine submitted reviews (rating >= 4) are eligible, newest first. If
 * there are none yet, the caller gets an empty array and must not render
 * the section — inventing placeholder testimonials is explicitly
 * forbidden by the project's own rules against fake reviews.
 */
export async function getFeaturedReviews(limit = 6) {
  const reviews = await db.review.findMany({
    where: { rating: { gte: 4 } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
  });
  return reviews.map((r) => ({
    id: r.id,
    userName: r.user.name,
    rating: r.rating,
    comment: r.comment,
    productName: r.product.name,
    productSlug: r.product.slug,
  }));
}

export async function getMyReview(productId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const review = await db.review.findUnique({
    where: { userId_productId: { userId: session.user.id as string, productId } },
  });
  if (!review) return null;
  return { rating: review.rating, comment: review.comment };
}
