import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useShop } from '@/store';

export function WishlistButton({ id, className = '' }: { id: string; className?: string }) {
  const on = useShop((s) => s.wishlist.includes(id));
  const toggle = useShop((s) => s.toggleWishlist);
  return (
    <button
      aria-label="علاقه‌مندی"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}
      className={`relative grid h-9 w-9 place-items-center rounded-full bg-black/50 backdrop-blur transition hover:bg-black/70 ${className}`}
    >
      <AnimatePresence mode="wait">
        <motion.span key={String(on)} initial={{ scale: 0.4 }} animate={{ scale: [0.4, 1.35, 1] }} exit={{ scale: 0 }} transition={{ duration: 0.35 }}>
          <Heart size={17} className={on ? 'fill-magenta text-magenta' : 'text-white'} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
