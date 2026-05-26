import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Visual rhythm helper used inside drawers — a small section header (label +
 * optional description + optional inline action) followed by content.
 *
 * Keeps section padding/typography consistent across Payments, AddVendor,
 * EditVendor, etc.
 */
export function SheetSection({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {title || action ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            {title ? (
              <h3 className="text-ds-sm font-semibold text-foreground">{title}</h3>
            ) : null}
            {description ? (
              <p className="text-ds-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
