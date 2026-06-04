import {
  InvoiceMatchStatus,
  PaymentStatus,
  POAdvanceRequestStatus,
} from "@/lib/prisma-enums";

import { dbSerial } from "@/lib/db-serial";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import {
  advanceOverageForPo,
  committedTotalFromPo,
  computeAdvanceBalances,
  sumDecimalRows,
} from "@/lib/po-advance";
import { computeRemainingSettled } from "@/lib/payment-totals";
import { prisma } from "@/lib/prisma";
import {
  invoiceWhereFromScopeIds,
  purchaseOrderWhereFromScopeIds,
} from "@/lib/warehouse-scope";

export type FinanceReportsSummary = {
  openInvoiceValue: number;
  paidMtd: number;
  pendingAdvances: number;
  matchRate: number;
  overCommitment: number;
};

export type PaymentAgeingRow = {
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  remaining: number;
  ageDays: number;
  bucket: string;
  href: string;
};

export type VendorExposureRow = {
  vendorId: string;
  vendorName: string;
  openInvoiceValue: number;
  advanceUnallocated: number;
  invoiceCount: number;
};

export type AdvanceLedgerRow = {
  id: string;
  kind: "payment" | "allocation";
  poId: string;
  vendorName: string;
  amount: string;
  date: string;
  href: string;
  detail: string;
};

export type RecentSettlementRow = {
  id: string;
  kind: "cash" | "advance";
  amount: string;
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  date: string;
  recordedByName: string | null;
  href: string;
};

