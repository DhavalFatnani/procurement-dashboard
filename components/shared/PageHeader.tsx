import type { ReactNode } from "react";

import { Breadcrumbs, type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
  variant = "default",
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  /** Hero variant adds soft gradient background for module landing pages. */
  variant?: "default" | "hero";
}) {
  const showTitleRow = title.length > 0 || subtitle != null || action != null;
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        variant === "hero" &&
          "-mx-4 rounded-2xl border border-border-subtle bg-[var(--gradient-shell)] px-4 py-5 shadow-ds md:-mx-0 md:px-6",
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
      {showTitleRow ? (
        <div className="flex min-h-9 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <h1 className="text-ds-lg font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="text-ds-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
