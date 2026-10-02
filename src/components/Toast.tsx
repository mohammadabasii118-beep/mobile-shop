import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useShop } from '@/store';

export function Toaster() {
  const toasts = useShop((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-surface2/95 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur">
            {t.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400" /> : t.type === 'error' ? <XCircle size={18} className="text-red-400" /> : <Info size={18} className="text-sky" />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
