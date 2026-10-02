import { Star } from 'lucide-react';
import { toFa } from '@/utils/format';

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-mist/70">
      <Star size={13} className="fill-amber text-amber" />
      <b className="text-white">{value.toLocaleString('fa-IR')}</b>
      {count !== undefined && <span>({toFa(count)})</span>}
    </span>
  );
}
