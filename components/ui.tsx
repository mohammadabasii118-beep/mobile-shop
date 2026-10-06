import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Buttons: 10px radius, flat fills, a 1px press. Variants keep their names so every existing call site is unchanged. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-normal transition-[background-color,color,border-color,transform] duration-150 active:translate-y-px disabled:opacity-45 disabled:pointer-events-none cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-fg hover:opacity-90",
        outline: "border border-border-strong bg-transparent text-foreground hover:border-foreground hover:bg-surface-2",
        ghost: "text-foreground hover:bg-surface-2",
      },
      size: { sm: "h-10 px-4 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-[52px] px-7 text-[15px]", icon: "size-11" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className, variant, size, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Badge({ className, tone = "primary", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "primary" | "success" | "muted" | "dark" | "hot" }) {
  const tones = {
    primary: "bg-primary text-primary-fg",
    success: "bg-success/12 text-success",
    muted: "bg-surface-2 text-muted",
    dark: "bg-secondary text-secondary-fg",
    hot: "bg-hot text-white",
  };
  return <span className={cn("inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-bold leading-5", tones[tone], className)} {...props} />;
}

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10", className)} {...props} />;
}

/** Section title: serif headline, a hairline that runs to the "view all" link. */
export function SectionHeader({ title, href, sub }: { title: string; href?: string; sub?: string }) {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center gap-4">
        <h2 className="font-display shrink-0 text-[28px] leading-none sm:text-[36px]">{title}</h2>
        <span className="h-px flex-1 bg-border" aria-hidden />
        {href && (
          <Link href={href} className="group inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-foreground transition-colors hover:text-primary">
            مشاهده همه <span aria-hidden className="inline-block transition-transform duration-200 group-hover:-translate-x-1">←</span>
          </Link>
        )}
      </div>
      {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
    </div>
  );
}
