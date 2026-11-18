import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-xs font-bold uppercase tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-slate-900 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-slate-900 bg-slate-900 text-white hover:border-slate-800 hover:bg-slate-800",
        destructive:
          "border border-red-800 bg-red-700 text-white hover:border-red-900 hover:bg-red-800",
        outline:
          "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100",
        secondary:
          "border border-slate-300 bg-slate-100 text-slate-800 hover:border-slate-400 hover:bg-slate-200",
        ghost: "border border-transparent text-slate-700 hover:bg-slate-100",
        link: "text-slate-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 px-5 has-[>svg]:px-4",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
