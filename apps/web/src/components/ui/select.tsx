import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * follow-up: plain native `<select>`, styled — enough for simple pages
 * (a handful of options, plugged straight into react-hook-form's
 * `register()`). Upgrade to Radix `Select` later for screens that need
 * richer UX (search, multi-select, custom option rendering).
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  ),
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
