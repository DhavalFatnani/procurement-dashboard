import { InvoiceMatchStatus, POStatus, Prisma, Role } from "@/lib/prisma-client";

import { dbParallel } from "@/lib/db-parallel";
import { dbSerial } from "@/lib/db-serial";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { cachedQuery } from "@/lib/list-cache";
import { prisma } from "@/lib/prisma";
import {
  goodsReceiptWhereFromScopeIds,
  invoiceWhereFromScopeIds,
  prWarehouseWhereFromScopeIds,
  purchaseOrderWhereFromScopeIds,
  warehouseIdFilter,
} from "@/lib/warehouse-scope";

export type POStageDistribution = {
  status: POStatus;
  label: string;
  count: number;
};

const POSTatusLabels: Record<POStatus, string> = {
  [POStatus.OPEN]: "Open",
  [POStatus.PARTIALLY_RECEIVED]: "Partial",
  [POStatus.FULLY_RECEIVED]: "Received",
  [POStatus.INVOICED]: "Invoiced",
  [POStatus.PAID]: "Paid",
  [POStatus.CLOSED]: "Closed",
  [POStatus.PARTIALLY_CLOSED]: "Partially closed",
  [POStatus.FORCE_CLOSED]: "Force closed",
};

const STAGE_ORDER: POStatus[] = [
  POStatus.OPEN,
  POStatus.PARTIALLY_RECEIVED,
  POStatus.FULLY_RECEIVED,
  POStatus.INVOICED,
  POStatus.PAID,
  POStatus.CLOSED,
];

export async function getPOStageDistribution(
  scopeWarehouseIds?: string[],
): Promise<POStageDistribution[]> {
  return cachedQuery(
    "dashboard:po-stage-distribution",
    [(scopeWarehouseIds === undefined ? "__global__" : scopeWarehouseIds.slice().sort().join(","))],
    async () => {
      const rows = await prisma.purchaseOrder.groupBy({
        by: ["status"],
        where: purchaseOrderWhereFromScopeIds(scopeWarehouseIds),
        _count: { _all: true },
      });
      const map = new Map<POStatus, number>();
      for (const row of rows) {
        map.set(row.status, row._count._all);
      }
      return STAGE_ORDER.map((status) => ({
        status,
        label: POSTatusLabels[status],
        count: map.get(status) ?? 0,
      }));
    },
    { revalidate: 30, tags: ["dashboard-metrics"] },
  );
}

export type RecentActivityItem = {
  id: string;
  kind: "pr" | "po" | "grn" | "invoice" | "payment";
  title: string;
  actor: string;
  timestamp: string;
  href: string;
};

export async function getRecentActivity(
  limit = 10,
  scopeWarehouseIds?: string[],
): Promise<RecentActivityItem[]> {
  return getRecentActivityForRole(null, limit, scopeWarehouseIds);
}

export async function getRecentActivityForRole(
  role: Role | null,
  limit = 10,
  scopeWarehouseIds?: string[],
): Promise<RecentActivityItem[]> {
  return cachedQuery(
    "dashboard:recent-activity",
    [(scopeWarehouseIds === undefined ? "__global__" : scopeWarehouseIds.slice().sort().join(",")), role ?? "all", String(limit)],
    () => computeRecentActivity(limit, role, scopeWarehouseIds),
    { revalidate: 30, tags: ["dashboard-metrics"] },
  );
}

const ACTIVITY_KINDS_BY_ROLE: Record<Role, RecentActivityItem["kind"][]> = {
  [Role.SM]: ["pr", "grn", "invoice", "po"],
  [Role.CENTRAL_TEAM]: ["pr", "po", "grn", "invoice", "payment"],
  [Role.OPS_HEAD]: ["pr", "po", "grn", "invoice", "payment"],
  [Role.FINANCE]: ["invoice", "payment"],
  [Role.ADMIN]: ["pr", "po", "grn", "invoice", "payment"],
};

