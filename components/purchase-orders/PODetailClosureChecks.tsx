import { Check, Circle } from "lucide-react";

import type { PODetail } from "@/lib/queries/purchase-orders";
import { cn } from "@/lib/utils";

/**
 * Side-panel surface for the four closure checks Ops uses to know when a PO
 * is ready to close: delivery complete, invoiced ≥ received, fully paid,
 * and no open GRN disputes. Data is sourced from `po.reconciliation.checks`.
 */
export function PODetailClosureChecks({ po }: { po: PODetail }) {
  const checks = po.reconciliation.checks;
  if (!checks || checks.length === 0) {
    return (
      <p className="text-ds-sm text-muted-foreground">No closure checks yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {checks.map((check) => (
        <li
          key={check.id}
          className="flex items-start gap-2 text-ds-sm"
        >
          <span
            className={cn(
              "mt-0.5 flex size-4 items-center justify-center rounded-full",
              check.done
                ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {check.done ? (
              <Check className="size-3" strokeWidth={2.5} />
            ) : (
              <Circle className="size-2" strokeWidth={2.5} />
            )}
          </span>
          <span
            className={cn(
              "leading-snug",
              check.done ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {check.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
