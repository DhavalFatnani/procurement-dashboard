import {
  InvoiceMatchStatus,
  PaymentStatus,
  POAdvanceRequestStatus,
  PRStatus,
} from "@/lib/prisma-enums";

import { dbParallel } from "@/lib/db-parallel";
import { cachedQuery, LIST_CACHE_TAGS } from "@/lib/list-cache";
import { advanceOverageForPo, committedTotalFromPo } from "@/lib/po-advance";
import { prisma } from "@/lib/prisma";
import {
  invoiceWhereFromScopeIds,
  purchaseOrderWhereFromScopeIds,
  warehouseIdFilter,
} from "@/lib/warehouse-scope";

export type CycleTimePoint = { day: string; count: number };
export type ExceptionPoint = { day: string; total: number; open: number };
export type PaymentAgePoint = { bucket: string; count: number };

export type PaymentAgeingExportRow = {
  invoiceNumber: string;
  poId: string;
  vendorName: string;
  invoiceAmount: string;
  remaining: string;
  ageDays: number;
  bucket: string;
};
export type TopVendor = { id: string; name: string; openValue: number; poCount: number };

export type ReportsData = {
  cycleTime: CycleTimePoint[];
  exceptionRate: ExceptionPoint[];
  paymentAge: PaymentAgePoint[];
  topVendors: TopVendor[];
  summary: {
    prsThisMonth: number;
    avgPrToPoDays: number | null;
    matchRate: number;
    openInvoiceValue: number;
    pendingAdvanceRequests: number;
    pendingAdvanceValue: number;
    advanceOverCommittedPoCount: number;
  };
};

const DAYS = 14;

function startOf(day: Date): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function grnExceptionWarehouseWhere(scopeWarehouseIds: string[]) {
  return {
    grn: {
      purchaseOrder: {
        purchaseRequest: { warehouseId: warehouseIdFilter(scopeWarehouseIds) },
      },
    },
  };
}

export async function getReports(scopeWarehouseIds: string[]): Promise<ReportsData> {
  return cachedQuery(
    "reports",
    [scopeWarehouseIds.slice().sort().join(",")],
    () => computeReports(scopeWarehouseIds),
    {
      revalidate: 120,
      tags: [
        LIST_CACHE_TAGS.purchaseRequests,
        LIST_CACHE_TAGS.purchaseOrders,
        LIST_CACHE_TAGS.invoices,
      ],
    },
  );
}

