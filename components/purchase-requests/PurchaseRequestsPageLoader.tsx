import { Suspense } from "react";

import { PurchaseRequestsListClient } from "@/components/purchase-requests/PurchaseRequestsListClient";
import { PurchaseRequestsPageHeader } from "@/components/purchase-requests/PurchaseRequestsPageHeader";
import { PurchaseRequestsRowsLoader } from "@/components/purchase-requests/PurchaseRequestsRowsLoader";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { parsePurchaseRequestPageParams } from "@/lib/list-search-params";
import { getListFilterOptions } from "@/lib/queries/purchase-requests";
import type { SessionUser } from "@/lib/session";
import { timed } from "@/lib/server-timing";

type ParsedParams = ReturnType<typeof parsePurchaseRequestPageParams>;

export async function PurchaseRequestsPageLoader({
  user,
  parsed,
  dataKey,
}: {
  user: SessionUser;
  parsed: ParsedParams;
  dataKey: string;
}) {
  const filterOptions = await timed("PR.filterOptions", () => getListFilterOptions());

  return (
    <>
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
    </>
  );
}

function tableSkeletonColumns(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `col-${i}`,
    header: "",
    width: i === 0 ? "w-20" : "w-28",
  }));
}
