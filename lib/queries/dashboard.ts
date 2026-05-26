import { unstable_cache } from "next/cache";
import { Prisma, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

export type DashboardMetrics = {
  pendingApprovals: number;
  openPurchaseOrders: number;
  draftPurchaseRequests: number;
  pendingVendorRequests: number;
};

type MetricsRow = {
  pending_approvals: number;
  open_purchase_orders: number;
  draft_purchase_requests: number;
  pending_vendor_requests: number;
};

function warehouseFilterSql(warehouseIds: string[]) {
  if (warehouseIds.length === 0) {
    return Prisma.empty;
  }
  if (warehouseIds.length === 1) {
    return Prisma.sql`AND pr."warehouseId" = ${warehouseIds[0]!}`;
  }
  return Prisma.sql`AND pr."warehouseId" IN (${Prisma.join(warehouseIds)})`;
}

function poWarehouseFilterSql(warehouseIds: string[]) {
  if (warehouseIds.length === 0) {
    return Prisma.empty;
  }
  if (warehouseIds.length === 1) {
    return Prisma.sql`AND pr."warehouseId" = ${warehouseIds[0]!}`;
  }
  return Prisma.sql`AND pr."warehouseId" IN (${Prisma.join(warehouseIds)})`;
}

async function fetchDashboardMetrics(
  role: Role,
  warehouseIds: string[],
): Promise<DashboardMetrics> {
  const includeVendorPending = role === Role.OPS_HEAD;
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
      } AS pending_vendor_requests
  `;

  return {
    pendingApprovals: row?.pending_approvals ?? 0,
    openPurchaseOrders: row?.open_purchase_orders ?? 0,
    draftPurchaseRequests: row?.draft_purchase_requests ?? 0,
    pendingVendorRequests: row?.pending_vendor_requests ?? 0,
  };
}

const getCachedDashboardMetrics = (
  role: Role,
  userId: string,
  warehouseKey: string,
) =>
  unstable_cache(
    () => fetchDashboardMetrics(role, warehouseKey ? warehouseKey.split(",") : []),
    ["dashboard-metrics", role, userId, warehouseKey],
    { revalidate: 30, tags: ["dashboard-metrics"] },
  );

export async function getDashboardMetricsForSession(
  user: SessionUser,
): Promise<DashboardMetrics> {
  const warehouseIds = assignedWarehouseIds(user);
  return getCachedDashboardMetrics(user.role, user.id, warehouseIds.join(","))();
}
