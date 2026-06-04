/**
 * Pending quantity for recording a new GRN must use physical receipt totals,
 * not accepted-only. Otherwise disputed units still on a prior GRN look "pending"
 * and allow a duplicate delivery record before dispute resolution.
 */
export function sumReceivedQtyOnPoLine(
  lines: ReadonlyArray<{ receivedQty: number }>,
): number {
  return lines.reduce((sum, line) => sum + line.receivedQty, 0);
}

export function pendingQtyForNextGrnReceipt(
  effectiveOrderedQty: number,
  summedReceivedQty: number,
): number {
  return Math.max(0, effectiveOrderedQty - summedReceivedQty);
}

export type GrnReceiptLinePending = {
  previouslyReceivedQty: number;
  pendingQty: number;
};

/** Hide receipt headers that no longer carry any quantity after replace/return. */
export function isVisibleGrnReceipt(row: {
  receivedQty: number;
  acceptedQty: number;
  disputedQty: number;
}): boolean {
  return row.receivedQty > 0 || row.acceptedQty > 0 || row.disputedQty > 0;
}
