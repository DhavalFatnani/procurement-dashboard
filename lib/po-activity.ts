import { GRNExceptionResolution } from "@/lib/prisma-enums";

import type { PODetail } from "@/lib/queries/purchase-orders";

export type POActivityEventKind =
  | "po_created"
  | "grn_received"
  | "grn_exception_resolved"
  | "invoice_uploaded";

export type POActivityEvent = {
  id: string;
  kind: POActivityEventKind;
  at: string;
  title: string;
  description?: string;
  byName?: string;
};

/**
 * Synthesises a chronological audit-style timeline from the data we already
 * have on `PODetail`. A real PO audit log is a follow-up; until then this
 * gives users a credible "what happened on this PO" view by surfacing each
 * GRN, exception resolution, and invoice upload alongside the PO creation
 * event.
 */
export function buildPOActivity(po: PODetail): POActivityEvent[] {
  const events: POActivityEvent[] = [];

  events.push({
    id: `po-${po.id}`,
    kind: "po_created",
    at: po.createdAt,
    title: "Purchase order created",
    description: `${po.lineSummary} · ${po.orderedQty} units ordered.`,
  });

  for (const grn of po.grns) {
    events.push({
      id: `grn-${grn.id}`,
      kind: "grn_received",
      at: grn.receivedAt,
      title: `Goods receipt — ${grn.acceptedQty} accepted`,
      description:
        grn.disputedQty > 0
          ? `${grn.receivedQty} received · ${grn.disputedQty} disputed`
          : `${grn.receivedQty} received`,
      byName: grn.receivedByName,
    });

    for (const line of grn.lines) {
      const ex = line.exception;
      if (!ex?.resolutionStatus) {
        continue;
      }
      events.push({
        id: `grn-${grn.id}-ex-${ex.id}`,
        kind: "grn_exception_resolved",
        // No timestamp on resolution today — surface at GRN time so it
        // anchors next to the receipt line it relates to.
        at: grn.receivedAt,
        title: `Exception resolved — ${humanise(ex.resolutionStatus)}`,
        description: ex.resolutionNote
          ? `${humanise(ex.exceptionType)} · ${ex.resolutionNote} (${line.label})`
          : `${humanise(ex.exceptionType)} (${line.label})`,
      });
    }
  }

  for (const inv of po.invoices) {
    events.push({
      id: `invoice-${inv.id}`,
      kind: "invoice_uploaded",
      at: inv.createdAt,
      title: `Invoice ${inv.invoiceNumber} uploaded`,
      description: inv.expectedAmount
        ? `Amount ${inv.amount} · expected ${inv.expectedAmount}`
        : `Amount ${inv.amount}`,
      byName: inv.uploadedByName,
    });
  }

  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

function humanise(value: string | GRNExceptionResolution): string {
  return String(value).replaceAll("_", " ").toLowerCase();
}
