import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

/** Drawer کناری (دسکتاپ/موبایل) یا Bottom Sheet */
export function Sheet({ open, onClose, children, title, side = 'right' }: { open: boolean; onClose: () => void; children: ReactNode; title: string; side?: 'right' | 'left' | 'bottom' }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', h); };
  }, [open, onClose]);
  const from = side === 'bottom' ? { y: '100%' } : { x: side === 'right' ? '100%' : '-100%' };
  const pos = side === 'bottom' ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl' : `inset-y-0 ${side === 'right' ? 'right-0' : 'left-0'} w-full max-w-md`;
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside role="dialog" aria-label={title} className={`absolute flex flex-col bg-surface ${pos}`} initial={from} animate={{ x: 0, y: 0 }} exit={from} transition={{ type: 'spring', damping: 34, stiffness: 320 }}>
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-lg font-black text-white">{title}</h3>
              <button onClick={onClose} aria-label="بستن" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X size={18} /></button>
            </header>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
