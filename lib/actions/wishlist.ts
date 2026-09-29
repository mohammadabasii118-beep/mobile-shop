"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("برای استفاده از لیست علاقه‌مندی‌ها ابتدا وارد حساب کاربری شوید");
  return session.user.id as string;
}

export async function isWishlisted(productId: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  const row = await db.wishlistItem.findUnique({
    where: { userId_productId: { userId: session.user.id as string, productId } },
    select: { id: true },
  });
  return !!row;
}

export async function getWishlistProductIds(): Promise<string[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];
  const rows = await db.wishlistItem.findMany({ where: { userId: session.user.id as string }, select: { productId: true } });
  return rows.map((r) => r.productId);
}

/**
 * Adds or removes a product from the current user's wishlist and returns
 * the resulting state, so the caller doesn't need a second round-trip to
 * know whether the toggle turned it on or off.
 */
export async function toggleWishlist(productId: string): Promise<{ wishlisted: boolean }> {
  const userId = await requireUserId();

  const existing = await db.wishlistItem.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });

  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/account/wishlist");
    return { wishlisted: false };
  }

  // findUnique-then-create has a tiny race window under a rapid double
  // click; the @@unique([userId, productId]) constraint makes that safe —
  // a duplicate create simply throws, which we treat as "already added".
  try {
    await db.wishlistItem.create({ data: { userId, productId } });
  } catch {
    // Already added concurrently — fine, end state is the same.
  }
  revalidatePath("/account/wishlist");
  return { wishlisted: true };
}

export async function removeFromWishlist(productId: string) {
  const userId = await requireUserId();
  await db.wishlistItem.deleteMany({ where: { userId, productId } });
  revalidatePath("/account/wishlist");
}
