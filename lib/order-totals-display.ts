/** Human-readable catalog item count (distinct SKUs / line items). */
export function formatItemCount(count: number): string {
  const n = count.toLocaleString("en-IN");
  return `${n} ${count === 1 ? "item" : "items"}`;
}

/** Human-readable unit quantity (sum of ordered/received units). */
export function formatUnitCount(qty: number): string {
  const n = qty.toLocaleString("en-IN");
  return `${n} ${qty === 1 ? "unit" : "units"}`;
}

/** Inline summary when both item count and total units matter. */
export function formatOrderTotalsInline(itemCount: number, totalQty: number): string {
  if (itemCount <= 0 && totalQty <= 0) {
    return "—";
  }
  if (itemCount <= 0) {
    return formatUnitCount(totalQty);
  }
  if (totalQty <= 0 || itemCount === totalQty) {
    return formatItemCount(itemCount);
  }
  return `${formatItemCount(itemCount)} · ${formatUnitCount(totalQty)}`;
}

export function countPoCatalogItems(po: {
  lineItems: unknown[];
  lines: unknown[];
}): number {
  return po.lineItems.length > 0 ? po.lineItems.length : po.lines.length;
}
