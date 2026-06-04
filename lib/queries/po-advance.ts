import "server-only";

import { POAdvanceRequestStatus } from "@/lib/prisma-enums";

import { cachedQuery, LIST_CACHE_TAGS } from "@/lib/list-cache";
import {
  advanceOverageForPo,
  committedTotalFromPo,
  computeAdvanceBalances,
} from "@/lib/po-advance";
import { prisma } from "@/lib/prisma";
import { formatProcurementRef } from "@/lib/display-ref";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { purchaseOrderWhereFromScopeIds } from "@/lib/warehouse-scope";

export type AdvancePaymentHistoryRow = {
  id: string;
  requestId: string;
  poId: string;
  poLabel: string;
  vendorName: string;
  amount: string;
  allocated: string;
  unallocated: string;
  method: string | null;
  transactionRef: string;
  paidByName: string;
  paidAt: string;
  requestedByName: string;
  requestedAt: string;
  reason: string;
};

export type AdvanceRequestListRow = {
  id: string;
  poId: string;
  poLabel: string;
  vendorName: string;
  requestedAmount: string;
  requestedPercent: string | null;
  reason: string;
  status: POAdvanceRequestStatus;
  requestedByName: string;
  requestedAt: string;
};

export type AdvanceRequestDetail = {
  id: string;
  poId: string;
  prId: string;
  vendorName: string;
  requestedAmount: string;
  requestedPercent: string | null;
  reason: string;
  status: POAdvanceRequestStatus;
  requestedByName: string;
  requestedAt: string;
  committedTotal: string;
  advancePaid: string;
  advanceUnallocated: string;
  overCommittedBy: string;
  overageWarning: string | null;
  vendorBank: {
    accountName: string;
    accountNumber: string;
    accountLast4: string;
    ifsc: string;
    bankName: string;
  };
};

export type AdvanceRequestDetailPage = AdvanceRequestDetail & {
  reviewedByName: string | null;
  reviewReason: string | null;
  payment: {
    id: string;
    amount: string;
    paidAt: string;
    method: string | null;
    transactionRef: string;
    paidByName: string;
  } | null;
};

export type AdvancePaymentDetail = {
  id: string;
  requestId: string;
  poId: string;
  poLabel: string;
  prId: string;
  vendorName: string;
  amount: string;
  allocated: string;
  unallocated: string;
  method: string | null;
  transactionRef: string;
  paidByName: string;
  paidAt: string;
  proofSignedUrl: string | null;
  request: {
    id: string;
    reason: string;
    requestedAmount: string;
    requestedPercent: string | null;
    requestedByName: string;
    requestedAt: string;
    status: POAdvanceRequestStatus;
  };
  allocations: {
    id: string;
    amount: string;
    createdAt: string;
    invoiceId: string;
    invoiceNumber: string;
  }[];
  vendorBank: {
    accountName: string;
    accountNumber: string;
    accountLast4: string;
    ifsc: string;
    bankName: string;
  };
};

export type POAdvanceSummary = {
  committedTotal: string;
  advancePaid: string;
  advanceAllocated: string;
  advanceUnallocated: string;
  overCommittedBy: string;
  overageWarning: string | null;
  requests: {
    id: string;
    requestedAmount: string;
    status: POAdvanceRequestStatus;
    reason: string;
    requestedByName: string;
    requestedAt: string;
    paidAt: string | null;
    paidByName: string | null;
    method: string | null;
    transactionRef: string | null;
    paymentId: string | null;
    proofSignedUrl: string | null;
  }[];
};

const advancePaymentInclude = {
  allocations: { select: { amount: true } },
} as const;

