import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--bg-elevated)_25%,#252525_50%,var(--bg-elevated)_75%)]",
        "animate-[ds-shimmer_1.5s_ease-in-out_infinite]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
