"use client";

import { MotionConfig } from "framer-motion";
import { CartProvider } from "@/features/cart/cart-context";
import { CartDrawer } from "@/components/layout/cart-drawer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <CartProvider>
        {children}
        <CartDrawer />
      </CartProvider>
    </MotionConfig>
  );
}
