import { POAdvanceRequestStatus } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import {
  advanceOverageForPo,
  computeAdvanceCommittedOverage,
  fifoAdvanceAllocationChunks,
  invoiceRemainingBeforeCash,
  resolveAdvanceRequestAmount,
  suggestAdvanceAllocation,
  validateAdvanceAllocation,
  validateAdvancePaymentAgainstCommitted,
} from "@/lib/po-advance";

/**
 * End-to-end advance flow (pure functions): configure → pay → short-ship → invoice settle.
 */
describe("advance payment flow (pure)", () => {
  it("configure: OPS requests advance capped at committed PO", () => {
    const committed = 1000;
    const request = resolveAdvanceRequestAmount(committed, { percent: 20 });
    expect(request).toEqual({ ok: true, amount: 200, percent: 20 });
    expect(resolveAdvanceRequestAmount(committed, { amount: 1200 }).ok).toBe(false);
  });

  it("fulfill: Finance pays advance against committed cap", () => {
    const committed = 1000;
    const paid = 0;
    const payAmount = 200;
    expect(validateAdvancePaymentAgainstCommitted(committed, paid, payAmount).ok).toBe(
      true,
    );
    expect(
      validateAdvancePaymentAgainstCommitted(committed, 900, 200).ok,
    ).toBe(false);
  });

  it("short-ship: warns when paid advance exceeds lowered commitment", () => {
    const committedAfterShortShip = 150;
    const overage = advanceOverageForPo({
      committedTotal: committedAfterShortShip,
      advancePayments: [{ amount: 200, allocations: [] }],
      advanceRequests: [],
    });
    expect(overage.overCommittedBy).toBe(50);
    expect(overage.message).toContain("exceeds current PO commitment");
  });

  it("invoice: hybrid settlement uses advance credit then cash", () => {
    const remaining = invoiceRemainingBeforeCash({
      amount: 1000,
      payments: [],
      advanceAllocations: [],
    });
    expect(remaining).toBe(1000);
    const suggested = suggestAdvanceAllocation(200, remaining);
    expect(suggested).toBe(200);
    expect(validateAdvanceAllocation(200, 200, 1000).ok).toBe(true);

    const chunks = fifoAdvanceAllocationChunks(
      [{ id: "ap1", paidAt: "2026-01-01", amount: 200, allocated: 0 }],
      200,
    );
    expect(chunks).toEqual([{ advancePaymentId: "ap1", amount: 200 }]);

    const afterAlloc = invoiceRemainingBeforeCash({
      amount: 1000,
      payments: [],
      advanceAllocations: [{ amount: 200 }],
    });
    expect(afterAlloc).toBe(800);
  });

  it("pending requests count toward over-commitment before pay", () => {
    const overage = computeAdvanceCommittedOverage({
      committedTotal: 500,
      advancePaid: 100,
      pendingReserved: 450,
    });
    expect(overage.overCommittedBy).toBe(50);
    expect(overage.message).toContain("Pending advance");
  });

  it("reject path: only pending requests are in exposure", () => {
    const overage = advanceOverageForPo({
      committedTotal: 1000,
      advancePayments: [],
      advanceRequests: [
        { status: POAdvanceRequestStatus.PENDING, requestedAmount: 300 },
        { status: POAdvanceRequestStatus.REJECTED, requestedAmount: 500 },
      ],
    });
    expect(overage.pendingReserved).toBe(300);
    expect(overage.overCommittedBy).toBe(0);
  });
});
