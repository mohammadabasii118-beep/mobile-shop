"use client";

import { Check, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCart } from "@/store/cart";
import type { Product } from "@/data/products";
import { cn, toFa } from "@/lib/utils";

export function AddToCartButton({
  product,
  qty = 1,
  className,
  size = "default",
  label = "افزودن به سبد",
  compact = false,
}: {
  product: Product;
  qty?: number;
  className?: string;
  size?: "default" | "sm" | "lg";
  label?: string;
  compact?: boolean;
}) {
  const add = useCart((s) => s.add);
  const router = useRouter();
  const [done, setDone] = useState(false);
  const disabled = product.stock === "out-of-stock";

  function handle() {
    add(product.id, qty);
    setDone(true);
    setTimeout(() => setDone(false), 1400);
    toast.success("به سبد خرید اضافه شد", {
      description: `${product.name}${qty > 1 ? ` — ${toFa(qty)} عدد` : ""}`,
      action: { label: "مشاهده سبد", onClick: () => router.push("/cart") },
    });
  }

  if (disabled) {
    return (
      <Button size={size} variant="secondary" className={cn("text-neutral-500", className)} asChild>
        <Link href="/contact">{compact ? "استعلام" : "استعلام موجودی"}</Link>
      </Button>
    );
  }

  return (
    <Button size={size} onClick={handle} className={cn(done && "bg-emerald-600 hover:bg-emerald-600 shadow-none", className)} aria-label={`افزودن ${product.name} به سبد خرید`}>
      {done ? <Check className="animate-in zoom-in" /> : <ShoppingCart />}
      {!compact && <span>{done ? "اضافه شد" : label}</span>}
    </Button>
  );
}
