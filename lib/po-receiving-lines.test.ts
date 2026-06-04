import { GRNExceptionOutcome, GRNExceptionType, POStatus } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import {
  attentionLinesForPo,
  buildReceivingLineRows,
  filterAttentionLines,
  openDisputeLines,
  pendingQtyForPo,
  receivingFollowupLines,
} from "@/lib/po-receiving-lines";

describe("po-receiving-lines", () => {
  const baseLine = {
    lineKey: "item:line-1",
    lineId: "line-1",
    lineNumber: 1,
    lineItemNumber: 1,
    label: "Widgets",
    originalOrderedQty: 10,
    acceptedQty: 4,
    unitPrice: "100",
    openException: null,
    grnIdsWithOpenDispute: [] as string[],
    receiptContext: null,
  };

  it("computes pending from effective ordered while PO is receivable", () => {
    const rows = buildReceivingLineRows([baseLine], [], POStatus.PARTIALLY_RECEIVED);
    expect(rows[0]!.pendingQty).toBe(6);
  });

  it("zeroes pending when PO is not in receive phase", () => {
    const rows = buildReceivingLineRows([baseLine], [], POStatus.FULLY_RECEIVED);
    expect(rows[0]!.pendingQty).toBe(0);
  });

  it("uses effective ordered from adjustments", () => {
    const rows = buildReceivingLineRows(
      [baseLine],
      [
        {
          poLineItemId: "line-1",
          poLineId: null,
          originalOrderedQty: 10,
          effectiveOrderedQty: 7,
          originalUnitPrice: 100,
          effectiveUnitPrice: 100,
          createdAt: new Date(),
          resolutionOutcome: null,
        },
      ],
      POStatus.OPEN,
    );
    expect(rows[0]!.effectiveOrderedQty).toBe(7);
    expect(rows[0]!.hasOrderedQtyReduction).toBe(true);
    expect(rows[0]!.hasShortShip).toBe(true);
    expect(rows[0]!.pendingQty).toBe(3);
    expect(rows[0]!.lineValueAtEffective).toBe(700);
  });

  it("does not flag accept-at-new-price split as short-ship when fully received", () => {
    const rows = buildReceivingLineRows(
      [
        {
          ...baseLine,
          originalOrderedQty: 50_000,
          acceptedQty: 49_500,
        },
      ],
      [
        {
          poLineItemId: "line-1",
          poLineId: null,
          originalOrderedQty: 50_000,
          effectiveOrderedQty: 49_500,
          originalUnitPrice: 100,
          effectiveUnitPrice: 100,
          createdAt: new Date(),
          resolutionOutcome: GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE,
        },
      ],
      POStatus.FULLY_RECEIVED,
    );
    expect(rows[0]!.hasOrderedQtyReduction).toBe(true);
    expect(rows[0]!.hasShortShip).toBe(false);
    expect(rows[0]!.pendingQty).toBe(0);
    expect(receivingFollowupLines(rows)).toHaveLength(0);
    expect(filterAttentionLines(rows)).toHaveLength(0);
  });

  it("shows pending only for dispute split base line awaiting final receipt", () => {
    const rows = buildReceivingLineRows(
      [
        {
          ...baseLine,
          originalOrderedQty: 50_000,
          acceptedQty: 49_000,
        },
      ],
      [
        {
          poLineItemId: "line-1",
          poLineId: null,
          originalOrderedQty: 50_000,
          effectiveOrderedQty: 49_500,
          originalUnitPrice: 100,
          effectiveUnitPrice: 100,
          createdAt: new Date(),
          resolutionOutcome: GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE,
        },
      ],
      POStatus.PARTIALLY_RECEIVED,
    );
    expect(rows[0]!.hasShortShip).toBe(false);
    expect(rows[0]!.pendingQty).toBe(500);
    const followups = receivingFollowupLines(rows);
    expect(followups).toHaveLength(1);
    expect(followups[0]!.pendingQty).toBe(500);
  });

  it("computes effective unit price and line value from adjustments", () => {
    const rows = buildReceivingLineRows(
      [baseLine],
      [
        {
          poLineItemId: "line-1",
          poLineId: null,
          originalOrderedQty: 10,
          effectiveOrderedQty: 10,
          originalUnitPrice: 100,
          effectiveUnitPrice: 85,
          createdAt: new Date(),
        },
      ],
      POStatus.OPEN,
    );
    expect(rows[0]!.effectiveUnitPrice).toBe("85");
    expect(rows[0]!.hasPriceAdjustment).toBe(true);
    expect(rows[0]!.lineValueAtEffective).toBe(850);
  });

  it("openDisputeLines and receivingFollowupLines partition attention", () => {
    const rows = buildReceivingLineRows(
      [
        {
          ...baseLine,
          openException: {
            id: "ex-1",
            exceptionType: GRNExceptionType.QUANTITY_SHORT,
            exceptionQty: 2,
            note: "n",
            resolutionStatus: null,
            resolutionOutcome: null,
            resolutionDisposition: null,
            closeLineAfterResolve: null,
            pendingReplacementQty: null,
            resolutionNote: null,
          },
        },
        { ...baseLine, lineKey: "item:line-2", lineId: "line-2", acceptedQty: 2 },
      ],
      [],
      POStatus.OPEN,
    );
    const attention = filterAttentionLines(rows);
    expect(openDisputeLines(attention)).toHaveLength(1);
    expect(receivingFollowupLines(attention)).toHaveLength(1);
  });

  it("filterAttentionLines includes open dispute and short-ship", () => {
    const clean = buildReceivingLineRows(
      [{ ...baseLine, acceptedQty: 10 }],
      [],
      POStatus.OPEN,
    );
    expect(filterAttentionLines(clean)).toHaveLength(0);

    const withPending = buildReceivingLineRows([baseLine], [], POStatus.OPEN);
    expect(filterAttentionLines(withPending)).toHaveLength(1);
  });

  it("pendingQtyForPo", () => {
    expect(pendingQtyForPo(100, 40)).toBe(60);
    expect(pendingQtyForPo(40, 50)).toBe(0);
  });

  it("attentionLinesForPo tolerates missing field (stale cache)", () => {
    expect(attentionLinesForPo({})).toEqual([]);
    expect(attentionLinesForPo({ attentionLines: [] })).toEqual([]);
  });
});
