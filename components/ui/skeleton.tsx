import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded bg-[color-mix(in_srgb,var(--border-subtle)_60%,var(--surface-2)_40%)]",
        "animate-ds-pulse",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
