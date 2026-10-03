"use client";

import { useEffect, useState, type RefObject } from "react";

/** true وقتی عنصر نزدیک viewport است؛ برای mount/unmount کردن Canvas (فقط یک Canvas فعال) */
export function useNearViewport(ref: RefObject<Element | null>, margin = "150px") {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return near;
}
