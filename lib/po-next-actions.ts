import { PaymentStatus, POStatus, Role } from "@prisma/client";

import type { PODetail } from "@/lib/queries/purchase-orders";

/**
 * Catalog of contextual actions a user can take on a Purchase Order detail
 * page. The function below returns the ordered subset that applies to the
 * current PO + role combination — consumed by both the sticky action bar
 * (primary surface) and the side panel "Next actions" list (discoverable
 * surface) so there is a single source of truth for what is offered.
 */
export type PONextActionId =
  | "record-grn"
  | "upload-invoice"
  | "record-payment"
  | "mark-delivery-complete"
  | "force-close";

export type PONextAction = {
  id: PONextActionId;
  label: string;
  description: string;
  tone: "primary" | "secondary" | "destructive";
  href?: string;
};

const CLOSED_STATUSES: POStatus[] = [
  POStatus.CLOSED,
  POStatus.PARTIALLY_CLOSED,
  POStatus.FORCE_CLOSED,
];

export function getApplicablePOActions(
  po: PODetail,
  role: Role,
): PONextAction[] {
  const actions: PONextAction[] = [];
  const isOps = role === Role.OPS_HEAD;
  const isSm = role === Role.SM;
  const isFinance = role === Role.FINANCE;
  const isClosed = CLOSED_STATUSES.includes(po.status);

  if (isClosed) {
    return actions;
  }

  const status = po.status;
  const inReceivePhase =
    status === POStatus.OPEN || status === POStatus.PARTIALLY_RECEIVED;
  const inInvoicePhase =
    status === POStatus.PARTIALLY_RECEIVED ||
    status === POStatus.FULLY_RECEIVED;
  const hasUnpaidInvoice = po.invoices.some(
    (inv) => inv.paymentStatus !== PaymentStatus.PAID,
  );

  if ((isSm || isOps) && inReceivePhase) {
    actions.push({
      id: "record-grn",
      label: "Record GRN",
      description: "Log accepted, disputed, or damaged goods received.",
      tone: "primary",
      href: `/goods-receipt/new?poId=${encodeURIComponent(po.id)}`,
    });
  }

  if ((isSm || isOps) && inInvoicePhase) {
    actions.push({
      id: "upload-invoice",
      label: "Upload invoice",
      description: "Match a vendor invoice to received GRNs.",
      tone: actions.length === 0 ? "primary" : "secondary",
      href: `/invoices/new?poId=${encodeURIComponent(po.id)}`,
    });
  }

  if ((isFinance || isOps) && hasUnpaidInvoice) {
    actions.push({
      id: "record-payment",
      label: "Record payment",
      description: "Disburse against matched invoices.",
      tone: actions.length === 0 ? "primary" : "secondary",
      href: `/payments?paymentStatus=UNPAID&poId=${encodeURIComponent(po.id)}`,
    });
  }

  if (isOps && !po.deliveryComplete) {
    actions.push({
      id: "mark-delivery-complete",
      label: "Mark delivery complete",
      description: "Flag this PO as delivered and run closure evaluation.",
      tone: actions.length === 0 ? "primary" : "secondary",
    });
  }

  if (isOps) {
    actions.push({
      id: "force-close",
      label: "Force close",
      description: "Close this PO with a documented reason.",
      tone: "destructive",
    });
  }

  return actions;
}
