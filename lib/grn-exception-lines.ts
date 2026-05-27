import type { GRNExceptionResolution, GRNExceptionType } from "@prisma/client";

export type GrnExceptionSnapshot = {
  id: string;
  exceptionType: GRNExceptionType;
  exceptionQty: number;
  note: string;
  resolutionStatus: GRNExceptionResolution | null;
  resolutionNote: string | null;
};

type ExceptionRecord = {
  id: string;
  poLineItemId: string | null;
  poLineId: string | null;
  exceptionType: GRNExceptionType;
  exceptionQty: number;
  note: string;
  resolutionStatus: GRNExceptionResolution | null;
  resolutionNote: string | null;
};

export function toGrnExceptionSnapshot(ex: ExceptionRecord): GrnExceptionSnapshot {
  return {
    id: ex.id,
    exceptionType: ex.exceptionType,
    exceptionQty: ex.exceptionQty,
    note: ex.note,
    resolutionStatus: ex.resolutionStatus,
    resolutionNote: ex.resolutionNote,
  };
}

export function resolveExceptionForLineItem(
  exceptions: ExceptionRecord[],
  poLineItemId: string,
  lineDisputedQty: number,
): GrnExceptionSnapshot | null {
  const linked = exceptions.find((e) => e.poLineItemId === poLineItemId);
  if (linked) {
    return toGrnExceptionSnapshot(linked);
  }
  if (lineDisputedQty <= 0) {
    return null;
  }
  const unlinked = exceptions.filter((e) => !e.poLineItemId && !e.poLineId);
  if (unlinked.length === 1) {
    return toGrnExceptionSnapshot(unlinked[0]!);
  }
  return null;
}

export function resolveExceptionForLegacyLine(
  exceptions: ExceptionRecord[],
  poLineId: string,
  lineDisputedQty: number,
): GrnExceptionSnapshot | null {
  const linked = exceptions.find((e) => e.poLineId === poLineId);
  if (linked) {
    return toGrnExceptionSnapshot(linked);
  }
  if (lineDisputedQty <= 0) {
    return null;
  }
  const unlinked = exceptions.filter((e) => !e.poLineItemId && !e.poLineId);
  if (unlinked.length === 1) {
    return toGrnExceptionSnapshot(unlinked[0]!);
  }
  return null;
}
