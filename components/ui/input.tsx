import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-border bg-input px-3",
        "text-ds-sm text-foreground transition-[border,box-shadow,background] duration-fast outline-none",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-ds-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground/70",
        "hover:border-border-strong",
        "focus-visible:border-[var(--brand-accent)] focus-visible:shadow-ds-focus",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-background disabled:text-muted-foreground/50",
        "aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_color-mix(in_srgb,var(--status-error)_28%,transparent)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
