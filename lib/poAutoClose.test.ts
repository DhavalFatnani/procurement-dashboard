import { InvoiceMatchStatus, PaymentStatus, POStatus, Prisma } from "@/lib/prisma-client";
import { describe, expect, it } from "vitest";

import { buildClosureSnapshot, type POWithRelations } from "@/lib/po-closure-snapshot";

function makePo(overrides: {
  orderedQty?: number;
  unitPrice?: number | null;
  deliveryComplete?: boolean;
  status?: POStatus;
  lines?: {
    id: string;
    orderedQty: number;
    unitPrice: number;
    goodsReceiptLines: { acceptedQty: number }[];
  }[];
  grns?: {
    acceptedQty: number;
    disputedQty: number;
    exceptions: { resolutionStatus: string | null }[];
  }[];
  invoices?: {
    amount: number;
    paymentStatus: PaymentStatus;
    tolerancePct: number;
    matchStatus: InvoiceMatchStatus;
    payments?: { amount: number | null }[];
  }[];
}): POWithRelations {
  const lines =
    overrides.lines ??
    (overrides.orderedQty != null && overrides.unitPrice != null
      ? [
          {
            id: "pol-1",
            orderedQty: overrides.orderedQty,
            unitPrice: overrides.unitPrice,
            goodsReceiptLines: [{ acceptedQty: overrides.grns?.[0]?.acceptedQty ?? 0 }],
          },
        ]
      : []);

  const grns =
    overrides.grns ??
    lines.flatMap((line) =>
      line.goodsReceiptLines.map((grl) => ({
        acceptedQty: grl.acceptedQty,
        disputedQty: 0,
        exceptions: [],
      })),
    );

  return {
    id: "PO-test",
    status: overrides.status ?? POStatus.OPEN,
    orderedQty: overrides.orderedQty ?? lines.reduce((s, l) => s + l.orderedQty, 0),
    unitPrice:
      overrides.unitPrice != null ? new Prisma.Decimal(overrides.unitPrice) : null,
    deliveryComplete: overrides.deliveryComplete ?? false,
    grns,
    invoices: (overrides.invoices ?? []).map((inv) => ({
      amount: new Prisma.Decimal(inv.amount),
      paymentStatus: inv.paymentStatus,
      tolerancePct: new Prisma.Decimal(inv.tolerancePct),
      matchStatus: inv.matchStatus,
      payments: (inv.payments ?? []).map((p) => ({
        amount: p.amount != null ? new Prisma.Decimal(p.amount) : null,
      })),
    })),
    lines: lines.map((line) => ({
      id: line.id,
      poId: "PO-test",
      prLineId: `prl-${line.id}`,
      categoryId: "cat-1",
      subcategoryId: "sub-1",
      orderedQty: line.orderedQty,
      unitPrice: new Prisma.Decimal(line.unitPrice),
      goodsReceiptLines: line.goodsReceiptLines,
    })),
  } as unknown as POWithRelations;
}

describe("buildClosureSnapshot multi-line", () => {
  it("aggregates ordered and received qty across PO lines", () => {
    const po = makePo({
      lines: [
        {
          id: "pol-1",
          orderedQty: 100,
          unitPrice: 10,
          goodsReceiptLines: [{ acceptedQty: 80 }],
        },
        {
          id: "pol-2",
          orderedQty: 50,
          unitPrice: 20,
          goodsReceiptLines: [{ acceptedQty: 50 }],
        },
      ],
      grns: [
        { acceptedQty: 130, disputedQty: 0, exceptions: [] },
      ],
    });

    const snapshot = buildClosureSnapshot(po);
    expect(snapshot.orderedQty).toBe(150);
    expect(snapshot.receivedQty).toBe(130);
  });

  it("compares invoice amount to line-weighted expected value", () => {
    const po = makePo({
      lines: [
        {
          id: "pol-1",
          orderedQty: 10,
          unitPrice: 100,
          goodsReceiptLines: [{ acceptedQty: 10 }],
        },
        {
          id: "pol-2",
          orderedQty: 5,
          unitPrice: 200,
          goodsReceiptLines: [{ acceptedQty: 5 }],
        },
      ],
      grns: [{ acceptedQty: 15, disputedQty: 0, exceptions: [] }],
      invoices: [
        {
          amount: 2000,
          paymentStatus: PaymentStatus.UNPAID,
          tolerancePct: 2.5,
          matchStatus: InvoiceMatchStatus.MATCHED,
        },
      ],
    });

    const snapshot = buildClosureSnapshot(po);
    expect(snapshot.checks.invoicedMatchesReceived).toBe(true);
  });
});