export type FinanceReportsData = {
  summary: FinanceReportsSummary;
  paymentAgeing: PaymentAgeingRow[];
  vendorExposure: VendorExposureRow[];
  advanceLedger: AdvanceLedgerRow[];
  recentSettlementActivity: RecentSettlementRow[];
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

function ageingBucketForDays(ageDays: number): string {
  const bucket = AGEING_BUCKETS.find((b) => ageDays >= b.min && ageDays <= b.max);
  return bucket?.label ?? "30d+";
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

function cashPaymentDate(payment: { paidAt: Date | null; createdAt: Date }): Date {
  return payment.paidAt ?? payment.createdAt;
}

async function countAdvanceOverCommitment(scopeWarehouseIds: string[]): Promise<number> {
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

export async function getFinanceReports(
  scopeWarehouseIds: string[],
): Promise<FinanceReportsData> {
  const invoiceScope = invoiceWhereFromScopeIds(scopeWarehouseIds);
  const poScope = purchaseOrderWhereFromScopeIds(scopeWarehouseIds);
  const startMonth = startOfMonth();
  const now = Date.now();

  const [
    openInvoices,
    matchedCount,
    totalInvoices,
    pendingAdvances,
    cashPaidMtd,
    allocationsMtd,
    overCommitment,
    advancePayments,
    advanceAllocations,
    recentCash,
    recentAllocations,
    posWithAdvance,
  ] = await dbSerial(
    () =>
      prisma.invoice.findMany({
        where: {
          paymentStatus: { not: PaymentStatus.PAID },
          ...invoiceScope,
        },
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          createdAt: true,
          payments: { select: { amount: true } },
          advanceAllocations: { select: { amount: true } },
          purchaseOrder: {
            select: {
              id: true,
              vendor: { select: { id: true, businessName: true } },
              advancePayments: {
                include: { allocations: { select: { amount: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
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
    () => prisma.invoice.count({ where: invoiceScope }),
    () =>
      prisma.pOAdvanceRequest.count({
        where: {
          status: POAdvanceRequestStatus.PENDING,
          purchaseOrder: poScope,
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
    () => countAdvanceOverCommitment(scopeWarehouseIds),
    () =>
      prisma.pOAdvancePayment.findMany({
        where: { purchaseOrder: poScope },
        orderBy: { paidAt: "desc" },
        take: 15,
        select: {
          id: true,
          poId: true,
          amount: true,
          paidAt: true,
          purchaseOrder: {
            select: { vendor: { select: { businessName: true } } },
          },
        },
      }),
    () =>
      prisma.pOAdvanceAllocation.findMany({
        where: { invoice: invoiceScope },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          invoice: {
            select: {
              poId: true,
              purchaseOrder: {
                select: { vendor: { select: { businessName: true } } },
              },
            },
          },
        },
      }),
    () =>
      prisma.payment.findMany({
        where: { amount: { not: null }, invoice: invoiceScope },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          amount: true,
          paidAt: true,
          createdAt: true,
          paidBy: { select: { name: true } },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              purchaseOrder: {
                select: { vendor: { select: { businessName: true } } },
              },
            },
          },
        },
      }),
    () =>
      prisma.pOAdvanceAllocation.findMany({
        where: { invoice: invoiceScope },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          advancePayment: {
            select: {
              paidBy: { select: { name: true } },
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              purchaseOrder: {
                select: { vendor: { select: { businessName: true } } },
              },
            },
          },
        },
      }),
    () =>
      prisma.purchaseOrder.findMany({
        where: {
          ...poScope,
          advancePayments: { some: {} },
        },
        select: {
          id: true,
          vendor: { select: { id: true, businessName: true } },
          advancePayments: {
            include: { allocations: { select: { amount: true } } },
          },
        },
        take: 200,
      }),
  );

  const paymentAgeing: PaymentAgeingRow[] = openInvoices.map((inv) => {
    const remaining = invoiceRemaining(inv.amount, inv.payments, inv.advanceAllocations);
    const ageDays = Math.floor((now - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendorName: inv.purchaseOrder.vendor.businessName,
      remaining,
      ageDays,
      bucket: ageingBucketForDays(ageDays),
      href: FINANCE_ROUTES.invoiceDetail(inv.id),
    };
  });

  const vendorMap = new Map<
    string,
    { vendorId: string; vendorName: string; openInvoiceValue: number; invoiceCount: number }
  >();
  for (const inv of openInvoices) {
    const remaining = invoiceRemaining(inv.amount, inv.payments, inv.advanceAllocations);
    const vendor = inv.purchaseOrder.vendor;
    const prev = vendorMap.get(vendor.id) ?? {
      vendorId: vendor.id,
      vendorName: vendor.businessName,
      openInvoiceValue: 0,
      invoiceCount: 0,
    };
    prev.openInvoiceValue += remaining;
    prev.invoiceCount += 1;
    vendorMap.set(vendor.id, prev);
  }

  const advanceUnallocatedByVendor = new Map<string, number>();
  for (const po of posWithAdvance) {
    const balances = computeAdvanceBalances(po.advancePayments);
    if (balances.advanceUnallocated <= 0) {
      continue;
    }
    const vendorId = po.vendor.id;
    advanceUnallocatedByVendor.set(
      vendorId,
      (advanceUnallocatedByVendor.get(vendorId) ?? 0) + balances.advanceUnallocated,
    );
  }

  const vendorExposure: VendorExposureRow[] = Array.from(vendorMap.values())
    .map((v) => ({
      ...v,
      advanceUnallocated: advanceUnallocatedByVendor.get(v.vendorId) ?? 0,
    }))
    .sort((a, b) => b.openInvoiceValue - a.openInvoiceValue)
    .slice(0, 10);

  const advanceLedger: AdvanceLedgerRow[] = [
    ...advancePayments.map((row) => ({
      id: row.id,
      kind: "payment" as const,
      poId: row.poId,
      vendorName: row.purchaseOrder.vendor.businessName,
      amount: row.amount.toString(),
      date: row.paidAt.toISOString(),
      href: FINANCE_ROUTES.advancePaymentDetail(row.id),
      detail: "Advance paid",
    })),
    ...advanceAllocations.map((row) => ({
      id: row.id,
      kind: "allocation" as const,
      poId: row.invoice.poId,
      vendorName: row.invoice.purchaseOrder.vendor.businessName,
      amount: row.amount.toString(),
      date: row.createdAt.toISOString(),
      href: FINANCE_ROUTES.allocationDetail(row.id),
      detail: "Allocated to invoice",
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  const recentSettlementActivity: RecentSettlementRow[] = [
    ...recentCash.map((row) => ({
      id: row.id,
      kind: "cash" as const,
      amount: row.amount!.toString(),
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      vendorName: row.invoice.purchaseOrder.vendor.businessName,
      date: cashPaymentDate(row).toISOString(),
      recordedByName: row.paidBy?.name ?? null,
      href: FINANCE_ROUTES.cashPaymentDetail(row.id),
    })),
    ...recentAllocations.map((row) => ({
      id: row.id,
      kind: "advance" as const,
      amount: row.amount.toString(),
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      vendorName: row.invoice.purchaseOrder.vendor.businessName,
      date: row.createdAt.toISOString(),
      recordedByName: row.advancePayment.paidBy?.name ?? null,
      href: FINANCE_ROUTES.allocationDetail(row.id),
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 12);

  const openInvoiceValue = paymentAgeing.reduce((sum, row) => sum + row.remaining, 0);
  const paidMtd =
    Number(cashPaidMtd._sum.amount ?? 0) + Number(allocationsMtd._sum.amount ?? 0);

  return {
    summary: {
      openInvoiceValue,
      paidMtd,
      pendingAdvances,
      matchRate: totalInvoices > 0 ? Math.round((matchedCount / totalInvoices) * 100) : 0,
      overCommitment,
    },
    paymentAgeing,
    vendorExposure,
    advanceLedger,
    recentSettlementActivity,
  };
}
