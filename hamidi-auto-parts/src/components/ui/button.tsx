import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_rgba(225,6,0,.7)] hover:bg-primary/90 hover:shadow-[0_10px_24px_-8px_rgba(225,6,0,.8)]",
        dark: "bg-neutral-950 text-white hover:bg-neutral-800",
        outline: "border border-border bg-background hover:border-neutral-950 hover:bg-neutral-50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-neutral-200",
        ghost: "hover:bg-neutral-100",
        whatsapp: "bg-[#25D366] text-white shadow-[0_8px_20px_-8px_rgba(37,211,102,.8)] hover:bg-[#1ebe5b]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-lg px-3.5 text-[13px]",
        lg: "h-13 rounded-2xl px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-8 rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
