import { POAdvanceRequestStatus } from "@/lib/prisma-enums";

import { deriveInvoicePaymentStatus } from "@/lib/payment-totals";
import {
  buildEffectiveLineMap,
  computeCommittedSubtotalFromEffectiveLines,
  type POLineAdjustmentRow,
} from "@/lib/po-line-effective";
import { applyGstToSubtotal, computePoOrderBilling, roundMoney } from "@/lib/po-gst";

export type PoBillingLine = {
  orderedQty: number;
  unitPrice: string | number;
};

export type AdvanceRequestRow = {
  status: POAdvanceRequestStatus;
  requestedAmount: unknown;
};

export type AdvancePaymentRow = {
  amount: unknown;
  allocations?: { amount: unknown }[];
};

export type InvoiceSettlementRow = {
  amount: unknown;
  payments?: { amount: unknown }[];
  advanceAllocations?: { amount: unknown }[];
};

export function sumDecimalRows(rows: { amount: unknown }[]): number {
  return roundMoney(
    rows.reduce((sum, row) => {
      const n = Number(row.amount);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0),
  );
}

export function resolveAdvanceRequestAmount(
  committedTotal: number,
  input: { amount?: number; percent?: number },
): { ok: true; amount: number; percent: number | null } | { ok: false; message: string } {
  if (!Number.isFinite(committedTotal) || committedTotal <= 0) {
    return { ok: false, message: "PO committed value must be greater than zero to request advance." };
  }

  const hasAmount = input.amount != null && Number.isFinite(input.amount) && input.amount > 0;
  const hasPercent = input.percent != null && Number.isFinite(input.percent) && input.percent > 0;

  if (hasAmount === hasPercent) {
    return { ok: false, message: "Enter either an advance amount or a percentage, not both." };
  }

  let amount: number;
  let percent: number | null = null;
  if (hasAmount) {
    amount = roundMoney(input.amount!);
  } else {
    percent = roundMoney(input.percent!);
    if (percent > 100) {
      return { ok: false, message: "Advance percentage cannot exceed 100%." };
    }
    amount = roundMoney((committedTotal * percent) / 100);
  }

  if (amount <= 0) {
    return { ok: false, message: "Advance amount must be greater than zero." };
  }
  if (amount > committedTotal) {
    return {
      ok: false,
      message: `Advance cannot exceed PO committed value (${committedTotal.toFixed(2)}).`,
    };
  }

  return { ok: true, amount, percent };
}

export function sumPendingAndFulfilledAdvanceRequests(
  requests: AdvanceRequestRow[],
): number {
  return roundMoney(
    requests
      .filter(
        (r) =>
          r.status === POAdvanceRequestStatus.PENDING ||
          r.status === POAdvanceRequestStatus.FULFILLED,
      )
      .reduce((sum, r) => sum + Number(r.requestedAmount), 0),
  );
}

export function computeAdvanceBalances(payments: AdvancePaymentRow[]) {
  const advancePaid = roundMoney(
    payments.reduce((sum, p) => sum + Number(p.amount), 0),
  );
  const advanceAllocated = roundMoney(
    payments.reduce(
      (sum, p) => sum + sumDecimalRows(p.allocations ?? []),
      0,
    ),
  );
  const advanceUnallocated = roundMoney(Math.max(0, advancePaid - advanceAllocated));
  return { advancePaid, advanceAllocated, advanceUnallocated };
}

export function sumAllocationsForInvoice(
  invoice: Pick<InvoiceSettlementRow, "advanceAllocations">,
): number {
  return sumDecimalRows(invoice.advanceAllocations ?? []);
}

export function sumCashPaidForInvoice(
  invoice: Pick<InvoiceSettlementRow, "payments">,
): number {
  return sumDecimalRows(invoice.payments ?? []);
}

export function invoiceTotalSettled(invoice: InvoiceSettlementRow): number {
  return roundMoney(
    sumCashPaidForInvoice(invoice) + sumAllocationsForInvoice(invoice),
  );
}

export function invoiceRemainingBeforeCash(invoice: InvoiceSettlementRow): number {
  const invoiceAmount = Number(invoice.amount);
  if (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0) {
    return 0;
  }
  return roundMoney(Math.max(0, invoiceAmount - invoiceTotalSettled(invoice)));
}

export function suggestAdvanceAllocation(
  advanceUnallocated: number,
  invoiceRemaining: number,
): number {
  if (advanceUnallocated <= 0 || invoiceRemaining <= 0) {
    return 0;
  }
  return roundMoney(Math.min(advanceUnallocated, invoiceRemaining));
}

export function validateAdvanceAllocation(
  allocationAmount: number,
  advanceUnallocated: number,
  invoiceRemaining: number,
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(allocationAmount) || allocationAmount < 0) {
    return { ok: false, message: "Enter a valid advance allocation amount." };
  }
  if (allocationAmount > advanceUnallocated + 0.001) {
    return { ok: false, message: "Allocation exceeds unallocated advance on this PO." };
  }
  if (allocationAmount > invoiceRemaining + 0.001) {
    return { ok: false, message: "Allocation exceeds remaining invoice balance." };
  }
  return { ok: true };
}

export function deriveInvoiceSettledStatus(
  invoiceAmount: number,
  cashPaid: number,
  allocated: number,
) {
  return deriveInvoicePaymentStatus(
    roundMoney(cashPaid + allocated),
    invoiceAmount,
  );
}

export function canRequestAdvanceOnPoStatus(status: string): boolean {
  return status !== "CLOSED" && status !== "FORCE_CLOSED";
}

