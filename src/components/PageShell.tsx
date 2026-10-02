import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/** پوسته‌ی صفحات داخلی با فاصله از هدر ثابت */
export function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="container-x pb-10 pt-28 md:pt-36">
      <h1 className="text-4xl font-black text-white md:text-6xl">{title}</h1>
      {subtitle && <p className="mt-3 max-w-xl text-mist/60">{subtitle}</p>}
      <div className="mt-10">{children}</div>
    </motion.div>
  );
}
