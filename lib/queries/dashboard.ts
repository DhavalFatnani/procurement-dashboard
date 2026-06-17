import { unstable_cache } from "next/cache";
import {
  InvoiceMatchStatus,
  PaymentStatus,
  POAdvanceRequestStatus,
  Prisma,
  Role,
} from "@/lib/prisma-client";

import { dbSerial } from "@/lib/db-serial";
import { advanceOverageForPo, committedTotalFromPo, sumDecimalRows } from "@/lib/po-advance";
import { computeRemainingSettled } from "@/lib/payment-totals";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import {
  assignedWarehouseIds,
  prWarehouseWhereFromScopeIds,
  scopeWarehouseIdsForUser,
  invoiceWhereFromScopeIds,
  purchaseOrderWhereFromScopeIds,
  warehouseIdFilter,
} from "@/lib/warehouse-scope";

export type DashboardMetrics = {
  pendingApprovals: number;
  openPurchaseOrders: number;
  posAwaitingReceipt: number;
  draftPurchaseRequests: number;
  pendingVendorRequests: number;
  unpaidInvoices: number;
};

type MetricsRow = {
  pending_approvals: number;
  open_purchase_orders: number;
  pos_awaiting_receipt: number;
  draft_purchase_requests: number;
  pending_vendor_requests: number;
  unpaid_invoices: number;
};

function warehouseFilterSql(warehouseIds: string[] | undefined) {
  if (warehouseIds === undefined) {
    return Prisma.empty;
  }
  if (warehouseIds.length === 0) {
    return Prisma.sql`AND false`;
  }
  if (warehouseIds.length === 1) {
    return Prisma.sql`AND pr."warehouseId" = ${warehouseIds[0]!}`;
  }
  return Prisma.sql`AND pr."warehouseId" IN (${Prisma.join(warehouseIds)})`;
}

function poWarehouseFilterSql(warehouseIds: string[] | undefined) {
  if (warehouseIds === undefined) {
    return Prisma.empty;
  }
  if (warehouseIds.length === 0) {
    return Prisma.sql`AND false`;
  }
  if (warehouseIds.length === 1) {
    return Prisma.sql`AND pr."warehouseId" = ${warehouseIds[0]!}`;
  }
  return Prisma.sql`AND pr."warehouseId" IN (${Prisma.join(warehouseIds)})`;
}

async function fetchDashboardMetrics(
  role: Role,
  warehouseIds: string[] | undefined,
): Promise<DashboardMetrics> {
  const includeVendorPending =
    role === Role.CENTRAL_TEAM || role === Role.OPS_HEAD || role === Role.ADMIN;
  const prWarehouseFilter = warehouseFilterSql(warehouseIds);
  const poWarehouseFilter = poWarehouseFilterSql(warehouseIds);

  const [row] = await prisma.$queryRaw<MetricsRow[]>`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM "PurchaseRequest" pr
        WHERE pr.status = 'PENDING_APPROVAL'::"PRStatus"
          AND pr."executionType" = 'VENDOR_PURCHASE'::"ExecutionType"
          ${prWarehouseFilter}
      ) AS pending_approvals,
      (
        SELECT COUNT(*)::int
        FROM "PurchaseOrder" po
        INNER JOIN "PurchaseRequest" pr ON pr.id = po."prId"
        WHERE po.status IN (
          'OPEN'::"POStatus",
          'PARTIALLY_RECEIVED'::"POStatus",
          'FULLY_RECEIVED'::"POStatus",
          'INVOICED'::"POStatus"
        )
        ${poWarehouseFilter}
      ) AS open_purchase_orders,
      (
        SELECT COUNT(*)::int
        FROM "PurchaseOrder" po
        INNER JOIN "PurchaseRequest" pr ON pr.id = po."prId"
        WHERE po.status IN (
          'OPEN'::"POStatus",
          'PARTIALLY_RECEIVED'::"POStatus"
        )
        ${poWarehouseFilter}
      ) AS pos_awaiting_receipt,
      (
        SELECT COUNT(*)::int
        FROM "PurchaseRequest" pr
        WHERE pr.status = 'DRAFT'::"PRStatus"
          ${prWarehouseFilter}
      ) AS draft_purchase_requests,
      ${
        includeVendorPending
          ? Prisma.sql`(
              SELECT COUNT(*)::int
              FROM "VendorRequest"
              WHERE status = 'PENDING'::"VendorRequestStatus"
            )`
          : Prisma.sql`0::int`
      } AS pending_vendor_requests,
      (
        SELECT COUNT(*)::int
        FROM "Invoice" inv
        INNER JOIN "PurchaseOrder" po ON po.id = inv."poId"
        INNER JOIN "PurchaseRequest" pr ON pr.id = po."prId"
        WHERE inv."paymentStatus" != 'PAID'::"PaymentStatus"
          ${poWarehouseFilter}
      ) AS unpaid_invoices
  `;

  return {
    pendingApprovals: row?.pending_approvals ?? 0,
    openPurchaseOrders: row?.open_purchase_orders ?? 0,
    posAwaitingReceipt: row?.pos_awaiting_receipt ?? 0,
    draftPurchaseRequests: row?.draft_purchase_requests ?? 0,
    pendingVendorRequests: row?.pending_vendor_requests ?? 0,
    unpaidInvoices: row?.unpaid_invoices ?? 0,
  };
}

