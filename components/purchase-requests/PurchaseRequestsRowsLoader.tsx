import { ExecutionType, PRStatus } from "@prisma/client";

import { PurchaseRequestsTable } from "@/components/purchase-requests/PurchaseRequestsTable";
import { dbParallel } from "@/lib/db-parallel";
import { getPurchaseRequests } from "@/lib/queries/purchase-requests";
import { timed } from "@/lib/server-timing";
import type { SessionUser } from "@/lib/session";

/**
 * Server async loader for the Purchase Requests table. Lives inside the
 * Suspense boundary so the persistent filter UI above it never unmounts
 * during a navigation. Fetches rows (and any future parallel data) for the
 * current filter snapshot.
 */
export async function PurchaseRequestsRowsLoader({
  user,
  filters,
}: {
  user: SessionUser;
  filters: {
    statuses: PRStatus[];
    categoryId: string;
    subcategoryId: string;
    executionType: string;
    executionTypeParsed?: ExecutionType;
    warehouseId: string;
    createdById: string;
    dateFrom: string;
    dateTo: string;
    page: number;
    includeExactCount: boolean;
  };
}) {
  const [rows] = await dbParallel(() =>
    timed("PR.getPurchaseRequests", () =>
      getPurchaseRequests(user, {
        statuses: filters.statuses.length ? filters.statuses : undefined,
        categoryId: filters.categoryId || undefined,
        subcategoryId: filters.subcategoryId || undefined,
        executionType: filters.executionTypeParsed,
        warehouseId: filters.warehouseId || undefined,
        createdById: filters.createdById || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page: filters.page,
        includeExactCount: filters.includeExactCount,
      }),
    ),
  );

  return (
    <PurchaseRequestsTable
      role={user.role}
      rows={rows}
      filters={{
        categoryId: filters.categoryId,
        subcategoryId: filters.subcategoryId,
        executionType: filters.executionType,
        warehouseId: filters.warehouseId,
        createdById: filters.createdById,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }}
    />
  );
}
