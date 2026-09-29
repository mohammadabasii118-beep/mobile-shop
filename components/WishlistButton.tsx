"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Icon from "./Icon";
import { toggleWishlist } from "@/lib/actions/wishlist";

/**
 * A heart toggle for saving a product to the logged-in user's wishlist.
 * `initialWishlisted` comes from a server-rendered lookup (see product/
 * category/search pages) so the correct filled/empty state shows on first
 * paint without a client round-trip.
 */
export default function WishlistButton({
  productId,
  initialWishlisted = false,
  size = "md",
}: {
  productId: string;
  initialWishlisted?: boolean;
  size?: "sm" | "md";
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      router.push("/login");
      return;
    }

    const next = !wishlisted;
    setWishlisted(next); // optimistic
    startTransition(async () => {
      try {
        const result = await toggleWishlist(productId);
        setWishlisted(result.wishlisted);
      } catch {
        setWishlisted(!next); // revert on failure
      }
    });
  }

  const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const iconDim = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-pressed={wishlisted}
      aria-label={wishlisted ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      title={wishlisted ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      type="button"
      className={`${dim} rounded-full flex items-center justify-center surface disabled:opacity-60`}
      style={{ color: wishlisted ? "#c23b4e" : "var(--text)" }}
    >
      <Icon name="heart" className={iconDim} filled={wishlisted} />
    </button>
  );
}
