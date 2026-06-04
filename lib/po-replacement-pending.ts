import { GRNExceptionOutcome } from "@/lib/prisma-enums";

export type ReplacementPendingLine = {
  poLineItemId: string;
  poLineId: string | null;
  pendingQty: number;
  exceptionId: string;
};

type GrnExceptionRow = {
  id: string;
  poLineItemId: string | null;
  poLineId: string | null;
  exceptionQty: number;
  resolutionOutcome: string | null;
  pendingReplacementQty: number | null;
  resolutionStatus: string | null;
};

type PoLineAccepted = {
  poLineItemId: string;
  acceptedQty: number;
};

/**
 * Remaining replacement qty per base PO line (resolved REPLACE_AND_AWAIT_GRN only).
 */
export function pendingReplacementByPoLine(
  exceptions: GrnExceptionRow[],
  acceptedByLineItem: Map<string, number>,
  effectiveOrderedByLineItem: Map<string, number>,
): ReplacementPendingLine[] {
  const pending: ReplacementPendingLine[] = [];

  for (const ex of exceptions) {
    if (ex.resolutionOutcome !== GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN) {
      continue;
    }
    const pendingQty = ex.pendingReplacementQty ?? 0;
    if (pendingQty <= 0 || !ex.poLineItemId) {
      continue;
    }
    const lineId = ex.poLineItemId;
    const accepted = acceptedByLineItem.get(lineId) ?? 0;
    const effectiveOrdered = effectiveOrderedByLineItem.get(lineId) ?? 0;
    const remaining = Math.max(0, effectiveOrdered - accepted);
    const stillPending = Math.min(pendingQty, remaining);
    if (stillPending > 0) {
      pending.push({
        poLineItemId: lineId,
        poLineId: ex.poLineId,
        pendingQty: stillPending,
        exceptionId: ex.id,
      });
    }
  }

  return pending;
}

export function hasPendingReplacement(
  exceptions: GrnExceptionRow[],
  acceptedByLineItem: Map<string, number>,
  effectiveOrderedByLineItem: Map<string, number>,
): boolean {
  return (
    pendingReplacementByPoLine(
      exceptions,
      acceptedByLineItem,
      effectiveOrderedByLineItem,
    ).length > 0
  );
}

export function sumPendingReplacementQty(
  lines: ReplacementPendingLine[],
): number {
  return lines.reduce((s, l) => s + l.pendingQty, 0);
}
