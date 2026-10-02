import type { Product } from '@/types';
import { categoryName } from '@/data/categories';

export const searchProducts = (list: Product[], q: string): Product[] => {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((p) =>
    [p.name, categoryName(p.category), p.brand, ...p.models, ...p.tags].join(' ').toLowerCase().includes(s),
  );
};