const getCachedDashboardMetrics = (
  role: Role,
  userId: string,
  warehouseKey: string,
) =>
  unstable_cache(
    () =>
      fetchDashboardMetrics(
        role,
        warehouseKey === "__global__"
          ? undefined
          : warehouseKey
            ? warehouseKey.split(",")
            : [],
      ),
    ["dashboard-metrics", role, userId, warehouseKey],
    { revalidate: 30, tags: ["dashboard-metrics"] },
  );

export async function getDashboardMetricsForSession(
  user: SessionUser,
): Promise<DashboardMetrics> {
  const scoped = scopeWarehouseIdsForUser(user);
  const warehouseKey =
    scoped === undefined ? "__global__" : scoped.join(",");
  return getCachedDashboardMetrics(user.role, user.id, warehouseKey)();
}

export type PaymentAgeingBucketSummary = {
  bucket: string;
  count: number;
  value: number;
};

export type FinanceDashboardMetrics = {
  unpaidInvoices: { count: number; value: number };
  pendingVendorAdvances: number;
  paidThisMonth: { cash: number; allocations: number };
  matchExceptions: number;
  advanceOverCommitment: number;
  paymentAgeing: PaymentAgeingBucketSummary[];
};

const AGEING_BUCKETS = [
  { label: "≤7d", min: 0, max: 7 },
  { label: "8–14d", min: 8, max: 14 },
  { label: "15–30d", min: 15, max: 30 },
  { label: "30d+", min: 31, max: Number.POSITIVE_INFINITY },
] as const;

const poAdvanceInclude = {
  gstApplicable: true,
  gstRatePercent: true,
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
  advancePayments: {
    include: { allocations: { select: { amount: true } } },
  },
  advanceRequests: { select: { status: true, requestedAmount: true } },
};

function startOfMonth(day = new Date()): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

function invoiceRemaining(
  amount: unknown,
  payments: { amount: unknown }[],
  advanceAllocations: { amount: unknown }[],
): number {
  const cashPaid = sumDecimalRows(payments);
  const allocated = sumDecimalRows(advanceAllocations);
  return computeRemainingSettled(Number(amount), cashPaid, allocated);
}

