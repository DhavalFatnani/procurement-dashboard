import { InvoiceMatchStatus, PaymentStatus, PRStatus } from "@/lib/prisma-enums";

import { dbSerial } from "@/lib/db-serial";
import { prisma } from "@/lib/prisma";
import {
  invoiceWhereFromScopeIds,
  purchaseOrderWhereFromScopeIds,
  warehouseIdFilter,
} from "@/lib/warehouse-scope";

export type CycleTimePoint = { day: string; count: number };
export type ExceptionPoint = { day: string; total: number; open: number };
export type PaymentAgePoint = { bucket: string; count: number };
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
  const since = startOf(new Date());
  since.setDate(since.getDate() - DAYS + 1);

  const invoiceScope = invoiceWhereFromScopeIds(scopeWarehouseIds);
  const poScope = purchaseOrderWhereFromScopeIds(scopeWarehouseIds);

  const [prs, grnExceptions, unpaidInvoices, topVendorRows, monthMetrics] =
    await dbSerial(
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

async function monthlyMetrics(
  scopeWarehouseIds: string[],
): Promise<ReportsData["summary"]> {
  const startMonth = startOf(new Date());
  startMonth.setDate(1);

  const invoiceScope = invoiceWhereFromScopeIds(scopeWarehouseIds);
  const poScope = purchaseOrderWhereFromScopeIds(scopeWarehouseIds);

  const [prsThisMonth, matchedCount, totalInvoices, openInvoices] = await dbSerial(
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
  };
}

export type { PRStatus };
