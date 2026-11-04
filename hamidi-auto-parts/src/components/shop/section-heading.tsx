import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  href,
  linkLabel = "مشاهده همه",
  dark,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <span className="mb-2 inline-flex items-center gap-2 text-xs font-bold tracking-wide text-primary">
            <span className="h-[3px] w-6 rounded-full bg-primary" />
            {eyebrow}
          </span>
        )}
        <h2 className={cn("text-2xl font-black tracking-tight sm:text-3xl", dark ? "text-white" : "text-neutral-950")}>{title}</h2>
        {subtitle && <p className={cn("mt-2 max-w-xl text-sm leading-7", dark ? "text-neutral-400" : "text-neutral-500")}>{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className={cn(
            "group flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
            dark ? "border-white/15 text-white hover:bg-white hover:text-neutral-950" : "border-neutral-200 hover:border-neutral-950 hover:bg-neutral-950 hover:text-white",
          )}
        >
          {linkLabel}
          <ArrowLeft className="size-4 transition group-hover:-translate-x-1" />
        </Link>
      )}
    </div>
  );
}
