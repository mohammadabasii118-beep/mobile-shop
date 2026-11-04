"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function RailScroller({ children, dark, label }: { children: React.ReactNode; dark?: boolean; label: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const btn = cn(
    "absolute top-1/3 z-10 hidden size-11 cursor-pointer place-items-center rounded-full shadow-lg transition md:grid",
    dark ? "bg-white text-neutral-950 hover:bg-primary hover:text-white" : "bg-neutral-950 text-white hover:bg-primary",
  );
  return (
    <div className="relative">
      <button type="button" aria-label="محصولات قبلی" onClick={() => scroll(1)} className={cn(btn, "-right-5")}><ChevronRight className="size-5" /></button>
      <button type="button" aria-label="محصولات بعدی" onClick={() => scroll(-1)} className={cn(btn, "-left-5")}><ChevronLeft className="size-5" /></button>
      <ul ref={ref} aria-label={label} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pt-1 pb-6 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {children}
      </ul>
    </div>
  );
}
