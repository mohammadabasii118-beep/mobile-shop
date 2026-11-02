"use client";

import { motion } from "motion/react";

/**
 * Route transition. Opacity-only on purpose: a `transform` on this ancestor
 * would create a containing block and break the cinematic `position: sticky`
 * scroll stage on the home page. Opacity keeps transitions smooth and safe.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
