import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import { isViewerWholesale, effectivePrice } from "@/lib/wholesalePricing";

export const metadata = { title: "علاقه‌مندی‌ها" };

export default async function WishlistPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [items, isWholesale] = await Promise.all([
    db.wishlistItem.findMany({
      where: { userId: session.user.id as string },
      orderBy: { createdAt: "desc" },
      include: { product: true },
    }),
    isViewerWholesale(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-extrabold">علاقه‌مندی‌های من</h1>
        <Link href="/account" className="text-sm font-medium" style={{ color: "#404040" }}>بازگشت به حساب کاربری</Link>
      </div>

      {items.length === 0 ? (
        <p className="muted text-sm">هنوز محصولی به لیست علاقه‌مندی‌ها اضافه نکرده‌اید. روی آیکون قلب در صفحه‌ی هر محصول بزنید تا اینجا ذخیره شود.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {items
            .filter((i) => i.product.isActive)
            .map((i) => (
              <ProductCard
                key={i.id}
                p={{
                  id: i.product.id,
                  slug: i.product.slug,
                  name: i.product.name,
                  price: effectivePrice(i.product.price, i.product.wholesalePrice, isWholesale),
                  oldPrice: isWholesale && i.product.wholesalePrice != null ? null : i.product.oldPrice,
                  images: i.product.images,
                  isBestSeller: i.product.isBestSeller,
                  isNew: i.product.isNew,
                  isTrending: i.product.isTrending,
                  hasVariants: i.product.hasVariants,
                  avgRating: i.product.avgRating,
                  reviewCount: i.product.reviewCount,
                }}
              />
            ))}
        </div>
      )}
    </div>
  );
}
