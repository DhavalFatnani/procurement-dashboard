import { PRStatus } from "@prisma/client";

const ALLOWED: Partial<Record<PRStatus, readonly PRStatus[]>> = {
  [PRStatus.DRAFT]: [PRStatus.PENDING_APPROVAL, PRStatus.CANCELLED, PRStatus.EXECUTED_PRINT],
  [PRStatus.PENDING_APPROVAL]: [
    PRStatus.APPROVED,
    PRStatus.REJECTED,
    PRStatus.REVISION_REQUIRED,
    PRStatus.CANCELLED,
  ],
  [PRStatus.REVISION_REQUIRED]: [PRStatus.PENDING_APPROVAL, PRStatus.FORCE_CANCELLED],
  [PRStatus.APPROVED]: [PRStatus.CONVERTED_TO_PO],
};

export class PRStatusTransitionError extends Error {
  constructor(from: PRStatus, to: PRStatus) {
    super(`Invalid PR status transition: ${from} → ${to}`);
    this.name = "PRStatusTransitionError";
  }
}

export function canTransitionPRStatus(from: PRStatus, to: PRStatus): boolean {
  if (from === to) {
    return true;
  }
  const next = ALLOWED[from];
  return next?.includes(to) ?? false;
}

export function assertPRStatusTransition(from: PRStatus, to: PRStatus): void {
  if (!canTransitionPRStatus(from, to)) {
    throw new PRStatusTransitionError(from, to);
  }
}

/** Validates a PR's transition to `next`; returns the target status when valid. */
export function evaluatePRStatus(
  pr: { status: PRStatus },
  next: PRStatus,
): PRStatus {
  assertPRStatusTransition(pr.status, next);
  return next;
}