const advanceRequestDetailInclude = {
  requestedBy: { select: { name: true } },
  reviewedBy: { select: { name: true } },
  payment: {
    select: {
      id: true,
      amount: true,
      paidAt: true,
      method: true,
      transactionRef: true,
      paidBy: { select: { name: true } },
    },
  },
  purchaseOrder: {
    include: {
      vendor: {
        select: {
          businessName: true,
          accountName: true,
          accountNumber: true,
          ifsc: true,
          bankName: true,
        },
      },
      lineItems: { select: { id: true, orderedQty: true, unitPrice: true } },
      lines: { select: { id: true, orderedQty: true, unitPrice: true } },
      lineAdjustments: {
        orderBy: { createdAt: "asc" as const },
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
      advancePayments: { include: advancePaymentInclude },
      advanceRequests: {
        select: { status: true, requestedAmount: true },
      },
    },
  },
} as const;

type AdvanceRequestDetailRow = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.pOAdvanceRequest.findUnique<{
        where: { id: string };
        include: typeof advanceRequestDetailInclude;
      }>
    >
  >
>;

function buildAdvanceRequestDetailFromRow(
  row: AdvanceRequestDetailRow,
): AdvanceRequestDetail {
  const po = row.purchaseOrder;
  const committed = committedTotalFromPo({
    gstApplicable: po.gstApplicable,
    gstRatePercent: po.gstRatePercent?.toString() ?? null,
    lineItems: [],
    lines: [],
    lineAdjustments: po.lineAdjustments,
    lineItemsWithIds: po.lineItems.map((l) => ({
      id: l.id,
      orderedQty: l.orderedQty,
      unitPrice: Number(l.unitPrice),
    })),
    linesWithIds: po.lines.map((l) => ({
      id: l.id,
      orderedQty: l.orderedQty,
      unitPrice: Number(l.unitPrice),
    })),
  });
  const balances = computeAdvanceBalances(po.advancePayments);
  const overage = advanceOverageForPo({
    committedTotal: committed,
    advancePayments: po.advancePayments,
    advanceRequests: po.advanceRequests,
  });
  const acct = po.vendor.accountNumber;
  const last4 = acct.length >= 4 ? acct.slice(-4) : acct;

  return {
    id: row.id,
    poId: row.poId,
    prId: po.prId,
    vendorName: po.vendor.businessName,
    requestedAmount: row.requestedAmount.toString(),
    requestedPercent: row.requestedPercent?.toString() ?? null,
    reason: row.reason,
    status: row.status,
    requestedByName: row.requestedBy.name,
    requestedAt: row.requestedAt.toISOString(),
    committedTotal: committed.toFixed(2),
    advancePaid: balances.advancePaid.toFixed(2),
    advanceUnallocated: balances.advanceUnallocated.toFixed(2),
    overCommittedBy: overage.overCommittedBy.toFixed(2),
    overageWarning: overage.message,
    vendorBank: {
      accountName: po.vendor.accountName,
      accountNumber: acct,
      accountLast4: last4,
      ifsc: po.vendor.ifsc,
      bankName: po.vendor.bankName,
    },
  };
}

export async function getPendingAdvanceRequests(
  scopeWarehouseIds?: string[],
): Promise<AdvanceRequestListRow[]> {
  const scopeKey =
    scopeWarehouseIds === undefined ? "*" : scopeWarehouseIds.slice().sort().join(",");
  return cachedQuery(
    "pending-advance-requests",
    [scopeKey],
    () => fetchPendingAdvanceRequests(scopeWarehouseIds),
    { tags: [LIST_CACHE_TAGS.advanceRequests, LIST_CACHE_TAGS.inbox] },
  );
}

async function fetchPendingAdvanceRequests(
  scopeWarehouseIds?: string[],
): Promise<AdvanceRequestListRow[]> {
  const rows = await prisma.pOAdvanceRequest.findMany({
    where: {
      status: POAdvanceRequestStatus.PENDING,
      purchaseOrder: purchaseOrderWhereFromScopeIds(scopeWarehouseIds),
    },
    orderBy: { requestedAt: "asc" },
    include: {
      requestedBy: { select: { name: true } },
      purchaseOrder: {
        select: {
          id: true,
          vendor: { select: { businessName: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    poId: row.poId,
    poLabel: formatProcurementRef(row.poId),
    vendorName: row.purchaseOrder.vendor.businessName,
    requestedAmount: row.requestedAmount.toString(),
    requestedPercent: row.requestedPercent?.toString() ?? null,
    reason: row.reason,
    status: row.status,
    requestedByName: row.requestedBy.name,
    requestedAt: row.requestedAt.toISOString(),
  }));
}

export async function getAdvancePaymentHistory(
  scopeWarehouseIds?: string[],
): Promise<AdvancePaymentHistoryRow[]> {
  const scopeKey =
    scopeWarehouseIds === undefined ? "*" : scopeWarehouseIds.slice().sort().join(",");
  return cachedQuery(
    "advance-payment-history",
    [scopeKey],
    () => fetchAdvancePaymentHistory(scopeWarehouseIds),
    { tags: [LIST_CACHE_TAGS.advanceRequests, LIST_CACHE_TAGS.payments] },
  );
}

async function fetchAdvancePaymentHistory(
  scopeWarehouseIds?: string[],
): Promise<AdvancePaymentHistoryRow[]> {
  const rows = await prisma.pOAdvancePayment.findMany({
    where: {
      purchaseOrder: purchaseOrderWhereFromScopeIds(scopeWarehouseIds),
    },
    orderBy: { paidAt: "desc" },
    include: {
      paidBy: { select: { name: true } },
      request: {
        select: {
          id: true,
          reason: true,
          requestedAt: true,
          requestedBy: { select: { name: true } },
        },
      },
      purchaseOrder: {
        select: {
          id: true,
          vendor: { select: { businessName: true } },
        },
      },
      allocations: { select: { amount: true } },
    },
  });

  return rows.map((row) => {
    const paid = Number(row.amount);
    const allocated = row.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    const unallocated = Math.max(0, paid - allocated);
    return {
      id: row.id,
      requestId: row.requestId,
      poId: row.poId,
      poLabel: formatProcurementRef(row.poId),
      vendorName: row.purchaseOrder.vendor.businessName,
      amount: row.amount.toString(),
      allocated: allocated.toString(),
      unallocated: unallocated.toString(),
      method: row.method,
      transactionRef: row.transactionRef,
      paidByName: row.paidBy.name,
      paidAt: row.paidAt.toISOString(),
      requestedByName: row.request.requestedBy.name,
      requestedAt: row.request.requestedAt.toISOString(),
      reason: row.request.reason,
    };
  });
}

export async function getAdvanceRequestDetail(
  requestId: string,
): Promise<AdvanceRequestDetail | null> {
  const row = await prisma.pOAdvanceRequest.findUnique({
    where: { id: requestId },
    include: advanceRequestDetailInclude,
  });

  if (!row || row.status !== POAdvanceRequestStatus.PENDING) {
    return null;
  }

  return buildAdvanceRequestDetailFromRow(row);
}

export async function getAdvanceRequestDetailPage(
  requestId: string,
): Promise<AdvanceRequestDetailPage | null> {
  const row = await prisma.pOAdvanceRequest.findUnique({
    where: { id: requestId },
    include: advanceRequestDetailInclude,
  });

  if (!row) {
    return null;
  }

  const detail = buildAdvanceRequestDetailFromRow(row);

  return {
    ...detail,
    reviewedByName: row.reviewedBy?.name ?? null,
    reviewReason: row.reviewReason,
    payment: row.payment
      ? {
          id: row.payment.id,
          amount: row.payment.amount.toString(),
          paidAt: row.payment.paidAt.toISOString(),
          method: row.payment.method,
          transactionRef: row.payment.transactionRef,
          paidByName: row.payment.paidBy.name,
        }
      : null,
  };
}

export async function getPOAdvanceSummary(poId: string): Promise<POAdvanceSummary | null> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      lineItems: { select: { id: true, orderedQty: true, unitPrice: true } },
      lines: { select: { id: true, orderedQty: true, unitPrice: true } },
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
      advanceRequests: {
        orderBy: { requestedAt: "desc" },
        include: {
          requestedBy: { select: { name: true } },
          payment: {
            select: {
              id: true,
              proofUrl: true,
              paidAt: true,
              method: true,
              transactionRef: true,
              paidBy: { select: { name: true } },
            },
          },
        },
      },
      advancePayments: { include: advancePaymentInclude },
    },
  });

  if (!po) {
    return null;
  }

  const committed = committedTotalFromPo({
    gstApplicable: po.gstApplicable,
    gstRatePercent: po.gstRatePercent?.toString() ?? null,
    lineItems: [],
    lines: [],
    lineAdjustments: po.lineAdjustments,
    lineItemsWithIds: po.lineItems.map((l) => ({
      id: l.id,
      orderedQty: l.orderedQty,
      unitPrice: Number(l.unitPrice),
    })),
    linesWithIds: po.lines.map((l) => ({
      id: l.id,
      orderedQty: l.orderedQty,
      unitPrice: Number(l.unitPrice),
    })),
  });
  const balances = computeAdvanceBalances(po.advancePayments);
  const overage = advanceOverageForPo({
    committedTotal: committed,
    advancePayments: po.advancePayments,
    advanceRequests: po.advanceRequests,
  });

  const { createStorageSignedUrl } = await import("@/lib/upload-storage");

  return {
    committedTotal: committed.toFixed(2),
    advancePaid: balances.advancePaid.toFixed(2),
    advanceAllocated: balances.advanceAllocated.toFixed(2),
    advanceUnallocated: balances.advanceUnallocated.toFixed(2),
    overCommittedBy: overage.overCommittedBy.toFixed(2),
    overageWarning: overage.message,
    requests: await Promise.all(
      po.advanceRequests.map(async (r) => ({
        id: r.id,
        requestedAmount: r.requestedAmount.toString(),
        status: r.status,
        reason: r.reason,
        requestedByName: r.requestedBy.name,
        requestedAt: r.requestedAt.toISOString(),
        paidAt: r.payment?.paidAt.toISOString() ?? null,
        paidByName: r.payment?.paidBy.name ?? null,
        method: r.payment?.method ?? null,
        transactionRef: r.payment?.transactionRef ?? null,
        paymentId: r.payment?.id ?? null,
        proofSignedUrl: r.payment?.proofUrl
          ? await createStorageSignedUrl(
              STORAGE_BUCKETS.paymentProofs,
              r.payment.proofUrl,
            )
          : null,
      })),
    ),
  };
}

export async function countPendingAdvanceRequests(
  scopeWarehouseIds?: string[],
): Promise<number> {
  return prisma.pOAdvanceRequest.count({
    where: {
      status: POAdvanceRequestStatus.PENDING,
      purchaseOrder: purchaseOrderWhereFromScopeIds(scopeWarehouseIds),
    },
  });
}

export async function getAdvancePaymentDetail(
  advancePaymentId: string,
): Promise<AdvancePaymentDetail | null> {
  const row = await prisma.pOAdvancePayment.findUnique({
    where: { id: advancePaymentId },
    include: {
      paidBy: { select: { name: true } },
      request: {
        select: {
          id: true,
          reason: true,
          requestedAmount: true,
          requestedPercent: true,
          requestedAt: true,
          status: true,
          requestedBy: { select: { name: true } },
        },
      },
      purchaseOrder: {
        select: {
          prId: true,
          vendor: {
            select: {
              businessName: true,
              accountName: true,
              accountNumber: true,
              ifsc: true,
              bankName: true,
            },
          },
        },
      },
      allocations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  const allocated = row.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  const paid = Number(row.amount);
  const unallocated = Math.max(0, paid - allocated);

  const { createStorageSignedUrl } = await import("@/lib/upload-storage");
  const proofSignedUrl = row.proofUrl
    ? await createStorageSignedUrl(STORAGE_BUCKETS.paymentProofs, row.proofUrl)
    : null;

  const vendor = row.purchaseOrder.vendor;
  const acct = vendor.accountNumber;
  const last4 = acct.length >= 4 ? acct.slice(-4) : acct;

  return {
    id: row.id,
    requestId: row.requestId,
    poId: row.poId,
    poLabel: formatProcurementRef(row.poId),
    prId: row.purchaseOrder.prId,
    vendorName: vendor.businessName,
    amount: row.amount.toString(),
    allocated: allocated.toString(),
    unallocated: unallocated.toString(),
    method: row.method,
    transactionRef: row.transactionRef,
    paidByName: row.paidBy.name,
    paidAt: row.paidAt.toISOString(),
    proofSignedUrl,
    request: {
      id: row.request.id,
      reason: row.request.reason,
      requestedAmount: row.request.requestedAmount.toString(),
      requestedPercent: row.request.requestedPercent?.toString() ?? null,
      requestedByName: row.request.requestedBy.name,
      requestedAt: row.request.requestedAt.toISOString(),
      status: row.request.status,
    },
    allocations: row.allocations.map((a) => ({
      id: a.id,
      amount: a.amount.toString(),
      createdAt: a.createdAt.toISOString(),
      invoiceId: a.invoice.id,
      invoiceNumber: a.invoice.invoiceNumber,
    })),
    vendorBank: {
      accountName: vendor.accountName,
      accountNumber: acct,
      accountLast4: last4,
      ifsc: vendor.ifsc,
      bankName: vendor.bankName,
    },
  };
}
