import { POAdvanceRequestStatus } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import {
  computeAdvanceBalances,
  computeAdvanceCommittedOverage,
  deriveInvoiceSettledStatus,
  invoiceRemainingBeforeCash,
  resolveAdvanceRequestAmount,
  sumPendingAndFulfilledAdvanceRequests,
  suggestAdvanceAllocation,
  validateAdvanceAllocation,
  validateAdvancePaymentAgainstCommitted,
} from "@/lib/po-advance";

describe("po-advance", () => {
  it("resolves amount from percent of committed total", () => {
    expect(resolveAdvanceRequestAmount(1000, { percent: 18 })).toEqual({
      ok: true,
      amount: 180,
      percent: 18,
    });
  });

  it("rejects advance above committed total", () => {
    expect(resolveAdvanceRequestAmount(100, { amount: 150 }).ok).toBe(false);
  });

  it("suggests min of unallocated advance and invoice remainder", () => {
    expect(suggestAdvanceAllocation(500, 300)).toBe(300);
    expect(suggestAdvanceAllocation(100, 400)).toBe(100);
  });

  it("computes advance balances", () => {
    const balances = computeAdvanceBalances([
      { amount: 1000, allocations: [{ amount: 400 }] },
      { amount: 500, allocations: [] },
    ]);
    expect(balances.advancePaid).toBe(1500);
    expect(balances.advanceAllocated).toBe(400);
    expect(balances.advanceUnallocated).toBe(1100);
  });

  it("derives invoice settlement including allocation", () => {
    const remaining = invoiceRemainingBeforeCash({
      amount: 1000,
      payments: [{ amount: 200 }],
      advanceAllocations: [{ amount: 300 }],
    });
    expect(remaining).toBe(500);
    expect(
      deriveInvoiceSettledStatus(1000, 200, 800),
    ).toBe("PAID");
  });

  it("validates allocation caps", () => {
    expect(validateAdvanceAllocation(50, 100, 80).ok).toBe(true);
    expect(validateAdvanceAllocation(150, 100, 80).ok).toBe(false);
  });

  it("detects advance paid above committed", () => {
    const overage = computeAdvanceCommittedOverage({
      committedTotal: 800,
      advancePaid: 1000,
    });
    expect(overage.overCommittedBy).toBe(200);
    expect(overage.message).toMatch(/short-ship/i);
  });

  it("blocks advance payment above committed", () => {
    expect(validateAdvancePaymentAgainstCommitted(500, 400, 200).ok).toBe(false);
    expect(validateAdvancePaymentAgainstCommitted(500, 100, 200).ok).toBe(true);
  });

  it("counts pending and fulfilled requests toward cap", () => {
    const total = sumPendingAndFulfilledAdvanceRequests([
      { status: POAdvanceRequestStatus.PENDING, requestedAmount: 100 },
      { status: POAdvanceRequestStatus.CANCELLED, requestedAmount: 50 },
      { status: POAdvanceRequestStatus.FULFILLED, requestedAmount: 200 },
    ]);
    expect(total).toBe(300);
  });
});