function buildPaymentAgeingSummary(
  unpaidInvoices: { createdAt: Date; remaining: number }[],
): PaymentAgeingBucketSummary[] {
  const now = Date.now();
  return AGEING_BUCKETS.map((b) => {
    const inBucket = unpaidInvoices.filter((inv) => {
      const age = Math.floor((now - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return age >= b.min && age <= b.max;
    });
    return {
      bucket: b.label,
      count: inBucket.length,
      value: inBucket.reduce((sum, inv) => sum + inv.remaining, 0),
    };
  });
}

async function countAdvanceOverCommitment(
  scopeWarehouseIds: string[] | undefined,
): Promise<number> {
  const poScope = purchaseOrderWhereFromScopeIds(scopeWarehouseIds);
  const posWithAdvance = await prisma.purchaseOrder.findMany({
    where: {
      ...poScope,
      OR: [
        { advancePayments: { some: {} } },
        { advanceRequests: { some: { status: POAdvanceRequestStatus.PENDING } } },
      ],
    },
    select: poAdvanceInclude,
    take: 300,
  });

  let count = 0;
  for (const po of posWithAdvance) {
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
    const overage = advanceOverageForPo({
      committedTotal: committed,
      advancePayments: po.advancePayments,
      advanceRequests: po.advanceRequests,
    });
    if (overage.overCommittedBy > 0) {
      count += 1;
    }
  }
  return count;
}

async function fetchFinanceDashboardMetrics(
  warehouseIds: string[] | undefined,
): Promise<FinanceDashboardMetrics> {
  const invoiceScope = invoiceWhereFromScopeIds(warehouseIds);
  const poScope = purchaseOrderWhereFromScopeIds(warehouseIds);
  const startMonth = startOfMonth();

  const [
    openInvoices,
    pendingVendorAdvances,
    matchExceptions,
    cashPaidThisMonth,
    allocationsThisMonth,
    advanceOverCommitment,
  ] = await dbSerial(
    () =>
      prisma.invoice.findMany({
        where: {
          paymentStatus: { not: PaymentStatus.PAID },
          ...invoiceScope,
        },
        select: {
          amount: true,
          createdAt: true,
          payments: { select: { amount: true } },
          advanceAllocations: { select: { amount: true } },
        },
      }),
    () =>
      prisma.pOAdvanceRequest.count({
        where: {
          status: POAdvanceRequestStatus.PENDING,
          purchaseOrder: poScope,
        },
      }),
    () =>
      prisma.invoice.count({
        where: {
          matchStatus: InvoiceMatchStatus.MISMATCH,
          overrideReason: null,
          ...invoiceScope,
        },
      }),
    () =>
      prisma.payment.aggregate({
        where: {
          amount: { not: null },
          paidAt: { gte: startMonth },
          invoice: invoiceScope,
        },
        _sum: { amount: true },
      }),
    () =>
      prisma.pOAdvanceAllocation.aggregate({
        where: {
          createdAt: { gte: startMonth },
          invoice: invoiceScope,
        },
        _sum: { amount: true },
      }),
    () => countAdvanceOverCommitment(warehouseIds),
  );

  const unpaidWithRemaining = openInvoices.map((inv) => ({
    createdAt: inv.createdAt,
    remaining: invoiceRemaining(inv.amount, inv.payments, inv.advanceAllocations),
  }));

  return {
    unpaidInvoices: {
      count: unpaidWithRemaining.length,
      value: unpaidWithRemaining.reduce((sum, inv) => sum + inv.remaining, 0),
    },
    pendingVendorAdvances,
    paidThisMonth: {
      cash: Number(cashPaidThisMonth._sum.amount ?? 0),
      allocations: Number(allocationsThisMonth._sum.amount ?? 0),
    },
    matchExceptions,
    advanceOverCommitment,
    paymentAgeing: buildPaymentAgeingSummary(unpaidWithRemaining),
  };
}

const getCachedFinanceDashboardMetrics = (userId: string, warehouseKey: string) =>
  unstable_cache(
    () =>
      fetchFinanceDashboardMetrics(
        warehouseKey === "__global__"
          ? undefined
          : warehouseKey
            ? warehouseKey.split(",")
            : [],
      ),
    ["finance-dashboard-metrics", userId, warehouseKey],
    { revalidate: 30, tags: ["dashboard-metrics", "finance-dashboard-metrics"] },
  );

export async function getFinanceDashboardMetrics(
  user: SessionUser,
): Promise<FinanceDashboardMetrics> {
  const scoped = scopeWarehouseIdsForUser(user);
  const warehouseKey =
    scoped === undefined ? "__global__" : scoped.join(",");
  return getCachedFinanceDashboardMetrics(user.id, warehouseKey)();
}

export type OpsDashboardMetrics = {
  pendingApprovals: number;
  pendingVendorRequests: number;
  prsAwaitingPo: number;
  openGrnExceptions: number;
  matchExceptions: number;
  openPurchaseOrders: number;
};

async function fetchOpsDashboardMetrics(
  warehouseIds: string[] | undefined,
): Promise<OpsDashboardMetrics> {
  const invoiceScope = invoiceWhereFromScopeIds(warehouseIds);
  const prWarehouseFilter = warehouseFilterSql(warehouseIds);
  const poWarehouseFilter = poWarehouseFilterSql(warehouseIds);

  const grnExceptionScope =
    warehouseIds === undefined
      ? {}
      : {
          grn: {
            purchaseOrder: {
              purchaseRequest: { warehouseId: warehouseIdFilter(warehouseIds) },
            },
          },
        };

  const [
    baseRow,
    prsAwaitingPo,
    openGrnExceptions,
    matchExceptions,
  ] = await dbSerial(
    () =>
      prisma.$queryRaw<MetricsRow[]>`
        SELECT
          (
            SELECT COUNT(*)::int
            FROM "PurchaseRequest" pr
            WHERE pr.status = 'PENDING_APPROVAL'::"PRStatus"
              AND pr."executionType" = 'VENDOR_PURCHASE'::"ExecutionType"
              ${prWarehouseFilter}
          ) AS pending_approvals,
          (
            SELECT COUNT(*)::int
            FROM "PurchaseOrder" po
            INNER JOIN "PurchaseRequest" pr ON pr.id = po."prId"
            WHERE po.status IN (
              'OPEN'::"POStatus",
              'PARTIALLY_RECEIVED'::"POStatus",
              'FULLY_RECEIVED'::"POStatus",
              'INVOICED'::"POStatus"
            )
            ${poWarehouseFilter}
          ) AS open_purchase_orders,
          0::int AS pos_awaiting_receipt,
          0::int AS draft_purchase_requests,
          (
            SELECT COUNT(*)::int
            FROM "VendorRequest"
            WHERE status = 'PENDING'::"VendorRequestStatus"
          ) AS pending_vendor_requests,
          0::int AS unpaid_invoices
      `.then((rows) => rows[0]),
    () =>
      prisma.purchaseRequest.count({
        where: {
          status: "APPROVED",
          executionType: "VENDOR_PURCHASE",
          ...prWarehouseWhereFromScopeIds(warehouseIds),
          lines: {
            some: {
              items: { some: { poLineItem: null } },
            },
          },
        },
      }),
    () =>
      prisma.gRNException.count({
        where: {
          resolutionStatus: null,
          ...grnExceptionScope,
        },
      }),
    () =>
      prisma.invoice.count({
        where: {
          matchStatus: InvoiceMatchStatus.MISMATCH,
          overrideReason: null,
          ...invoiceScope,
        },
      }),
  );

  return {
    pendingApprovals: baseRow?.pending_approvals ?? 0,
    pendingVendorRequests: baseRow?.pending_vendor_requests ?? 0,
    prsAwaitingPo,
    openGrnExceptions,
    matchExceptions,
    openPurchaseOrders: baseRow?.open_purchase_orders ?? 0,
  };
}

const getCachedOpsDashboardMetrics = (userId: string, warehouseKey: string) =>
  unstable_cache(
    () =>
      fetchOpsDashboardMetrics(
        warehouseKey === "__global__"
          ? undefined
          : warehouseKey
            ? warehouseKey.split(",")
            : [],
      ),
    ["ops-dashboard-metrics", userId, warehouseKey],
    { revalidate: 30, tags: ["dashboard-metrics", "ops-dashboard-metrics"] },
  );

export async function getOpsDashboardMetrics(
  user: SessionUser,
): Promise<OpsDashboardMetrics> {
  const scoped = scopeWarehouseIdsForUser(user);
  const warehouseKey =
    scoped === undefined ? "__global__" : scoped.join(",");
  return getCachedOpsDashboardMetrics(user.id, warehouseKey)();
}
