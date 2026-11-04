"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { label: "نمای اصلی", cls: "" },
  { label: "نمای جانبی", cls: "-scale-x-100 rotate-6" },
  { label: "جزئیات", cls: "scale-[1.6] origin-[60%_40%]" },
  { label: "نمای بالا", cls: "rotate-[-14deg] scale-90" },
];

export function ProductGallery({ src, alt, badges }: { src: string; alt: string; badges?: React.ReactNode }) {
  const [v, setV] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      <div className="no-scrollbar flex gap-2 overflow-x-auto sm:flex-col">
        {VIEWS.map((view, i) => (
          <button key={view.label} onClick={() => setV(i)} aria-label={view.label} className={cn("relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 bg-studio transition", v === i ? "border-primary" : "border-transparent hover:border-neutral-300")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className={cn("size-full object-contain p-2", view.cls)} />
          </button>
        ))}
      </div>
      <div
        className="group relative aspect-square flex-1 cursor-zoom-in overflow-hidden rounded-3xl border border-neutral-200 bg-studio"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        <div className="absolute inset-0 transition-transform duration-200" style={zoom ? { transform: "scale(1.8)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={v} src={src} alt={alt} className={cn("size-full object-contain p-[10%] transition duration-500 animate-in fade-in", VIEWS[v].cls)} />
        </div>
        <div className="absolute top-4 right-4 flex flex-col items-start gap-1.5">{badges}</div>
        <span className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-neutral-600 shadow-sm backdrop-blur transition group-hover:opacity-0">
          <Maximize2 className="size-3.5" />برای بزرگنمایی نشانگر را حرکت دهید
        </span>
      </div>
    </div>
  );
}
