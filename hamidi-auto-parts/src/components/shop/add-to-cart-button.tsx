"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/store/cart";
import { toast } from "@/store/toast";
import type { CartItem } from "@/lib/cart-item";
import { cn, toFa } from "@/lib/utils";

export function AddToCartButton({
  item,
  qty = 1,
  className,
  size = "default",
  label = "افزودن به سبد",
}: {
  item: CartItem;
  qty?: number;
  className?: string;
  size?: "default" | "sm" | "lg";
  label?: string;
}) {
  const add = useCart((s) => s.add);
  const [done, setDone] = useState(false);

  if (!item.available) {
    return (
      <Button size={size} variant="secondary" className={cn("text-neutral-600", className)} asChild>
        <Link href="/contact">استعلام موجودی</Link>
      </Button>
    );
  }

  return (
    <Button
      size={size}
      className={cn(done && "bg-emerald-600 shadow-none hover:bg-emerald-600", className)}
      onClick={() => {
        add(item, qty);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
        toast({ title: "به سبد خرید اضافه شد", description: `${item.name}${qty > 1 ? ` — ${toFa(qty)} عدد` : ""}`, action: { label: "مشاهده سبد", href: "/cart" } });
      }}
    >
      {done ? <Check aria-hidden /> : <ShoppingCart aria-hidden />}
      <span>{done ? "اضافه شد" : label}</span>
      <span className="sr-only">: {item.name}</span>
    </Button>
  );
}
