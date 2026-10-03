import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
}

export function SectionHeader({ eyebrow, title, description, href, linkLabel = "مشاهدهٔ همه", className }: Props) {
  return (
    <div className={cn("mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 md:mb-12", className)}>
      <div className="max-w-3xl">
        {eyebrow && <p className="t-eyebrow mb-3">{eyebrow}</p>}
        <h2 className="t-h1">{title}</h2>
        {description && <p className="t-body mt-3 text-muted">{description}</p>}
      </div>
      {href && (
        <a href={href} className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
          {linkLabel}
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden />
        </a>
      )}
    </div>
  );
}
