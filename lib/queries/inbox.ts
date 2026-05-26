import {
  InvoiceMatchStatus,
  PaymentStatus,
  POStatus,
  PRStatus,
  Role,
} from "@prisma/client";

import { dbSerial } from "@/lib/db-serial";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import {
  nestedPurchaseOrderWarehouseScope,
  nestedPurchaseRequestWarehouseScope,
  warehouseScopeForUser,
} from "@/lib/warehouse-scope";

export type InboxItemKind =
  | "pr_draft"
  | "pr_pending_approval"
  | "pr_revision_required"
  | "po_to_receive"
  | "grn_exception"
  | "invoice_to_upload"
  | "invoice_to_pay"
  | "invoice_partial"
  | "vendor_request"
  | "po_at_risk";

export type InboxItem = {
  id: string;
  /** Stable key (kind + entity id). */
  key: string;
  kind: InboxItemKind;
  /** Procurement ref (PR-xxx, PO-xxx) or null for non-doc items. */
  ref: string | null;
  title: string;
  subtitle: string;
  /** ISO timestamp for sorting; falls back to created/updated. */
  timestamp: string;
  /** Where clicking the item should navigate. */
  href: string;
  /** Action button copy (e.g. "Continue", "Approve", "Pay"). */
  actionLabel: string;
};

export type InboxGroup = {
  id: "drafts" | "awaiting" | "at_risk" | "recent";
  label: string;
  description: string;
  items: InboxItem[];
  /** Total available (we cap items at `limit`, but counts come from full query). */
  total: number;
};

export type InboxSummary = {
  drafts: number;
  awaiting: number;
  atRisk: number;
  recent: number;
};

export type InboxData = {
  summary: InboxSummary;
  groups: InboxGroup[];
};

const ITEMS_PER_GROUP = 10;


