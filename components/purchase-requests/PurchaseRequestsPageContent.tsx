import { Suspense } from "react";

import type { PurchaseRequestsFiltersValue } from "@/components/purchase-requests/PurchaseRequestsFilters";
import { PurchaseRequestsFiltersLoader } from "@/components/purchase-requests/PurchaseRequestsFiltersLoader";
import { PurchaseRequestsListNav } from "@/components/purchase-requests/PurchaseRequestsListNav";
import { PurchaseRequestsPageHeader } from "@/components/purchase-requests/PurchaseRequestsPageHeader";
import { PurchaseRequestsRowsLoader } from "@/components/purchase-requests/PurchaseRequestsRowsLoader";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { parsePurchaseRequestPageParams } from "@/lib/list-search-params";
import type { SessionUser } from "@/lib/session";

type ParsedParams = ReturnType<typeof parsePurchaseRequestPageParams>;

function filtersFromParsed(parsed: ParsedParams): PurchaseRequestsFiltersValue {
  return {
    statuses: parsed.statuses,
    categoryId: parsed.categoryId,
    subcategoryId: parsed.subcategoryId,
    executionType: parsed.executionType,
    warehouseId: parsed.warehouseId,
    createdById: parsed.createdById,
    dateFrom: parsed.dateFrom,
    dateTo: parsed.dateTo,
  };
}

export function PurchaseRequestsPageContent({
  user,
  parsed,
  dataKey,
}: {
  user: SessionUser;
  parsed: ParsedParams;
  dataKey: string;
}) {
  const filters = filtersFromParsed(parsed);

  return (
    <>
      <PurchaseRequestsPageHeader />
      <PurchaseRequestsListNav>
        <Suspense fallback={<FiltersBarSkeleton />}>
          <PurchaseRequestsFiltersLoader role={user.role} filters={filters} />
        </Suspense>
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
      </PurchaseRequestsListNav>
    </>
  );
}

function FiltersBarSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-36" />
      </div>
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
