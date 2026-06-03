import { InvoiceMatchStatus } from "@/lib/prisma-enums";

export type InvoiceMatchResult = {
  expectedAmount: number | null;
  matchStatus: InvoiceMatchStatus;
  variance: number | null;
  variancePct: number | null;
};

function matchFromExpected(
  expectedAmount: number | null,
  amount: number,
  tolerancePct: number,
): InvoiceMatchResult {
  if (expectedAmount == null || expectedAmount <= 0) {
    return {
      expectedAmount,
      matchStatus: InvoiceMatchStatus.PENDING,
      variance: null,
      variancePct: null,
    };
  }

  const variance = amount - expectedAmount;
  const variancePct =
    expectedAmount > 0 ? (variance / expectedAmount) * 100 : amount > 0 ? 100 : 0;
  const withinTolerance = Math.abs(variancePct) <= tolerancePct;

  return {
    expectedAmount,
    matchStatus: withinTolerance ? InvoiceMatchStatus.MATCHED : InvoiceMatchStatus.MISMATCH,
    variance,
    variancePct,
  };
}

/** Three-way match from selected GRN accepted qty and PO unit price (default ±2.5%). */
export function computeInvoiceMatch(
  acceptedQty: number,
  amount: number,
  unitPrice: number | null,
  tolerancePct = 2.5,
): InvoiceMatchResult {
  if (unitPrice == null || unitPrice <= 0) {
    return matchFromExpected(null, amount, tolerancePct);
  }
  return matchFromExpected(acceptedQty * unitPrice, amount, tolerancePct);
}

/** Line-weighted match when expected amount is precomputed from PO lines. */
export function computeInvoiceMatchFromExpected(
  expectedAmount: number | null,
  amount: number,
  tolerancePct = 2.5,
): InvoiceMatchResult {
  return matchFromExpected(expectedAmount, amount, tolerancePct);
}
