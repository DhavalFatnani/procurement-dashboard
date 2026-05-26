import type { ReactNode } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Standard filter bar above DataTable lists.
 */
export function FilterBar({
  children,
  activeChips,
  resultCount,
  onExportCsv,
  className,
}: {
  children: ReactNode;
  activeChips?: ReactNode;
  resultCount?: number;
  onExportCsv?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border-subtle bg-card px-4 py-3 shadow-ds",
        className,
      )}
    >
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
        <div className="flex shrink-0 items-center gap-2">
          {resultCount != null ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-ds-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{resultCount}</span> result
              {resultCount === 1 ? "" : "s"}
            </span>
          ) : null}
          {onExportCsv ? (
            <Button
              type="button"
              variant="soft"
              size="sm"
              className="h-8 gap-1.5"
              onClick={onExportCsv}
            >
              <Download className="size-3.5" strokeWidth={1.5} />
              Export CSV
            </Button>
          ) : null}
        </div>
      </div>
      {activeChips ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2.5">
          {activeChips}
        </div>
      ) : null}
    </div>
  );
}
