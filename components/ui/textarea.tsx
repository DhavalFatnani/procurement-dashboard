import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-border-subtle bg-input px-3 py-2",
        "text-ds-sm text-foreground shadow-ds transition-[border,box-shadow] duration-fast",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-[var(--brand-accent)] focus-visible:shadow-ds-focus",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
