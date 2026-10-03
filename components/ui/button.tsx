"use client";

import { cloneElement, isValidElement } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** DESIGN.md §5/§8 — فقط pill و دایره */
export const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:opacity-90",
        accent: "bg-accent text-accent-fg hover:brightness-95",
        secondary: "bg-secondary text-fg hover:bg-line",
        outline: "text-fg shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--fg)]",
        ghost: "text-fg hover:bg-secondary",
      },
      size: {
        sm: "min-h-11 px-4 text-sm",
        md: "min-h-12 px-6 text-[0.9375rem]",
        lg: "min-h-14 px-8 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, children, ...props }: ButtonProps) {
  const cls = cn(buttonVariants({ variant, size }), className);
  if (asChild && isValidElement<{ className?: string }>(children)) {
    return cloneElement(children, { className: cn(cls, children.props.className) });
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
