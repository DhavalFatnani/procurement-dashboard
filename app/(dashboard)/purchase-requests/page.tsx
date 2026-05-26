import { Suspense } from "react";

import { PurchaseRequestsListClient } from "@/components/purchase-requests/PurchaseRequestsListClient";
import { PurchaseRequestsPageHeader } from "@/components/purchase-requests/PurchaseRequestsPageHeader";
import { PurchaseRequestsRowsLoader } from "@/components/purchase-requests/PurchaseRequestsRowsLoader";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { parsePurchaseRequestPageParams } from "@/lib/list-search-params";
import { getFilterOptions } from "@/lib/queries/purchase-requests";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { timed } from "@/lib/server-timing";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseRequests]);
  const sp = await searchParams;

  const parsed = parsePurchaseRequestPageParams(sp);
  const filterOptions = await timed("PR.filterOptions", () => getFilterOptions());

  // Suspense key is narrowed to the params that actually affect the row query.
  // includeExactCount toggles row counting but should not re-suspend the page.
  const dataKey = [
    parsed.statuses.join(","),
    parsed.categoryId,
    parsed.subcategoryId,
    parsed.executionType,
    parsed.warehouseId,
    parsed.createdById,
    parsed.dateFrom,
    parsed.dateTo,
    parsed.page,
  ].join("|");

  return (
    <div className="space-y-6">
      <PurchaseRequestsPageHeader />
      <PurchaseRequestsListClient
        role={user.role}
        filterOptions={filterOptions}
        filters={{
          statuses: parsed.statuses,
          categoryId: parsed.categoryId,
          subcategoryId: parsed.subcategoryId,
          executionType: parsed.executionType,
          warehouseId: parsed.warehouseId,
          createdById: parsed.createdById,
          dateFrom: parsed.dateFrom,
          dateTo: parsed.dateTo,
        }}
      >
        <Suspense
          fallback={<TableSkeleton columns={tableSkeletonColumns(8)} rows={10} />}
          key={dataKey}
        >
          <PurchaseRequestsRowsLoader
            user={user}
            filters={{
              statuses: parsed.statuses,
              categoryId: parsed.categoryId,
              subcategoryId: parsed.subcategoryId,
              executionType: parsed.executionType,
              executionTypeParsed: parsed.executionTypeParsed,
              warehouseId: parsed.warehouseId,
              createdById: parsed.createdById,
              dateFrom: parsed.dateFrom,
              dateTo: parsed.dateTo,
              page: parsed.page,
              includeExactCount: parsed.includeExactCount,
            }}
          />
        </Suspense>
      </PurchaseRequestsListClient>
    </div>
  );
}

function tableSkeletonColumns(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `col-${i}`,
    header: "",
    width: i === 0 ? "w-20" : "w-28",
  }));
}
