import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Form field wrapper — label + optional hint/error + input slot.
 *
 * Standardises label scale (text-ds-sm font-medium) across drawers and forms
 * so different sheets stop using different `<label>` class soups.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
  layout = "stack",
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  /** `stack` = label on top; `inline` = label left + control right (compact). */
  layout?: "stack" | "inline";
}) {
  if (layout === "inline") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          className,
        )}
      >
        {label ? (
          <label
            htmlFor={htmlFor}
            className="shrink-0 text-ds-sm font-medium text-foreground"
          >
            {label}
            {required ? (
              <span className="ml-0.5 text-[var(--status-error)]" aria-hidden>
                *
              </span>
            ) : null}
          </label>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
        {hint || error ? (
          <p className="text-ds-2xs text-muted-foreground">{error ?? hint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block text-ds-sm font-medium text-foreground"
        >
          {label}
          {required ? (
            <span className="ml-0.5 text-[var(--status-error)]" aria-hidden>
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-ds-xs text-[var(--status-error)]">{error}</p>
      ) : hint ? (
        <p className="text-ds-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
