import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-primary text-primary-foreground hover:opacity-90 shadow-sm",
  secondary: "bg-muted text-foreground hover:bg-border",
  outline: "border bg-card hover:bg-muted",
  ghost: "hover:bg-muted",
  danger: "bg-danger/10 text-danger hover:bg-danger/20",
  success: "bg-success/10 text-success hover:bg-success/20",
};
const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm", lg: "h-11 px-6 text-sm", icon: "h-9 w-9" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary", variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});
