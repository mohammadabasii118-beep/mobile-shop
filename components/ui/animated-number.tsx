"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { formatNumber } from "@/lib/format";

/** تغییر قیمت/عدد با slide عمودی ۸px (DESIGN.md §10) */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={`relative inline-flex overflow-hidden align-bottom ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="num inline-block"
          initial={reduce ? { opacity: 0 } : { y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: -8, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {formatNumber(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
