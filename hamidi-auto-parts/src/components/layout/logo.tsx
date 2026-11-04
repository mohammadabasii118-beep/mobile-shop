import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-11", className)} aria-hidden>
      <defs>
        <linearGradient id="lg-red" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3b30" />
          <stop offset="1" stopColor="#a80400" />
        </linearGradient>
      </defs>
      <path d="M24 2 43 13v22L24 46 5 35V13Z" fill="#0b0b0d" />
      <path d="M24 5.5 40 14.8v18.4L24 42.5 8 33.2V14.8Z" fill="url(#lg-red)" />
      <path d="M15.5 14.5h5v7.2h7v-7.2h5v19h-5v-7.3h-7v7.3h-5z" fill="#fff" />
      <path d="M8 14.8 24 5.5l16 9.3-3 1.7L24 9 11 16.5Z" fill="#fff" opacity=".25" />
    </svg>
  );
}

export function Logo({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)} aria-label="فروشگاه حمیدی - صفحه اصلی">
      <LogoMark className="transition-transform duration-500 group-hover:rotate-[30deg]" />
      <div className="flex flex-col leading-none">
        <span className={cn("text-[15px] font-black tracking-tight sm:text-[17px]", dark ? "text-white" : "text-neutral-950")} dir="ltr">
          HAMIDI <span className="text-primary">AUTO</span> PARTS
        </span>
        <span className={cn("mt-1 text-[11px] font-medium sm:text-xs", dark ? "text-neutral-400" : "text-neutral-500")}>
          فروشگاه حمیدی · نیسان و هوندا
        </span>
      </div>
    </Link>
  );
}
