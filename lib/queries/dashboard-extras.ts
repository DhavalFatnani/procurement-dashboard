import { POStatus, Prisma } from "@/lib/prisma-client";

import { dbParallel } from "@/lib/db-parallel";
import { cachedQuery } from "@/lib/list-cache";
import { prisma } from "@/lib/prisma";
import {
  goodsReceiptWhereFromScopeIds,
  invoiceWhereFromScopeIds,
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
  scopeWarehouseIds: string[],
): Promise<POStageDistribution[]> {
  return cachedQuery(
    "dashboard:po-stage-distribution",
    [scopeWarehouseIds.slice().sort().join(",")],
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
  scopeWarehouseIds: string[],
  limit = 10,
): Promise<RecentActivityItem[]> {
  return cachedQuery(
    "dashboard:recent-activity",
    [scopeWarehouseIds.slice().sort().join(","), String(limit)],
    () => computeRecentActivity(scopeWarehouseIds, limit),
    { revalidate: 30, tags: ["dashboard-metrics"] },
  );
}

async function computeRecentActivity(
  scopeWarehouseIds: string[],
  limit: number,
): Promise<RecentActivityItem[]> {
  const prWhere = { warehouseId: warehouseIdFilter(scopeWarehouseIds) };
  const poWhere = purchaseOrderWhereFromScopeIds(scopeWarehouseIds);
  const grnWhere = goodsReceiptWhereFromScopeIds(scopeWarehouseIds);
  const invoiceWhere = invoiceWhereFromScopeIds(scopeWarehouseIds);

  const [prs, pos, grns, invoices, payments] = await dbParallel(
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
      href: `/purchase-orders/${grn.poId}?tab=grns`,
    })),
    ...invoices.map((inv) => ({
      id: inv.id,
      kind: "invoice" as const,
      title: `Invoice ${inv.invoiceNumber} — ${inv.purchaseOrder.vendor.businessName}`,
      actor: inv.uploadedBy?.name ?? "System",
      timestamp: inv.updatedAt.toISOString(),
      href: `/purchase-orders/${inv.poId}?tab=invoices`,
    })),
    ...payments.map((p) => ({
      id: p.id,
      kind: "payment" as const,
      title: `Payment ₹${Number(p.amount ?? 0).toLocaleString("en-IN")} — invoice ${p.invoice.invoiceNumber}`,
      actor: p.paidBy?.name ?? "Finance",
      timestamp: p.createdAt.toISOString(),
      href: `/purchase-orders/${p.invoice.purchaseOrder.id}?tab=payments`,
    })),
  ];

  return items
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
