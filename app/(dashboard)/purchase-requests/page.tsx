import { Suspense } from "react";

import { PurchaseRequestsPageLoader } from "@/components/purchase-requests/PurchaseRequestsPageLoader";
import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { parsePurchaseRequestPageParams } from "@/lib/list-search-params";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseRequests]);
  const sp = await searchParams;

  const parsed = parsePurchaseRequestPageParams(sp);

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
      <Suspense fallback={<PageTableLoading columns={8} rows={10} />}>
        <PurchaseRequestsPageLoader user={user} parsed={parsed} dataKey={dataKey} />
      </Suspense>
    </div>
  );
}
