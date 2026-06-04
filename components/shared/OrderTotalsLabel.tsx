import {
  formatItemCount,
  formatOrderTotalsInline,
  formatUnitCount,
} from "@/lib/order-totals-display";
import { cn } from "@/lib/utils";

export function OrderTotalsLabel({
  itemCount,
  totalQty,
  variant = "inline",
  className,
}: {
  itemCount: number;
  totalQty: number;
  variant?: "inline" | "stacked";
  className?: string;
}) {
  if (variant === "stacked") {
    const showBoth = itemCount > 0 && totalQty > 0 && itemCount !== totalQty;
    return (
      <span className={cn("inline-flex flex-col gap-0.5 tabular-nums", className)}>
        {itemCount > 0 ? (
          <span className="font-medium text-foreground">{formatItemCount(itemCount)}</span>
        ) : null}
        {showBoth || (itemCount <= 0 && totalQty > 0) ? (
          <span className="text-ds-xs text-muted-foreground">{formatUnitCount(totalQty)}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={cn("tabular-nums", className)}>
      {formatOrderTotalsInline(itemCount, totalQty)}
    </span>
  );
}
