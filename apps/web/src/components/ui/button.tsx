import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Baseline reset — `ghost`/`link` rely on this staying transparent;
  // variants that DO want a background (default/destructive/outline/
  // secondary) override it later in the class string, resolved by `cn()`
  // (tailwind-merge) in their favor.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border-0 bg-transparent p-0 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-card hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "bg-transparent hover:bg-accent hover:text-accent-foreground",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        // follow-up: user feedback (2026-08-15) — first tried a size bump
        // for the default across the board, but that was the wrong
        // direction; reverted to compact sizing. `default`/`sm`/`icon` stay
        // small and dense; `lg` is available for a page's one or two real
        // primary CTAs (e.g. "Salvar", "Criar") where more visual weight
        // is actually wanted.
        default: "h-8 px-3.5 py-2 text-sm",
        sm: "h-7 rounded-md px-3 text-xs",
        lg: "h-9 rounded-md px-6 text-sm",
        icon: "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