async function computeRecentActivity(
  limit: number,
  role: Role | null = null,
  scopeWarehouseIds?: string[],
): Promise<RecentActivityItem[]> {
  const prWhere = prWarehouseWhereFromScopeIds(scopeWarehouseIds);
  const poWhere = purchaseOrderWhereFromScopeIds(scopeWarehouseIds);
  const grnWhere = goodsReceiptWhereFromScopeIds(scopeWarehouseIds);
  const invoiceWhere = invoiceWhereFromScopeIds(scopeWarehouseIds);

  const [prs, pos, grns, invoices, payments] = await dbSerial(
    () =>
      prisma.purchaseRequest.findMany({
        where: prWhere,
        select: {
          id: true,
          updatedAt: true,
          status: true,
          createdBy: { select: { name: true } },
          lines: {
            orderBy: { lineNumber: "asc" },
            select: { subcategory: { select: { name: true } } },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
    () =>
      prisma.purchaseOrder.findMany({
        where: poWhere,
        select: {
          id: true,
          updatedAt: true,
          status: true,
          vendor: { select: { businessName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
    () =>
      prisma.goodsReceipt.findMany({
        where: grnWhere,
        select: {
          id: true,
          receivedAt: true,
          poId: true,
          receivedBy: { select: { name: true } },
          purchaseOrder: { select: { vendor: { select: { businessName: true } } } },
        },
        orderBy: { receivedAt: "desc" },
        take: limit,
      }),
    () =>
      prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          id: true,
          updatedAt: true,
          invoiceNumber: true,
          poId: true,
          purchaseOrder: { select: { vendor: { select: { businessName: true } } } },
          uploadedBy: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
    () =>
      prisma.payment.findMany({
        where: {
          amount: { not: null },
          invoice: invoiceWhereFromScopeIds(scopeWarehouseIds),
        },
        select: {
          id: true,
          createdAt: true,
          amount: true,
          paidBy: { select: { name: true } },
          invoice: {
            select: {
              invoiceNumber: true,
              purchaseOrder: { select: { id: true, vendor: { select: { businessName: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
  );

  const items: RecentActivityItem[] = [
    ...prs.map((pr) => ({
      id: pr.id,
      kind: "pr" as const,
      title: `${pr.lines[0]?.subcategory.name ?? "PR"} — ${pr.status.replaceAll("_", " ")}`,
      actor: pr.createdBy.name,
      timestamp: pr.updatedAt.toISOString(),
      href: `/purchase-requests/${pr.id}`,
    })),
    ...pos.map((po) => ({
      id: po.id,
      kind: "po" as const,
      title: `${po.vendor.businessName} — ${po.status.replaceAll("_", " ")}`,
      actor: po.vendor.businessName,
      timestamp: po.updatedAt.toISOString(),
      href: `/purchase-orders/${po.id}`,
    })),
    ...grns.map((grn) => ({
      id: grn.id,
      kind: "grn" as const,
      title: `GRN — ${grn.purchaseOrder.vendor.businessName}`,
      actor: grn.receivedBy?.name ?? "System",
      timestamp: grn.receivedAt.toISOString(),
      href: `/purchase-orders/${grn.poId}?tab=fulfillment`,
    })),
    ...invoices.map((inv) => ({
      id: inv.id,
      kind: "invoice" as const,
      title: `Invoice ${inv.invoiceNumber} — ${inv.purchaseOrder.vendor.businessName}`,
      actor: inv.uploadedBy?.name ?? "System",
      timestamp: inv.updatedAt.toISOString(),
      href:
        role === Role.FINANCE
          ? FINANCE_ROUTES.invoiceDetail(inv.id)
          : `/purchase-orders/${inv.poId}?tab=invoices`,
    })),
    ...payments.map((p) => ({
      id: p.id,
      kind: "payment" as const,
      title: `Payment ₹${Number(p.amount ?? 0).toLocaleString("en-IN")} — invoice ${p.invoice.invoiceNumber}`,
      actor: p.paidBy?.name ?? "Finance",
      timestamp: p.createdAt.toISOString(),
      href:
        role === Role.FINANCE
          ? FINANCE_ROUTES.cashPaymentDetail(p.id)
          : `/purchase-orders/${p.invoice.purchaseOrder.id}?tab=financials`,
    })),
  ];

  const allowedKinds = role ? ACTIVITY_KINDS_BY_ROLE[role] : null;
  const filtered = allowedKinds
    ? items.filter((item) => allowedKinds.includes(item.kind))
    : items;

  return filtered
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

/**
 * 7-day sparkline of PR creation count for the given warehouse scope.
 */
export async function getPrCreationSparkline(
  scope: { warehouseIds: string[] },
  days = 7,
): Promise<{ day: string; count: number }[]> {
  return cachedQuery(
    "dashboard:pr-sparkline",
    [scope.warehouseIds.slice().sort().join(","), String(days)],
    () => computePrCreationSparkline(scope, days),
    { revalidate: 30, tags: ["dashboard-metrics"] },
  );
}

async function computePrCreationSparkline(
  scope: { warehouseIds: string[] },
  days: number,
): Promise<{ day: string; count: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);

  const warehouseFilter =
    scope.warehouseIds.length === 0
      ? Prisma.sql`AND false`
      : scope.warehouseIds.length === 1
        ? Prisma.sql`AND pr."warehouseId" = ${scope.warehouseIds[0]!}`
        : Prisma.sql`AND pr."warehouseId" IN (${Prisma.join(scope.warehouseIds)})`;

  const rows = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    WITH series AS (
      SELECT generate_series(${since}::date, CURRENT_DATE, INTERVAL '1 day')::date AS day
    )
    SELECT to_char(s.day, 'YYYY-MM-DD') as day, COUNT(pr.id)::bigint as count
    FROM series s
    LEFT JOIN "PurchaseRequest" pr
      ON pr."createdAt"::date = s.day
      ${warehouseFilter}
    GROUP BY s.day
    ORDER BY s.day ASC
  `;
  return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}

export type DashboardWorkQueueItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
};

export async function getDashboardWorkQueue(
  role: Role,
  scopeWarehouseIds?: string[],
): Promise<DashboardWorkQueueItem[]> {
  return cachedQuery(
    "dashboard:work-queue",
    [(scopeWarehouseIds === undefined ? "__global__" : scopeWarehouseIds.slice().sort().join(",")), role],
    () => computeDashboardWorkQueue(role, scopeWarehouseIds),
    { revalidate: 30, tags: ["dashboard-metrics"] },
  );
}

async function computeDashboardWorkQueue(
  role: Role,
  scopeWarehouseIds?: string[],
): Promise<DashboardWorkQueueItem[]> {
  const prWhere = prWarehouseWhereFromScopeIds(scopeWarehouseIds);
  const poWhere = purchaseOrderWhereFromScopeIds(scopeWarehouseIds);

  if (role === Role.FINANCE) {
    const invoices = await prisma.invoice.findMany({
      where: {
        paymentStatus: { not: "PAID" },
        ...invoiceWhereFromScopeIds(scopeWarehouseIds),
      },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        paymentStatus: true,
        purchaseOrder: {
          select: { vendor: { select: { businessName: true } } },
        },
      },
    });

    return invoices.map((inv) => ({
      id: inv.id,
      title: `Invoice ${inv.invoiceNumber}`,
      subtitle: inv.purchaseOrder.vendor.businessName,
      href: FINANCE_ROUTES.invoiceDetail(inv.id),
      badge: inv.paymentStatus.replaceAll("_", " "),
    }));
  }

  if (role === Role.CENTRAL_TEAM || role === Role.OPS_HEAD || role === Role.ADMIN) {
    const pendingPrBadge = role === Role.CENTRAL_TEAM ? "Review" : "Approve";
    const pendingPrSubtitle =
      role === Role.CENTRAL_TEAM
        ? "Vendor PR pending approval"
        : "Vendor PR awaiting your approval";
    const [pendingPrs, vendorRequests, awaitingPoPrs, grnExceptions, mismatchPos] =
      await dbParallel(
        () =>
          prisma.purchaseRequest.findMany({
            where: {
              ...prWhere,
              status: "PENDING_APPROVAL",
              executionType: "VENDOR_PURCHASE",
            },
            orderBy: { updatedAt: "asc" },
            take: 4,
            select: {
              id: true,
              vendor: { select: { businessName: true } },
              lines: {
                orderBy: { lineNumber: "asc" },
                take: 1,
                select: { subcategory: { select: { name: true } } },
              },
            },
          }),
        () =>
          prisma.vendorRequest.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "asc" },
            take: 3,
            select: { id: true, businessName: true },
          }),
        () =>
          prisma.purchaseRequest.findMany({
            where: {
              ...prWhere,
              status: "APPROVED",
              executionType: "VENDOR_PURCHASE",
              lines: { some: { items: { some: { poLineItem: null } } } },
            },
            orderBy: { updatedAt: "asc" },
            take: 3,
            select: {
              id: true,
              vendor: { select: { businessName: true } },
              lines: {
                orderBy: { lineNumber: "asc" },
                take: 1,
                select: { subcategory: { select: { name: true } } },
              },
            },
          }),
        () =>
          prisma.goodsReceipt.findMany({
            where: {
              ...goodsReceiptWhereFromScopeIds(scopeWarehouseIds),
              exceptions: { some: { resolutionStatus: null } },
            },
            orderBy: { receivedAt: "desc" },
            take: 3,
            select: {
              id: true,
              poId: true,
              purchaseOrder: { select: { vendor: { select: { businessName: true } } } },
              exceptions: {
                where: { resolutionStatus: null },
                select: { exceptionType: true },
              },
            },
          }),
        () =>
          prisma.purchaseOrder.findMany({
            where: {
              ...poWhere,
              invoices: {
                some: {
                  matchStatus: InvoiceMatchStatus.MISMATCH,
                  overrideReason: null,
                },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: 3,
            select: {
              id: true,
              vendor: { select: { businessName: true } },
            },
          }),
      );

    return [
      ...pendingPrs.map((pr) => ({
        id: pr.id,
        title: pr.vendor?.businessName ?? pr.lines[0]?.subcategory.name ?? pr.id,
        subtitle: pendingPrSubtitle,
        href: `/purchase-requests/${pr.id}`,
        badge: pendingPrBadge,
      })),
      ...vendorRequests.map((v) => ({
        id: v.id,
        title: v.businessName,
        subtitle: "New vendor awaiting activation",
        href: `/vendors?tab=pending&requestId=${v.id}`,
        badge: "Vendor",
      })),
      ...awaitingPoPrs.map((pr) => ({
        id: pr.id,
        title: pr.vendor?.businessName ?? pr.lines[0]?.subcategory.name ?? pr.id,
        subtitle: "Approved — configure purchase order",
        href: `/purchase-orders/configure/${pr.id}`,
        badge: "Configure PO",
      })),
      ...grnExceptions.map((grn) => ({
        id: grn.id,
        title: grn.purchaseOrder.vendor.businessName,
        subtitle: `${grn.exceptions.length} open GRN exception${grn.exceptions.length === 1 ? "" : "s"}`,
        href: `/purchase-orders/${grn.poId}?tab=fulfillment`,
        badge: "Resolve",
      })),
      ...mismatchPos.map((po) => ({
        id: po.id,
        title: po.vendor.businessName,
        subtitle: "Invoice mismatch needs override",
        href: `/purchase-orders/${po.id}?tab=invoices`,
        badge: "Override",
      })),
    ].slice(0, 8);
  }

  const [drafts, pending, posToReceive] = await dbParallel(
    () =>
      prisma.purchaseRequest.findMany({
        where: { ...prWhere, status: "DRAFT" },
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: {
          id: true,
          lines: {
            orderBy: { lineNumber: "asc" },
            take: 1,
            select: { subcategory: { select: { name: true } } },
          },
        },
      }),
    () =>
      prisma.purchaseRequest.findMany({
        where: { ...prWhere, status: "PENDING_APPROVAL" },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          vendor: { select: { businessName: true } },
          lines: {
            orderBy: { lineNumber: "asc" },
            take: 1,
            select: { subcategory: { select: { name: true } } },
          },
        },
      }),
    () =>
      prisma.purchaseOrder.findMany({
        where: {
          ...poWhere,
          status: { in: [POStatus.OPEN, POStatus.PARTIALLY_RECEIVED] },
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          status: true,
          vendor: { select: { businessName: true } },
        },
      }),
  );

  return [
    ...drafts.map((pr) => ({
      id: pr.id,
      title: pr.lines[0]?.subcategory.name ?? pr.id,
      subtitle: "Draft — finish and submit",
      href: `/purchase-requests/${pr.id}`,
      badge: "Draft",
    })),
    ...pending.map((pr) => ({
      id: pr.id,
      title: pr.vendor?.businessName ?? pr.lines[0]?.subcategory.name ?? pr.id,
      subtitle: "Waiting for Ops approval",
      href: `/purchase-requests/${pr.id}`,
      badge: "Pending",
    })),
    ...posToReceive.map((po) => ({
      id: po.id,
      title: po.vendor.businessName,
      subtitle: "Record goods receipt",
      href: `/goods-receipt/new?poId=${encodeURIComponent(po.id)}`,
      badge: "Receive",
    })),
  ].slice(0, 6);
}