async function fetchSmInbox(user: SessionUser): Promise<InboxData> {
  const warehouseScope = warehouseScopeForUser(user);
  const poScope = nestedPurchaseRequestWarehouseScope(user);
  const grnScope = nestedPurchaseOrderWarehouseScope(user);

  const [drafts, revisions, posToReceive, exceptions, invoicesToUpload, recent] =
    await dbSerial(
      () => prisma.purchaseRequest.findMany({
        where: { status: PRStatus.DRAFT, createdById: user.id, ...warehouseScope },
        select: {
          id: true,
          updatedAt: true,
          createdAt: true,
          lines: {
            orderBy: { lineNumber: "asc" },
            select: { quantity: true, subcategory: { select: { name: true } } },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.purchaseRequest.findMany({
        where: { status: PRStatus.REVISION_REQUIRED, createdById: user.id, ...warehouseScope },
        select: {
          id: true,
          updatedAt: true,
          lines: {
            orderBy: { lineNumber: "asc" },
            select: { quantity: true, subcategory: { select: { name: true } } },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.purchaseOrder.findMany({
        where: {
          status: { in: [POStatus.OPEN, POStatus.PARTIALLY_RECEIVED] },
          ...poScope,
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          vendor: { select: { businessName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.goodsReceipt.findMany({
        where: {
          exceptions: { some: { resolutionStatus: null } },
          ...grnScope,
        },
        select: {
          id: true,
          receivedAt: true,
          poId: true,
          purchaseOrder: { select: { vendor: { select: { businessName: true } } } },
          exceptions: { where: { resolutionStatus: null }, select: { exceptionType: true } },
        },
        orderBy: { receivedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.purchaseOrder.findMany({
        where: {
          status: POStatus.FULLY_RECEIVED,
          invoices: { none: {} },
          ...poScope,
        },
        select: {
          id: true,
          updatedAt: true,
          vendor: { select: { businessName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.purchaseRequest.findMany({
        where: { createdById: user.id, ...warehouseScope },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          lines: {
            orderBy: { lineNumber: "asc" },
            select: { quantity: true, subcategory: { select: { name: true } } },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
    );

  const prTitle = (line?: { quantity: number; subcategory: { name: string } }) =>
    line ? `${line.subcategory.name} × ${line.quantity}` : "Purchase request";

  const draftItems: InboxItem[] = drafts.map((pr) => ({
    id: pr.id,
    key: `pr_draft:${pr.id}`,
    kind: "pr_draft",
    ref: pr.id,
    title: prTitle(pr.lines[0]),
    subtitle: "Continue where you left off",
    timestamp: pr.updatedAt.toISOString(),
    href: `/purchase-requests/${pr.id}`,
    actionLabel: "Continue",
  }));

  const revisionItems: InboxItem[] = revisions.map((pr) => ({
    id: pr.id,
    key: `pr_revision:${pr.id}`,
    kind: "pr_revision_required",
    ref: pr.id,
    title: prTitle(pr.lines[0]),
    subtitle: "Approver requested changes",
    timestamp: pr.updatedAt.toISOString(),
    href: `/purchase-requests/${pr.id}`,
    actionLabel: "Revise",
  }));

  const poItems: InboxItem[] = posToReceive.map((po) => ({
    id: po.id,
    key: `po_recv:${po.id}`,
    kind: "po_to_receive",
    ref: po.id,
    title: po.vendor.businessName,
    subtitle: "Record goods receipt",
    timestamp: po.updatedAt.toISOString(),
    href: `/goods-receipt/new?poId=${po.id}`,
    actionLabel: "Record GRN",
  }));

  const exceptionItems: InboxItem[] = exceptions.map((grn) => ({
    id: grn.id,
    key: `grn_exc:${grn.id}`,
    kind: "grn_exception",
    ref: grn.poId,
    title: grn.purchaseOrder.vendor.businessName,
    subtitle: `${grn.exceptions.length} open exception${grn.exceptions.length === 1 ? "" : "s"}`,
    timestamp: grn.receivedAt.toISOString(),
    href: `/purchase-orders/${grn.poId}?tab=grns`,
    actionLabel: "Review",
  }));

  const invoiceUploadItems: InboxItem[] = invoicesToUpload.map((po) => ({
    id: po.id,
    key: `inv_upload:${po.id}`,
    kind: "invoice_to_upload",
    ref: po.id,
    title: po.vendor.businessName,
    subtitle: "Goods received — upload invoice",
    timestamp: po.updatedAt.toISOString(),
    href: `/invoices/new?poId=${po.id}`,
    actionLabel: "Upload",
  }));

  const recentItems: InboxItem[] = recent.map((pr) => ({
    id: pr.id,
    key: `recent_pr:${pr.id}`,
    kind: "pr_draft",
    ref: pr.id,
    title: prTitle(pr.lines[0]),
    subtitle: pr.status.replaceAll("_", " "),
    timestamp: pr.updatedAt.toISOString(),
    href: `/purchase-requests/${pr.id}`,
    actionLabel: "Open",
  }));

  const draftsAll = [...draftItems, ...revisionItems];
  const awaiting = [...poItems, ...exceptionItems, ...invoiceUploadItems];

  return {
    summary: {
      drafts: draftsAll.length,
      awaiting: awaiting.length,
      atRisk: 0,
      recent: recentItems.length,
    },
    groups: [
      {
        id: "drafts",
        label: "Your drafts",
        description: "Pick up where you left off.",
        items: draftsAll.slice(0, ITEMS_PER_GROUP),
        total: draftsAll.length,
      },
      {
        id: "awaiting",
        label: "Awaiting your action",
        description: "POs to receive, exceptions to resolve, invoices to upload.",
        items: awaiting.slice(0, ITEMS_PER_GROUP),
        total: awaiting.length,
      },
      {
        id: "recent",
        label: "Recently updated",
        description: "Your last updates across procurement.",
        items: recentItems.slice(0, ITEMS_PER_GROUP),
        total: recentItems.length,
      },
    ],
  };
}

async function fetchOpsHeadInbox(user: SessionUser): Promise<InboxData> {
  const prScope = warehouseScopeForUser(user);
  const poScope = nestedPurchaseRequestWarehouseScope(user);
  const grnScope = nestedPurchaseOrderWarehouseScope(user);

  const [pendingApprovals, vendorRequests, exceptions, atRiskPos, recentApprovals] =
    await dbSerial(
      () => prisma.purchaseRequest.findMany({
        where: { status: PRStatus.PENDING_APPROVAL, ...prScope },
        select: {
          id: true,
          updatedAt: true,
          createdBy: { select: { name: true } },
          lines: {
            orderBy: { lineNumber: "asc" },
            select: { quantity: true, subcategory: { select: { name: true } } },
            take: 1,
          },
        },
        orderBy: { updatedAt: "asc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.vendorRequest.findMany({
        where: { status: "PENDING" },
        select: {
          id: true,
          createdAt: true,
          businessName: true,
          requestedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.goodsReceipt.findMany({
        where: { exceptions: { some: { resolutionStatus: null } }, ...grnScope },
        select: {
          id: true,
          receivedAt: true,
          poId: true,
          purchaseOrder: { select: { vendor: { select: { businessName: true } } } },
          exceptions: { where: { resolutionStatus: null }, select: { exceptionType: true } },
        },
        orderBy: { receivedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.purchaseOrder.findMany({
        where: {
          status: { in: [POStatus.FULLY_RECEIVED, POStatus.INVOICED] },
          invoices: { some: { matchStatus: InvoiceMatchStatus.MISMATCH, overrideReason: null } },
          ...poScope,
        },
        select: {
          id: true,
          updatedAt: true,
          vendor: { select: { businessName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.purchaseRequest.findMany({
        where: { status: { in: [PRStatus.APPROVED, PRStatus.CONVERTED_TO_PO] }, ...prScope },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          createdBy: { select: { name: true } },
          lines: {
            orderBy: { lineNumber: "asc" },
            select: { quantity: true, subcategory: { select: { name: true } } },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
    );

  const prTitle = (line?: { quantity: number; subcategory: { name: string } }) =>
    line ? `${line.subcategory.name} × ${line.quantity}` : "Purchase request";

  const approvalItems: InboxItem[] = pendingApprovals.map((pr) => ({
    id: pr.id,
    key: `pr_pend:${pr.id}`,
    kind: "pr_pending_approval",
    ref: pr.id,
    title: prTitle(pr.lines[0]),
    subtitle: `Requested by ${pr.createdBy.name}`,
    timestamp: pr.updatedAt.toISOString(),
    href: `/purchase-requests/${pr.id}`,
    actionLabel: "Review",
  }));

  const vendorItems: InboxItem[] = vendorRequests.map((vr) => ({
    id: vr.id,
    key: `vendor_req:${vr.id}`,
    kind: "vendor_request",
    ref: null,
    title: vr.businessName,
    subtitle: `Requested by ${vr.requestedBy?.name ?? "—"}`,
    timestamp: vr.createdAt.toISOString(),
    href: `/vendors?tab=pending&requestId=${vr.id}`,
    actionLabel: "Review",
  }));

  const exceptionItems: InboxItem[] = exceptions.map((grn) => ({
    id: grn.id,
    key: `grn_exc:${grn.id}`,
    kind: "grn_exception",
    ref: grn.poId,
    title: grn.purchaseOrder.vendor.businessName,
    subtitle: `${grn.exceptions.length} open exception${grn.exceptions.length === 1 ? "" : "s"}`,
    timestamp: grn.receivedAt.toISOString(),
    href: `/purchase-orders/${grn.poId}?tab=grns`,
    actionLabel: "Resolve",
  }));

  const atRiskItems: InboxItem[] = atRiskPos.map((po) => ({
    id: po.id,
    key: `po_risk:${po.id}`,
    kind: "po_at_risk",
    ref: po.id,
    title: po.vendor.businessName,
    subtitle: "Invoice mismatch needs override",
    timestamp: po.updatedAt.toISOString(),
    href: `/purchase-orders/${po.id}?tab=invoices`,
    actionLabel: "Override",
  }));

  const recentItems: InboxItem[] = recentApprovals.map((pr) => ({
    id: pr.id,
    key: `recent_pr:${pr.id}`,
    kind: "pr_pending_approval",
    ref: pr.id,
    title: prTitle(pr.lines[0]),
    subtitle: pr.status.replaceAll("_", " "),
    timestamp: pr.updatedAt.toISOString(),
    href: `/purchase-requests/${pr.id}`,
    actionLabel: "Open",
  }));

  const awaiting = [...approvalItems, ...vendorItems, ...exceptionItems];

  return {
    summary: {
      drafts: 0,
      awaiting: awaiting.length,
      atRisk: atRiskItems.length,
      recent: recentItems.length,
    },
    groups: [
      {
        id: "awaiting",
        label: "Awaiting your action",
        description: "Approvals, vendor requests, and exception resolutions.",
        items: awaiting.slice(0, ITEMS_PER_GROUP),
        total: awaiting.length,
      },
      {
        id: "at_risk",
        label: "At risk",
        description: "POs blocked by an invoice mismatch.",
        items: atRiskItems.slice(0, ITEMS_PER_GROUP),
        total: atRiskItems.length,
      },
      {
        id: "recent",
        label: "Recently updated",
        description: "Recent procurement activity across the warehouse network.",
        items: recentItems.slice(0, ITEMS_PER_GROUP),
        total: recentItems.length,
      },
    ],
  };
}

async function fetchFinanceInbox(user: SessionUser): Promise<InboxData> {
  const invoiceScope = nestedPurchaseOrderWarehouseScope(user);
  const prWarehouseFilter = invoiceScope.purchaseOrder?.purchaseRequest ?? {};

  const [readyToPay, partials, atRiskInvoices, vendorChanged, recent] =
    await dbSerial(
      () => prisma.invoice.findMany({
        where: {
          paymentStatus: PaymentStatus.UNPAID,
          matchStatus: { in: [InvoiceMatchStatus.MATCHED, InvoiceMatchStatus.OVERRIDE_ACCEPTED] },
          ...invoiceScope,
        },
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          updatedAt: true,
          purchaseOrder: { select: { id: true, vendor: { select: { businessName: true } } } },
        },
        orderBy: { updatedAt: "asc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.invoice.findMany({
        where: { paymentStatus: PaymentStatus.PARTIALLY_PAID, ...invoiceScope },
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          updatedAt: true,
          purchaseOrder: { select: { id: true, vendor: { select: { businessName: true } } } },
          payments: { select: { amount: true } },
        },
        orderBy: { updatedAt: "asc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.invoice.findMany({
        where: { matchStatus: InvoiceMatchStatus.MISMATCH, overrideReason: null, ...invoiceScope },
        select: {
          id: true,
          invoiceNumber: true,
          updatedAt: true,
          purchaseOrder: { select: { id: true, vendor: { select: { businessName: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.invoice.findMany({
        where: {
          paymentStatus: PaymentStatus.UNPAID,
          purchaseOrder: {
            ...(Object.keys(prWarehouseFilter).length > 0
              ? { purchaseRequest: prWarehouseFilter }
              : {}),
            vendor: {
              updatedAt: { gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
            },
          },
        },
        select: {
          id: true,
          invoiceNumber: true,
          updatedAt: true,
          purchaseOrder: {
            select: {
              id: true,
              createdAt: true,
              vendor: { select: { businessName: true, updatedAt: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
      () => prisma.payment.findMany({
        where: { amount: { not: null }, invoice: invoiceScope },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          createdAt: true,
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              purchaseOrder: { select: { id: true, vendor: { select: { businessName: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: ITEMS_PER_GROUP,
      }),
    );

  const readyToPayItems: InboxItem[] = readyToPay.map((inv) => ({
    id: inv.id,
    key: `inv_pay:${inv.id}`,
    kind: "invoice_to_pay",
    ref: inv.purchaseOrder.id,
    title: inv.purchaseOrder.vendor.businessName,
    subtitle: `Invoice ${inv.invoiceNumber} — ₹${Number(inv.amount).toLocaleString("en-IN")}`,
    timestamp: inv.updatedAt.toISOString(),
    href: `/payments?invoiceId=${inv.id}`,
    actionLabel: "Pay",
  }));

  const partialItems: InboxItem[] = partials.map((inv) => {
    const paid = inv.payments.reduce(
      (sum, p) => sum + (p.amount ? Number(p.amount) : 0),
      0,
    );
    const total = Number(inv.amount);
    const remaining = Math.max(0, total - paid);
    return {
      id: inv.id,
      key: `inv_partial:${inv.id}`,
      kind: "invoice_partial",
      ref: inv.purchaseOrder.id,
      title: inv.purchaseOrder.vendor.businessName,
      subtitle: `Invoice ${inv.invoiceNumber} — ₹${remaining.toLocaleString("en-IN")} remaining`,
      timestamp: inv.updatedAt.toISOString(),
      href: `/payments?invoiceId=${inv.id}`,
      actionLabel: "Continue",
    };
  });

  const atRiskItems: InboxItem[] = [
    ...atRiskInvoices.map((inv) => ({
      id: inv.id,
      key: `inv_mismatch:${inv.id}`,
      kind: "po_at_risk" as const,
      ref: inv.purchaseOrder.id,
      title: inv.purchaseOrder.vendor.businessName,
      subtitle: `Invoice ${inv.invoiceNumber} mismatch — awaiting Ops override`,
      timestamp: inv.updatedAt.toISOString(),
      href: `/purchase-orders/${inv.purchaseOrder.id}?tab=invoices`,
      actionLabel: "View",
    })),
    ...vendorChanged
      .filter((inv) => inv.purchaseOrder.vendor.updatedAt > inv.purchaseOrder.createdAt)
      .map((inv) => ({
        id: inv.id,
        key: `inv_vendor_changed:${inv.id}`,
        kind: "po_at_risk" as const,
        ref: inv.purchaseOrder.id,
        title: inv.purchaseOrder.vendor.businessName,
        subtitle: `Vendor details changed after PO — re-verify before paying`,
        timestamp: inv.updatedAt.toISOString(),
        href: `/payments?invoiceId=${inv.id}`,
        actionLabel: "Verify",
      })),
  ];

  const recentItems: InboxItem[] = recent.map((p) => ({
    id: p.id,
    key: `pay_recent:${p.id}`,
    kind: "invoice_partial",
    ref: p.invoice.purchaseOrder.id,
    title: p.invoice.purchaseOrder.vendor.businessName,
    subtitle: `Paid ₹${Number(p.amount ?? 0).toLocaleString("en-IN")} on invoice ${p.invoice.invoiceNumber}`,
    timestamp: (p.paidAt ?? p.createdAt).toISOString(),
    href: `/payments?invoiceId=${p.invoice.id}`,
    actionLabel: "Open",
  }));

  const awaiting = [...readyToPayItems, ...partialItems];

  return {
    summary: {
      drafts: 0,
      awaiting: awaiting.length,
      atRisk: atRiskItems.length,
      recent: recentItems.length,
    },
    groups: [
      {
        id: "awaiting",
        label: "Awaiting payment",
        description: "Matched invoices ready to pay, and partial payments to continue.",
        items: awaiting.slice(0, ITEMS_PER_GROUP),
        total: awaiting.length,
      },
      {
        id: "at_risk",
        label: "At risk",
        description: "Mismatched invoices and vendor bank changes since PO.",
        items: atRiskItems.slice(0, ITEMS_PER_GROUP),
        total: atRiskItems.length,
      },
      {
        id: "recent",
        label: "Recently paid",
        description: "Your last payment entries.",
        items: recentItems.slice(0, ITEMS_PER_GROUP),
        total: recentItems.length,
      },
    ],
  };
}

export async function getInboxForSession(user: SessionUser): Promise<InboxData> {
  switch (user.role) {
    case Role.SM:
      return fetchSmInbox(user);
    case Role.OPS_HEAD:
      return fetchOpsHeadInbox(user);
    case Role.FINANCE:
      return fetchFinanceInbox(user);
  }
}
