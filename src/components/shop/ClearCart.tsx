'use client';

import { useEffect } from 'react';
import { useShop } from './CartProvider';

export default function ClearCart() {
  const { clear, ready } = useShop();
  useEffect(() => {
    if (!ready) return;
    clear();
    try { sessionStorage.removeItem('vt_coupon'); } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return null;
}
