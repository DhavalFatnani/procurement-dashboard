import { InvoiceMatchStatus, PaymentStatus, PRStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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

export async function getReports(): Promise<ReportsData> {
  const since = startOf(new Date());
  since.setDate(since.getDate() - DAYS + 1);

  const [prs, grnExceptions, unpaidInvoices, topVendorRows, monthMetrics] =
    await Promise.all([
      prisma.purchaseRequest.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.gRNException.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, resolutionStatus: true },
      }),
      prisma.invoice.findMany({
        where: { paymentStatus: { not: PaymentStatus.PAID } },
        select: {
          amount: true,
          createdAt: true,
          payments: { select: { amount: true } },
        },
      }),
      prisma.purchaseOrder.findMany({
        where: { status: { notIn: ["CLOSED", "FORCE_CLOSED", "PARTIALLY_CLOSED"] } },
        select: {
          id: true,
          unitPrice: true,
          orderedQty: true,
          lines: { select: { orderedQty: true, unitPrice: true } },
          vendor: { select: { id: true, businessName: true } },
        },
        take: 200,
      }),
      monthlyMetrics(),
    ]);

  // Build day-of-creation buckets
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

async function monthlyMetrics(): Promise<ReportsData["summary"]> {
  const startMonth = startOf(new Date());
  startMonth.setDate(1);

  const [prsThisMonth, matchedCount, totalInvoices, openInvoices] = await Promise.all([
    prisma.purchaseRequest.count({ where: { createdAt: { gte: startMonth } } }),
    prisma.invoice.count({
      where: {
        matchStatus: {
          in: [InvoiceMatchStatus.MATCHED, InvoiceMatchStatus.OVERRIDE_ACCEPTED],
        },
      },
    }),
    prisma.invoice.count(),
    prisma.invoice.findMany({
      where: { paymentStatus: { not: PaymentStatus.PAID } },
      select: { amount: true, payments: { select: { amount: true } } },
    }),
  ]);

  const openValue = openInvoices.reduce((sum, inv) => {
    const paid = inv.payments.reduce(
      (s, p) => s + (p.amount ? Number(p.amount) : 0),
      0,
    );
    return sum + Math.max(0, Number(inv.amount) - paid);
  }, 0);

  // Average PR → PO days for items converted in the last 30 days
  const avgRows = await prisma.purchaseOrder.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
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

// Re-export needed Prisma type for action callers
export type { PRStatus };