async function computeReports(scopeWarehouseIds: string[]): Promise<ReportsData> {
  const since = startOf(new Date());
  since.setDate(since.getDate() - DAYS + 1);

  const invoiceScope = invoiceWhereFromScopeIds(scopeWarehouseIds);
  const poScope = purchaseOrderWhereFromScopeIds(scopeWarehouseIds);

  const [prs, grnExceptions, unpaidInvoices, topVendorRows, monthMetrics] =
    await dbParallel(
      () =>
        prisma.purchaseRequest.findMany({
          where: {
            createdAt: { gte: since },
            warehouseId: warehouseIdFilter(scopeWarehouseIds),
          },
          select: { createdAt: true },
        }),
      () =>
        prisma.gRNException.findMany({
          where: {
            createdAt: { gte: since },
            ...grnExceptionWarehouseWhere(scopeWarehouseIds),
          },
          select: { createdAt: true, resolutionStatus: true },
        }),
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
          },
        }),
      () =>
        prisma.purchaseOrder.findMany({
          where: {
            status: { notIn: ["CLOSED", "FORCE_CLOSED", "PARTIALLY_CLOSED"] },
            ...poScope,
          },
          select: {
            id: true,
            unitPrice: true,
            orderedQty: true,
            lines: { select: { orderedQty: true, unitPrice: true } },
            vendor: { select: { id: true, businessName: true } },
          },
          take: 200,
        }),
      () => monthlyMetrics(scopeWarehouseIds),
    );

  const dayKeys: string[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const cycleTime: CycleTimePoint[] = dayKeys.map((day) => ({
    day,
    count: prs.filter((pr) => pr.createdAt.toISOString().slice(0, 10) === day).length,
  }));

  const exceptionRate: ExceptionPoint[] = dayKeys.map((day) => {
    const dayItems = grnExceptions.filter(
      (e) => e.createdAt.toISOString().slice(0, 10) === day,
    );
    return {
      day,
      total: dayItems.length,
      open: dayItems.filter((e) => e.resolutionStatus == null).length,
    };
  });

  const now = Date.now();
  const buckets = [
    { label: "≤7d", min: 0, max: 7 },
    { label: "8–14d", min: 8, max: 14 },
    { label: "15–30d", min: 15, max: 30 },
    { label: "30d+", min: 31, max: Number.POSITIVE_INFINITY },
  ];
  const paymentAge: PaymentAgePoint[] = buckets.map((b) => ({
    bucket: b.label,
    count: unpaidInvoices.filter((inv) => {
      const age = Math.floor((now - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return age >= b.min && age <= b.max;
    }).length,
  }));

  const vendorTotals = new Map<string, { id: string; name: string; value: number; count: number }>();
  for (const po of topVendorRows) {
    const value = po.lines.length
      ? po.lines.reduce(
          (sum, line) => sum + line.orderedQty * Number(line.unitPrice),
          0,
        )
      : (po.unitPrice ? Number(po.unitPrice) : 0) * (po.orderedQty ?? 0);
    const key = po.vendor.id;
    const prev = vendorTotals.get(key) ?? {
      id: po.vendor.id,
      name: po.vendor.businessName,
      value: 0,
      count: 0,
    };
    prev.value += value;
    prev.count += 1;
    vendorTotals.set(key, prev);
  }
  const topVendors: TopVendor[] = Array.from(vendorTotals.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((v) => ({ id: v.id, name: v.name, openValue: v.value, poCount: v.count }));

  return {
    cycleTime,
    exceptionRate,
    paymentAge,
    topVendors,
    summary: monthMetrics,
  };
}

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

async function advanceMetrics(scopeWarehouseIds: string[]) {
  const poScope = purchaseOrderWhereFromScopeIds(scopeWarehouseIds);

  const [pendingRequests, posWithAdvance] = await dbParallel(
    () =>
      prisma.pOAdvanceRequest.findMany({
        where: {
          status: POAdvanceRequestStatus.PENDING,
          purchaseOrder: poScope,
        },
        select: { requestedAmount: true },
      }),
    () =>
      prisma.purchaseOrder.findMany({
        where: {
          ...poScope,
          OR: [
            { advancePayments: { some: {} } },
            { advanceRequests: { some: { status: POAdvanceRequestStatus.PENDING } } },
          ],
        },
        select: poAdvanceInclude,
        take: 300,
      }),
  );

  const pendingAdvanceValue = pendingRequests.reduce(
    (sum, r) => sum + Number(r.requestedAmount),
    0,
  );

  let advanceOverCommittedPoCount = 0;
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
      advanceOverCommittedPoCount += 1;
    }
  }

  return {
    pendingAdvanceRequests: pendingRequests.length,
    pendingAdvanceValue,
    advanceOverCommittedPoCount,
  };
}

async function monthlyMetrics(
  scopeWarehouseIds: string[],
): Promise<ReportsData["summary"]> {
  const startMonth = startOf(new Date());
  startMonth.setDate(1);

  const invoiceScope = invoiceWhereFromScopeIds(scopeWarehouseIds);
  const poScope = purchaseOrderWhereFromScopeIds(scopeWarehouseIds);

  const [prsThisMonth, matchedCount, totalInvoices, openInvoices, advance] =
    await dbParallel(
    () =>
      prisma.purchaseRequest.count({
        where: {
          createdAt: { gte: startMonth },
          warehouseId: warehouseIdFilter(scopeWarehouseIds),
        },
      }),
    () =>
      prisma.invoice.count({
        where: {
          matchStatus: {
            in: [InvoiceMatchStatus.MATCHED, InvoiceMatchStatus.OVERRIDE_ACCEPTED],
          },
          ...invoiceScope,
        },
      }),
    () =>
      prisma.invoice.count({
        where: invoiceScope,
      }),
    () =>
      prisma.invoice.findMany({
        where: {
          paymentStatus: { not: PaymentStatus.PAID },
          ...invoiceScope,
        },
        select: { amount: true, payments: { select: { amount: true } } },
      }),
      () => advanceMetrics(scopeWarehouseIds),
    );

  const openValue = openInvoices.reduce((sum, inv) => {
    const paid = inv.payments.reduce(
      (s, p) => s + (p.amount ? Number(p.amount) : 0),
      0,
    );
    return sum + Math.max(0, Number(inv.amount) - paid);
  }, 0);

  const avgRows = await prisma.purchaseOrder.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      ...poScope,
    },
    select: { createdAt: true, purchaseRequest: { select: { createdAt: true } } },
  });
  const avgPrToPoDays =
    avgRows.length === 0
      ? null
      : avgRows.reduce(
          (sum, row) =>
            sum +
            (row.createdAt.getTime() - row.purchaseRequest.createdAt.getTime()) /
              (1000 * 60 * 60 * 24),
          0,
        ) / avgRows.length;

  return {
    prsThisMonth,
    avgPrToPoDays,
    matchRate: totalInvoices > 0 ? Math.round((matchedCount / totalInvoices) * 100) : 0,
    openInvoiceValue: openValue,
    ...advance,
  };
}

function ageingBucketForDays(ageDays: number): string {
  if (ageDays <= 7) return "≤7d";
  if (ageDays <= 14) return "8–14d";
  if (ageDays <= 30) return "15–30d";
  return "30d+";
}

export async function getPaymentAgeingExportRows(
  scopeWarehouseIds: string[],
): Promise<PaymentAgeingExportRow[]> {
  const invoiceScope = invoiceWhereFromScopeIds(scopeWarehouseIds);
  const rows = await prisma.invoice.findMany({
    where: {
      paymentStatus: { not: PaymentStatus.PAID },
      ...invoiceScope,
    },
    select: {
      invoiceNumber: true,
      poId: true,
      amount: true,
      createdAt: true,
      payments: { select: { amount: true } },
      purchaseOrder: {
        select: { vendor: { select: { businessName: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = Date.now();
  return rows.map((inv) => {
    const paid = inv.payments.reduce(
      (sum, p) => sum + (p.amount ? Number(p.amount) : 0),
      0,
    );
    const total = Number(inv.amount);
    const remaining = Math.max(0, total - paid);
    const ageDays = Math.floor((now - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    return {
      invoiceNumber: inv.invoiceNumber,
      poId: inv.poId,
      vendorName: inv.purchaseOrder.vendor.businessName,
      invoiceAmount: inv.amount.toString(),
      remaining: remaining.toString(),
      ageDays,
      bucket: ageingBucketForDays(ageDays),
    };
  });
}

export type { PRStatus };
