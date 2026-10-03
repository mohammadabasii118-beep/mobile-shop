import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-6", {
  variants: {
    variant: {
      neutral: "bg-secondary text-fg",
      accent: "bg-accent text-accent-fg",
      discount: "bg-discount/12 text-discount",
      outline: "text-muted shadow-hairline",
      success: "bg-success/12 text-success",
      warning: "bg-warning/14 text-warning",
      danger: "bg-danger/12 text-danger",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
