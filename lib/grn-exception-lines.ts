import type {
  GRNExceptionDisposition,
  GRNExceptionOutcome,
  GRNExceptionResolution,
  GRNExceptionType,
} from "@/lib/prisma-enums";

import { OUTCOME_LABELS } from "@/lib/grn-exception-outcomes";

export type GrnExceptionSnapshot = {
  id: string;
  exceptionType: GRNExceptionType;
  exceptionQty: number;
  note: string;
  resolutionStatus: GRNExceptionResolution | null;
  resolutionOutcome: GRNExceptionOutcome | null;
  resolutionDisposition: GRNExceptionDisposition | null;
  closeLineAfterResolve: boolean | null;
  pendingReplacementQty: number | null;
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
  resolutionOutcome?: GRNExceptionOutcome | null;
  resolutionDisposition?: GRNExceptionDisposition | null;
  closeLineAfterResolve?: boolean | null;
  pendingReplacementQty?: number | null;
  resolutionNote: string | null;
};

export function formatExceptionResolutionLabel(ex: GrnExceptionSnapshot): string | null {
  if (!ex.resolutionStatus) {
    return null;
  }
  if (ex.resolutionOutcome) {
    return OUTCOME_LABELS[ex.resolutionOutcome];
  }
  const disposition =
    ex.resolutionDisposition === "KEEP"
      ? "Kept"
      : ex.resolutionDisposition === "RETURN_TO_VENDOR"
        ? "Returned"
        : ex.resolutionDisposition === "NOT_RETURNED"
          ? "Removed (not returned)"
          : null;
  const commitment =
    ex.closeLineAfterResolve === true
      ? "line closed"
      : ex.closeLineAfterResolve === false
        ? "still expecting"
        : null;

  if (disposition && commitment) {
    return `${disposition} · ${commitment}`;
  }
  return ex.resolutionStatus.replaceAll("_", " ");
}

export function toGrnExceptionSnapshot(ex: ExceptionRecord): GrnExceptionSnapshot {
  return {
    id: ex.id,
    exceptionType: ex.exceptionType,
    exceptionQty: ex.exceptionQty,
    note: ex.note,
    resolutionStatus: ex.resolutionStatus,
    resolutionOutcome: ex.resolutionOutcome ?? null,
    resolutionDisposition: ex.resolutionDisposition ?? null,
    closeLineAfterResolve: ex.closeLineAfterResolve ?? null,
    pendingReplacementQty: ex.pendingReplacementQty ?? null,
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
