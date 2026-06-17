import {
  InvoiceMatchStatus,
  PaymentStatus,
  POStatus,
  type Prisma,
} from "@/lib/prisma-client";

import {
  computeAdvanceBalances,
  invoiceTotalSettled,
} from "@/lib/po-advance";
import { applyGstToSubtotal } from "@/lib/po-gst";
import {
  buildEffectiveLineMap,
  effectiveOrderedQtyForLineItem,
  effectiveUnitPriceForLegacyLine,
  effectiveUnitPriceForLineItem,
  sumEffectiveOrderedQty,
} from "@/lib/po-line-effective";
import { hasPendingReplacement } from "@/lib/po-replacement-pending";

export type POClosureSnapshot = {
  poId: string;
  status: POStatus;
  orderedQty: number;
  receivedQty: number;
  invoicedAmount: number;
  paidAmount: number;
  advancePaid: number;
  settledAmount: number;
  deliveryComplete: boolean;
  unitPrice: number | null;
  expectedInvoicedAmount: number | null;
  checks: {
    deliveryComplete: boolean;
    invoicedMatchesReceived: boolean;
    allInvoicesPaid: boolean;
    noOpenDisputes: boolean;
    noPendingReplacement: boolean;
  };
};

export const PO_WITH_RELATIONS = {
  lineItems: {
    include: {
      goodsReceiptLineItems: { select: { acceptedQty: true } },
    },
  },
  lines: {
    include: {
      goodsReceiptLines: { select: { acceptedQty: true } },
    },
  },
  grns: { include: { exceptions: true } },
  invoices: {
    include: {
      payments: { select: { amount: true } },
      advanceAllocations: { select: { amount: true } },
    },
  },
  advancePayments: {
    include: { allocations: { select: { amount: true } } },
  },
  lineAdjustments: {
    orderBy: { createdAt: "asc" },
    select: {
      poLineItemId: true,
      poLineId: true,
      originalOrderedQty: true,
      effectiveOrderedQty: true,
      originalUnitPrice: true,
      effectiveUnitPrice: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PurchaseOrderInclude;

export type POWithRelations = Prisma.PurchaseOrderGetPayload<{
  include: typeof PO_WITH_RELATIONS;
}>;

function resolveOrderedQty(po: POWithRelations): number {
  const effectiveMap = buildEffectiveLineMap(po.lineAdjustments ?? []);
  const lineItems = po.lineItems ?? [];
  const lines = po.lines ?? [];
  return sumEffectiveOrderedQty(
    lineItems.map((l) => ({ id: l.id, orderedQty: l.orderedQty })),
    lines.map((l) => ({ id: l.id, orderedQty: l.orderedQty })),
    effectiveMap,
    po.orderedQty,
  );
}

function sumAcceptedQty(grns: POWithRelations["grns"]): number {
  return grns.reduce((sum, grn) => sum + grn.acceptedQty, 0);
}

function acceptedQtyByPoLine(po: POWithRelations): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of po.lines ?? []) {
    const accepted = line.goodsReceiptLines.reduce((s, grl) => s + grl.acceptedQty, 0);
    map.set(line.id, accepted);
  }
  return map;
}

function computeExpectedInvoicedSubtotal(po: POWithRelations): number | null {
  const effectiveMap = buildEffectiveLineMap(po.lineAdjustments ?? []);
  const lineItems = po.lineItems ?? [];
  const lines = po.lines ?? [];
  if (lineItems.length > 0) {
    let total = 0;
    for (const line of lineItems) {
      const accepted = line.goodsReceiptLineItems.reduce(
        (s, grl) => s + grl.acceptedQty,
        0,
      );
      const price = effectiveUnitPriceForLineItem(
        line.id,
        Number(line.unitPrice),
        effectiveMap,
      );
      total += accepted * price;
    }
    return total;
  }

  if (lines.length === 0) {
    const receivedQty = sumAcceptedQty(po.grns);
    if (po.unitPrice == null) {
      return receivedQty > 0 ? null : 0;
    }
    return receivedQty * Number(po.unitPrice);
  }

  const acceptedByLine = acceptedQtyByPoLine(po);
  let total = 0;
  for (const line of lines) {
    const accepted = acceptedByLine.get(line.id) ?? 0;
    const price = effectiveUnitPriceForLegacyLine(
      line.id,
      Number(line.unitPrice),
      effectiveMap,
    );
    total += accepted * price;
  }
  return total;
}

function computeExpectedInvoicedAmount(po: POWithRelations): number | null {
  const subtotal = computeExpectedInvoicedSubtotal(po);
  if (subtotal == null) {
    return null;
  }
  const billing = applyGstToSubtotal(
    subtotal,
    po.gstApplicable,
    po.gstRatePercent != null ? Number(po.gstRatePercent) : null,
  );
  return billing.total;
}

function sumInvoicedAmount(invoices: POWithRelations["invoices"]): number {
  return invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
}

function sumSettledOnInvoices(invoices: POWithRelations["invoices"]): number {
  return invoices.reduce((sum, inv) => sum + invoiceTotalSettled(inv), 0);
}

function hasOpenDisputes(grns: POWithRelations["grns"]): boolean {
  return grns.some((grn) =>
    grn.exceptions.some((ex) => ex.resolutionStatus == null),
  );
}

function invoicedWithinTolerance(
  po: POWithRelations,
  expectedAmount: number | null,
  invoicedAmount: number,
): boolean {
  if (expectedAmount == null || expectedAmount <= 0) {
    return invoicedAmount > 0 && sumAcceptedQty(po.grns) > 0;
  }
  if (expectedAmount <= 0) {
    return invoicedAmount <= 0;
  }
  const tolerancePct =
    po.invoices[0] != null ? Number(po.invoices[0].tolerancePct) : 2.5;
  const diff = Math.abs(invoicedAmount - expectedAmount) / expectedAmount;
  return diff <= tolerancePct / 100;
}

function deriveIntermediateStatus(
  orderedQty: number,
  receivedQty: number,
  invoices: POWithRelations["invoices"],
): POStatus {
  const allPaid =
    invoices.length > 0 &&
    invoices.every((inv) => inv.paymentStatus === PaymentStatus.PAID);

  if (allPaid) {
    return POStatus.PAID;
  }
  if (invoices.length > 0) {
    return POStatus.INVOICED;
  }
  if (receivedQty >= orderedQty) {
    return POStatus.FULLY_RECEIVED;
  }
  if (receivedQty > 0) {
    return POStatus.PARTIALLY_RECEIVED;
  }
  return POStatus.OPEN;
}

export function buildClosureSnapshot(po: POWithRelations): POClosureSnapshot {
  const orderedQty = resolveOrderedQty(po);
  const receivedQty = sumAcceptedQty(po.grns);
  const invoicedAmount = sumInvoicedAmount(po.invoices);
  const settledAmount = sumSettledOnInvoices(po.invoices);
  const { advancePaid } = computeAdvanceBalances(po.advancePayments ?? []);
  const paidAmount = settledAmount;
  const expectedInvoicedAmount = computeExpectedInvoicedAmount(po);
  const deliveryCheck = po.deliveryComplete || receivedQty >= orderedQty;
  const invoicedCheck = invoicedWithinTolerance(
    po,
    expectedInvoicedAmount,
    invoicedAmount,
  );
  const allInvoicesPaid =
    po.invoices.length > 0 &&
    po.invoices.every((inv) => inv.paymentStatus === PaymentStatus.PAID) &&
    settledAmount >= invoicedAmount;
  const noOpenDisputes = !hasOpenDisputes(po.grns);

  const effectiveMap = buildEffectiveLineMap(po.lineAdjustments ?? []);
  const acceptedByLineItem = new Map<string, number>();
  for (const line of po.lineItems ?? []) {
    const accepted = line.goodsReceiptLineItems.reduce(
      (s, grl) => s + grl.acceptedQty,
      0,
    );
    acceptedByLineItem.set(line.id, accepted);
  }
  const effectiveOrderedByLineItem = new Map<string, number>();
  for (const line of po.lineItems ?? []) {
    effectiveOrderedByLineItem.set(
      line.id,
      effectiveOrderedQtyForLineItem(line.id, line.orderedQty, effectiveMap),
    );
  }
  const allExceptions = po.grns.flatMap((g) => g.exceptions);
  const noPendingReplacement = !hasPendingReplacement(
    allExceptions,
    acceptedByLineItem,
    effectiveOrderedByLineItem,
  );

  const checks = {
    deliveryComplete: deliveryCheck && noPendingReplacement,
    invoicedMatchesReceived: invoicedCheck,
    allInvoicesPaid,
    noOpenDisputes,
    noPendingReplacement,
  };

  let status = po.status;
  if (po.status !== POStatus.FORCE_CLOSED) {
    if (
      checks.deliveryComplete &&
      checks.invoicedMatchesReceived &&
      checks.allInvoicesPaid &&
      checks.noOpenDisputes &&
      checks.noPendingReplacement
    ) {
      status = POStatus.CLOSED;
    } else if (
      checks.invoicedMatchesReceived &&
      checks.allInvoicesPaid &&
      checks.noOpenDisputes &&
      checks.noPendingReplacement &&
      !checks.deliveryComplete
    ) {
      status = POStatus.PARTIALLY_CLOSED;
    } else {
      status = deriveIntermediateStatus(orderedQty, receivedQty, po.invoices);
    }
  }

  const lines = po.lines ?? [];
  const legacyUnitPrice =
    lines.length === 1
      ? Number(lines[0]!.unitPrice)
      : po.unitPrice != null
        ? Number(po.unitPrice)
        : null;

  return {
    poId: po.id,
    status,
    orderedQty,
    receivedQty,
    invoicedAmount,
    paidAmount,
    advancePaid,
    settledAmount,
    deliveryComplete: po.deliveryComplete,
    unitPrice: legacyUnitPrice,
    expectedInvoicedAmount,
    checks,
  };
}

export function aggregatePaymentStatus(
  invoices: { paymentStatus: PaymentStatus }[],
): PaymentStatus {
  if (invoices.length === 0) {
    return PaymentStatus.UNPAID;
  }
  if (invoices.every((i) => i.paymentStatus === PaymentStatus.PAID)) {
    return PaymentStatus.PAID;
  }
  if (invoices.some((i) => i.paymentStatus === PaymentStatus.PAID || i.paymentStatus === PaymentStatus.PARTIALLY_PAID)) {
    return PaymentStatus.PARTIALLY_PAID;
  }
  return PaymentStatus.UNPAID;
}

export function aggregateInvoiceMatchStatus(
  invoices: { matchStatus: InvoiceMatchStatus }[],
): InvoiceMatchStatus {
  if (invoices.length === 0) {
    return InvoiceMatchStatus.PENDING;
  }
  if (invoices.some((i) => i.matchStatus === InvoiceMatchStatus.MISMATCH)) {
    return InvoiceMatchStatus.MISMATCH;
  }
  if (invoices.every((i) => i.matchStatus === InvoiceMatchStatus.MATCHED)) {
    return InvoiceMatchStatus.MATCHED;
  }
  if (invoices.some((i) => i.matchStatus === InvoiceMatchStatus.OVERRIDE_ACCEPTED)) {
    return InvoiceMatchStatus.OVERRIDE_ACCEPTED;
  }
  return InvoiceMatchStatus.PENDING;
}

export function deliveryStatusLabel(
  orderedQty: number,
  receivedQty: number,
  deliveryComplete: boolean,
): string {
  if (deliveryComplete || receivedQty >= orderedQty) {
    return "Complete";
  }
  if (receivedQty > 0) {
    return "Partial";
  }
  return "Pending";
}