export function committedTotalFromPo(po: {
  gstApplicable: boolean;
  gstRatePercent: string | number | null | undefined;
  lineItems: PoBillingLine[];
  lines: PoBillingLine[];
  lineAdjustments?: POLineAdjustmentRow[];
  lineItemsWithIds?: { id: string; orderedQty: number; unitPrice: string | number }[];
  linesWithIds?: { id: string; orderedQty: number; unitPrice: string | number }[];
}): number {
  const adjustments = po.lineAdjustments ?? [];
  const effectiveMap = buildEffectiveLineMap(adjustments);
  const itemsWithIds = po.lineItemsWithIds;
  const linesWithIds = po.linesWithIds;

  let subtotal: number;
  if (itemsWithIds && itemsWithIds.length > 0) {
    subtotal = computeCommittedSubtotalFromEffectiveLines(
      itemsWithIds,
      [],
      effectiveMap,
    );
  } else if (linesWithIds && linesWithIds.length > 0) {
    subtotal = computeCommittedSubtotalFromEffectiveLines(
      [],
      linesWithIds,
      effectiveMap,
    );
  } else {
    const billingLines = po.lineItems.length > 0 ? po.lineItems : po.lines;
    return computePoOrderBilling(
      billingLines,
      po.gstApplicable,
      po.gstRatePercent != null && po.gstRatePercent !== ""
        ? String(po.gstRatePercent)
        : null,
    ).total;
  }

  return applyGstToSubtotal(
    subtotal,
    po.gstApplicable,
    po.gstRatePercent != null && po.gstRatePercent !== ""
      ? Number(po.gstRatePercent)
      : null,
  ).total;
}

export type AdvancePaymentFifoRow = {
  id: string;
  paidAt: Date | string;
  amount: number;
  allocated: number;
};

/** Split allocation across advance payments (oldest paid first). */
export function fifoAdvanceAllocationChunks(
  payments: AdvancePaymentFifoRow[],
  amountToAllocate: number,
): { advancePaymentId: string; amount: number }[] {
  if (amountToAllocate <= 0) {
    return [];
  }
  const sorted = [...payments].sort(
    (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
  );
  const chunks: { advancePaymentId: string; amount: number }[] = [];
  let left = roundMoney(amountToAllocate);
  for (const payment of sorted) {
    const unallocated = roundMoney(payment.amount - payment.allocated);
    if (unallocated <= 0) {
      continue;
    }
    const chunk = roundMoney(Math.min(left, unallocated));
    if (chunk > 0) {
      chunks.push({ advancePaymentId: payment.id, amount: chunk });
      left = roundMoney(left - chunk);
    }
    if (left <= 0) {
      break;
    }
  }
  return chunks;
}

export type AdvanceCommittedOverage = {
  overCommittedBy: number;
  advancePaid: number;
  committedTotal: number;
  pendingReserved: number;
  message: string | null;
};

/** True when paid + pending advance exposure exceeds current committed PO value. */
export function computeAdvanceCommittedOverage(params: {
  committedTotal: number;
  advancePaid: number;
  pendingReserved?: number;
}): AdvanceCommittedOverage {
  const committedTotal = roundMoney(params.committedTotal);
  const advancePaid = roundMoney(params.advancePaid);
  const pendingReserved = roundMoney(params.pendingReserved ?? 0);
  const exposure = roundMoney(advancePaid + pendingReserved);
  const overCommittedBy = roundMoney(Math.max(0, exposure - committedTotal));

  let message: string | null = null;
  if (overCommittedBy > 0) {
    if (advancePaid > committedTotal + 0.001) {
      message = `Advance paid (₹${advancePaid.toFixed(2)}) exceeds current PO commitment (₹${committedTotal.toFixed(2)}), often after short-ship or line adjustments. Unallocated credit may need manual recovery.`;
    } else {
      message = `Pending advance requests (₹${pendingReserved.toFixed(2)}) plus paid advance exceed current PO commitment by ₹${overCommittedBy.toFixed(2)}.`;
    }
  }

  return {
    overCommittedBy,
    advancePaid,
    committedTotal,
    pendingReserved,
    message,
  };
}

export function advanceOverageForPo(input: {
  committedTotal: number;
  advancePayments: AdvancePaymentRow[];
  advanceRequests: AdvanceRequestRow[];
}): AdvanceCommittedOverage {
  const { advancePaid } = computeAdvanceBalances(input.advancePayments);
  const pendingReserved = sumPendingAdvanceRequestAmounts(input.advanceRequests);
  return computeAdvanceCommittedOverage({
    committedTotal: input.committedTotal,
    advancePaid,
    pendingReserved,
  });
}

export function sumPendingAdvanceRequestAmounts(
  requests: AdvanceRequestRow[],
): number {
  return roundMoney(
    requests
      .filter((r) => r.status === POAdvanceRequestStatus.PENDING)
      .reduce((sum, r) => sum + Number(r.requestedAmount), 0),
  );
}

export function validateAdvancePaymentAgainstCommitted(
  committedTotal: number,
  advancePaid: number,
  payAmount: number,
): { ok: true } | { ok: false; message: string } {
  const nextPaid = roundMoney(advancePaid + payAmount);
  if (nextPaid > committedTotal + 0.001) {
    return {
      ok: false,
      message: `This payment would bring total advance paid (₹${nextPaid.toFixed(2)}) above current PO commitment (₹${committedTotal.toFixed(2)}). Reject the request or resolve PO line changes first.`,
    };
  }
  return { ok: true };
}
