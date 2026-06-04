import { GRNExceptionOutcome, POStatus } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import { buildClosureSnapshot, type POWithRelations } from "@/lib/po-closure-snapshot";

function minimalPo(overrides: Partial<POWithRelations> = {}): POWithRelations {
  return {
    id: "po-1",
    status: POStatus.PARTIALLY_RECEIVED,
    orderedQty: 100,
    unitPrice: null,
    deliveryComplete: false,
    gstApplicable: false,
    gstRatePercent: null,
    lineItems: [
      {
        id: "line-1",
        orderedQty: 100,
        unitPrice: { toString: () => "10" } as POWithRelations["lineItems"][0]["unitPrice"],
        goodsReceiptLineItems: [{ acceptedQty: 80 }],
      },
    ],
    lines: [],
    grns: [
      {
        acceptedQty: 80,
        receivedQty: 100,
        disputedQty: 20,
        exceptions: [
          {
            poLineItemId: "line-1",
            poLineId: null,
            resolutionStatus: "RETURNED_TO_VENDOR",
            resolutionOutcome: GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN,
            pendingReplacementQty: 20,
          },
        ],
      },
    ],
    invoices: [],
    advancePayments: [],
    lineAdjustments: [],
    ...overrides,
  } as POWithRelations;
}

describe("buildClosureSnapshot", () => {
  it("blocks delivery complete when replacement GRN is pending", () => {
    const snapshot = buildClosureSnapshot(minimalPo());
    expect(snapshot.checks.noPendingReplacement).toBe(false);
    expect(snapshot.checks.deliveryComplete).toBe(false);
  });

  it("allows delivery complete when replacement qty is received", () => {
    const po = minimalPo({
      lineItems: [
        {
          id: "line-1",
          orderedQty: 100,
          unitPrice: { toString: () => "10" } as POWithRelations["lineItems"][0]["unitPrice"],
          goodsReceiptLineItems: [{ acceptedQty: 100 }],
        },
      ],
      grns: [
        {
          acceptedQty: 100,
          receivedQty: 100,
          disputedQty: 0,
          exceptions: [
            {
              poLineItemId: "line-1",
              poLineId: null,
              resolutionStatus: "RETURNED_TO_VENDOR",
              resolutionOutcome: GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN,
              pendingReplacementQty: 20,
            },
          ],
        },
      ],
    });
    const snapshot = buildClosureSnapshot(po);
    expect(snapshot.checks.noPendingReplacement).toBe(true);
    expect(snapshot.receivedQty).toBe(100);
  });
});
