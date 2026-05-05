import { randomUUID } from "crypto";

/** Application-level IDs with the prefixes required by procurement numbering rules. */
export function newPurchaseRequestId(): string {
  return `PR-${randomUUID()}`;
}

export function newPurchaseOrderId(): string {
  return `PO-${randomUUID()}`;
}
